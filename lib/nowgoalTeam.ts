// NowGoal club detail — the club's own page at
// `https://football.nowgoal50.com/team/summary/{id}`, behind `/teams/[id]`.
//
// That page opens on one file and two endpoints, and its inline script names
// every one of them, so nothing here guesses a path:
//
//   detail file  /jsdata/teamInfo/teamdetail/json/tdl{id}_en.json (`_dataPath`)
//     TeamInfo        the club itself: [id, name, logoPath, city, stadium,
//                     capacity, founded, value in £M, average age, leagueId,
//                     league name, league logoPath]
//     lineupDetail    one row per player, the coach's own row included:
//                     [playerId, number, name, 0, birthday, height, weight,
//                     role, country, value (in £10k), contract expiry, …]
//     vanguard / midfielder / rearguard / goalkeeper
//                     the same players filed by group, carrying the photo path
//                     a lineup row does not have
//     coach           [[coachId, '', name, 0, photoPath]]
//     TeamHonor       [[title, '75/76,48/49,…', honourId]]
//     teamCharacter   [[group, level, text]] — the publisher's own style notes,
//                     with no legend published for the two fields that file
//                     them, so only the texts are kept
//     PlayerStatsSclassList   [[sclassId, name, [season, …]]] — the
//                     competitions whose player plate the club has numbers in
//     TeamOrderInfo   [[sclassId, sub (0/1), name, cup (0/1),
//                     [[season, sectionId, section], …]]] — the competitions
//                     the club played in, each season with the section of that
//                     competition's own season file its matches are filed under
//                     (a sub-league's section, a cup's group)
//     TransferSeason  ['2026', '2025', …], newest first
//     teamLastUpdateTime  when the file was written
//
//   schedule   /ajax/getteamschedulebypageno?id={id}&pageNo={n}&sclassId={c}&init={0|1}
//              {MatchList, SclassList, TotalPages, PlayingPage} — ten fixtures
//              to a page, newest first. `init=1` answers with the paging
//              metadata, the competition list and the five pages from `pageNo`
//              on; `init=0` answers with the requested page alone, which is how
//              the page's own pager asks for a page it did not cache. The page
//              opens on `PlayingPage`, the page the current date falls on, so
//              the club's most recently played fixtures are what a visitor
//              lands on rather than the far end of its calendar.
//   transfers  /ajax/GetTeamTransferByYear?teamId={id}&year={year}
//              one row per move: {playerId, playerName, playerPic, teamId,
//              money, time, type, isJoined} — `isJoined` files the arrivals and
//              `type` is the publisher's own 1…5, which its own label map names
//              Full Ownership, Loan, Free Transfer, End of loan, Co-ownership.
//
// The statistics and standing tabs read nothing of their own: they are the
// competition's season file
// (`/jsData/matchResult/json/{season}/{s|c}{id}_en.json` — see
// lib/nowgoalLeague.ts), which already carries the club's fixtures, its row of
// every table view and the section each of those belongs to.
//
// Two habits of the host are inherited from that module: a file it does not have
// is answered with an HTML error page at HTTP 200 (so the parse is the health
// check), and every stamp is GMT+8 wall clock written `2027/5/31 0:30:00` (so
// `kickoffMs` is handed the slashes turned into dashes, exactly as the page's
// own `E8Date` does).

import { NOWGOAL_FOOTBALL_ORIGIN, NOWGOAL_IMAGE_ORIGIN } from './nowgoal';
import {
  competitionCrest,
  fixtureNote,
  kickoffMs,
  plainText,
  playerPhoto,
  teamCrest,
} from './nowgoalLeague';
import type {
  NowgoalFixture,
  NowgoalHonour,
  NowgoalSeasonData,
  NowgoalSquadPlayer,
  NowgoalStandingTable,
  NowgoalTeamCompetition,
  NowgoalTeamFact,
  NowgoalTeamFixture,
  NowgoalTeamForm,
  NowgoalTeamInfo,
  NowgoalTeamRecord,
  NowgoalTeamSeasonStats,
  NowgoalTeamStanding,
  NowgoalTeamTransfer,
  NowgoalViewOption,
} from './types';

/** The club's own file is rewritten through the day during a transfer window. */
const TEAM_REVALIDATE = 30 * 60;
/** Fixtures and results move during a match, so the schedule is read like a
 *  competition's season file is. */
const SCHEDULE_REVALIDATE = 5 * 60;
/** Transfers move in windows, not minutes. */
const TRANSFER_REVALIDATE = 30 * 60;
/** A file that has not answered by then is a bad day; the page says so. */
const FETCH_TIMEOUT_MS = 10_000;
/** The host answers its own pages, not bare clients. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Fixtures one page of the endpoint's own pager holds. */
const FIXTURES_PER_PAGE = 10;
/** Country flags, addressed by country id — the template the page's own fixture
 *  rows use (`_miniCountryPicUrl`). */
const COUNTRY_FLAG_PATH = '/mini/fbcountry/';

/** The publisher's own names for the five kinds of move (`transferTypeText`). */
const TRANSFER_TYPES: Record<number, string> = {
  1: 'Full Ownership',
  2: 'Loan',
  3: 'Free Transfer',
  4: 'End of loan',
  5: 'Co-ownership',
};

/** How the region pills of a club's table read — the publisher labels its own
 *  total view `Total`, but the club page names the three views the way its own
 *  schedule filter names its competitions. */
const REGION_LABELS: Record<'all' | 'home' | 'away', string> = {
  all: 'All',
  home: 'Home',
  away: 'Away',
};

/** The groups the file files a squad under, in the publisher's own order — the
 *  order its own lineup list sorts by — with the labels it gives them. */
const SQUAD_GROUPS: readonly { key: string; label: string }[] = [
  { key: 'vanguard', label: 'Forward' },
  { key: 'midfielder', label: 'Midfielder' },
  { key: 'rearguard', label: 'Defender' },
  { key: 'goalkeeper', label: 'Goalkeeper' },
];

/** A positional row of the club's own file. */
type RawRow = readonly unknown[];
/** The club's own file, parsed. */
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

/** A positive number of a field — a rating, a value — or `null`, which is how
 *  these fields say "not published" (an empty string, a `0`). */
const positive = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Country flag of a competition (`_miniCountryPicUrl`), `''` without an id. */
function countryFlag(id: string): string {
  return id ? `${NOWGOAL_IMAGE_ORIGIN}${COUNTRY_FLAG_PATH}${id}-flag-small.png` : '';
}

/** The kind of move a `type` field names, or `''` for one the map does not
 *  carry. */
export function transferType(value: unknown): string {
  return TRANSFER_TYPES[int(value)] ?? '';
}

/** The file's stamps are `2027/5/31 0:30:00` — GMT+8 wall clock, slashes and
 *  all (see the note at the top of this file). */
function matchStamp(raw: unknown): number | null {
  return typeof raw === 'string' ? kickoffMs(raw.replace(/\//g, '-')) : null;
}

/** A transfer's date, published `04-09-2026` (day first), turned into
 *  `2026-09-04`. It stays a plain date: the field carries no time, so reading
 *  it as an instant would put the move on the previous day for a viewer west of
 *  the host's own clock. */
function transferDate(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const m = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : raw.trim();
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

/** The file's own rows of one key, or `[]`. */
function rowsOf(file: RawFile, key: string): RawRow[] {
  const rows = file[key];
  return Array.isArray(rows) ? (rows.filter((row) => Array.isArray(row)) as RawRow[]) : [];
}

/** The photos and groups of a squad, by player id: only the four position lists
 *  carry a photo, and only they say which group a player is filed under. */
function readSquadIndex(file: RawFile): Map<string, { group: string; photo: string }> {
  const index = new Map<string, { group: string; photo: string }>();
  for (const group of SQUAD_GROUPS) {
    for (const row of rowsOf(file, group.key)) {
      const id = str(row[0]);
      if (id) index.set(id, { group: group.label, photo: str(row[4]) });
    }
  }
  return index;
}

/** The squad the file lists, in the publisher's own order: its position groups
 *  (strikers first, as its own lineup list sorts them), then the best valued
 *  player and the lowest shirt number within a group — the same three keys its
 *  own sort uses. The coach's row is dropped: it is filed in `lineupDetail` too,
 *  and the head of the page shows him separately. */
function readSquad(file: RawFile, today: Date): NowgoalSquadPlayer[] {
  const index = readSquadIndex(file);
  const coach = new Set(rowsOf(file, 'coach').map((row) => str(row[0])));
  const order = new Map(SQUAD_GROUPS.map((group, position) => [group.label, position + 1]));
  const squad: NowgoalSquadPlayer[] = [];
  for (const row of rowsOf(file, 'lineupDetail')) {
    const id = str(row[0]);
    if (!id || coach.has(id)) continue;
    const where = index.get(id);
    const birthday = str(row[4]);
    // The file publishes a player's value in £10k units (`50` is £0.5M) — the
    // same conversion the page's own `toExp` makes.
    const value = positive(row[9]);
    squad.push({
      id,
      name: plainText(row[2]) || `Player ${id}`,
      photo: playerPhoto(where?.photo ?? ''),
      number: str(row[1]),
      group: where?.group ?? '',
      role: plainText(row[7]),
      birthday,
      age: ageAt(birthday, today),
      heightCm: positive(row[5]),
      weightKg: positive(row[6]),
      country: plainText(row[8]),
      valueMillions: value === null ? null : value / 100,
      contractExpiry: str(row[10]),
    });
  }
  squad.sort(
    (a, b) =>
      (order.get(a.group) ?? 99) - (order.get(b.group) ?? 99) ||
      (b.valueMillions ?? -1) - (a.valueMillions ?? -1) ||
      (int(a.number) || 99) - (int(b.number) || 99),
  );
  return squad;
}

/** The club's honours (`TeamHonor`), as published — the title with the seasons
 *  it was won in. */
function readHonours(file: RawFile): NowgoalHonour[] {
  return rowsOf(file, 'TeamHonor')
    .map((row) => ({
      title: plainText(row[0]),
      seasons: str(row[1])
        .split(',')
        .map((season) => season.trim())
        .filter(Boolean),
    }))
    .filter((honour) => honour.title);
}

/** The publisher's own style notes (`teamCharacter`). The two fields that file
 *  them carry no legend anywhere on the page, so only their texts are kept, in
 *  the file's own order — no label nobody publishes. */
function readTraits(file: RawFile): string[] {
  const traits = new Set<string>();
  for (const row of rowsOf(file, 'teamCharacter')) {
    const text = plainText(row[2]);
    if (text) traits.add(text);
  }
  return [...traits];
}

/** The competitions the file publishes a player plate for
 *  (`PlayerStatsSclassList`: `[sclassId, name, [season, …]]`). */
function readPlayerCompetitions(file: RawFile): NowgoalTeamCompetition[] {
  return rowsOf(file, 'PlayerStatsSclassList')
    .map((row) => ({
      id: str(row[0]),
      name: plainText(row[1]) || `Competition ${str(row[0])}`,
      // A player plate is a season file's statistics, so the file is a league's;
      // this list is only read for the players tab, which has no standing.
      kind: 'league' as const,
      seasons: (Array.isArray(row[2]) ? (row[2] as RawRow).map(str) : [])
        .filter(Boolean)
        .map((season) => ({ key: season, label: season })),
      sections: {},
    }))
    .filter((competition) => competition.id && competition.seasons.length);
}

/** The competitions the club played in, with the section of each competition's
 *  own season file its matches of that season are filed under
 *  (`TeamOrderInfo`: `[sclassId, sub (0/1), name, cup (0/1),
 *  [[season, sectionId, section], …]]`). */
function readSeasonCompetitions(file: RawFile): NowgoalTeamCompetition[] {
  return rowsOf(file, 'TeamOrderInfo')
    .map((row) => {
      const seasons: NowgoalViewOption[] = [];
      const sections: Record<string, string> = {};
      for (const entry of Array.isArray(row[4]) ? (row[4] as RawRow) : []) {
        // A cup files an entry `[season, groupId, group]` and a sub-league
        // `[season, sectionId, section]`; a competition with neither publishes
        // the season as a plain string.
        const season = Array.isArray(entry) ? str(entry[0]) : str(entry);
        if (!season || seasons.some((option) => option.key === season)) continue;
        seasons.push({ key: season, label: season });
        const section = Array.isArray(entry) ? str(entry[1]) : '';
        if (!section) continue;
        // What the section is stored as is the prefix its table keys carry: a
        // cup's group table is keyed `S{stage}{group}` (the publisher's own
        // `S${id}${name}`), a sub-league's section is keyed by its id alone.
        const group = Array.isArray(entry) ? str(entry[2]) : '';
        sections[season] =
          int(row[3]) === 1 ? `S${section}${group}` : section;
      }
      return {
        id: str(row[0]),
        name: plainText(row[2]) || `Competition ${str(row[0])}`,
        kind: int(row[3]) === 1 ? ('cup' as const) : ('league' as const),
        seasons,
        sections,
      };
    })
    .filter((competition) => competition.id && competition.seasons.length);
}

/** The club's own file read into the page's shapes. */
export interface NowgoalTeamDetail {
  info: NowgoalTeamInfo;
  squad: NowgoalSquadPlayer[];
  /** Competitions the file publishes a player plate for. */
  playerCompetitions: NowgoalTeamCompetition[];
  /** Competitions the club played in, with their sections. */
  seasonCompetitions: NowgoalTeamCompetition[];
  /** Transfer years the file publishes, newest first. */
  transferYears: string[];
}

/** Read the club's own file, or `null` when the payload is not one — the host
 *  answers a file it does not have with an HTML error page at HTTP 200, so the
 *  shape of what came back is the only health check. */
export function readTeamDetail(payload: unknown, today = new Date()): NowgoalTeamDetail | null {
  if (!payload || typeof payload !== 'object') return null;
  const file = payload as RawFile;
  const info = Array.isArray(file.TeamInfo) ? (file.TeamInfo as RawRow) : null;
  if (!info || !info.length) return null;
  const id = str(info[0]);
  const coach = rowsOf(file, 'coach')[0];
  return {
    info: {
      id,
      name: plainText(info[1]) || `Team ${id}`,
      crest: teamCrest(id, str(info[2])),
      city: plainText(info[3]),
      stadium: plainText(info[4]),
      capacity: positive(info[5]),
      founded: str(info[6]),
      valueMillions: positive(info[7]),
      avgAge: str(info[8]),
      leagueId: str(info[9]),
      leagueName: plainText(info[10]),
      // The club's competition badge, addressed the way every other crest in the
      // app is (the site's own `_miniLeaguePicUrl`).
      leagueCrest: competitionCrest(str(info[9])),
      coach: coach
        ? { id: str(coach[0]), name: plainText(coach[2]), photo: playerPhoto(str(coach[4])) }
        : null,
      honours: readHonours(file),
      traits: readTraits(file),
      updatedMs: kickoffMs(str(file.teamLastUpdateTime)),
    },
    squad: readSquad(file, today),
    playerCompetitions: readPlayerCompetitions(file),
    seasonCompetitions: readSeasonCompetitions(file),
    transferYears: (Array.isArray(file.TransferSeason) ? (file.TransferSeason as RawRow) : [])
      .map(str)
      .filter(Boolean),
  };
}


/* ------------------------------------------------------------------------- *
 * The club's own schedule endpoint. It publishes the two sides inline, so the
 * reader below needs no team table, and the page it opens on is the one the
 * endpoint itself flags as playing (`PlayingPage`).
 * ------------------------------------------------------------------------- */

/** One row of `MatchList`, as the endpoint publishes it. */
interface RawMatchRow {
  ID?: unknown;
  SclassID?: unknown;
  Time?: unknown;
  HomeName?: unknown;
  AwayName?: unknown;
  HomeID?: unknown;
  AwayID?: unknown;
  HomeScore?: unknown;
  AwayScore?: unknown;
  HomeRed?: unknown;
  AwayRed?: unknown;
  HomeRank?: unknown;
  AwayRank?: unknown;
  State?: unknown;
  Rating?: unknown;
  Explain?: unknown;
}

/** One competition of the endpoint's own list (`SclassList`). */
interface RawSclassRow {
  ID?: unknown;
  Name?: unknown;
  CountryID?: unknown;
}

/** One page of the schedule, plus what the endpoint says about the whole list. */
export interface NowgoalTeamSchedule {
  fixtures: NowgoalTeamFixture[];
  /** The page these fixtures are (`1` holds the club's newest fixture). */
  page: number;
  pageCount: number;
  /** Competitions the club's fixtures are filed under, `All` first. */
  competitions: NowgoalViewOption[];
}

/** One `MatchList` row into the page's own shape. The score is only read for a
 *  fixture that has been played or is being played: the endpoint publishes a
 *  `0-0` for anything else, which its own template turns into a dash. The aside
 *  goes through the league reader, which is what the page's own fixture template
 *  passes its `Explain` through too. */
function readTeamFixture(
  row: RawMatchRow,
  names: Map<string, string>,
  teamId: string,
): NowgoalTeamFixture | null {
  const id = str(row.ID);
  if (!id) return null;
  const homeId = str(row.HomeID);
  const awayId = str(row.AwayID);
  const state = int(row.State);
  const played = state === -1 || state > 0;
  const score = played ? `${int(row.HomeScore)}-${int(row.AwayScore)}` : '';
  let result: '' | 'W' | 'D' | 'L' = '';
  if (state === -1) {
    const goals = score.split('-').map(int);
    const own = homeId === teamId ? goals[0] : goals[1];
    const against = homeId === teamId ? goals[1] : goals[0];
    result = own > against ? 'W' : own === against ? 'D' : 'L';
  }
  const competitionId = str(row.SclassID);
  return {
    id,
    kickoffMs: matchStamp(row.Time),
    state,
    home: {
      id: homeId,
      name: plainText(row.HomeName) || `Team ${homeId}`,
      crest: teamCrest(homeId),
    },
    away: {
      id: awayId,
      name: plainText(row.AwayName) || `Team ${awayId}`,
      crest: teamCrest(awayId),
    },
    score,
    // This endpoint publishes no half-time score: the competition's own season
    // file is where one lives (see the fixtures tab of /competitions/[id]).
    halfScore: '',
    homeRed: int(row.HomeRed),
    awayRed: int(row.AwayRed),
    note: fixtureNote(row.Explain, 'league'),
    competitionId,
    competition: names.get(competitionId) ?? `Competition ${competitionId}`,
    countryFlag: '',
    rank: { home: str(row.HomeRank), away: str(row.AwayRank) },
    rating: positive(row.Rating),
    result,
  };
}

/** The endpoint's own competition list, `All` first — the key `0` it reads a
 *  missing competition as. */
function readSclassList(rows: unknown): NowgoalViewOption[] {
  const list = Array.isArray(rows) ? (rows as RawSclassRow[]) : [];
  return [
    { key: '0', label: 'All' },
    ...list
      .map((row) => ({ key: str(row.ID), label: plainText(row.Name) }))
      .filter((option) => option.key)
      .map((option) => ({ key: option.key, label: option.label || `Competition ${option.key}` })),
  ];
}

/** Competition names and country flags of the endpoint's own list, keyed by
 *  competition id — the label a fixture row carries and the flag its header
 *  prints beside the competition's name. */
function readSclassIndex(rows: unknown): { names: Map<string, string>; flags: Map<string, string> } {
  const names = new Map<string, string>();
  const flags = new Map<string, string>();
  for (const row of Array.isArray(rows) ? (rows as RawSclassRow[]) : []) {
    const id = str(row.ID);
    if (!id) continue;
    names.set(id, plainText(row.Name) || `Competition ${id}`);
    flags.set(id, countryFlag(str(row.CountryID)));
  }
  return { names, flags };
}

/** The country flag of one fixture's competition, for its own row. */
function withFlag(fixture: NowgoalTeamFixture, flags: Map<string, string>): NowgoalTeamFixture {
  return { ...fixture, countryFlag: flags.get(fixture.competitionId) ?? '' };
}



/* ------------------------------------------------------------------------- *
 * The statistics and standing tabs. Both are cut from one competition's season
 * file (lib/nowgoalLeague.ts), which already files the club's fixtures and its
 * row of every table view — so a number below either comes from the publisher's
 * own table or is counted off the fixtures it publishes, never estimated.
 * ------------------------------------------------------------------------- */

/** The tables one section of a competition publishes. A sub-league files its
 *  tables per section (`scope`), so the club's own section carries its own
 *  All/Home/Away views; a cup files its group tables under `S{stage}{group}`,
 *  which is the key prefix the club's own file names for the group it was drawn
 *  in. A section the file in hand does not have falls back to every table it
 *  does, which is what the publisher's own page does when a season's section is
 *  not in the file. */
function tablesFor(data: NowgoalSeasonData, sectionId: string): NowgoalStandingTable[] {
  if (!sectionId) return data.tables;
  const prefix = sectionId.startsWith('S') ? sectionId : `S${sectionId}`;
  const section = data.tables.filter(
    (table) => table.scope === sectionId || table.key.startsWith(prefix),
  );
  return section.length ? section : data.tables;
}

/** The region a table key names: `all` for a total table, `home`, `away` — or
 *  `''` for a table that is no region of anything (a cup group). */
function regionOf(key: string): 'all' | 'home' | 'away' | '' {
  const m = key.match(/(?:^|_)(all|home|away)$/);
  return m ? (m[1] as 'all' | 'home' | 'away') : '';
}

/** The key one region of a table group has: `all`/`home`/`away` for a league
 *  file, `S2948_all` for a section of a sub-league. */
function regionKey(key: string, region: 'all' | 'home' | 'away'): string {
  const m = key.match(/^(.*?)_?(?:all|home|away)$/);
  return m && m[1] ? `${m[1]}_${region}` : region;
}

/** One of the club's finished fixtures of a competition, from its own side. */
interface PlayedMatch {
  fixture: NowgoalFixture;
  /** The club's own goals, and the opponent's. */
  own: number;
  against: number;
  home: boolean;
}

/** The club's finished fixtures in one season file, oldest first. A fixture the
 *  file lists without a score is left out: it cannot add up to one. */
function playedMatches(data: NowgoalSeasonData, teamId: string): PlayedMatch[] {
  const matches: PlayedMatch[] = [];
  for (const round of data.rounds) {
    for (const fixture of round.fixtures) {
      const home = fixture.home.id === teamId;
      const away = fixture.away.id === teamId;
      if (fixture.state !== -1 || (!home && !away)) continue;
      const m = fixture.score.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!m) continue;
      matches.push({
        fixture,
        own: Number(home ? m[1] : m[2]),
        against: Number(home ? m[2] : m[1]),
        home,
      });
    }
  }
  matches.sort((a, b) => (a.fixture.kickoffMs ?? 0) - (b.fixture.kickoffMs ?? 0));
  return matches;
}

/** `W-D-L` of a run of matches. */
function record(matches: PlayedMatch[]): string {
  const win = matches.filter((m) => m.own > m.against).length;
  const draw = matches.filter((m) => m.own === m.against).length;
  return `${win}W ${draw}D ${matches.length - win - draw}L`;
}

/** The club's season numbers for one competition: its rows in the competition's
 *  table — every view the file publishes for its section — plus the facts its
 *  own finished fixtures add up to. */
export function teamSeasonStats(
  data: NowgoalSeasonData,
  teamId: string,
  sectionId: string,
): NowgoalTeamSeasonStats {
  const records: NowgoalTeamRecord[] = [];
  for (const table of tablesFor(data, sectionId)) {
    const row = table.rows.find((candidate) => candidate.team.id === teamId);
    if (row) records.push({ label: table.label, row });
  }

  const matches = playedMatches(data, teamId);
  const played = matches.length;
  const scored = matches.reduce((sum, m) => sum + m.own, 0);
  const conceded = matches.reduce((sum, m) => sum + m.against, 0);
  const perMatch = (total: number) => (played ? (total / played).toFixed(2) : '0.00');
  const widest = (list: PlayedMatch[], better: (a: PlayedMatch, b: PlayedMatch) => boolean) =>
    list.reduce<PlayedMatch | null>((best, m) => (!best || better(m, best) ? m : best), null);
  const wins = matches.filter((m) => m.own > m.against);
  const defeats = matches.filter((m) => m.own < m.against);
  const biggestWin = widest(wins, (a, b) => a.own - a.against > b.own - b.against);
  const heaviestDefeat = widest(defeats, (a, b) => b.own - b.against > a.own - a.against);
  const describe = (m: PlayedMatch) =>
    `${m.home ? `${m.own}-${m.against}` : `${m.against}-${m.own}`} v ${
      m.home ? m.fixture.away.name : m.fixture.home.name
    } (${m.home ? 'H' : 'A'})`;

  // The run the club is on now, read off its newest matches backwards.
  const newest = [...matches].reverse();
  const outcome = (m: PlayedMatch) => (m.own > m.against ? 'W' : m.own === m.against ? 'D' : 'L');
  const runWord: Record<string, string> = { W: 'Won', D: 'Drawn', L: 'Lost' };
  let streak = '';
  if (newest.length) {
    const last = outcome(newest[0]);
    let count = 0;
    while (count < newest.length && outcome(newest[count]) === last) count += 1;
    streak = `${runWord[last]} ${count}`;
  }

  const facts: NowgoalTeamFact[] = played
    ? [
        { label: 'Matches played', value: String(played) },
        { label: 'Goals scored', value: String(scored) },
        { label: 'Goals conceded', value: String(conceded) },
        { label: 'Goals per match', value: perMatch(scored) },
        { label: 'Conceded per match', value: perMatch(conceded) },
        { label: 'Clean sheets', value: String(matches.filter((m) => m.against === 0).length) },
        { label: 'Failed to score', value: String(matches.filter((m) => m.own === 0).length) },
        {
          label: 'Both teams scored',
          value: String(matches.filter((m) => m.own > 0 && m.against > 0).length),
        },
        {
          label: 'Over 2.5 goals',
          value: String(matches.filter((m) => m.own + m.against > 2.5).length),
        },
        { label: 'Home record', value: record(matches.filter((m) => m.home)) },
        { label: 'Away record', value: record(matches.filter((m) => !m.home)) },
        ...(biggestWin ? [{ label: 'Biggest win', value: describe(biggestWin) }] : []),
        ...(heaviestDefeat ? [{ label: 'Heaviest defeat', value: describe(heaviestDefeat) }] : []),
        ...(streak ? [{ label: 'Current run', value: streak }] : []),
      ]
    : [];

  return {
    records,
    facts,
    form: {
      results: newest.slice(0, 6).map(outcome),
      note: played
        ? `Last ${Math.min(6, played)} of ${played} played, newest first`
        : 'No fixture of this competition has been played yet',
    },
    played,
  };
}

/** The club's standing in one competition: the tables its own section publishes
 *  (its group, for a cup), the region pills a league's section offers, and the
 *  table that is open. `wanted` is the key of a table from a previous request —
 *  one the file no longer has falls back to the section's first table, so a
 *  stale link still lands on a real one. */
export function teamStanding(
  data: NowgoalSeasonData,
  teamId: string,
  sectionId: string,
  wanted: string,
): NowgoalTeamStanding {
  const tables = tablesFor(data, sectionId);
  const tableOptions = tables.map((table) => ({ key: table.key, label: table.label }));
  const selected =
    tables.find((table) => table.key === wanted) ??
    tables.find((table) => regionOf(table.key) === 'all') ??
    tables[0];
  const viewOptions: NowgoalViewOption[] = [];
  if (selected) {
    const keys = new Set(tables.map((table) => table.key));
    for (const region of ['all', 'home', 'away'] as const) {
      const key = regionKey(selected.key, region);
      if (keys.has(key)) viewOptions.push({ key, label: REGION_LABELS[region] });
    }
  }
  return {
    tableOptions,
    // A single table is no choice, so no pills are offered for it.
    viewOptions: viewOptions.length > 1 ? viewOptions : [],
    table: selected?.key ?? '',
    label: selected?.label ?? '',
    rows: selected?.rows ?? [],
    bands: selected?.bands ?? [],
  };
}

/* ------------------------------------------------------------------------- *
 * Reading them off the network. Every read is cached through `next.revalidate`,
 * so switching tabs does not re-read a file the previous tab just read.
 * ------------------------------------------------------------------------- */

/** What a read of the host answered: the payload, or why there is none.
 *  `missing` is the host's own way of saying it has no such file — a 404, or the
 *  HTML error page it serves with HTTP 200 in its place; `unavailable` is a
 *  request that never completed (a timeout, a refused connection, a 5xx), which
 *  says nothing about whether the file exists. */
type FetchOutcome<T> = { status: 'ok'; data: T } | { status: 'missing' | 'unavailable' };

/** The payload of an outcome, or `null` — for the readers that treat every way a
 *  read can fail the same way. */
function payloadOf<T>(outcome: FetchOutcome<T>): T | null {
  return outcome.status === 'ok' ? outcome.data : null;
}

/** One JSON answer of the host, parsed. The answers carry a UTF-8 BOM, which
 *  `JSON.parse` rejects, so it is stripped first. */
async function fetchJson<T>(
  path: string,
  revalidate: number,
  teamId: string,
): Promise<FetchOutcome<T>> {
  try {
    const res = await fetch(`${NOWGOAL_FOOTBALL_ORIGIN}${path}`, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json,text/javascript,*/*;q=0.8',
        // The host answers these endpoints for its own club page, so the request
        // says which page it is made from.
        referer: `${NOWGOAL_FOOTBALL_ORIGIN}/team/summary/${teamId}/`,
      },
      next: { revalidate },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) return { status: 'missing' };
    if (!res.ok) return { status: 'unavailable' };
    try {
      return { status: 'ok', data: JSON.parse((await res.text()).replace(/^\uFEFF/, '')) as T };
    } catch {
      // A file the host does not have is answered with an HTML error page at
      // HTTP 200, so what came back is the health check, not the status.
      return { status: 'missing' };
    }
  } catch {
    return { status: 'unavailable' };
  }
}

/** What a read of the club's own file came back with. */
export type NowgoalTeamDetailRead =
  | { status: 'ok'; detail: NowgoalTeamDetail }
  | { status: 'missing' | 'unavailable' };

/** The club's own file (`tdl{id}_en.json`), read into the page's shapes. A
 *  payload that is not that file is `missing` — the host answered, it just has
 *  no club for this id — while a request that never completed stays
 *  `unavailable`, because an unreachable host is not a club that does not
 *  exist. */
export async function getTeamDetail(id: string): Promise<NowgoalTeamDetailRead> {
  const outcome = await fetchJson<unknown>(
    `/jsdata/teamInfo/teamdetail/json/tdl${id}_en.json`,
    TEAM_REVALIDATE,
    id,
  );
  if (outcome.status !== 'ok') return { status: outcome.status };
  const detail = readTeamDetail(outcome.data);
  return detail ? { status: 'ok', detail } : { status: 'missing' };
}

/** One answer of the schedule endpoint, as published. */
interface RawSchedulePage {
  MatchList?: unknown;
  SclassList?: unknown;
  TotalPages?: unknown;
  PlayingPage?: unknown;
}

/** Ask the schedule endpoint for one page. `init` is the endpoint's own switch:
 *  it answers with the paging metadata, the competition list and the five pages
 *  from `pageNo` on when set, and with the requested page alone when not. */
async function fetchSchedulePage(
  teamId: string,
  competitionId: string,
  page: number,
  init: boolean,
): Promise<RawSchedulePage | null> {
  return payloadOf(
    await fetchJson<RawSchedulePage>(
      `/ajax/getteamschedulebypageno?id=${encodeURIComponent(teamId)}&pageNo=${page}` +
        `&sclassId=${encodeURIComponent(competitionId)}&init=${init ? 1 : 0}`,
      SCHEDULE_REVALIDATE,
      teamId,
    ),
  );
}

/** The rows of one answer of the schedule endpoint. */
function scheduleRows(payload: RawSchedulePage | null): RawMatchRow[] {
  const rows = payload?.MatchList;
  return Array.isArray(rows) ? (rows as RawMatchRow[]) : [];
}

/** One page of the club's own schedule: ten fixtures to a page, newest first.
 *  The page the current date falls on is the one the publisher's own page opens
 *  on, so a request naming no page gets that one. The metadata call is always
 *  made for page 1, because that is the only one the endpoint answers with the
 *  paging metadata and the row cache (`PlayingPage` comes back as `-1` for any
 *  other page); a page beyond the five it caches is then asked for on its own,
 *  exactly as the publisher's own pager does. `null` when the endpoint answers
 *  nothing. */
export async function getTeamSchedule(
  teamId: string,
  competitionId: string,
  page: number | null,
): Promise<NowgoalTeamSchedule | null> {
  const requested = page !== null && page > 0 ? Math.trunc(page) : null;
  const first = await fetchSchedulePage(teamId, competitionId, 1, true);
  if (!first) return null;

  const pageCount = Math.max(1, int(first.TotalPages));
  const playingPage = int(first.PlayingPage) > 0 ? int(first.PlayingPage) : 1;
  const wanted = Math.min(Math.max(1, requested ?? playingPage), pageCount);
  let rows = scheduleRows(first);
  let start = (wanted - 1) * FIXTURES_PER_PAGE;
  if (start >= rows.length) {
    rows = scheduleRows(await fetchSchedulePage(teamId, competitionId, wanted, false));
    start = 0;
  }

  const { names, flags } = readSclassIndex(first.SclassList);
  const fixtures = rows
    .slice(start, start + FIXTURES_PER_PAGE)
    .map((row) => readTeamFixture(row, names, teamId))
    .filter((fixture): fixture is NowgoalTeamFixture => fixture !== null)
    .map((fixture) => withFlag(fixture, flags));
  return {
    fixtures,
    page: wanted,
    pageCount,
    competitions: readSclassList(first.SclassList),
  };
}

/** The moves the endpoint publishes for one year. A row the endpoint names no
 *  player for is dropped rather than rendered blank. */
export function readTeamTransfers(payload: unknown): NowgoalTeamTransfer[] {
  const rows = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
  const transfers: NowgoalTeamTransfer[] = [];
  for (const row of rows) {
    const playerId = str(row.playerId);
    if (!playerId) continue;
    const teamId = str(row.teamId);
    transfers.push({
      playerId,
      name: plainText(row.playerName) || `Player ${playerId}`,
      photo: playerPhoto(str(row.playerPic)),
      teamId,
      teamCrest: teamCrest(teamId),
      fee: str(row.money),
      date: transferDate(row.time),
      type: transferType(row.type),
      // `isJoined` files the players the club took on, which is the arrivals
      // list the publisher's own page shows first.
      direction: row.isJoined ? 'in' : 'out',
    });
  }
  return transfers;
}

/** One year of the club's transfers. */
export async function getTeamTransfers(teamId: string, year: string): Promise<NowgoalTeamTransfer[]> {
  const payload = payloadOf(
    await fetchJson<unknown>(
      `/ajax/GetTeamTransferByYear?teamId=${encodeURIComponent(teamId)}&year=${encodeURIComponent(year)}`,
      TRANSFER_REVALIDATE,
      teamId,
    ),
  );
  return readTeamTransfers(payload);
}

