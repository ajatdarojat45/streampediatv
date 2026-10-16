// NowGoal competition season data — the fixture, standings and statistics files
// behind `/competitions/[id]`.
//
// The publisher's own competition page is
// `https://football.nowgoal50.com/league/{id}`, and its inline script names the
// three files that page reads (they are the only sources this module uses, so
// nothing here guesses a path):
//
//   seasons      /jsData/leagueSeason/sea{id}.json
//                {"SeasonList":["2026-2027","2025-2026", …]}          newest first
//   season file  /jsData/matchResult/json/{season}/s{id}_en.json    a league
//                /jsData/matchResult/json/{season}/c{id}_en.json    a cup
//   player stats /jsData/Count/json/{season}/playerTech_{id}_en.json
//
// and the crests/crests shown next to them come from the image CDN those pages
// point at (`_cdnWebDomain`, `_miniTeamPicUrl` — see lib/nowgoal.ts for the
// catalogue's use of the same host).
//
// One season file carries the whole page. A league publishes
//
//   LeagueInfo     [id, fullName, season, color, logoPath, rounds, currentRound,
//                   shortName, description, roundsWithTables, …]
//   TeamInfo       [teamId, name, '', logoPath, conferenceIndex]
//   ScheduleList   R_1 … R_{rounds} → one row per fixture
//   TotalScore / HomeScore / GuestScore   the standings table, three views
//   ColorList      [[color, label]] — the promotion/relegation bands
//   TeamTech       Total/Home/Guest → {Key, Value} team statistics
//   LastUpdateTime 'YYYY-MM-DD HH:mm:ss'
//
// and a cup the same idea with a different vocabulary: `CupKindList` (the
// stages), `ScheduleList` keyed `G{stage}{group}` (a group letter is appended
// for a group stage), `Standings` keyed `S{stage}{group}` for the group tables,
// `TeamList` instead of `TeamInfo`, and `LeagueInfo` shifted by one field
// (`[id, fullName, shortName, season, logoPath, color, description, …]`).
//
// Plenty of leagues — Italy's Serie A, the English Championship, most minor
// competitions — take a third shape instead: `SubLeagueInfo` files the
// competition in sections (a league phase plus a championship round, a
// relegation group, a knockout round…), each with its own `R_{n}` rounds under
// `sub_{id}`, and the tables are keyed the same way (`TotalScoreList`,
// `HomeScoreList`, `GuestScoreList`, `ColorList`). `LeagueInfo` there is the
// short form `[id, fullName, season, color, logoPath, shortName, description,
// …]`. A section can itself be a knockout round, which is why its fixtures go
// through the same reader a cup's do.
//
// Because of that third shape a round is not always `R_7`: the key the page
// passes back in `?round=` is the file's own key for a league and a cup, and
// `S{section}R_{n}` for a sub-league's round. `roundNumber` reads the round a
// key names, and the standings tables carry the section they belong to
// (`scope`), so a table rebuilt from the fixtures counts only its own.
//
// LeagueInfo/TeamInfo/TeamList/CupKindList/SubLeagueInfo are positional arrays,
// so every index below is spelled out where it is read.
//
// Two habits of this host shape the code:
//
//   * a file that does not exist is answered with an HTML error page and HTTP
//     200, so the parse — not `res.ok` — is the health check, exactly as in
//     lib/nowgoalCatalogue.ts. `getSeason` returns `null` for anything that is
//     not the shape it expects, and the page renders its own empty state;
//   * every timestamp in these files is GMT+8 wall clock. The site's own
//     `timeFromE8()` builds a local `Date` from the stamp, subtracts exactly 8h
//     and adds the viewer's offset — i.e. the stamps are Beijing time — so
//     `kickoffMs` reads them as `+08:00` and hands the app's `LocalTime` a true
//     instant (see components/LocalTime.tsx).

import { NOWGOAL_FOOTBALL_ORIGIN, NOWGOAL_IMAGE_ORIGIN } from './nowgoal';
import type {
  NowgoalFixture,
  NowgoalPlayerRow,
  NowgoalRound,
  NowgoalSeasonData,
  NowgoalStandingBand,
  NowgoalStandingRow,
  NowgoalStandingTable,
  NowgoalStatMetric,
  NowgoalStatTable,
  NowgoalTeamRef,
  NowgoalTeamRow,
} from './types';

/** Season file cache window: live scores move through the day, but a page
 *  reload should not re-read the whole file per click. */
const SEASON_REVALIDATE = 5 * 60;
/** The season list changes once a year. */
const SEASON_LIST_REVALIDATE = 6 * 60 * 60;
/** Player statistics move after a round, not during one. */
const PLAYER_STATS_REVALIDATE = 30 * 60;
/** A file that has not answered by then is a bad day; the page says so. */
const FETCH_TIMEOUT_MS = 10_000;
/** The host answers its own pages, not bare clients. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Team crests, addressed by team id — the template the site's own rows use
 *  (`_miniTeamPicUrl`). */
const MINI_TEAM_PATH = '/mini/fbteam/';
/** The same crest through the team's own logo path, which the fixture rows use
 *  (`/football/image/team/{logoPath}`). */
const TEAM_LOGO_PATH = '/football/image/team/';
/** Player photos (`/football/image/player/{photo}`). */
const PLAYER_PHOTO_PATH = '/football/image/player/';

/** Competition crest by id, moved onto the image CDN the feed's own pages read. */
export function competitionCrest(id: string): string {
  return id ? `${NOWGOAL_IMAGE_ORIGIN}/mini/fbleague/${id}.png` : '';
}

/** Team crest: the team's own logo path when the season file publishes one,
 *  the id-addressed mini crest otherwise — the two sources the publisher's own
 *  fixtures and standings rows use. */
export function teamCrest(id: string, logoPath?: string): string {
  if (logoPath) return `${NOWGOAL_IMAGE_ORIGIN}${TEAM_LOGO_PATH}${logoPath.replace(/^\/+/, '')}`;
  return id ? `${NOWGOAL_IMAGE_ORIGIN}${MINI_TEAM_PATH}${id}.png` : '';
}

/** Player photo, or `''` when the file publishes none. */
export function playerPhoto(photo: string): string {
  return photo ? `${NOWGOAL_IMAGE_ORIGIN}${PLAYER_PHOTO_PATH}${photo.replace(/^\/+/, '')}` : '';
}

/** The feed's stamps are GMT+8 wall clock (`2026-08-22 03:00`) — see the note at
 *  the top of this file. Returns ms since epoch, or `null` for a missing stamp. */
export function kickoffMs(stamp: unknown): number | null {
  if (typeof stamp !== 'string') return null;
  const m = stamp.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const ms = Date.parse(
    `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:00+08:00`,
  );
  return Number.isNaN(ms) ? null : ms;
}

/* ------------------------------------------------------------------------- *
 * Reading the files. Everything below is pure: it takes the parsed JSON of one
 * file and returns the shapes lib/types.ts declares, so the page never sees a
 * positional array.
 * ------------------------------------------------------------------------- */

/** A positional row of one of these files. */
type RawRow = readonly unknown[];
/** A parsed season file (a league `s{id}` file or a cup `c{id}` file). */
type RawFile = Record<string, unknown>;
/** The `playerTech_{id}.json` payload. */
type RawPlayerFile = { TechCountInfo?: Record<string, unknown> };

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
/** Text of a field. The feed mixes strings and numbers in the same positions —
 *  team ids, for instance, are numbers everywhere and strings in the maps they
 *  are looked up in — so a number reads as its own digits rather than as empty. */
const str = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/** The description/notes in these files are HTML fragments with `&nbsp;`-style
 *  entities between the words (`The&nbsp;Premier&nbsp;League`), so they are
 *  decoded and the tags dropped before they reach the page. Only the handful of
 *  entities the publisher actually uses is handled. */
export function plainText(html: unknown): string {
  if (typeof html !== 'string' || !html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The publisher's own aside on a tie. Both shapes are the same field list —
 *  two legs, extra time, penalties, who went through — only the wrapper around
 *  it differs: a league row carries the list straight (`n[20]`), a cup row
 *  carries it as the fourth `|`-separated segment (`n[19]`, see the page's own
 *  `showExplain` / `showCupExplain`). Fields that are empty or a stray `;` are
 *  dropped rather than printed as the site's own JS prints them. */
export function fixtureNote(raw: unknown, kind: 'league' | 'cup'): string {
  if (typeof raw !== 'string' || !raw) return '';
  const segment = kind === 'cup' ? (raw.split('|')[3] ?? '') : raw;
  const parts = segment.split(';').map((p) => p.replace(/;+$/, '').trim());
  const out: string[] = [];
  const [, twoLegs, extraTime, pens, winner] = parts;
  if (twoLegs) out.push(`Two legs ${twoLegs}`);
  if (extraTime) {
    const [mode, value] = extraTime.split(',');
    out.push(`${mode === '1' ? '120 min' : 'ET'} ${value ?? ''}`.trim());
  }
  if (pens) out.push(`Pens ${pens}`);
  if (winner === '1') out.push('Home win');
  else if (winner === '2') out.push('Away win');
  return out.join(' · ');
}

/** One score string as published (`3-0`) turned into its two halves. */
function scorePair(raw: unknown): [number, number] | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Team table of a season file → id-keyed map of the names and crests every
 *  other row in the file refers to by id. */
function readTeams(rows: unknown): Map<string, NowgoalTeamRef> {
  const map = new Map<string, NowgoalTeamRef>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const id = str(row[0]);
    if (!id) continue;
    map.set(id, { id, name: plainText(row[1]) || `Team ${id}`, crest: teamCrest(id, str(row[3])) });
  }
  return map;
}

/** One fixture row, with both sides resolved to names. The column indices are
 *  the ones the publisher's own `getMatchTemp` reads; a cup row carries its red
 *  cards and its aside two slots earlier than a league row does. `leg` labels a
 *  leg of a two-legged tie. */
function readFixture(
  row: RawRow,
  teams: Map<string, NowgoalTeamRef>,
  kind: 'league' | 'cup',
  leg = '',
): NowgoalFixture | null {
  const id = str(row[0]);
  if (!id) return null;
  const side = (value: unknown): NowgoalTeamRef => {
    const teamId = str(value);
    return teams.get(teamId) ?? { id: teamId, name: teamId ? `Team ${teamId}` : '—', crest: teamCrest(teamId) };
  };
  const red = kind === 'cup' ? 16 : 18;
  const note = fixtureNote(row[kind === 'cup' ? 19 : 20], kind);
  return {
    id,
    kickoffMs: kickoffMs(row[3]),
    state: num(row[2]),
    home: side(row[4]),
    away: side(row[5]),
    score: str(row[6]),
    halfScore: str(row[7]),
    homeRed: num(row[red]),
    awayRed: num(row[red + 1]),
    note: leg ? (note ? `${note} · ${leg}` : leg) : note,
  };
}

/** Fixtures filed under one schedule key. A two-legged cup stage files each tie
 *  as a wrapper — `[homeId, awayId, …, [leg1, leg2]]` — so its legs are lifted
 *  out and labelled; every other row is a fixture of its own. */
function readFixtures(
  rows: unknown,
  teams: Map<string, NowgoalTeamRef>,
  kind: 'league' | 'cup',
): NowgoalFixture[] {
  const fixtures: NowgoalFixture[] = [];
  if (!Array.isArray(rows)) return fixtures;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const legs = Array.isArray(row[4]) ? (row[4] as unknown[]) : null;
    if (!legs) {
      const fixture = readFixture(row, teams, kind);
      if (fixture) fixtures.push(fixture);
      continue;
    }
    legs.forEach((legRow, index) => {
      if (!Array.isArray(legRow)) return;
      const label =
        legs.length > 1 ? (index === 0 ? '1st leg' : index === 1 ? '2nd leg' : `Leg ${index + 1}`) : '';
      const fixture = readFixture(legRow, teams, kind, label);
      if (fixture) fixtures.push(fixture);
    });
  }
  return fixtures;
}

/** How one flavour of file keys and labels its rounds. */
interface RoundSpec {
  /** Which keys of the section are rounds. */
  pattern: RegExp;
  /** The number a round sorts and is compared by. */
  index: (raw: string) => number;
  /** The key the page passes back in `?round=`. */
  key: (raw: string) => string;
  /** The label the dropdown shows. */
  label: (raw: string) => string;
}

/** A schedule object read into one entry per key the file actually carries,
 *  ordered by the specification's own round number — so a round that the file
 *  does not have never appears in a dropdown. */
function readRounds(
  section: unknown,
  teams: Map<string, NowgoalTeamRef>,
  kind: 'league' | 'cup',
  spec: RoundSpec,
): NowgoalRound[] {
  if (!section || typeof section !== 'object') return [];
  const keys = Object.keys(section).filter((key) => spec.pattern.test(key));
  keys.sort((a, b) => spec.index(a) - spec.index(b) || a.localeCompare(b));
  return keys.map((raw) => ({
    key: spec.key(raw),
    label: spec.label(raw),
    fixtures: readFixtures((section as Record<string, unknown>)[raw], teams, kind),
  }));
}

/** The round number a round key carries — `R_7` for a league round, `S87R_7` for
 *  one of a sub-league's rounds. `null` for a cup stage, which is not a round. */
function roundNumber(key: string): number | null {
  const match = key.match(/R_(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** The last round the file has a result for — the per-round league tables stop
 *  there, so a round nobody has played yet is not offered. */
function lastPlayedRound(rounds: NowgoalRound[]): number {
  let last = 0;
  for (const round of rounds) {
    const index = roundNumber(round.key);
    if (index === null) continue;
    if (round.fixtures.some((f) => f.state === -1) && index > last) last = index;
  }
  return last;
}


/** `ColorList` of a league file: `[[color, label], …]` — the bands a table row
 *  is filed under (champions, Europa League, relegation, …). */
function readBands(rows: unknown): NowgoalStandingBand[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is RawRow => Array.isArray(row))
    .map((row) => ({ color: str(row[0]), label: plainText(row[1]) }))
    .filter((band) => band.color || band.label);
}

/** A league's table as the file precomputes it. The three tables it publishes do
 *  not share a layout: `TotalScore` leads with the colour band and puts the
 *  points column at 16 (`[band, rank, teamId, ?, played, win, draw, lose,
 *  goalsFor, goalsAgainst, goalDiff, …percentages…, points]`), while the home and
 *  away tables have neither band nor percentages (`[rank, teamId, played, win,
 *  draw, lose, goalsFor, goalsAgainst, goalDiff, …, points]`). `banded` picks the
 *  same layout the publisher's own `sclassStandings` picks. */
function readLeagueTable(
  rows: unknown,
  bands: NowgoalStandingBand[],
  teams: Map<string, NowgoalTeamRef>,
  banded: boolean,
): NowgoalStandingRow[] {
  if (!Array.isArray(rows)) return [];
  const table: NowgoalStandingRow[] = [];
  // The banded layout carries two columns the plain one does not, so its
  // statistics sit two slots further right.
  const shift = banded ? 0 : 2;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const team = teams.get(str(row[banded ? 2 : 1]));
    if (!team) continue;
    const band = banded ? num(row[0]) : -1;
    table.push({
      rank: num(row[banded ? 1 : 0]),
      team,
      played: num(row[4 - shift]),
      win: num(row[5 - shift]),
      draw: num(row[6 - shift]),
      lose: num(row[7 - shift]),
      goalsFor: num(row[8 - shift]),
      goalsAgainst: num(row[9 - shift]),
      goalDiff: num(row[10 - shift]),
      points: num(row[16 - shift]),
      band: band >= 0 ? (bands[band]?.color ?? '') : '',
      qualified: false,
    });
  }
  return table;
}

/** A cup group table (`Standings.S{stage}{group}`): `[rank, teamId, played, win,
 *  draw, lose, goalsFor, goalsAgainst, goalDiff, points, qualifiedRank]` — a row
 *  whose rank is inside `qualifiedRank` goes through to the next stage. */
function readCupTable(rows: unknown, teams: Map<string, NowgoalTeamRef>): NowgoalStandingRow[] {
  if (!Array.isArray(rows)) return [];
  const table: NowgoalStandingRow[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const team = teams.get(str(row[1]));
    if (!team) continue;
    const rank = num(row[0]);
    const qualifyingRank = num(row[10]);
    table.push({
      rank,
      team,
      played: num(row[2]),
      win: num(row[3]),
      draw: num(row[4]),
      lose: num(row[5]),
      goalsFor: num(row[6]),
      goalsAgainst: num(row[7]),
      goalDiff: num(row[8]),
      points: num(row[9]),
      band: '',
      qualified: qualifyingRank > 0 && rank <= qualifyingRank,
    });
  }
  return table;
}

/** A league table rebuilt from the fixtures themselves, up to and including
 *  `upToRound` — the per-round view the publisher's round tabs show. Only
 *  finished fixtures count (`state === -1`), `region` narrows it to the fixtures
 *  a team played at home or away, and the ranking rules are the page's own
 *  (`getStandingsDataByRound`): points, then goal difference, then goals scored.
 *
 *  The rows come from every round of the season, not just the played ones, so
 *  the same teams sit in the table on every round tab — the source reads its own
 *  team list for the same reason. */
export function standingsFromFixtures(
  rounds: NowgoalRound[],
  region: 'all' | 'home' | 'away',
  upToRound: number,
  scope?: string,
): NowgoalStandingRow[] {
  type Totals = { team: NowgoalTeamRef; played: number; win: number; draw: number; lose: number; goalsFor: number; goalsAgainst: number };
  const totals = new Map<string, Totals>();
  const bucket = (team: NowgoalTeamRef): Totals => {
    let entry = totals.get(team.id);
    if (!entry) {
      entry = { team, played: 0, win: 0, draw: 0, lose: 0, goalsFor: 0, goalsAgainst: 0 };
      totals.set(team.id, entry);
    }
    return entry;
  };

  for (const round of rounds) {
    // A competition filed in sub-leagues keeps one table per section, so only
    // that section's rounds count towards it.
    if (scope && !round.key.startsWith(`S${scope}`)) continue;
    const index = roundNumber(round.key);
    const played = index !== null && index <= upToRound;
    for (const fixture of round.fixtures) {
      const home = bucket(fixture.home);
      const away = bucket(fixture.away);
      if (!played || fixture.state !== -1) continue;
      const score = scorePair(fixture.score);
      if (!score) continue;
      const [homeGoals, awayGoals] = score;
      if (region !== 'away') {
        home.played += 1;
        home.goalsFor += homeGoals;
        home.goalsAgainst += awayGoals;
        if (homeGoals > awayGoals) home.win += 1;
        else if (homeGoals === awayGoals) home.draw += 1;
        else home.lose += 1;
      }
      if (region !== 'home') {
        away.played += 1;
        away.goalsFor += awayGoals;
        away.goalsAgainst += homeGoals;
        if (awayGoals > homeGoals) away.win += 1;
        else if (awayGoals === homeGoals) away.draw += 1;
        else away.lose += 1;
      }
    }
  }

  const table: NowgoalStandingRow[] = [...totals.values()].map((t) => ({
    team: t.team,
    played: t.played,
    win: t.win,
    draw: t.draw,
    lose: t.lose,
    goalsFor: t.goalsFor,
    goalsAgainst: t.goalsAgainst,
    goalDiff: t.goalsFor - t.goalsAgainst,
    points: t.win * 3 + t.draw,
    rank: 0,
    band: '',
    qualified: false,
  }));
  table.sort(
    (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.team.name.localeCompare(b.team.name),
  );
  table.forEach((row, index) => {
    row.rank = index + 1;
  });
  return table;
}

/** Team statistics (`TeamTech.Total/Home/Guest`): the same `{Key, Value}` shape
 *  the player plate uses, one row per team, still numeric — the requested
 *  metric reads its column by index (see `TEAM_METRICS`). */
function readTeamRows(section: unknown, teams: Map<string, NowgoalTeamRef>): NowgoalTeamRow[] {
  const value = (section as { Value?: unknown } | null)?.Value;
  if (!Array.isArray(value)) return [];
  const rows: NowgoalTeamRow[] = [];
  for (const row of value) {
    if (!Array.isArray(row)) continue;
    const team = teams.get(str(row[0]));
    if (!team) continue;
    rows.push({ team, columns: row.map(num) });
  }
  return rows;
}

/** The player plate: read out of the `playerTech_{id}.json` payload, where
 *  `TechCountInfo.Pid` names a player (`[[name, photo], teamId]`) and
 *  `TechCountInfo.Total.Value` carries one numeric row per player, in the same
 *  order. A row the file cannot name is dropped rather than rendered blank. */
function readPlayers(
  payload: RawPlayerFile | null,
  teams: Map<string, NowgoalTeamRef>,
): NowgoalPlayerRow[] {
  const info = payload?.TechCountInfo;
  const pid = (info?.Pid ?? {}) as Record<string, unknown>;
  const rows = ((info?.Total as { Value?: unknown } | undefined)?.Value ?? []) as unknown;
  if (!Array.isArray(rows)) return [];
  const players: NowgoalPlayerRow[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const playerId = str(row[0]);
    const entry = pid[playerId];
    const identity = Array.isArray(entry) && Array.isArray(entry[0]) ? (entry[0] as RawRow) : null;
    if (!playerId || !identity) continue;
    const teamId = Array.isArray(entry) ? str((entry as RawRow)[1]) : '';
    players.push({
      playerId,
      name: plainText(identity[0]) || `Player ${playerId}`,
      photo: str(identity[1]),
      teamId,
      teamName: teams.get(teamId)?.name ?? '',
      teamCrest: teamCrest(teamId),
      columns: row.map(num),
    });
  }
  return players;
}

/** A league season file (`s{id}_en.json`) read into the page's own shapes.
 *  `LeagueInfo` here is `[id, fullName, season, color, logoPath, rounds,
 *  currentRound, shortName, description, roundsWithTables, …]`. */
function readLeague(
  file: RawFile,
  info: RawRow,
  playerPayload: RawPlayerFile | null,
): NowgoalSeasonData | null {
  const teams = readTeams(file.TeamInfo);
  if (!teams.size) return null;
  const id = str(info[0]);
  const rounds = readRounds(file.ScheduleList, teams, 'league', {
    pattern: /^R_\d+$/,
    index: (raw) => Number(raw.replace(/^R_/, '')),
    key: (raw) => raw,
    label: (raw) => `Round ${raw.replace(/^R_/, '')}`,
  });
  const bands = readBands(file.ColorList);
  // `LeagueInfo[9]` is how many rounds the source's own round tabs cover; the
  // played-round scan covers a file that leaves it at zero.
  const tableRounds = Math.max(num(info[9]), lastPlayedRound(rounds));
  const tables: NowgoalStandingTable[] = [];
  const views: { key: string; label: string; rows: unknown; banded: boolean }[] = [
    { key: 'all', label: 'Total', rows: file.TotalScore, banded: true },
    { key: 'home', label: 'Home', rows: file.HomeScore, banded: false },
    { key: 'away', label: 'Away', rows: file.GuestScore, banded: false },
  ];
  for (const view of views) {
    const table = readLeagueTable(view.rows, bands, teams, view.banded);
    if (table.length) {
      tables.push({
        key: view.key,
        label: view.label,
        rows: table,
        bands,
        roundsPlayed: tableRounds,
      });
    }
  }
  // `LeagueInfo[6]` is the round in progress — the one the publisher's own
  // fixtures tab opens on.
  const currentIndex = rounds.findIndex((round) => roundNumber(round.key) === num(info[6]));
  const tech = file.TeamTech as RawFile | undefined;
  return {
    id,
    kind: 'league',
    name: plainText(info[1]) || `Competition ${id}`,
    shortName: plainText(info[7]) || plainText(info[1]),
    season: str(info[2]),
    crest: competitionCrest(id),
    description: plainText(info[8]),
    teams: teams.size,
    rounds,
    tables,
    currentRound: currentIndex >= 0 ? currentIndex + 1 : 0,
    players: readPlayers(playerPayload, teams),
    teamRows: readTeamRows(tech?.Total, teams),
    updatedMs: kickoffMs(file.LastUpdateTime),
  };
}

/** A cup season file (`c{id}_en.json`). The vocabulary differs from a league's:
 *  stages come from `CupKindList` (`[stageId, hasTables, name, groups, current,
 *  twoLegged]`), fixtures are keyed `G{stage}{group}` and the group tables
 *  `S{stage}{group}`, and `LeagueInfo` is shifted by one field:
 *  `[id, fullName, shortName, season, logoPath, color, description, …]`. */
function readCup(
  file: RawFile,
  info: RawRow,
  kinds: RawRow[],
  playerPayload: RawPlayerFile | null,
): NowgoalSeasonData | null {
  const teams = readTeams(file.TeamList);
  if (!teams.size) return null;
  const id = str(info[0]);

  // The publisher's own stage order, used to file both the fixtures and the
  // tables — and to name them, since a key alone (`G29090A`) says nothing.
  const stageName = new Map<string, string>();
  const stageOrder = new Map<string, number>();
  kinds.forEach((row, index) => {
    const stageId = str(row[0]);
    if (!stageId) return;
    stageName.set(stageId, plainText(row[2]) || `Stage ${stageId}`);
    stageOrder.set(stageId, index);
  });
  const stageOf = (key: string) => key.replace(/^[GS]/, '').replace(/[A-Z]$/, '');
  const groupOf = (key: string) => (/[A-Z]$/.test(key) ? key.slice(-1) : '');
  const label = (key: string) => {
    const name = stageName.get(stageOf(key)) ?? `Stage ${stageOf(key)}`;
    const group = groupOf(key);
    return group ? `${name} ${group}` : name;
  };
  const order = (key: string) => stageOrder.get(stageOf(key)) ?? 999;

  const rounds = readRounds(file.ScheduleList, teams, 'cup', {
    pattern: /^G\d+[A-Z]?$/,
    index: (raw) => order(raw) * 100 + (groupOf(raw) ? groupOf(raw).charCodeAt(0) - 64 : 0),
    key: (raw) => raw,
    label,
  });
  // The publisher flags the stage in progress in `CupKindList[i][4]`, and its own
  // fixtures tab opens on that stage's first round.
  const currentStage = str(kinds.find((row) => num(row[4]) > 0)?.[0] ?? '');
  const currentIndex = currentStage
    ? rounds.findIndex((round) => stageOf(round.key) === currentStage)
    : -1;

  const tables: NowgoalStandingTable[] = [];
  const standings = file.Standings;
  if (standings && typeof standings === 'object') {
    const keys = Object.keys(standings).filter((key) => /^S\d+[A-Z]?$/.test(key));
    keys.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    for (const key of keys) {
      const rows = readCupTable((standings as Record<string, unknown>)[key], teams);
      if (rows.length) tables.push({ key, label: label(key), rows });
    }
  }
  const tech = file.TeamTech as RawFile | undefined;
  return {
    id,
    kind: 'cup',
    name: plainText(info[1]) || `Competition ${id}`,
    shortName: plainText(info[2]) || plainText(info[1]),
    season: str(info[3]),
    crest: competitionCrest(id),
    description: plainText(info[6]),
    teams: teams.size,
    rounds,
    tables,
    currentRound: currentIndex >= 0 ? currentIndex + 1 : 0,
    players: readPlayers(playerPayload, teams),
    teamRows: readTeamRows(tech?.Total, teams),
    updatedMs: kickoffMs(file.LastUpdateTime),
  };
}

/** A season file whose competition is filed in sub-leagues (`SubLeagueInfo`) —
 *  the shape Italy's Serie A, the English Championship and most minor leagues
 *  publish. `LeagueInfo` here is `[id, fullName, season, color, logoPath,
 *  shortName, description, …]`; the fixtures live under `sub_{id}` in the same
 *  `R_{n}` rounds a league file has, and so do the tables — `TotalScoreList`,
 *  `HomeScoreList`, `GuestScoreList` and `ColorList` are keyed by section.
 *
 *  A section can be a knockout round rather than a league table (the publisher
 *  marks a two-legged one in `SubLeagueInfo[i][5]`), which is why its fixtures
 *  go through the same reader a cup's do. */
function readSubLeague(
  file: RawFile,
  info: RawRow,
  sections: RawRow[],
  playerPayload: RawPlayerFile | null,
): NowgoalSeasonData | null {
  const teams = readTeams(file.TeamInfo);
  if (!teams.size) return null;
  const id = str(info[0]);
  const subs = sections
    .map((row) => ({
      id: str(row[0]),
      name: plainText(row[1]) || `Section ${str(row[0])}`,
      hasTable: num(row[2]) === 1,
      currentRound: num(row[4]),
      roundsPlayed: num(row[7]),
      current: num(row[8]) === 1,
    }))
    .filter((sub) => sub.id);
  const schedule = (file.ScheduleList ?? {}) as Record<string, unknown>;
  // Every section the file really carries, in the publisher's own order; one
  // without a `SubLeagueInfo` row is kept anyway, so nothing drops out.
  const listed = subs.map((sub) => sub.id);
  const order = [
    ...listed,
    ...Object.keys(schedule)
      .map((key) => key.replace(/^sub_/, ''))
      .filter((sectionId) => !listed.includes(sectionId)),
  ];
  // A single section does not need to name itself in a round label; a
  // competition that files several does.
  const multi = order.filter((sectionId) => {
    const section = schedule[`sub_${sectionId}`];
    return section && typeof section === 'object' && Object.keys(section).length > 0;
  }).length > 1;

  const rounds: NowgoalRound[] = [];
  for (const sectionId of order) {
    const section = schedule[`sub_${sectionId}`];
    if (!section || typeof section !== 'object') continue;
    const name = subs.find((sub) => sub.id === sectionId)?.name ?? `Section ${sectionId}`;
    rounds.push(
      ...readRounds(section, teams, 'league', {
        pattern: /^R_\d+$/,
        index: (raw) => Number(raw.replace(/^R_/, '')),
        key: (raw) => `S${sectionId}${raw}`,
        label: (raw) => `${multi ? `${name} · ` : ''}Round ${raw.replace(/^R_/, '')}`,
      }),
    );
  }

  const totals = (file.TotalScoreList ?? {}) as Record<string, unknown>;
  const homes = (file.HomeScoreList ?? {}) as Record<string, unknown>;
  const guests = (file.GuestScoreList ?? {}) as Record<string, unknown>;
  const colors = (file.ColorList ?? {}) as Record<string, unknown>;
  const withTable = subs.filter((sub) => sub.hasTable);
  const manyTables = withTable.length > 1;
  const tables: NowgoalStandingTable[] = [];
  for (const sub of withTable) {
    const bands = readBands(colors[`sub_${sub.id}`]);
    const views: { view: string; label: string; rows: unknown; banded: boolean }[] = [
      { view: 'all', label: 'Total', rows: totals[`sub_${sub.id}`], banded: true },
      { view: 'home', label: 'Home', rows: homes[`sub_${sub.id}`], banded: false },
      { view: 'away', label: 'Away', rows: guests[`sub_${sub.id}`], banded: false },
    ];
    for (const view of views) {
      const rows = readLeagueTable(view.rows, bands, teams, view.banded);
      if (!rows.length) continue;
      tables.push({
        key: manyTables ? `S${sub.id}_${view.view}` : view.view,
        label: `${manyTables ? `${sub.name} · ` : ''}${view.label}`,
        rows,
        bands,
        roundsPlayed: sub.roundsPlayed,
        scope: sub.id,
      });
    }
  }

  // The section the publisher flags as current (`SubLeagueInfo[i][8]`) carries
  // the round its own fixtures tab opens on.
  const currentSub =
    subs.find((sub) => sub.current && schedule[`sub_${sub.id}`]) ??
    subs.find((sub) => sub.hasTable) ??
    subs[0];
  const currentIndex =
    currentSub && currentSub.currentRound > 0
      ? rounds.findIndex((round) => round.key === `S${currentSub.id}R_${currentSub.currentRound}`)
      : -1;

  const tech = file.TeamTech as RawFile | undefined;
  // A sub-league file's `LeagueInfo` is the short form (`[id, name, season,
  // color, logoPath, shortName, description, …]`); a file that also carries the
  // full league form is read with its own offsets.
  const full = info.length >= 11;
  return {
    id,
    kind: 'league',
    name: plainText(info[1]) || `Competition ${id}`,
    shortName: plainText(full ? info[7] : info[5]) || plainText(info[1]),
    season: str(info[2]),
    crest: competitionCrest(id),
    description: plainText(full ? info[8] : info[6]),
    teams: teams.size,
    rounds,
    tables,
    currentRound: currentIndex >= 0 ? currentIndex + 1 : 0,
    players: readPlayers(playerPayload, teams),
    teamRows: readTeamRows(tech?.Total, teams),
    updatedMs: kickoffMs(file.LastUpdateTime),
  };
}

/** Read one season file into the page's own shapes, or `null` when the payload
 *  is not one — the host answers a file it does not have with an HTML error page
 *  at HTTP 200, so the shape of what came back is the only health check.
 *  `playerPayload` is the competition's statistics plate, which the readers fold
 *  in while they still hold the team names those rows refer to. */
export function readSeasonFile(
  file: unknown,
  playerPayload: RawPlayerFile | null = null,
): NowgoalSeasonData | null {
  if (!file || typeof file !== 'object') return null;
  const raw = file as RawFile;
  const info = Array.isArray(raw.LeagueInfo) ? (raw.LeagueInfo as RawRow) : null;
  if (!info || !info.length) return null;
  const kinds = Array.isArray(raw.CupKindList) ? (raw.CupKindList as RawRow[]) : null;
  // `CupKindList` is present in every cup file (empty ones included), and
  // `SubLeagueInfo` in every file of a competition the publisher files in
  // sections — which is how its own page tells the flavours apart too.
  if (kinds) return readCup(raw, info, kinds, playerPayload);
  const sections = Array.isArray(raw.SubLeagueInfo) ? (raw.SubLeagueInfo as RawRow[]) : null;
  if (sections && sections.length) return readSubLeague(raw, info, sections, playerPayload);
  return readLeague(raw, info, playerPayload);
}

/* ------------------------------------------------------------------------- *
 * The statistics plates. A metric is a label plus which columns of the
 * `playerTech`/`TeamTech` row it reads — transcribed from the page's own
 * `getTechData`, so the numbers match the source rather than a guess about what
 * each column means.
 * ------------------------------------------------------------------------- */

/** One metric of a plate: how it is labelled, the column it sorts on (`data-tech-sort`
 *  of the publisher's own dropdown) and how its value reads. */
export interface StatMetric extends NowgoalStatMetric {
  sort: number;
  value: (columns: number[]) => string;
  /** Second column, for the metrics that also average over matches played. */
  second?: (columns: number[]) => string;
}

/** Per-match average — the second column of the team plate. */
const average = (value: number, matches: number): string =>
  matches > 0 ? (value / matches).toFixed(1) : '0.0';

/** The player plate (`getTechData(…, 1)`). */
export const PLAYER_METRICS: readonly StatMetric[] = [
  { id: '1', label: 'Goals(P)', sort: 52, value: (c) => `${c[52]}${c[5] > 0 ? ` (${c[5]})` : ''}`, second: (c) => `${c[55]}` },
  { id: '2', label: 'Assists', sort: 15, value: (c) => `${c[15]}` },
  { id: '3', label: 'Red/Yellow', sort: 33, value: (c) => `${c[33]}/${c[34]}` },
  // The file publishes `rating` as a season total rather than a per-match
  // average — that is the column the publisher's own plate sorts on, so it is
  // shown as published.
  { id: '4', label: 'Rating', sort: 10, value: (c) => `${c[10]}` },
  { id: '5', label: 'Mins(Avg)', sort: 3, value: (c) => `${c[3]}/${average(c[3], c[1])}` },
  { id: '6', label: 'Shots/OT', sort: 6, value: (c) => `${c[6]}/${c[7]}` },
  { id: '7', label: 'Passes/Rate', sort: 12, value: (c) => `${c[12]}/${c[53]}` },
  { id: '8', label: 'Key Passes', sort: 14, value: (c) => `${c[14]}` },
  { id: '9', label: 'Tackles', sort: 24, value: (c) => `${c[24]}` },
  { id: '10', label: 'Interceptions', sort: 25, value: (c) => `${c[25]}` },
  { id: '11', label: 'Clearances', sort: 26, value: (c) => `${c[26]}` },
  { id: '12', label: 'Steal', sort: 29, value: (c) => `${c[29]}` },
  { id: '13', label: 'Fouls', sort: 32, value: (c) => `${c[32]}` },
  { id: '14', label: 'Fouled', sort: 8, value: (c) => `${c[8]}` },
  { id: '15', label: 'Dribbles', sort: 22, value: (c) => `${c[22]}` },
];
/** The player plate's second column is the average minute of a player's goals
 *  (`T_TH_MinOfGoals` of the publisher's own header). */
const PLAYER_SECOND_LABEL = 'Mins/Goals';

/** One team metric: the total the file publishes, then its per-match average
 *  (`getTechData(…, 2)` of the publisher's page). */
const teamMetric = (id: string, label: string, column: number): StatMetric => ({
  id,
  label,
  sort: column,
  value: (c) => `${c[column]}`,
  second: (c) => average(c[column], c[1]),
});
/** The team plate. Possession is the one metric without a second column: the
 *  file publishes it as `avgControl`, a rate already, so averaging it again
 *  would say nothing. */
export const TEAM_METRICS: readonly StatMetric[] = [
  teamMetric('1', 'Goals', 20),
  teamMetric('2', 'Conceded', 21),
  teamMetric('3', 'Shots', 2),
  teamMetric('4', 'Shots (SOG)', 3),
  { id: '5', label: 'Possession', sort: 32, value: (c) => `${c[32]}` },
  teamMetric('6', 'Corners', 12),
  teamMetric('7', 'Fouls', 11),
  teamMetric('8', 'Offsides', 13),
  teamMetric('9', 'Yellow', 8),
  teamMetric('10', 'Red', 9),
];
/** The team plate's second column is always the per-match average. */
const TEAM_SECOND_LABEL = 'Avg';
/** Rows a statistics plate shows per page (the source pages its own plate at 20). */
export const STAT_PAGE_SIZE = 25;

/** The metrics as the page's dropdowns list them — label and id only, so the
 *  client never carries the column reads. */
export const PLAYER_METRIC_OPTIONS: readonly NowgoalStatMetric[] = PLAYER_METRICS.map(
  ({ id, label }) => ({ id, label }),
);
export const TEAM_METRIC_OPTIONS: readonly NowgoalStatMetric[] = TEAM_METRICS.map(
  ({ id, label }) => ({ id, label }),
);

/** One plate turned into what the page renders: pick the metric, rank every row
 *  by it (descending, as the source does), then hand over one page of formatted
 *  rows. A metric id the plate does not have falls back to its first metric, so
 *  a stale link still lands on real numbers. */
function buildStatTable(
  metrics: readonly StatMetric[],
  source: { name: string; photo: string; teamName: string; teamCrest: string; columns: number[] }[],
  metricId: string,
  secondLabel: string,
  page: number,
): NowgoalStatTable {
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const ranked = [...source].sort(
    (a, b) => (b.columns[metric.sort] ?? 0) - (a.columns[metric.sort] ?? 0),
  );
  const pageCount = Math.max(1, Math.ceil(ranked.length / STAT_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * STAT_PAGE_SIZE;
  return {
    secondLabel: metric.second ? secondLabel : '',
    rows: ranked.slice(start, start + STAT_PAGE_SIZE).map((row, index) => ({
      rank: start + index + 1,
      name: row.name,
      photo: row.photo,
      teamName: row.teamName,
      teamCrest: row.teamCrest,
      value: metric.value(row.columns),
      second: metric.second ? metric.second(row.columns) : '',
    })),
    page: current,
    pageCount,
    total: ranked.length,
  };
}

/** The player plate of a season: one metric, one page. */
export function playerStats(data: NowgoalSeasonData, metricId: string, page: number): NowgoalStatTable {
  return buildStatTable(
    PLAYER_METRICS,
    data.players.map((p) => ({
      name: p.name,
      photo: playerPhoto(p.photo),
      teamName: p.teamName,
      teamCrest: p.teamCrest,
      columns: p.columns,
    })),
    metricId,
    PLAYER_SECOND_LABEL,
    page,
  );
}

/** The team plate of a season. A team row is the team itself, so its crest is
 *  the row's only badge. */
export function teamStats(data: NowgoalSeasonData, metricId: string, page: number): NowgoalStatTable {
  return buildStatTable(
    TEAM_METRICS,
    data.teamRows.map((row) => ({
      name: row.team.name,
      photo: row.team.crest,
      teamName: '',
      teamCrest: '',
      columns: row.columns,
    })),
    metricId,
    TEAM_SECOND_LABEL,
    page,
  );
}

/* ------------------------------------------------------------------------- *
 * Reading them off the network. Both readers are cached through `next.revalidate`,
 * so a tab switch does not re-read a file the previous tab just read.
 * ------------------------------------------------------------------------- */

/** One `/jsData/…` file, parsed. `null` for anything that is not JSON —
 *  including the HTML error page this host serves with HTTP 200 in place of a
 *  file it does not have. The files carry a UTF-8 BOM, which `JSON.parse`
 *  rejects, so it is stripped first. */
async function fetchJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${NOWGOAL_FOOTBALL_ORIGIN}${path}`, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json,text/javascript,*/*;q=0.8',
        referer: `${NOWGOAL_FOOTBALL_ORIGIN}/league/`,
      },
      next: { revalidate },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return JSON.parse((await res.text()).replace(/^\uFEFF/, '')) as T;
  } catch {
    return null;
  }
}

/** The seasons a competition publishes, newest first — the list its own season
 *  dropdown is built from. */
export async function getSeasonList(id: string): Promise<string[]> {
  const file = await fetchJson<{ SeasonList?: unknown }>(
    `/jsData/leagueSeason/sea${id}.json`,
    SEASON_LIST_REVALIDATE,
  );
  const list = file?.SeasonList;
  return Array.isArray(list)
    ? list.filter((season): season is string => typeof season === 'string' && season.length > 0)
    : [];
}

/** One season of one competition: the season file and the statistics plate,
 *  read together. `null` when the season file is not there — a season the
 *  publisher has no results for yet, or an id it does not know. */
export async function getSeason(
  id: string,
  kind: 'league' | 'cup',
  season: string,
): Promise<NowgoalSeasonData | null> {
  const [file, players] = await Promise.all([
    fetchJson<unknown>(
      `/jsData/matchResult/json/${season}/${kind === 'cup' ? 'c' : 's'}${id}_en.json`,
      SEASON_REVALIDATE,
    ),
    fetchJson<RawPlayerFile>(
      `/jsData/Count/json/${season}/playerTech_${id}_en.json`,
      PLAYER_STATS_REVALIDATE,
    ),
  ]);
  return readSeasonFile(file, players);
}

