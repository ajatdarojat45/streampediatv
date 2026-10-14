/**
 * The Goaloo match centre — the second publisher's half of `/watch/{id}`.
 *
 * The two publishers describe the same fixture and each owns one half of it.
 * Rblink owns the stream: which channels exist, what the player plays, when the
 * match kicks off. Goaloo owns the match itself, on its own live host:
 *
 *   https://live10.goaloo28.com/football/<slug>/live-<scheduleId>
 *
 * and that page is far richer than anything Rblink publishes — the score and the
 * half scores, both team sheets with each player's rating and the minute he came
 * on or went off, the event list, thirty-odd technical statistics for each of the
 * four periods (FT / 1st half / 2nd half / extra time), the two clubs' recent
 * form, where their goals land inside the ninety minutes, their HT/FT record, and
 * a minute-by-minute text feed.
 *
 * None of that arrives as JSON. The page is server-rendered HTML — every panel is
 * a `ul.stat`, a `table#eventsTable`, a `#matchBox` sheet or one of the two
 * statistics tables — so this module reads the markup, exactly as the publisher's
 * own bundle does, and every read is guarded: a panel the page has not published
 * (an upcoming fixture has no events, an unplayed match no statistics) comes back
 * as an empty list rather than as a fabricated row, and a page that cannot be
 * fetched at all comes back as `null` and the panel simply is not drawn. The text
 * feed IS JSON (`/ajax/gettextlivedetail?scheduleId=`), and is read through the
 * same guard.
 *
 * Nothing here knows how Goaloo spells a competition or a club: the slug in the
 * path is decorative, and the host answers `.../football/x/live-<id>` with the
 * same page (verified against a finished, an upcoming and a live fixture). The
 * only key needed is the schedule id, which is the same id the competition feed
 * publishes (lib/goaloo.ts) — that is the whole join (lib/goalooLiveJoin.ts).
 *
 * The club and player ids the page prints are Goaloo's (`team/summary/109`,
 * `team/player/142766`), i.e. the very ids `/club/{id}` and `/player/{id}` are
 * addressed by, so a sheet row links straight into this app's own pages.
 */
import type {
  GoalooLiveBucket,
  GoalooLiveEvent,
  GoalooLiveFormRow,
  GoalooLiveHtFt,
  GoalooLiveMatch,
  GoalooLivePeriod,
  GoalooLivePlayer,
  GoalooLiveSide,
  GoalooLiveStatRow,
  GoalooLiveTeam,
  GoalooLiveTextRow,
} from './types';

/** Host the match pages are served from. Overridable, like the feed origin. */
export const GOALOO_LIVE_ORIGIN =
  process.env.NEXT_PUBLIC_GOALOO_LIVE_ORIGIN || 'https://live10.goaloo28.com';

/** The page only answers a browser-shaped request; the publisher's own host
 *  check is what the `referer` satisfies. */
const LIVE_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
  referer: `${GOALOO_LIVE_ORIGIN}/`,
} as const;

/** The match page for one schedule id. The slug segment is decorative — see the
 *  module header. */
export function goalooLiveMatchUrl(scheduleId: number | string): string {
  return `${GOALOO_LIVE_ORIGIN}/football/match/live-${Number(scheduleId) || 0}`;
}

/** The whole text feed for one schedule id, as one JSON document. */
export function goalooLiveTextUrl(scheduleId: number | string): string {
  return `${GOALOO_LIVE_ORIGIN}/ajax/gettextlivedetail?scheduleId=${Number(scheduleId) || 0}`;
}

/* ---------- text helpers ---------- */

const NAMED: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

/** Entity decoding, numeric forms included: the feed writes `&#39;` inside
 *  apostrophes, minutes as `88&#39;`. */
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED[name.toLowerCase()] ?? whole);
}

/** Markup → one line of text (`Goal! Atletico Madrid 1, …`). */
function text(value: string | undefined): string {
  return decodeEntities((value ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** `//imgcms.thscore.fun/…` → `https://imgcms.thscore.fun/…`; a path the page
 *  left relative is resolved onto the Goaloo image host. */
function absolute(url: string | undefined): string {
  const p = (url ?? '').trim();
  if (!p) return '';
  if (p.startsWith('//')) return `https:${p}`;
  if (/^https?:/i.test(p)) return p;
  return `https://imgcms.thscore.fun${p.startsWith('/') ? '' : '/'}${p}`;
}

/** Everything after the first `start` marker, up to the first of `ends` after
 *  it. An empty string when the marker is absent — the caller then reads
 *  nothing, which is exactly what an unpublished panel should produce. */
function slice(html: string, start: string, ...ends: string[]): string {
  const from = html.indexOf(start);
  if (from < 0) return '';
  const after = from + start.length;
  let to = html.length;
  for (const end of ends) {
    const at = html.indexOf(end, after);
    if (at >= 0 && at < to) to = at;
  }
  return html.slice(after, to);
}

/** First capture of `re` in `value`, or `''`. */
function first(re: RegExp, value: string): string {
  return (re.exec(value) ?? ['', ''])[1] ?? '';
}

/* ---------- fetching ---------- */

async function getTextOrNull(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: LIVE_HEADERS, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Read one match centre.
 *
 * The page and its text feed are fetched together: the page carries every panel
 * but the transcript, the feed is one JSON document, and a failure of either
 * degrades to an empty panel instead of to a broken page. `cache: 'no-store'`
 * because a live page changes by the minute — the short re-use window this app
 * wants is applied by the server action around this call (`getGoalooLiveMatch`
 * in app/actions.ts), which can size it by whether the match is in play.
 */
export async function getGoalooLiveMatch(
  scheduleId: number | string
): Promise<GoalooLiveMatch | null> {
  const id = Number(scheduleId) || 0;
  if (!id) return null;
  const [html, feed] = await Promise.all([
    getTextOrNull(goalooLiveMatchUrl(id)),
    getTextOrNull(goalooLiveTextUrl(id)),
  ]);
  if (!html) return null;
  const match = parseGoalooLiveMatch(html, id);
  if (!match) return null;
  match.text = parseGoalooLiveText(feed);
  return match;
}
/* ---------- header ---------- */

/** One club in the header — `data-tid` is its Goaloo id, `.sclassName` its name,
 *  the first `img` in the block its crest. */
function headClub(box: string, cls: 'home' | 'guest'): GoalooLiveTeam {
  const at = box.search(new RegExp(`<div class="${cls}"`));
  const chunk = at < 0 ? '' : box.slice(at, at + 900);
  if (!chunk) return { id: 0, name: '', logo: '' };
  return {
    id:
      Number(first(/data-tid="(\d+)"/, chunk)) ||
      Number(first(/team\/summary\/(\d+)/, chunk)) ||
      0,
    name: text(first(/class="sclassName">([\s\S]*?)<\/div>/, chunk)),
    logo: absolute(first(/<img[^>]*src="([^"]+)"/, chunk)),
  };
}

/** Kick-off from the page's own clock literal. The host runs on UTC — its
 *  `data-t` stamp and `GetLocalTime(...)` agree, and both line up with the
 *  UTC+8 kick-off the competition feed publishes — so the tuple is read as UTC
 *  and needs no offset here. */
function parseKickoff(html: string): number | null {
  const m = /GetLocalTime\('(\d{4}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2}),(\d{1,2})'\)/.exec(html);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

/** The scoreboard: `2` — `Finished` — `0` with the two half scores under it, or
 *  a bare `VS` before kick-off (two `.score` cells only exist once there is a
 *  score, which is how the two states are told apart). */
function parseScoreboard(
  box: string
): Pick<GoalooLiveMatch, 'state' | 'minute' | 'score' | 'halves'> {
  const board = slice(box, 'id="mScore"', '<div class="guest"');
  if (!board) return { state: '', minute: '', score: null, halves: [] };
  if (/class='row vs'/.test(board)) {
    return { state: 'Scheduled', minute: '', score: null, halves: [] };
  }
  const digits = [...board.matchAll(/class='score'>\s*(\d+)\s*</g)].map((m) => Number(m[1]));
  const state = text(first(/class='row state[^']*'>([\s\S]*?)<\/div>/, board));
  const minute = /(\d{1,3}(?:\+\d{1,2})?)['′]/.exec(state)?.[1];
  const halves = [...board.matchAll(/title='Score ([^']*)'>([^<]*)</g)].map((m) => ({
    label: text(m[1]),
    value: text(m[2]),
  }));
  return {
    state,
    minute: minute ? `${minute}'` : '',
    score: digits.length === 2 ? { home: digits[0], away: digits[1] } : null,
    halves,
  };
}

/* ---------- team sheets ---------- */

/** One `div.play` row of a sheet: `techWinId` is the Goaloo player id, the
 *  `sr` element his rating (absent on a player who never came on), and any
 *  `alt`/`time` pair inside the row a badge — a goal, a card, or the minute a
 *  substitute came on (`Sub in`) or went off (`Sub out`). */
const PLAY = /<div class='play' techWinId='(\d+)'>([\s\S]{0,800}?)<div class='name'>([^<]*)<\/div>/g;

function playRows(region: string): GoalooLivePlayer[] {
  const out: GoalooLivePlayer[] = [];
  for (const m of region.matchAll(PLAY)) {
    const body = m[2];
    const rating = Number(first(/<i class='sr[^']*'>\s*([\d.]+)\s*</, body));
    out.push({
      id: Number(m[1]) || 0,
      number: text(first(/class='number'>([^<]*)</, body)),
      name: text(m[3]),
      rating: Number.isFinite(rating) && rating > 0 ? rating : null,
      marks: [...body.matchAll(/alt='([^']+)'[^>]*?time='([^']+)'/g)].map((x) => ({
        label: text(x[1]),
        time: text(x[2]),
      })),
    });
  }
  return out;
}

/** Split a container that holds one `class="home"` block and one
 *  `class="guest"` block (the starting elevens, then the two benches) into its
 *  two halves. Anything unexpected yields two empty sides rather than a sheet
 *  with both teams' players in one list. */
function twoSides(region: string): [string, string] {
  const home = region.search(/<div class="home[^"]*"/);
  const away = region.search(/<div class="guest[^"]*"/);
  if (home < 0 || away < 0 || away < home) return ['', ''];
  return [region.slice(home, away), region.slice(away)];
}

/** Both team sheets: formation, the eleven, the bench — or an empty list while
 *  the page has not published a sheet (an upcoming fixture still shows one, but
 *  a very early one may not). */
function parseLineups(html: string, home: GoalooLiveTeam, away: GoalooLiveTeam): GoalooLiveSide[] {
  // The names block carries the formations (`tn-home`/`tn-away`: the away block
  // prints its formation BEFORE the name, the home block after it).
  const names = slice(html, 'class="teamNames"', 'id="matchBox"');
  const formations = [
    text(first(/class="tn-home[^"]*">[\s\S]*?<span>\s*([^<]*?)\s*<\/span>/, names)),
    text(first(/class="tn-away[^"]*">[\s\S]*?<span>\s*([^<]*?)\s*<\/span>/, names)),
  ];
  const elevens = slice(html, 'id="matchBox"', 'id="backupPlay"', 'id="eventMenu"');
  const benches = slice(
    html,
    'id="backupPlay"',
    'id="antLine"',
    'id="chatContainer"',
    'id="eventMenu"'
  );
  const [homeEleven, awayEleven] = twoSides(elevens);
  const [homeBench, awayBench] = twoSides(benches);

  const sides: GoalooLiveSide[] = [];
  const push = (team: GoalooLiveTeam, formation: string, eleven: string, bench: string): void => {
    const starters = playRows(eleven);
    const substitutes = playRows(bench);
    if (!starters.length && !substitutes.length) return;
    sides.push({ team, formation, starters, substitutes });
  };
  push(home, formations[0], homeEleven, homeBench);
  push(away, formations[1], awayEleven, awayBench);
  return sides;
}



/* ---------- event list ---------- */

/** One side of an event row. The cell holds player links and, on a substitution,
 *  the two `Sub in` / `Sub out` markers, so the row is rebuilt as one line
 *  (`Sub in · Le Normand R. · Sub out · Simeone G.`) instead of as the bare
 *  concatenation the stripped markup would give. */
function sideText(cell: string): string {
  const parts: string[] = [];
  for (const m of cell.matchAll(/<a[^>]*>([\s\S]*?)<\/a>|<img[^>]*alt="([^"]+)"[^>]*>/g)) {
    const label = m[1] !== undefined ? text(m[1]) : text(m[2]);
    if (label) parts.push(label);
  }
  return parts.length ? parts.join(' · ') : text(cell);
}

/** The page's `#eventsTable`, row by row. A period row (`stage-tit`, `FT 2-0`)
 *  keeps its place in the same list; every other row carries five cells — the
 *  home side, the home badge column, the minute, the away badge column and the
 *  away side — and the badge column a row filled in is the side it belongs to. */
function parseEvents(html: string): GoalooLiveEvent[] {
  const table = slice(html, 'id="eventsTable"', '</table>');
  if (!table) return [];
  const out: GoalooLiveEvent[] = [];
  for (const row of table.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)) {
    // A period row carries a single cell — `FT 2-0` — so it is recognised before
    // the five-cell shape below is required.
    if (/stage-tit/.test(row[1])) {
      out.push({ kind: '', label: text(first(/<td[^>]*>([\s\S]*?)<\/td>/, row[2])), minute: '', side: '', home: '', away: '' });
      continue;
    }
    const cells = [...row[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const [homeCell, homeBadge, minuteCell, awayBadge, awayCell] = cells;
    const home = sideText(homeCell);
    const away = sideText(awayCell);
    const homeKind = text(first(/<img[^>]*alt="([^"]+)"/, homeBadge));
    const awayKind = text(first(/<img[^>]*alt="([^"]+)"/, awayBadge));
    out.push({
      kind: homeKind || awayKind,
      label: '',
      minute: text(first(/<b class="score">([\s\S]*?)<\/b>/, minuteCell)),
      side: homeKind || home ? 'home' : awayKind || away ? 'away' : '',
      home,
      away,
    });
  }
  return out;
}

/* ---------- statistics ---------- */

/** The four period tabs the statistics panel switches between, by the id the
 *  page gives each list. */
const PERIODS: Record<string, string> = {
  ftstat: 'FT',
  hf1stat: '1st Half',
  hf2stat: '2nd Half',
  otstat: 'ET',
};

/** Technical statistics, one entry per published period. Each row is
 *  `value — label — value`, read off the two `stat-c` cells that bracket the
 *  `stat-title`; the bar widths beside them are decoration and are ignored. */
function parseStats(html: string): GoalooLivePeriod[] {
  const out: GoalooLivePeriod[] = [];
  for (const block of html.matchAll(
    /<ul class="stat" id="(ftstat|hf1stat|hf2stat|otstat)"[^>]*>([\s\S]*?)<\/ul>/g
  )) {
    const rows: GoalooLiveStatRow[] = [];
    for (const li of block[2].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const label = text(first(/class="stat-title">([\s\S]*?)<\/span>/, li[1]));
      const values = [...li[1].matchAll(/class="stat-c">\s*([\s\S]*?)\s*<\/span>/g)].map((v) =>
        text(v[1])
      );
      if (!label || values.length < 2) continue;
      rows.push({ label, home: values[0], away: values[values.length - 1] });
    }
    if (rows.length) out.push({ key: PERIODS[block[1]], rows });
  }
  return out;
}
/** Both clubs' recent-form averages: three-match and ten-match, home and away.
 *  The table's own header row is `<th>`-based, so it drops out of the `<td>`
 *  read below. */
function parseForm(html: string): GoalooLiveFormRow[] {
  const table = slice(html, 'Team Statistics', 'The Rate of Goal', 'HT/FT Statistics');
  const out: GoalooLiveFormRow[] = [];
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    if (cells.length < 6 || !cells[1]) continue;
    out.push({ label: cells[1], recent3: [cells[0], cells[2]], recent10: [cells[3], cells[5]] });
  }
  return out;
}

/** Where a club's goals and misses fall inside the ninety minutes, for its last
 *  30 and last 50 matches. The page keeps the two windows in separate containers
 *  (`rateOfScored1`, `rateOfScored2`) and pairs a `scoreComp` block with a
 *  `missComp` one inside each. */
const SPANS: Record<string, string> = { 1: 'Last 30 Matches', 2: 'Last 50 Matches' };

function parseBuckets(html: string): GoalooLiveBucket[] {
  const region = slice(html, 'The Rate of Goal', 'HT/FT Statistics');
  if (!region) return [];
  const out: GoalooLiveBucket[] = [];
  // Split on the container opening tags: [before, span, body, span, body, …]
  const parts = region.split(/<div id="rateOfScored(\d)"/);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const span = SPANS[parts[i]] ?? `Last ${parts[i]}`;
    for (const row of parts[i + 1].matchAll(
      /<div class="fx-comparision (scoreComp|missComp)[^"]*">([\s\S]*?)(?=<div class="fx-comparision |<div id="rateOfScored|$)/g
    )) {
      // The missed blocks spell the class with a trailing space (`fx-c-3 `).
      const label = text(first(/class="fx-c-3\s*">([\s\S]*?)<\/span>\s*<\/span>/, row[2]));
      const values = [...row[2].matchAll(/class='fx-c2[^']*'>\s*([^<]*)</g)].map((v) => text(v[1]));
      if (!label || values.length < 2) continue;
      const home = Number(values[0]);
      const away = Number(values[values.length - 1]);
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      out.push({
        kind: row[1] === 'scoreComp' ? 'scored' : 'missed',
        span,
        label,
        home,
        away,
      });
    }
  }
  return out;
}

/** The half-time/full-time record of both clubs over the last two seasons. */
function parseHtFt(html: string): GoalooLiveHtFt | null {
  const table = slice(html, 'HT/FT Statistics', 'Last update', '</table>');
  if (!table) return null;
  const teams = [
    ...table.matchAll(/<th[^>]*class='(?:rl home-m|guest-m)'[^>]*>([\s\S]*?)<\/th>/g),
  ].map((m) => {
    const title = text(m[1]);
    const split = /^(.*?)\s*\(\s*(\d+)\s*Matches?\s*\)$/.exec(title);
    return split ? { name: split[1], matches: split[2] } : { name: title, matches: '' };
  });
  const columns = [...table.matchAll(/<th[^>]*width="160"[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
    text(m[1])
  );
  const rows: { label: string; cells: string[] }[] = [];
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
    if (cells.length < 5) continue;
    rows.push({ label: cells[0], cells: cells.slice(1) });
  }
  if (teams.length < 2 || !rows.length) return null;
  return { teams: [teams[0], teams[1]], columns, rows };
}

/* ---------- text feed ---------- */

/** The feed answers with a JSON-encoded STRING holding the transcript, so the
 *  payload is decoded until it is an object — and a shape that never becomes one
 *  is reported as nothing rather than thrown at the page. */
function decodeJson(payload: unknown): unknown {
  let value = payload;
  for (let i = 0; i < 2 && typeof value === 'string'; i += 1) {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return typeof value === 'string' ? null : value ?? null;
}

/**
 * The transcript: one line per event the publisher's reporters filed, oldest
 * first. Each line reads `1' Goal! Atletico Madrid 1, Manchester United 0. …`,
 * so the minute is lifted off the front of the text (the same convention the
 * live pages use) and the rest is kept whole.
 */
export function parseGoalooLiveText(payload: unknown): GoalooLiveTextRow[] {
  const list = decodeJson(payload);
  if (!Array.isArray(list)) return [];
  const out: GoalooLiveTextRow[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const body = text(typeof row.content === 'string' ? row.content : '');
    if (!body) continue;
    const minute = /^(\d{1,3}(?:\+\d{1,2})?)['′]/.exec(body);
    out.push({
      id: Number(row.id) || 0,
      time: typeof row.time === 'string' ? row.time : '',
      minute: minute ? `${minute[1]}'` : '',
      text: body,
    });
  }
  return out;
}

/* ---------- the whole page ---------- */

/**
 * One match page → the panel's payload.
 *
 * The header block is sliced off first — from the competition name (`LName`) to
 * the odds / team-sheet panels, whichever comes first — because the page repeats
 * `.home` and `.guest` markers inside the team sheet: reading the clubs off the
 * header alone is what keeps a sheet's `div.home` from being mistaken for the
 * home club. A page without both club names is not a match page at all and
 * reports `null`, so the caller drops the panel instead of drawing an empty one.
 */
export function parseGoalooLiveMatch(html: string, scheduleId: number): GoalooLiveMatch | null {
  const box = slice(html, 'class="LName"', 'id="oddsDiv"', 'id="lineupBox"', 'id="eventMenu"');
  if (!box) return null;
  const home = headClub(box, 'home');
  const away = headClub(box, 'guest');
  if (!home.name && !away.name) return null;
  return {
    scheduleId,
    league: {
      id: Number(first(/\/league\/(\d+)/, box)) || 0,
      name: text(first(/class="sclassLink">([\s\S]*?)<\/span>/, box)).replace(/\s*·\s*$/, ''),
    },
    kickoff: parseKickoff(html),
    ...parseScoreboard(box),
    home,
    away,
    lineups: parseLineups(html, home, away),
    events: parseEvents(html),
    stats: parseStats(html),
    form: parseForm(html),
    buckets: parseBuckets(html),
    htft: parseHtFt(html),
    text: [],
    fetchedAt: Date.now(),
  };
}

