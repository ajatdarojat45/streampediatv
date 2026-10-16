// NowGoal player detail — the player's own page at
// `https://football.nowgoal50.com/team/player/{id}`, behind `/players/[id]`.
//
// That page opens on a single file and nothing else, and its inline script names
// it, so nothing here guesses a path:
//
//   detail file  /jsData/playerInfo/player{id}_en.json (`_dataPath`)
//     PlayerInfo      the player himself, sixteen fields — see INFO_COLUMN
//     RadarInfo       [kind, six values] — his attributes on the publisher's own
//                     0–100 scale (`max:100` of its radar). A `kind` of `1`
//                     files the six the publisher labels PAC, SHO, PHY, PAS,
//                     DEF and DRI; any other value files the goalkeeper's DIV,
//                     HAN, POS, KIC, SPD and REF. Its locale publishes the
//                     abbreviations and no longer name for either set.
//     playerCount     one row per match the player is filed in, newest first,
//                     carrying his own numbers for it — see MATCH_COLUMN.
//                     A player with a hundred and ninety of them is the normal
//                     case, and this one list is also what the statistics plate
//                     is added up from (the publisher's own `initTechStats`
//                     sums exactly these columns), so the two tabs never
//                     disagree.
//     TransferInfo    one row per move of his career, oldest first — see
//                     TRANSFER_COLUMN
//     CountSum        the publisher's own totals for the *coach* plate: its
//                     script reads it only when `_isCoach` is set, and publishes
//                     no legend for its thirty-two columns, so it is not read
//                     here.
//     LastUpdateTime  when the file was written
//
// Two habits of the host are inherited from lib/nowgoalLeague.ts: a file it does
// not have is answered with an HTML error page at HTTP 200 (so the parse is the
// health check — a coach's id lands there, since a coach and a player are not
// filed under the same path), and every stamp is GMT+8 wall clock written
// `2026-09-02 03:00` (so `kickoffMs` reads it as such).
//
// One number is deliberately *not* the publisher's: a rating of `0` is a match
// the publisher published no rating for, not a rating of zero, so the plate's
// average rating is taken over the matches that carry one. Every other count,
// and the rates the plate derives from them, is the publisher's own arithmetic,
// label for label (`renderTechData` of its page).

import { NOWGOAL_FOOTBALL_ORIGIN, NOWGOAL_IMAGE_ORIGIN } from './nowgoal';
import { kickoffMs, competitionCrest, plainText, playerPhoto, teamCrest } from './nowgoalLeague';
import { transferType } from './nowgoalTeam';
import type {
  NowgoalPlayerAttribute,
  NowgoalPlayerFact,
  NowgoalPlayerInfo,
  NowgoalPlayerMatch,
  NowgoalPlayerMatchStats,
  NowgoalPlayerSeasonStats,
  NowgoalPlayerStatBlock,
  NowgoalPlayerTransfer,
} from './types';

/** A file the page has not answered by then is a bad day; the page says so. */
const FETCH_TIMEOUT_MS = 10_000;
/** The file carries the player's own match log, which gains a row, its minutes
 *  and its rating when a match ends — so it is read as often as a club's
 *  schedule is (lib/nowgoalTeam.ts). */
const PLAYER_REVALIDATE = 5 * 60;
/** The host answers its own pages, not bare clients. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Matches one page of the player's own log holds — the publisher's own pager
 *  (`const i = 10` of its `initSchedule`). */
export const MATCHES_PER_PAGE = 10;

/** Country flags, addressed by country id — the template the publisher's own
 *  fixture rows use (`_miniCountryPicUrl`). */
const COUNTRY_FLAG_PATH = '/mini/fbcountry/';

/** The publisher's own names for the feet of `PlayerInfo` index 14
 *  (`T_LeftFoot`, `T_RightFoot`, `T_BothFoot`). */
const FEET: Record<string, string> = { '0': 'Left', '1': 'Right', '2': 'Both' };

/** The two attribute sets of `RadarInfo`, in the order it files them: a `kind`
 *  of `1` carries the outfield six the publisher labels `T_Attribute_PAC` …
 *  `T_Attribute_DRI`, any other kind the goalkeeper's `T_Attribute_DIV` … */
const OUTFIELD_ATTRIBUTES: readonly string[] = ['PAC', 'SHO', 'PHY', 'PAS', 'DEF', 'DRI'];
const KEEPER_ATTRIBUTES: readonly string[] = ['DIV', 'HAN', 'POS', 'KIC', 'SPD', 'REF'];

/** The fields of `PlayerInfo`, in the order the file writes them — the
 *  positions its own `initHeadInfo` reads. */
const INFO_COLUMN = {
  id: 0,
  name: 1,
  photo: 2,
  teamId: 3,
  teamName: 4,
  teamLogo: 5,
  country: 6,
  countryFlag: 7,
  number: 8,
  /** In £10k units (the publisher's own `toExp` divides by 100). */
  value: 9,
  contractExpiry: 10,
  birthday: 11,
  height: 12,
  weight: 13,
  foot: 14,
  /** The competition the page opens its statistics on. */
  competitionId: 15,
} as const;

/** The columns of a `playerCount` row this module reads. They are named by the
 *  publisher's own readers — `initSchedule` for the fixture row it prints and
 *  `initTechStats` for the statistics plate it adds up — so none of them is
 *  inferred from position alone. The columns neither of those reads are left
 *  unnamed here, so nothing this module returns is a field the source itself
 *  never puts on screen. */
const MATCH_COLUMN = {
  id: 0,
  homeId: 1,
  awayId: 2,
  stamp: 3,
  competition: 4,
  homeName: 6,
  awayName: 7,
  homeScore: 8,
  awayScore: 9,
  goals: 11,
  penalties: 12,
  red: 13,
  yellow: 14,
  offsides: 15,
  best: 16,
  rating: 17,
  shots: 18,
  shotsOnTarget: 19,
  assists: 20,
  passes: 21,
  passesCompleted: 22,
  keyPasses: 23,
  longPasses: 24,
  throughBalls: 25,
  breakLoose: 26,
  fouled: 27,
  fouls: 28,
  interceptions: 29,
  blocked: 30,
  steals: 31,
  tackles: 33,
  headers: 35,
  clearances: 36,
  minutes: 38,
  season: 39,
  competitionId: 40,
  countryId: 41,
  highlights: 42,
  twoYellow: 43,
} as const;

/** The fields of a `TransferInfo` row, as the page's own `initTransfer` reads
 *  them. */
const TRANSFER_COLUMN = {
  season: 0,
  fromTeamId: 1,
  toTeamId: 2,
  date: 3,
  /** The day the spell ended, which the page's own list does not print. */
  endDate: 4,
  /** In £10k units, `''` for an undisclosed move. */
  fee: 5,
  /** The publisher's own 1…5, which `transferType` names. */
  type: 6,
  fromTeamName: 7,
  toTeamName: 8,
  fromLogo: 9,
  toLogo: 10,
} as const;

/** A positional row of this file. */
type RawRow = readonly unknown[];
/** The player's own file, parsed. */
type RawFile = Record<string, unknown>;

/** Text of a field. The file mixes strings and numbers in the same positions,
 *  so a number reads as its own digits rather than as empty. */
const str = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/** A whole number of a field, `0` for anything that is not one. */
const int = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/** A positive number of a field — a value, a rating, a height — or `null`,
 *  which is how these fields say "not published" (an empty string, a `0`). */
const positive = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** A value the file stores in £10k units, in millions of pounds. `null` when
 *  the file has none — the page's own `toExp` divides by 100 the same way. */
function millions(value: unknown): number | null {
  const tenThousands = positive(value);
  return tenThousands === null ? null : tenThousands / 100;
}

/** The dates of this file are already written `2026-09-02`; anything else is
 *  dropped rather than shown as a stamp that would have to be guessed at. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isoDate(value: unknown): string {
  const text = str(value).trim();
  return ISO_DATE.test(text) ? text : '';
}

/** Country flag of a competition, `''` without an id. */
function countryFlag(id: string): string {
  return id ? `${NOWGOAL_IMAGE_ORIGIN}${COUNTRY_FLAG_PATH}${id}-flag-small.png` : '';
}

/** Age in years at a given day, the way the page's own `calculateAge` reads it:
 *  the year difference, one year less until the birthday has come round. */
function ageAt(birthday: string, today: Date): number | null {
  const m = birthday.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const age =
    today.getUTCFullYear() -
    Number(m[1]) -
    (today.getUTCMonth() + 1 < Number(m[2]) ||
    (today.getUTCMonth() + 1 === Number(m[2]) && today.getUTCDate() < Number(m[3]))
      ? 1
      : 0);
  return age >= 0 ? age : null;
}

/** The player's own attributes (`RadarInfo`): its first field files which set of
 *  six the rest are, and the labels are the publisher's own abbreviations. */
function readAttributes(radar: unknown): NowgoalPlayerAttribute[] {
  if (!Array.isArray(radar) || radar.length < 7) return [];
  const row = radar as RawRow;
  const keys = int(row[0]) === 1 ? OUTFIELD_ATTRIBUTES : KEEPER_ATTRIBUTES;
  return keys.map((key, index) => ({ key, value: int(row[index + 1]) }));
}

/** The player himself (`PlayerInfo` and `RadarInfo`), with the instant the file
 *  says it was last written. */
function readInfo(
  row: RawRow,
  radar: unknown,
  updatedMs: number | null,
  today: Date,
): NowgoalPlayerInfo {
  const id = str(row[INFO_COLUMN.id]);
  const teamId = str(row[INFO_COLUMN.teamId]);
  const birthday = isoDate(row[INFO_COLUMN.birthday]);
  return {
    id,
    name: plainText(row[INFO_COLUMN.name]) || `Player ${id}`,
    photo: playerPhoto(str(row[INFO_COLUMN.photo])),
    teamId,
    teamName: plainText(row[INFO_COLUMN.teamName]) || (teamId ? `Team ${teamId}` : ''),
    teamCrest: teamCrest(teamId, str(row[INFO_COLUMN.teamLogo])),
    country: plainText(row[INFO_COLUMN.country]),
    // The publisher's own header prints this one through the team image path
    // (`_cdnWebDomain + '/football/image/team/' + path`), which the crest helper
    // builds for any path it is handed.
    countryFlag: teamCrest('', str(row[INFO_COLUMN.countryFlag])),
    number: str(row[INFO_COLUMN.number]),
    valueMillions: millions(row[INFO_COLUMN.value]),
    contractExpiry: isoDate(row[INFO_COLUMN.contractExpiry]),
    birthday,
    age: ageAt(birthday, today),
    heightCm: positive(row[INFO_COLUMN.height]),
    weightKg: positive(row[INFO_COLUMN.weight]),
    foot: FEET[str(row[INFO_COLUMN.foot])] ?? '',
    competitionId: str(row[INFO_COLUMN.competitionId]),
    // The player's competition badge, addressed the way every other crest in
    // the app is (the site's own `_miniLeaguePicUrl`).
    competitionCrest: competitionCrest(str(row[INFO_COLUMN.competitionId])),
    attributes: readAttributes(radar),
    updatedMs,
  };
}

/** The player's own numbers of one log row, column for column — the same ones
 *  the publisher's own statistics plate adds up. */
function readMatchStats(row: RawRow): NowgoalPlayerMatchStats {
  const at = (column: number) => int(row[column]);
  return {
    minutes: at(MATCH_COLUMN.minutes),
    // The publisher files a `0` for a match it published no rating for, which
    // is not a rating of zero — the plate averages the rated matches only.
    rating: positive(row[MATCH_COLUMN.rating]),
    goals: at(MATCH_COLUMN.goals),
    penalties: at(MATCH_COLUMN.penalties),
    assists: at(MATCH_COLUMN.assists),
    red: at(MATCH_COLUMN.red),
    yellow: at(MATCH_COLUMN.yellow),
    twoYellow: at(MATCH_COLUMN.twoYellow),
    shots: at(MATCH_COLUMN.shots),
    shotsOnTarget: at(MATCH_COLUMN.shotsOnTarget),
    fouled: at(MATCH_COLUMN.fouled),
    offsides: at(MATCH_COLUMN.offsides),
    best: at(MATCH_COLUMN.best),
    passes: at(MATCH_COLUMN.passes),
    passesCompleted: at(MATCH_COLUMN.passesCompleted),
    keyPasses: at(MATCH_COLUMN.keyPasses),
    longPasses: at(MATCH_COLUMN.longPasses),
    throughBalls: at(MATCH_COLUMN.throughBalls),
    breakLoose: at(MATCH_COLUMN.breakLoose),
    tackles: at(MATCH_COLUMN.tackles),
    interceptions: at(MATCH_COLUMN.interceptions),
    clearances: at(MATCH_COLUMN.clearances),
    steals: at(MATCH_COLUMN.steals),
    blocked: at(MATCH_COLUMN.blocked),
    headers: at(MATCH_COLUMN.headers),
    fouls: at(MATCH_COLUMN.fouls),
  };
}

/** One match of the log into the page's own shape. A row the file names no match
 *  for is dropped rather than rendered blank. */
function readMatch(row: RawRow): NowgoalPlayerMatch | null {
  const id = str(row[MATCH_COLUMN.id]);
  if (!id) return null;
  const homeId = str(row[MATCH_COLUMN.homeId]);
  const awayId = str(row[MATCH_COLUMN.awayId]);
  const competitionId = str(row[MATCH_COLUMN.competitionId]);
  return {
    id,
    // The log's stamps are the host's GMT+8 wall clock (`2026-09-02 03:00`),
    // which is how `kickoffMs` reads every stamp of these files.
    kickoffMs: kickoffMs(str(row[MATCH_COLUMN.stamp])),
    competitionId,
    competition: plainText(row[MATCH_COLUMN.competition]) || `Competition ${competitionId}`,
    countryFlag: countryFlag(str(row[MATCH_COLUMN.countryId])),
    home: {
      id: homeId,
      name: plainText(row[MATCH_COLUMN.homeName]) || `Team ${homeId}`,
      crest: teamCrest(homeId),
    },
    away: {
      id: awayId,
      name: plainText(row[MATCH_COLUMN.awayName]) || `Team ${awayId}`,
      crest: teamCrest(awayId),
    },
    // The log carries only the matches the player appeared in, so both scores
    // are always published — read as published, `2-1`.
    score: `${int(row[MATCH_COLUMN.homeScore])}-${int(row[MATCH_COLUMN.awayScore])}`,
    season: str(row[MATCH_COLUMN.season]),
    stats: readMatchStats(row),
    highlights: str(row[MATCH_COLUMN.highlights]),
  };
}

/** One move of his career. A row that names neither club is dropped. */
function readTransfer(row: RawRow): NowgoalPlayerTransfer | null {
  const teamId = str(row[TRANSFER_COLUMN.toTeamId]);
  const fromTeamId = str(row[TRANSFER_COLUMN.fromTeamId]);
  if (!teamId && !fromTeamId) return null;
  const fromName = plainText(row[TRANSFER_COLUMN.fromTeamName]);
  const toName = plainText(row[TRANSFER_COLUMN.toTeamName]);
  return {
    season: str(row[TRANSFER_COLUMN.season]),
    teamId,
    teamName: toName || (teamId ? `Team ${teamId}` : ''),
    teamCrest: teamCrest(teamId, str(row[TRANSFER_COLUMN.toLogo])),
    fromTeamId,
    fromTeamName: fromName || (fromTeamId ? `Team ${fromTeamId}` : ''),
    fromTeamCrest: teamCrest(fromTeamId, str(row[TRANSFER_COLUMN.fromLogo])),
    feeMillions: millions(row[TRANSFER_COLUMN.fee]),
    date: isoDate(row[TRANSFER_COLUMN.date]),
    type: transferType(row[TRANSFER_COLUMN.type]),
  };
}

/** One key of the file's own rows, or `[]`. */
function rowsOf(file: RawFile, key: string): RawRow[] {
  const rows = file[key];
  return Array.isArray(rows) ? (rows.filter((row) => Array.isArray(row)) as RawRow[]) : [];
}

/** The player's own file read into the page's shapes: himself, his whole match
 *  log and his whole career of moves. The log is kept whole on the server — the
 *  statistics tab and the matches tab both cut from it, and only the one page of
 *  the tab that is open ever reaches the browser (`app/players/[id]/page.tsx`).
 */
export interface NowgoalPlayerDetail {
  info: NowgoalPlayerInfo;
  /** One row per match he appeared in, newest first. */
  matches: NowgoalPlayerMatch[];
  /** His career moves, newest first. */
  transfers: NowgoalPlayerTransfer[];
}

/** The player's own file read into the page's shapes. Its four keys are read
 *  together — one request answers every tab — and the match log keeps the order
 *  the file publishes it in, newest first. */
export function readPlayerDetail(payload: unknown, today = new Date()): NowgoalPlayerDetail | null {
  if (!payload || typeof payload !== 'object') return null;
  const file = payload as RawFile;
  const info = Array.isArray(file.PlayerInfo) ? (file.PlayerInfo as RawRow) : null;
  if (!info || !info.length) return null;
  return {
    info: readInfo(
      info,
      file.RadarInfo,
      // The file's own stamp is the GMT+8 wall clock every stamp of this host
      // is, which is why it goes through the same reader a kick-off does.
      kickoffMs(str(file.LastUpdateTime)),
      today,
    ),
    matches: rowsOf(file, 'playerCount')
      .map(readMatch)
      .filter((match): match is NowgoalPlayerMatch => match !== null),
    transfers: rowsOf(file, 'TransferInfo')
      .map(readTransfer)
      .filter((transfer): transfer is NowgoalPlayerTransfer => transfer !== null)
      // The file publishes the moves oldest first; a career is read newest
      // first, and a move with no date published sorts last rather than first.
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  };
}

/* ------------------------------------------------------------------------- *
 * The statistics plate. It is the player's own match log added up per
 * competition and season — the publisher's own page builds exactly the same
 * plate from exactly the same rows (`initTechStats`), so the two agree number
 * for number; the difference is only that this one is summed on the server.
 * ------------------------------------------------------------------------- */

/** The four blocks of the plate, with the publisher's own labels
 *  (`techImportant`, `techOffensive`, `techPassing`, `techDefensive` of its
 *  page). */
const PLATE_BLOCKS: readonly string[] = ['Important', 'Offensive', 'Passing', 'Defensive'];

/** The player's own numbers for one competition and one season of his log.
 *  `null` when the log files him in no match of them, which is a season the
 *  page's own dropdowns never offer. */
export function playerSeasonStats(
  matches: NowgoalPlayerMatch[],
  competitionId: string,
  season: string,
): NowgoalPlayerSeasonStats | null {
  const rows = matches.filter(
    (match) => match.competitionId === competitionId && match.season === season,
  );
  if (!rows.length) return null;

  /** The rows' own total of one column. */
  const sum = (of: (stats: NowgoalPlayerMatchStats) => number): number =>
    rows.reduce((total, row) => total + of(row.stats), 0);

  const plays = rows.length;
  const minutes = sum((s) => s.minutes);
  // Only the matches the publisher published a rating for are averaged — see
  // the note at the top of this file.
  const ratings = rows
    .map((row) => row.stats.rating)
    .filter((rating): rating is number => rating !== null);
  const avgRating = ratings.length
    ? (ratings.reduce((total, rating) => total + rating, 0) / ratings.length).toFixed(2)
    : '—';
  const goals = sum((s) => s.goals);
  const penalties = sum((s) => s.penalties);
  const assists = sum((s) => s.assists);
  const red = sum((s) => s.red);
  const yellow = sum((s) => s.yellow);
  /** The goals that were not penalties, which the plate's own rates are built
   *  from (`goal - penalty` of its `renderTechData`). */
  const openGoals = Math.max(0, goals - penalties);
  const shots = sum((s) => s.shots);
  const passes = sum((s) => s.passes);
  const passesCompleted = sum((s) => s.passesCompleted);
  // The publisher's own reading of its three rates: one it cannot compute is
  // `0` or `0%`, never a blank.
  const perGoal = openGoals > 0 ? (minutes / openGoals).toFixed(1) : '0';
  const conversion = shots > 0 ? `${((openGoals * 100) / shots).toFixed(1)}%` : '0%';
  const passRate = passes > 0 ? `${((passesCompleted * 100) / passes).toFixed(1)}%` : '0%';

  const blocks: NowgoalPlayerStatBlock[] = [
    {
      label: PLATE_BLOCKS[0],
      facts: [
        { label: 'Plays', value: String(plays) },
        { label: 'Mins', value: String(minutes) },
        { label: 'Avg Rating', value: avgRating },
        { label: 'Goals(P)', value: penalties > 0 ? `${goals}(${penalties})` : String(goals) },
        { label: 'Assists', value: String(assists) },
        { label: 'Cards', value: `${red}/${yellow}` },
      ],
    },
    {
      label: PLATE_BLOCKS[1],
      facts: [
        { label: 'Mins/Goals', value: perGoal },
        { label: 'Shots', value: String(shots) },
        { label: 'Shots (SOG)', value: String(sum((s) => s.shotsOnTarget)) },
        { label: 'Conversion', value: conversion },
        { label: 'Fouled', value: String(sum((s) => s.fouled)) },
        { label: 'Offsides', value: String(sum((s) => s.offsides)) },
        { label: 'Best', value: String(sum((s) => s.best)) },
      ],
    },
    {
      label: PLATE_BLOCKS[2],
      facts: [
        { label: 'Passes', value: String(passes) },
        { label: 'Passes Success', value: passRate },
        { label: 'Key Passes', value: String(sum((s) => s.keyPasses)) },
        { label: 'Assists', value: String(assists) },
        { label: 'Long Passes', value: String(sum((s) => s.longPasses)) },
        { label: 'Through', value: String(sum((s) => s.throughBalls)) },
        { label: 'Break Loose', value: String(sum((s) => s.breakLoose)) },
      ],
    },
    {
      label: PLATE_BLOCKS[3],
      facts: [
        { label: 'Tackles', value: String(sum((s) => s.tackles)) },
        { label: 'Interceptions', value: String(sum((s) => s.interceptions)) },
        { label: 'Clearances', value: String(sum((s) => s.clearances)) },
        { label: 'Steal', value: String(sum((s) => s.steals)) },
        { label: 'Blocked', value: String(sum((s) => s.blocked)) },
        { label: 'Header', value: String(sum((s) => s.headers)) },
        { label: 'Fouls', value: String(sum((s) => s.fouls)) },
      ],
    },
  ];

  return { competitionId, competition: rows[0].competition, season, matches: plays, blocks };
}

/* ------------------------------------------------------------------------- *
 * Reading it off the network. Cached through `next.revalidate`, so moving
 * between the four tabs of one player is a single upstream read.
 * ------------------------------------------------------------------------- */

/** What one read of the host answered, before the payload is read into the
 *  page's shapes. It is the same three-way split lib/nowgoalTeam.ts uses: a
 *  404 and a payload that is not the file are both `missing` (the host does
 *  answer a file it does not have with an HTML error page at HTTP 200, so the
 *  parse is the health check), while a request that never completed is
 *  `unavailable`. */
type FetchOutcome<T> =
  | { status: 'ok'; data: T }
  | { status: 'missing' | 'unavailable' };

async function fetchJson<T>(
  path: string,
  revalidate: number,
  playerId: string,
): Promise<FetchOutcome<T>> {
  try {
    const res = await fetch(`${NOWGOAL_FOOTBALL_ORIGIN}${path}`, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json,text/javascript,*/*;q=0.8',
        // The host answers this file for its own player page, so the request
        // says which page it is made from — the id the page it is read for.
        referer: `${NOWGOAL_FOOTBALL_ORIGIN}/team/player/${playerId}/`,
      },
      next: { revalidate },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) return { status: 'unavailable' };
    try {
      return { status: 'ok', data: JSON.parse((await res.text()).replace(/^\uFEFF/, '')) as T };
    } catch {
      return { status: 'missing' };
    }
  } catch {
    return { status: 'unavailable' };
  }
}

/** What a read of the player's own file came back with. */
export type NowgoalPlayerDetailRead =
  | { status: 'ok'; detail: NowgoalPlayerDetail }
  | { status: 'missing' | 'unavailable' };

/** The player's own file (`player{id}_en.json`) — the one file his page opens
 *  on, read into the page's shapes. A payload that is not that file is
 *  `missing`: the host answered, it just has no player for this id (a coach's id
 *  lands there, since coaches are filed elsewhere). A request that never
 *  completed stays `unavailable`, because an unreachable host says nothing about
 *  whether the player exists. */
export async function getPlayerDetail(id: string): Promise<NowgoalPlayerDetailRead> {
  const outcome = await fetchJson<unknown>(`/jsData/playerInfo/player${id}_en.json`, PLAYER_REVALIDATE, id);
  if (outcome.status !== 'ok') return { status: outcome.status };
  const detail = readPlayerDetail(outcome.data);
  return detail ? { status: 'ok', detail } : { status: 'missing' };
}






