// NowGoal match detail — one match, read off the publisher's own two pages:
//
//   detail   https://live.nowgoal50.com/detail/{id}
//   analysis https://live.nowgoal50.com/analysis/{id}
//
// The publisher prints both pages server-side and picks them apart with jQuery
// in the browser; this module reads the same markup on the server, with
// lib/html.ts standing in for that jQuery. Nothing here guesses an endpoint:
// the two pages *are* the source, and every value below is one a page prints.
//
//   detail page
//     `#fbheader`        both sides and their crests, the competition and its
//                        round, the score with its half splits, the state word
//     `_matchInfo`       the ids, the state field, the names the header prints
//     `startDate`        kick-off, with `doorTime` for the time of day and
//     `doorTime`/`place` `place` for the venue (the three the page also feeds
//                        Google's structured data with)
//     `#eventsTable`     every event, newest first, with its own running score
//                        and the players it names — the rows this reader turns
//                        around into match order, plus the `HT`/`FT` markers
//     `#ftstat`…`#otstat` the statistics plates (full time, both halves, extra
//                        time) with the publisher's own label between the two
//                        sides' values
//     `#lineupBox`       both formations with the starting eleven grouped by the
//                        line the page lays them out on, the bench behind them,
//                        each player with his number, his rating and his events
//     `youtubeLink`      the highlight the page hangs off that variable
//
//   analysis page
//     `battleData`, `lastMatchData`, `marketData` — the publisher's own inputs
//                        to its strength script: the head-to-head rows as it
//                        orients them, each side's last matches *with the numbers
//                        it counts off them* (goals, corners, cards, fouls,
//                        control, rating, shots on target) and the two market
//                        values. Its radar and its grades are computed in the
//                        browser from exactly these, so `readStrength` derives
//                        the same comparison from the same numbers rather than
//                        porting its chart code.
//     `survayData`       the "Who will win?" poll's two counts
//     `#table_v3`, `#table_v1`, `#table_v2` — the head-to-head list and each
//                        side's own recent matches, one row per meeting with
//                        both teams, the score, the corners and how the followed
//                        side fared. A row's `index` attribute is the
//                        publisher's own schedule id, so a meeting links to
//                        `/matches/{id}` inside this app.
//     "Fixture (3 Matches)" — each side's own next three matches
//     `#injuryH`, `#injuryG` — who is injured or suspended, by position
//
// Two habits of the host are inherited from lib/nowgoalLeague.ts: a page it does
// not have is answered with an HTML error page at HTTP 200, so the parse is the
// health check (a schedule id that does not exist lands there), and every stamp
// is GMT+8 wall clock, so `kickoffMs` reads it as such.

import { NOWGOAL_LIVE_ORIGIN } from './nowgoal';
import { kickoffMs } from './nowgoalLeague';
import { attr, childElements, decodeEntities, findElement, findElements, hasClass, textOf } from './html';
import type { HtmlElement, HtmlSelector } from './html';
import type {
  NowgoalMatchAbsence,
  NowgoalMatchAnalysis,
  NowgoalMatchDetail,
  NowgoalMatchEvent,
  NowgoalMatchFixTab,
  NowgoalMatchFixture,
  NowgoalMatchHeader,
  NowgoalMatchLastTab,
  NowgoalMatchLineup,
  NowgoalMatchLineupPlayer,
  NowgoalMatchLineupSide,
  NowgoalMatchMeeting,
  NowgoalMatchPeriod,
  NowgoalMatchSide,
  NowgoalMatchStatGroup,
  NowgoalMatchStatRow,
  NowgoalMatchStrengthRow,
  NowgoalMatchTab,
  NowgoalMatchView,
  NowgoalMatchVideo,
  NowgoalMatchVote,
  NowgoalViewOption,
} from './types';

/** A page the host has not answered by then is a bad day; the page says so. */
const FETCH_TIMEOUT_MS = 10_000;

/* ------------------------------------------------------------------------- *
 * Reading the pages' inline script. Both publish the match's identity as one
 * `_matchInfo` object literal plus a few loose variables, and the analysis page
 * publishes its tables' own arrays. They are read as text, never evaluated:
 * nothing here runs the publisher's JavaScript.
 * ------------------------------------------------------------------------- */

/** The page's own inline string variable (`var youtubeLink = '…'`). */
function inlineText(markup: string, name: string): string {
  const match = new RegExp(`(?:var\\s+)?${name}\\s*=\\s*(['"])([^'"]*)\\1`).exec(markup);
  return match ? match[2] : '';
}

/** The body of an object literal the page publishes (`var _matchInfo = {…}`),
 *  braces balanced. */
function objectLiteral(markup: string, name: string): string {
  const start = new RegExp(`(?:var\\s+)?${name}\\s*=\\s*\\{`).exec(markup);
  if (!start) return '';
  const from = start.index + start[0].length - 1;
  let depth = 0;
  for (let index = from; index < markup.length && index < from + 20_000; index += 1) {
    if (markup[index] === '{') depth += 1;
    else if (markup[index] === '}') {
      depth -= 1;
      if (depth === 0) return markup.slice(from + 1, index);
    }
  }
  return '';
}

/** One field of an inline object literal, with the shapes the pages use for
 *  them unwrapped: `parseInt('-1')`, `Boolean(false)`, `'Arsenal'`, `36`. */
function fieldValue(literal: string, key: string): string {
  const match = new RegExp(`(?:^|[,{\\s])${key}\\s*:\\s*([^,]*)`).exec(literal);
  if (!match) return '';
  return match[1]
    .replace(/^(?:parseInt|parseFloat|Boolean|Number)\s*\(\s*/, '')
    .replace(/\s*\)\s*$/, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

/** One of the page's own joined lists (`"43,11".split(",")`, `"1,6,1|0,1,0"`):
 *  the values it publishes for its strength script, its poll and its market
 *  split. Only a string the page then splits is read, so a variable that merely
 *  shares the name is not mistaken for one. */
function inlineList(markup: string, name: string, separator: string): string[] {
  const match = new RegExp(`(?:var\\s+)?${name}\\s*=\\s*"([^"]*)"`).exec(markup);
  if (!match) return [];
  const tail = markup.slice(match.index + match[0].length, match.index + match[0].length + 24);
  if (!/^\s*\.split\(/.test(tail)) return [];
  return match[1].split(separator);
}

/** A number the page prints, `0` when it prints something else. */
const toNumber = (value: string): number => {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** The publisher's own split of two values — `computePercent` of its strength
 *  script, which rounds to two decimals and then drops them, so two of three
 *  games is the 66% its own bar is drawn at and not the 67% a plain round
 *  gives. An even split of nothing, which is how it fills an empty plate. */
function sharePct(home: number, away: number): { homePct: number; awayPct: number } {
  const total = home + away;
  if (total <= 0) return { homePct: 50, awayPct: 50 };
  const homePct = Math.trunc(Number(((home / total) * 100).toFixed(2)));
  return { homePct, awayPct: 100 - homePct };
}

/** The crest the publisher's own `<img>` points at. Its pages write the CDN
 *  host protocol-relative (`//imgcms.…`), which is not a URL a browser will
 *  fetch off a plain href, so it is made absolute here. */
function absoluteImage(src: string): string {
  if (!src) return '';
  return src.startsWith('//') ? `https:${src}` : src;
}

/** The match's own page never changes once a match is over, but both pages are
 *  rewritten while it is in play — a goal, a substitution, a rating, the clock —
 *  and a match page is the one a visitor reloads while he watches it, so it is
 *  read more often than the slower files around it: a minute, against the five a
 *  club's own schedule is read at (lib/nowgoalTeam.ts). */
const MATCH_REVALIDATE = 60;
/** The host answers its own pages, not bare clients. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Where a match's own page lives. */
export const matchDetailPath = (id: string): string => `/detail/${id}`;
/** Where the page around the match lives. */
export const matchAnalysisPath = (id: string): string => `/analysis/${id}`;

/* ------------------------------------------------------------------------- *
 * The detail page (`/detail/{id}`) — the match itself: its header, its
 * timeline, its statistics, its team sheets and its highlight.
 * ------------------------------------------------------------------------- */

/** The statistics plates the page publishes, in the order its own buttons print
 *  them (`FT`, `1st Half`, `2nd Half`, `ET` of `#xq_techstatbtns`): button n
 *  shows plate n, so a plate is named by the button above it. A plate with no
 *  rows is dropped rather than shown empty — a match that went no further than
 *  ninety minutes has an `otstat` element with nothing in it. */
const STAT_PLATES: readonly string[] = ['ftstat', 'hf1stat', 'hf2stat', 'otstat'];

/** What each label the page prints beside its event icons means. The goals come
 *  first, since `Own Goal` and `Penalty` both read as goals; `Sub` covers the
 *  `Substitution` of the event list and the `Sub in`/`Sub out` of a team sheet. */
const EVENT_KINDS: readonly (readonly [RegExp, NowgoalMatchEvent['kind']])[] = [
  [/own goal/i, 'own-goal'],
  [/penalty/i, 'penalty'],
  [/goal/i, 'goal'],
  [/yellow/i, 'yellow'],
  [/red/i, 'red'],
  [/sub/i, 'substitution'],
  [/var/i, 'var'],
];

function eventKind(label: string): NowgoalMatchEvent['kind'] {
  return EVENT_KINDS.find(([pattern]) => pattern.test(label))?.[1] ?? 'other';
}

/** The number a page prints for a score, `null` where it prints none — a match
 *  that has not kicked off prints no score, which is not a nil. */
function scoreOf(text: string): number | null {
  const digits = /^\s*(\d+)\s*$/.exec(text);
  return digits ? Number(digits[1]) : null;
}

/** A score line the way the page prints it (`2-0`), `''` for anything else. */
function scoreLine(text: string): string {
  const match = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(text);
  return match ? `${match[1]}-${match[2]}` : '';
}

/** One side of the header: the block the page draws beside the score, the crest
 *  in it, and the id its own link carries (`…/team/summary/19`). */
function readSide(block: HtmlElement | null, fallback: { id: string; name: string }): NowgoalMatchSide {
  if (!block) return { id: fallback.id, name: fallback.name, crest: '' };
  const name = textOf(findElement(block.inner, { class: 'sclassName' })?.inner ?? '');
  return {
    id: /\/summary\/(\d+)/.exec(attr(block, 'data-url'))?.[1] ?? fallback.id,
    name: name || fallback.name,
    crest: absoluteImage(attr(findElement(block.inner, { tag: 'img' }), 'src')),
  };
}

/** The half-by-half splits the page prints under the score, each with the label
 *  its own `title` gives it (`Score 1st Half`, `2-0`). They are the spans the
 *  page titles, found by that attribute: the row it wraps them in is a span
 *  too, so a plain span lookup would answer with the row and not its contents. */
function readSplits(scoreRow: HtmlElement | null): NowgoalMatchHeader['splits'] {
  if (!scoreRow) return [];
  const splits: NowgoalMatchHeader['splits'] = [];
  for (const span of findElements(scoreRow.inner, { tag: 'span', attrs: { title: '*' } })) {
    const score = scoreLine(textOf(span.inner));
    if (score) splits.push({ label: attr(span, 'title'), score });
  }
  return splits;
}

/** The match's own header: what it is, who plays it, and where it stands. */
function readHeader(markup: string): NowgoalMatchHeader {
  const info = objectLiteral(markup, '_matchInfo');
  const head = findElement(markup, { id: 'fbheader' });
  const inside = head ? head.inner : markup;
  const scoreRow = findElement(inside, { id: 'mScore' });
  const scores = scoreRow ? findElements(scoreRow.inner, { class: 'score' }) : [];
  const label = findElement(inside, { class: 'sclassLink' });
  const round = label ? findElement(label.inner, { tag: 'b' }) : null;
  const state = textOf(findElement(scoreRow?.inner ?? '', { class: 'state' })?.inner ?? '');
  const start = inlineText(markup, 'startDate');
  const door = inlineText(markup, 'doorTime');
  return {
    competitionId:
      fieldValue(info, 'sclassId') || (/\/league\/(\d+)/.exec(attr(label, 'onclick'))?.[1] ?? ''),
    competition: fieldValue(info, 'lName'),
    // The page prints the round after the competition, behind its own `·`.
    round: round ? textOf(round.inner).replace(/^[\s·•|/–—-]+/, '') : '',
    // The two variables the page also feeds its structured data with: its own
    // date (GMT+8) and the time of day, so no stamp is re-read by hand.
    kickoffMs: start && door ? kickoffMs(`${start} ${door.slice(0, 5)}`) : null,
    venue: inlineText(markup, 'place'),
    home: readSide(findElement(inside, { class: 'home' }), {
      id: fieldValue(info, 'hId'),
      name: fieldValue(info, 'hName'),
    }),
    away: readSide(findElement(inside, { class: 'guest' }), {
      id: fieldValue(info, 'gId'),
      name: fieldValue(info, 'gName'),
    }),
    homeScore: scores.length > 1 ? scoreOf(textOf(scores[0].inner)) : null,
    awayScore: scores.length > 1 ? scoreOf(textOf(scores[scores.length - 1].inner)) : null,
    state,
    stateCode: toNumber(fieldValue(info, 'state')),
    // That same word is the clock while a match is in play (`63'`), so the
    // header shows whichever of the two the publisher is printing.
    minute: /\d+\s*['′]/.test(state) ? state : '',
    splits: readSplits(scoreRow),
  };
}

/** Whether a row's side cell is the one an event is filed in: the page leaves
 *  the other side's cell empty, so the side is the cell with the player in it. */
function hasPlayer(cell: HtmlElement | undefined): boolean {
  return Boolean(cell && (findElement(cell.inner, { tag: 'a' }) || findElement(cell.inner, { tag: 'img' })));
}

/** Where the page's own role markers sit in one event cell, in document order:
 *  the `Sub in`/`Sub out` icons, and the `(Assist: …)` label it wraps an
 *  assistant in. A link's role is the last marker written before it. */
function eventMarks(markup: string): { start: number; label: string }[] {
  const marks: { start: number; label: string }[] = [];
  const collect = (selector: HtmlSelector, label: (el: HtmlElement) => string): void => {
    let cursor = 0;
    for (const el of findElements(markup, selector)) {
      const start = markup.indexOf(el.outer, cursor);
      if (start < 0) continue;
      cursor = start;
      marks.push({ start, label: label(el) });
    }
  };
  collect({ tag: 'img', attrs: { alt: '*' } }, (el) => decodeEntities(attr(el, 'alt')));
  collect({ tag: 'span' }, (el) => (/^\(?\s*assist/i.test(textOf(el.inner)) ? 'assist' : ''));
  return marks.filter((mark) => mark.label).sort((a, b) => a.start - b.start);
}

/** Who one event row names, with the role the row itself gives each of them: a
 *  goal's first link is the player who scored it and the one inside its
 *  `(Assist: …)` label his assistant, a substitution's links are the player
 *  coming on and the one going off, and a card or any other row simply names
 *  the player it is filed against. */
function readEventPlayers(markup: string, kind: NowgoalMatchEvent['kind']): NowgoalMatchEvent['players'] {
  const marks = eventMarks(markup);
  const players: NowgoalMatchEvent['players'] = [];
  const scoring = kind === 'goal' || kind === 'own-goal' || kind === 'penalty';
  const fallback: NowgoalMatchEvent['players'][number]['role'] = scoring
    ? 'scorer'
    : kind === 'substitution'
      ? 'in'
      : 'player';
  let markIndex = 0;
  let cursor = 0;
  for (const link of findElements(markup, { tag: 'a' })) {
    const start = markup.indexOf(link.outer, cursor);
    if (start < 0) continue;
    cursor = start;
    let label = '';
    while (markIndex < marks.length && marks[markIndex].start < start) {
      label = marks[markIndex].label;
      markIndex += 1;
    }
    players.push({
      id: /\/player\/(\d+)/.exec(attr(link, 'href'))?.[1] ?? '',
      name: textOf(link.inner),
      role: /assist/i.test(label)
        ? 'assist'
        : /sub in/i.test(label)
          ? 'in'
          : /sub out/i.test(label)
            ? 'out'
            : fallback,
    });
  }
  return players;
}

/** The match's own timeline: the events, with the `HT`/`FT` markers the page
 *  prints between them (its own `stage-tit` rows). The page files both newest
 *  first and a timeline reads the other way, so both are turned around. */
function readTimeline(markup: string): { periods: NowgoalMatchPeriod[]; events: NowgoalMatchEvent[] } {
  const periods: NowgoalMatchPeriod[] = [];
  const events: NowgoalMatchEvent[] = [];
  const table = findElement(markup, { id: 'eventsTable' });
  if (!table) return { periods, events };
  for (const row of childElements(table.inner, { tag: 'tr' })) {
    if (hasClass(row, 'stage-tit')) {
      const [label, ...rest] = textOf(row.inner).split(' ');
      if (label) periods.push({ label, score: scoreLine(rest.join(' ')) });
      continue;
    }
    // The page's own header row carries the two team names and no minute, so a
    // row without five cells or without a minute is not an event.
    const cells = childElements(row.inner, { tag: 'td' });
    if (cells.length < 5) continue;
    const minute = decodeEntities(textOf(findElement(cells[2].inner, { tag: 'b' })?.inner ?? ''));
    if (!minute) continue;
    const label = decodeEntities(
      attr(findElement(row.inner, { class: 'icontips' }), 'txt') ||
        attr(findElement(row.inner, { tag: 'img' }), 'alt'),
    );
    if (!label) continue;
    const kind = eventKind(label);
    const side: NowgoalMatchEvent['side'] = hasPlayer(cells[0]) ? 'home' : 'away';
    const cell = side === 'home' ? cells[0] : cells[cells.length - 1];
    events.push({
      label,
      kind,
      minute,
      minuteValue: toNumber(minute),
      side,
      score: scoreLine(textOf(findElement(row.inner, { class: 'ky_score' })?.inner ?? '')),
      players: readEventPlayers(cell.inner, kind),
    });
  }
  periods.reverse();
  events.reverse();
  return { periods, events };
}

/** One row of a statistics plate: the two values with the label the page prints
 *  between them, and the second-half rows it labels `Corner Kicks(HT)`. */
function readStatRow(row: HtmlElement): NowgoalMatchStatRow {
  const values = childElements(row.inner, { class: 'stat-c' });
  return {
    label: textOf(findElement(row.inner, { class: 'stat-title' })?.inner ?? ''),
    home: textOf(values[0]?.inner ?? ''),
    away: textOf(values[values.length - 1]?.inner ?? ''),
  };
}

/** The statistics plates the page published, each under its own button. A match
 *  the publisher has no statistics for keeps none of them. */
function readStats(markup: string): NowgoalMatchStatGroup[] {
  const buttons = findElements(findElement(markup, { id: 'xq_techstatbtns' })?.inner ?? '', { tag: 'span' });
  const groups: NowgoalMatchStatGroup[] = [];
  STAT_PLATES.forEach((id, index) => {
    const plate = findElement(markup, { id });
    const rows = plate ? childElements(plate.inner, { tag: 'li' }).map(readStatRow) : [];
    if (rows.length) groups.push({ label: textOf(buttons[index]?.inner ?? ''), rows });
  });
  return groups;
}

/** One player off one of the page's own pitch boxes: his number, his name, and
 *  the rating and the events (`Assist`, `Sub out`, `Yellow Card`) it hangs off
 *  him, each with the clock the page prints beside it. */
function readLineupPlayer(play: HtmlElement): NowgoalMatchLineupPlayer {
  return {
    id: attr(play, 'techwinid'),
    number: textOf(findElement(play.inner, { class: 'number' })?.inner ?? ''),
    name: textOf(findElement(play.inner, { class: 'name' })?.inner ?? ''),
    rating: textOf(findElement(play.inner, { tag: 'i' })?.inner ?? ''),
    events: findElements(play.inner, { attrs: { alt: '*', time: '*' } }).map((icon) => ({
      label: decodeEntities(attr(icon, 'alt')),
      minute: decodeEntities(attr(icon, 'time')),
    })),
  };
}

/** The formation the page prints beside one side's own name (`4-2-3-1`). */
function readFormation(named: HtmlElement | null, side: string): string {
  const block = named ? findElement(named.inner, { class: side }) : null;
  return block ? textOf(findElement(block.inner, { tag: 'span' })?.inner ?? '') : '';
}

/** One side's team sheet: the eleven grouped the way the page lays them out on
 *  its own pitch (one `.playBox` per line, the goalkeeper first) and the bench
 *  behind them. */
function readLineupSide(
  pitch: HtmlElement | null,
  bench: HtmlElement | null,
  formation: string,
): NowgoalMatchLineupSide {
  const boxes = pitch ? childElements(pitch.inner, { class: 'playBox' }) : [];
  const groups = boxes.length ? boxes : pitch ? [pitch] : [];
  return {
    formation,
    lines: groups
      .map((box) => childElements(box.inner, { class: 'play' }).map(readLineupPlayer))
      .filter((line) => line.length > 0),
    bench: bench ? childElements(bench.inner, { class: 'play' }).map(readLineupPlayer) : [],
  };
}

/** Both team sheets: the pitch (`.plays`, one block per side), the bench behind
 *  it (`#backupPlay`, one block per side) and the formations the page prints in
 *  the header above them. A match whose team sheet is not published yet keeps
 *  empty groups rather than an empty plate. */
function readLineup(markup: string): NowgoalMatchLineup {
  const named = findElement(markup, { class: 'teamNames' });
  const pitch = findElement(markup, { class: 'plays' });
  const bench = findElement(markup, { id: 'backupPlay' });
  const side = (name: string, formation: string): NowgoalMatchLineupSide =>
    readLineupSide(
      pitch ? findElement(pitch.inner, { class: name }) : null,
      bench ? findElement(bench.inner, { class: name }) : null,
      readFormation(named, formation),
    );
  return { home: side('home', 'tn-home'), away: side('guest', 'tn-away') };
}

/** The highlight the page hangs off its own `youtubeLink` variable, `null` when
 *  it publishes none. The id is read out of whatever shape that link has — an
 *  embed, a watch link or a short one — so the embed this app renders carries
 *  none of the page's own tracking parameters. */
function readVideo(markup: string): NowgoalMatchVideo | null {
  const link = inlineText(markup, 'youtubeLink');
  const id = /(?:embed\/|watch\?v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(link)?.[1] ?? '';
  return id ? { id, embed: `https://www.youtube.com/embed/${id}` } : null;
}

/** Everything the match's own page publishes about it. */
export function readDetail(markup: string): NowgoalMatchDetail {
  const timeline = readTimeline(markup);
  return {
    header: readHeader(markup),
    periods: timeline.periods,
    events: timeline.events,
    stats: readStats(markup),
    lineup: readLineup(markup),
    video: readVideo(markup),
  };
}

/* ------------------------------------------------------------------------- *
 * The analysis page (`/analysis/{id}`) — what the publisher publishes around
 * the match: the strength comparison, its poll, the head-to-head list, each
 * side's form, their next fixtures and their absences.
 * ------------------------------------------------------------------------- */

/** One side's record, as the publisher's own strength script counts it: the
 *  games, the wins, draws and losses, the goals scored and conceded, and the
 *  points behind them (3 a win, 1 a draw — its `hScore`). */
interface MatchTally {
  games: number;
  win: number;
  draw: number;
  loss: number;
  goals: number;
  lost: number;
  points: number;
}

const newTally = (): MatchTally => ({
  games: 0,
  win: 0,
  draw: 0,
  loss: 0,
  goals: 0,
  lost: 0,
  points: 0,
});

/** Add one match to a tally, the way that script does. */
function charge(into: MatchTally, goals: number, lost: number): void {
  into.games += 1;
  into.goals += goals;
  into.lost += lost;
  if (goals > lost) {
    into.win += 1;
    into.points += 3;
  } else if (goals === lost) {
    into.draw += 1;
    into.points += 1;
  } else into.loss += 1;
}

/** Everything the strength script counts off one side's matches. Its own rows
 *  carry the columns in its own order — goals for and against, corners, cards,
 *  fouls, control, rating, shots on target for and against — and `same` holds
 *  the same numbers over the matches it files in this competition, which is the
 *  second line of each of its own bars. */
interface MatchSide {
  record: MatchTally;
  corner: number;
  yellow: number;
  fouls: number;
  control: number;
  targets: number;
  /** The matches that published shots on target at all, its `hTargetGame`. */
  targetGames: number;
  lostTargets: number;
  rating: number;
  /** The matches it rated, so a rating of nothing is not averaged in. */
  ratingGames: number;
  /** Its own above-6.00 rating total, which its rating bar is split on. */
  vsRating: number;
  same: MatchSide | null;
}

const newSide = (withSame: boolean): MatchSide => ({
  record: newTally(),
  corner: 0,
  yellow: 0,
  fouls: 0,
  control: 0,
  targets: 0,
  targetGames: 0,
  lostTargets: 0,
  rating: 0,
  ratingGames: 0,
  vsRating: 0,
  same: withSame ? newSide(false) : null,
});

/** One match line of `lastMatchData`, behind its own same-competition flag,
 *  charged into a side's totals — and into that side's same-competition totals
 *  when the flag is set, exactly as the script charges both. */
function chargeLine(into: MatchSide, line: string): void {
  const [flag, goals, lost, corners, yellow, fouls, control, rating, shots, shotsLost] =
    line.split(',').map(toNumber);
  const targets = into.same && flag ? [into, into.same] : [into];
  for (const side of targets) {
    charge(side.record, goals, lost);
    side.corner += corners;
    side.yellow += yellow;
    side.fouls += fouls;
    side.control += control;
    if (shots + shotsLost > 0) {
      side.targets += shots;
      side.lostTargets += shotsLost;
      side.targetGames += 1;
    }
    if (rating > 0) {
      side.rating += rating;
      side.ratingGames += 1;
      side.vsRating += Math.max(rating - 6, 0);
    }
  }
}

/** The two sides of a comparison together, or `null` when either has nothing to
 *  show — the publisher's own `show` gate above each of its bars. */
function bothSides(home: MatchSide | null, away: MatchSide | null): [MatchSide, MatchSide] | null {
  if (!home || !away || home.record.games < 1 || away.record.games < 1) return null;
  return [home, away];
}

/** The record the way the publisher's own `T_S_WDL` line prints it: `3-2-1`. */
const record = (side: MatchTally): string => `${side.win}-${side.draw}-${side.loss}`;

/** An average the way the script prints it (`1.7`, `0.50`), `''` for no games. */
const perGame = (total: number, games: number, digits = 1): string =>
  games > 0 ? (total / games).toFixed(digits) : '';

/** One row of the comparison, skipped when either side has nothing to show. */
type StrengthPush = (
  label: string,
  home: string,
  away: string,
  split: { homePct: number; awayPct: number },
) => void;

/** The head-to-head lines: one per meeting the page files, each its own
 *  `[same competition, home goals, away goals]` with the goals read from the
 *  followed side's point of view — this match's own home team. */
function readBattle(lines: string[], push: StrengthPush): void {
  const home = newSide(true);
  const away = newSide(true);
  for (const line of lines) {
    const [flag, goals, lost] = line.split(',').map(toNumber);
    charge(home.record, goals, lost);
    charge(away.record, lost, goals);
    if (flag && home.same && away.same) {
      charge(home.same.record, goals, lost);
      charge(away.same.record, lost, goals);
    }
  }
  const games = home.record.games;
  if (games && home.record.points + away.record.points > 0) {
    push(
      'Head-to-head record',
      record(home.record),
      record(away.record),
      sharePct(home.record.points, away.record.points),
    );
  }
  if (home.record.goals + away.record.goals > 0) {
    push(
      'Head-to-head goals per game',
      perGame(home.record.goals, games),
      perGame(away.record.goals, games),
      sharePct(home.record.goals, away.record.goals),
    );
  }
  const same = bothSides(home.same, away.same);
  if (same && same[0].record.points + same[1].record.points > 0) {
    push(
      'Head-to-head record, same competition',
      record(same[0].record),
      record(same[1].record),
      sharePct(same[0].record.points, same[1].record.points),
    );
  }
  if (same && same[0].record.goals + same[1].record.goals > 0) {
    push(
      'Head-to-head goals per game, same competition',
      perGame(same[0].record.goals, same[0].record.games),
      perGame(same[1].record.goals, same[1].record.games),
      sharePct(same[0].record.goals, same[1].record.goals),
    );
  }
}

/** Each side's own last matches: one line per round, `thisSide#theOtherSide`,
 *  carrying the columns the strength script counts. A round it publishes only
 *  one side of is charged to that side alone. */
function readForm(lines: string[], push: StrengthPush): void {
  const home = newSide(true);
  const away = newSide(true);
  for (const line of lines) {
    const [homeLine, awayLine] = line.split('#');
    if (homeLine) chargeLine(home, homeLine);
    if (awayLine) chargeLine(away, awayLine);
  }
  const rounds = lines.length;
  const both = bothSides(home, away);
  if (!both) return;
  const same = bothSides(home.same, away.same);
  push(
    `Last ${rounds} matches`,
    record(home.record),
    record(away.record),
    sharePct(home.record.points, away.record.points),
  );
  if (same) {
    push(
      `Last ${rounds} matches, same competition`,
      record(same[0].record),
      record(same[1].record),
      sharePct(same[0].record.points, same[1].record.points),
    );
  }
  // Its own two `T_Get` bars: what each side scores and what its opponents do.
  push(
    'Goals per game',
    perGame(home.record.goals, rounds),
    perGame(away.record.goals, rounds),
    sharePct(home.record.goals, away.record.goals),
  );
  if (home.record.lost + away.record.lost > 0) {
    push(
      'Goals conceded per game',
      perGame(home.record.lost, rounds),
      perGame(away.record.lost, rounds),
      sharePct(home.record.lost, away.record.lost),
    );
  }
  if (home.targetGames && away.targetGames) {
    push(
      'Shots on target per game',
      perGame(home.targets, home.targetGames, 2),
      perGame(away.targets, away.targetGames, 2),
      sharePct(home.targets, away.targets),
    );
    if (home.lostTargets + away.lostTargets > 0) {
      push(
        'Shots on target conceded per game',
        perGame(home.lostTargets, home.targetGames, 2),
        perGame(away.lostTargets, away.targetGames, 2),
        sharePct(home.lostTargets, away.lostTargets),
      );
    }
  }
  if (same) {
    push(
      'Goals per game, same competition',
      perGame(same[0].record.goals, same[0].record.games),
      perGame(same[1].record.goals, same[1].record.games),
      sharePct(same[0].record.goals, same[1].record.goals),
    );
  }
  // Its own rating bar: the average of the matches it rated, split the way its
  // own script splits it (each rating above 6.00, the publisher's own floor).
  if (home.ratingGames && away.ratingGames) {
    push(
      'Team rating',
      perGame(home.rating, home.ratingGames, 2),
      perGame(away.rating, away.ratingGames, 2),
      sharePct(home.vsRating, away.vsRating),
    );
    if (same && same[0].ratingGames && same[1].ratingGames) {
      push(
        'Team rating, same competition',
        perGame(same[0].rating, same[0].ratingGames, 2),
        perGame(same[1].rating, same[1].ratingGames, 2),
        sharePct(same[0].vsRating, same[1].vsRating),
      );
    }
  }
  // Its own `T_Strength_Other` bars, each shown only where both sides have it.
  if (home.corner && away.corner) {
    push(
      'Corners per game',
      perGame(home.corner, rounds),
      perGame(away.corner, rounds),
      sharePct(home.corner, away.corner),
    );
  }
  if (home.yellow && away.yellow) {
    push(
      'Yellow cards per game',
      perGame(home.yellow, rounds),
      perGame(away.yellow, rounds),
      sharePct(home.yellow, away.yellow),
    );
  }
  if (home.fouls && away.fouls) {
    push(
      'Fouls per game',
      perGame(home.fouls, rounds),
      perGame(away.fouls, rounds),
      sharePct(home.fouls, away.fouls),
    );
  }
  if (home.control && away.control) {
    push(
      'Possession',
      `${perGame(home.control, rounds)}%`,
      `${perGame(away.control, rounds)}%`,
      sharePct(home.control, away.control),
    );
  }
}

/** The strength comparison the analysis page publishes: the two sides' head-to-
 *  head record and their recent form, derived from the same three arrays its
 *  own strength script reads (`battleData`, `lastMatchData`, `marketData`), with
 *  the same arithmetic — its per-game averages, its whole-number share and its
 *  own market split. Its radar, its grades and its chart are not ported; the
 *  numbers the radar is drawn from are what this plate shows. */
function readStrength(markup: string): NowgoalMatchStrengthRow[] {
  const rows: NowgoalMatchStrengthRow[] = [];
  const push: StrengthPush = (label, home, away, split) => {
    if (!home || !away) return;
    rows.push({ label, home, away, homePct: split.homePct, awayPct: split.awayPct });
  };
  readBattle(inlineList(markup, 'battleData', '|'), push);
  readForm(inlineList(markup, 'lastMatchData', '|'), push);
  // The two squad values, in £ millions — the unit the page's own bar prints.
  const market = inlineList(markup, 'marketData', ',').map(toNumber);
  push(
    'Market value',
    market[0] > 0 ? `£${market[0]}m` : '',
    market[1] > 0 ? `£${market[1]}m` : '',
    sharePct(market[0], market[1]),
  );
  return rows;
}

/** The page's own "Who will win?" poll: how many of its readers picked either
 *  side, with the publisher's own split of the two. */
function readVote(markup: string): NowgoalMatchVote | null {
  const counts = inlineList(markup, 'survayData', ',').map(toNumber);
  const home = counts[0] ?? 0;
  const away = counts[1] ?? 0;
  const total = home + away;
  return total > 0 ? { home, away, total, ...sharePct(home, away) } : null;
}

/** The team id behind one of the page's own team links (`soccerDbPage.team(19)`). */
const teamIdOf = (markup: string): string => /team\((\d+)\)/.exec(markup)?.[1] ?? '';

/** One row of one of the page's own match tables. Every such row carries the
 *  publisher's schedule id (`index`), the competition with its full name in the
 *  cell's own `title`, a `timeData` stamp, both sides, the score with its half,
 *  the corners with their half, and how the followed side fared (`W`/`D`/`L`). */
function readMeetingRow(row: HtmlElement): NowgoalMatchMeeting | null {
  const cells = childElements(row.inner, { tag: 'td' });
  if (cells.length < 6) return null;
  const text = (cell: HtmlElement): string => textOf(cell.inner);
  const dash = (value: string): string => value.replace(/\s*-\s*/, '-');
  const stamp = attr(findElement(row.inner, { attrs: { name: 'timeData' } }), 'data-t');
  const score = /^(\d+\s*-\s*\d+)/.exec(text(cells[3]));
  const half = /\((\d+\s*-\s*\d+)\)/.exec(text(cells[3]));
  const corner = /^(\d+\s*-\s*\d+)/.exec(text(cells[5]));
  const halfCorner = /\((\d+\s*-\s*\d+)\)/.exec(text(cells[5]));
  const result = cells.map(text).find((value) => /^(W|D|L)$/.test(value)) ?? '';
  return {
    matchId: attr(row, 'index'),
    competition: text(cells[0]),
    competitionName: attr(cells[0], 'title'),
    kickoffMs: stamp ? kickoffMs(stamp) : null,
    date: stamp,
    home: { id: teamIdOf(cells[2].inner), name: text(cells[2]) },
    away: { id: teamIdOf(cells[4].inner), name: text(cells[4]) },
    score: score ? dash(score[1]) : '',
    halfScore: half ? dash(half[1]) : '',
    corner: corner ? dash(corner[1]) : '',
    halfCorner: halfCorner ? dash(halfCorner[1]) : '',
    result: result === 'W' || result === 'D' || result === 'L' ? result : '',
  };
}

/** One of the page's own match tables — `#table_v3` for the head-to-head list,
 *  `#table_v1`/`#table_v2` for the home and away side's own matches, most
 *  recent first. Rows without the publisher's own `index` belong to the table's
 *  header and its own bars, so they are not meetings. */
function readMeetings(markup: string, id: string): NowgoalMatchMeeting[] {
  const table = findElement(markup, { id });
  if (!table) return [];
  const meetings: NowgoalMatchMeeting[] = [];
  for (const row of findElements(table.inner, { tag: 'tr', attrs: { index: '*' } })) {
    const meeting = readMeetingRow(row);
    if (meeting) meetings.push(meeting);
  }
  return meetings;
}

/** The page's own "Fixture (3 Matches)" plate, one side at a time: each row the
 *  competition, its own date stamp, where that side plays it, the opponent and
 *  the countdown the page prints behind it. */
function readFixtures(markup: string, side: string): NowgoalMatchFixture[] {
  const plate = findElement(markup, { id: 'porletP12' });
  const block = plate ? findElement(plate.inner, { class: side }) : null;
  if (!block) return [];
  const fixtures: NowgoalMatchFixture[] = [];
  for (const row of findElements(block.inner, { tag: 'tr' })) {
    const cells = childElements(row.inner, { tag: 'td' });
    // The plate's own header row carries `<th>`s instead and is skipped.
    if (cells.length < 5) continue;
    const stamp = attr(findElement(row.inner, { attrs: { name: 'timeData' } }), 'data-t');
    fixtures.push({
      competition: textOf(cells[0].inner),
      competitionName: attr(cells[0], 'title'),
      kickoffMs: stamp ? kickoffMs(stamp) : null,
      date: stamp,
      venue: textOf(cells[2].inner),
      opponent: textOf(cells[3].inner),
      countdown: textOf(cells[4].inner),
    });
  }
  return fixtures;
}

/** One side's absences (`#injuryH`, `#injuryG`): the players the page files
 *  under each of its own headings, which is its own word for what is wrong with
 *  them (`Injury`, and a suspension heading where it publishes one). The heading
 *  is the block above the list that carries no players. */
function readAbsences(markup: string, id: string): NowgoalMatchAbsence[] {
  const box = findElement(markup, { id });
  if (!box) return [];
  const absences: NowgoalMatchAbsence[] = [];
  let kind = '';
  for (const block of childElements(box.inner, {})) {
    const rows = findElements(block.inner, { class: 'player-row' });
    if (!rows.length) {
      const heading = textOf(block.inner);
      if (heading) kind = heading;
      continue;
    }
    for (const row of rows) {
      absences.push({
        kind,
        position: textOf(findElement(row.inner, { tag: 'b' })?.inner ?? ''),
        number: textOf(findElement(row.inner, { tag: 'span' })?.inner ?? ''),
        id: attr(row, 'playerid'),
        name: textOf(findElement(row.inner, { tag: 'a' })?.inner ?? ''),
      });
    }
  }
  return absences;
}

/** Everything the publisher publishes around the match. */
export function readAnalysis(markup: string): NowgoalMatchAnalysis {
  return {
    strength: readStrength(markup),
    vote: readVote(markup),
    meetings: readMeetings(markup, 'table_v3'),
    homeForm: readMeetings(markup, 'table_v1'),
    awayForm: readMeetings(markup, 'table_v2'),
    homeFixtures: readFixtures(markup, 'home-div'),
    awayFixtures: readFixtures(markup, 'guest-div'),
    homeAbsences: readAbsences(markup, 'injuryH'),
    awayAbsences: readAbsences(markup, 'injuryG'),
  };
}

/* ------------------------------------------------------------------------- *
 * Reading both pages off the host, and the view one request resolves to.
 * ------------------------------------------------------------------------- */

/** What the host answered for one page. A schedule id it does not have is
 *  answered with a 404 and its own error page; a page it has but does not answer
 *  is nothing at all (a timeout, a bad gateway), which says nothing about
 *  whether the match exists. */
type PageAnswer = { status: 'ok'; html: string } | { status: 'missing' | 'unavailable' };

async function fetchPage(path: string): Promise<PageAnswer> {
  try {
    const res = await fetch(`${NOWGOAL_LIVE_ORIGIN}${path}`, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        // The host answers its own pages to the site's own visitors.
        referer: `${NOWGOAL_LIVE_ORIGIN}/`,
      },
      next: { revalidate: MATCH_REVALIDATE },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) return { status: 'unavailable' };
    const html = await res.text();
    // The host also answers some of the pages it does not have with a 200 and
    // its own error page, so the parse is the health check as well.
    return html.includes('_matchInfo') ? { status: 'ok', html } : { status: 'missing' };
  } catch {
    return { status: 'unavailable' };
  }
}

/** What one read resolved to: the page's own data, `missing` for a match the
 *  publisher does not publish (a real 404), or `unavailable` for a host that did
 *  not answer — which says nothing about whether the match exists, so it must
 *  not be answered with a page-not-found. */
export type NowgoalMatchRead<T> =
  | { status: 'ok'; value: T }
  | { status: 'missing' | 'unavailable' };

/** The match's own page, read once per revalidation window. */
export async function getMatchDetail(id: string): Promise<NowgoalMatchRead<NowgoalMatchDetail>> {
  const page = await fetchPage(matchDetailPath(id));
  if (page.status !== 'ok') return page;
  const detail = readDetail(page.html);
  // A page that names neither side is the host's own error page, not a match.
  return detail.header.home.id || detail.header.away.id
    ? { status: 'ok', value: detail }
    : { status: 'missing' };
}

/** The page around the match, read once per revalidation window. */
export async function getMatchAnalysis(id: string): Promise<NowgoalMatchRead<NowgoalMatchAnalysis>> {
  const page = await fetchPage(matchAnalysisPath(id));
  if (page.status !== 'ok') return page;
  return { status: 'ok', value: readAnalysis(page.html) };
}

/** The tabs a match has data for, in the order it has them. The analysis page is
 *  part of every published match, so the head-to-head tab is always there; the
 *  timeline and the team sheets are there only once the publisher has published
 *  them, which is what decides whether a match that has not kicked off leads
 *  with its team sheet or with the little that is published about it. */
function matchTabs(detail: NowgoalMatchDetail): NowgoalViewOption[] {
  const tabs: NowgoalViewOption[] = [];
  if (detail.events.length || detail.stats.length) tabs.push({ key: 'detail', label: 'Detail' });
  else if (!detail.lineup.home.lines.length && !detail.lineup.away.lines.length) {
    // A match with neither a timeline nor a team sheet opens on the analysis:
    // the tab list has to lead with one, since it is the page's own default.
    tabs.push({ key: 'h2h', label: 'H2H' });
    return tabs;
  }
  if (detail.lineup.home.lines.length || detail.lineup.away.lines.length) {
    tabs.push({ key: 'lineup', label: 'Line Up' });
  }
  tabs.push({ key: 'h2h', label: 'H2H' });
  return tabs;
}

/** The lists each two-sided plate offers, in the order its own buttons print
 *  them: the last-matches plate (`Home`, `H2H`, `Away`) and the fixtures plate. */
const LAST_TABS: readonly NowgoalMatchLastTab[] = ['home', 'h2h', 'away'];
const FIX_TABS: readonly NowgoalMatchFixTab[] = ['home', 'away'];

/** What one request asked for, already reduced to single values. */
export interface NowgoalMatchQuery {
  tab: string;
  last: string;
  fix: string;
}

/** One plate's counts, in the order its buttons print them. */
function countsOf(keys: readonly string[], counts: Record<string, number>): Record<string, number> {
  const ordered: Record<string, number> = {};
  for (const key of keys) ordered[key] = counts[key] ?? 0;
  return ordered;
}

/** The list a plate was asked for, falling back to the first one that has rows
 *  — a stale link then lands on something real rather than an empty plate — and
 *  to `fallback` when none of them has any. */
function pickList(counts: Record<string, number>, wanted: string, fallback: string): string {
  if (counts[wanted] > 0) return wanted;
  return Object.keys(counts).find((key) => counts[key] > 0) ?? fallback;
}

/** Everything `/matches/[id]` needs for one request: the match, the tabs it has
 *  data for, and the rows of the tab and of the plates the query asked for. The
 *  analysis page is read only for the head-to-head tab, so a visitor on the
 *  timeline never waits for it. */
export async function getMatchView(
  id: string,
  query: NowgoalMatchQuery,
): Promise<NowgoalMatchRead<NowgoalMatchView>> {
  const read = await getMatchDetail(id);
  if (read.status !== 'ok') return read;
  const detail = read.value;
  const tabs = matchTabs(detail);
  // The list leads with the tab a match of this state opens on, so the page's
  // default is simply the first of them and the client can leave it out of a
  // link (see components/MatchDetail.tsx).
  const fallback = tabs[0].key;
  const tab = (tabs.some((option) => option.key === query.tab) ? query.tab : fallback) as NowgoalMatchTab;
  const analysisRead = tab === 'h2h' ? await getMatchAnalysis(id) : null;
  // The tab that was asked for is the one that has to answer: a head-to-head
  // page whose analysis page did not come back is a retry, not an empty plate.
  if (analysisRead && analysisRead.status !== 'ok') return analysisRead;
  const analysis: NowgoalMatchAnalysis =
    analysisRead && analysisRead.status === 'ok'
      ? analysisRead.value
      : {
          strength: [],
          vote: null,
          meetings: [],
          homeForm: [],
          awayForm: [],
          homeFixtures: [],
          awayFixtures: [],
          homeAbsences: [],
          awayAbsences: [],
        };
  const lastCounts = countsOf(LAST_TABS, {
    home: analysis.homeForm.length,
    h2h: analysis.meetings.length,
    away: analysis.awayForm.length,
  });
  const fixCounts = countsOf(FIX_TABS, {
    home: analysis.homeFixtures.length,
    away: analysis.awayFixtures.length,
  });
  const last = pickList(lastCounts, query.last || LAST_TABS[1], LAST_TABS[1]) as NowgoalMatchLastTab;
  const fix = pickList(fixCounts, query.fix || FIX_TABS[0], FIX_TABS[0]) as NowgoalMatchFixTab;
  return {
    status: 'ok',
    value: {
      header: detail.header,
      tabs,
      tab,
      periods: detail.periods,
      events: detail.events,
      stats: detail.stats,
      video: detail.video,
      lineup: detail.lineup,
      homeAbsences: analysis.homeAbsences,
      awayAbsences: analysis.awayAbsences,
      strength: analysis.strength,
      vote: analysis.vote,
      last,
      meetings:
        last === 'home' ? analysis.homeForm : last === 'away' ? analysis.awayForm : analysis.meetings,
      lastCounts: lastCounts as Record<NowgoalMatchLastTab, number>,
      fix,
      fixtures: fix === 'away' ? analysis.awayFixtures : analysis.homeFixtures,
      fixCounts: fixCounts as Record<NowgoalMatchFixTab, number>,
    },
  };
}










