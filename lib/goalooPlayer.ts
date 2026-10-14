/**
 * The player feed behind `/player/[id]` — `/jsData/playerInfo/player<id>_en.json`.
 *
 * Like every other Goaloo document the payload is POSITIONAL, and its field
 * numbers are only knowable from the page host's own bundle; the ones read here
 * were taken from that bundle rather than guessed:
 *
 *   PlayerInfo:  [id, name, photo, teamId, teamName, teamLogo, country, flag,
 *                 shirt, value, contract, birthDate, height, weight, foot,
 *                 compId]
 *   playerCount: [matchId, homeId, awayId, "kickoff", compName, colour,
 *                 homeName, awayName, homeScore, awayScore, …,
 *                 goals(11), penalty(12), red(13), yellow(14), offsides(15),
 *                 best(16), rating(17), shots(18), shotsOnTarget(19),
 *                 assists(20), passes(21), passesAccurate(22), keyPasses(23),
 *                 longPasses(24), throughBalls(25), breakLoose(26),
 *                 fouled(27), fouls(28), interceptions(29), blocked(30),
 *                 steals(31), tackles(33), headers(35), clearances(36),
 *                 minutes(38), season(39), compId(40), countryId(41),
 *                 liveUrl(42), twoYellow(43)]
 *   TransferInfo: [season, fromId, toId, fromDate, toDate, fee, type, fromName,
 *                  toName, fromLogo, toLogo]
 *   RadarInfo:   [kind, PAC/DIV, SHO/HAN, PHY/POS, PAS/KIC, DEF/SPD, DRI/REF] —
 *                 `kind` 1 = the outfield radar, 2 = a goalkeeper's (observed on
 *                 the live feed; the host's own `initAttribute` branches on
 *                 `kind == 1` and lets everything else take the keeper path,
 *                 which is what radarOf does), the six axes then follow as
 *                 published strings on a 0-100 scale. An empty array for the
 *                 many players the feed publishes no radar for.
 *
 * The match log (`playerCount`) is the same fixture list the club pages read,
 * so it is joined to the stream catalogue by the shared bridge in
 * lib/goalooJoin.ts: an appearance the stream catalogue knows links straight to
 * `/watch/{id}`, and one it does not stays plain text. Every row — and every
 * Tech Stats aggregate — also carries its competition's catalogue reference
 * (its crest on the Goaloo CDN and the Rblink leagueId that streams it, see
 * `competitionRefs`), which is what lets the page draw the competition's own
 * badge and link it to `/competition/{id}` rather than inventing either.
 *
 * The same rows are ALSO the page's Tech Stats source: the feed keys every match
 * by (competition 40, season 39) and sums the stat fields above — 18 counters plus
 * minutes and ratings, exactly the fields its own `initTechStats` reads — into one
 * line per competition and season (`techAggregates` below). Season totals are
 * simple sums over the appearances the feed publishes — labelled as such on the
 * page, because the feed's own aggregate block (`CountSum`) never says what it
 * counts.
 */
import { goalooCompetitionLogoUrl, goalooPlayerPhotoUrl, goalooPlayerUrl, goalooTeamLogoUrl } from './goaloo';
import { transferTypeLabel } from './goalooClub';
import { findCompetition } from './competitions';
import { joinStreamIds, rblinkLeagueIdForCompetition, type GoalooFixtureRef } from './goalooJoin';
import type {
  GoalooPlayer,
  GoalooPlayerAttribute,
  GoalooPlayerMatch,
  GoalooPlayerSeason,
  GoalooPlayerTech,
  GoalooPlayerTransfer,
} from './types';

/** How many appearances the Matches tab lists per page — the page size the feed
 *  paginates its own schedule with (`initSchedule`: 10 rows, newest first). */
export const PLAYER_MATCHES_PER_PAGE = 10;

/** How many recent appearances the Overview tab previews before linking to the
 *  full log. */
export const PLAYER_RECENT_MATCHES = 5;

/** The same five-minute window the club feed uses. */
const REVALIDATE = 300;

const row = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Clock-or-number field the feed spells as a string ("68", "1"). */
function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number.parseFloat(str(v));
  return Number.isFinite(n) ? n : 0;
}

/** The feed's clock (`"2026-09-16 16:30"`, UTC+8) → epoch ms; `0` when absent. */
function kickoffAt(value: unknown): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(str(value));
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 8 * 3600 * 1000;
}

/** Preferred foot, in the feed's own words. */
function footLabel(code: number): string {
  if (code === 0) return 'Left';
  if (code === 1) return 'Right';
  if (code === 2) return 'Both';
  return '';
}

/** A competition's static identity: the name and crest the catalogue of
 *  lib/competitions.ts publishes for the id, plus the Rblink league that streams
 *  it. The catalogue is also the only authority on which of the two feed keys
 *  (`s<id>` / `c<id>`) files a competition — the feeds themselves publish bare
 *  ids, never the key. */
interface CompetitionRefs {
  /** Catalogue name, "" for an id it does not list. */
  name: string;
  /** Absolute crest URL on the Goaloo CDN, "" when there is no crest to draw. */
  logo: string;
  /** Rblink leagueId for `/competition/{id}`; 0 = no stream paired with it. */
  streamId: number;
}

/** Both lookups are build-time data, so the result is remembered per Goaloo id:
 *  a player's match log repeats the same handful of competitions on every row. */
const COMPETITION_REFS = new Map<number, CompetitionRefs>();

/** The catalogue's reference to one Goaloo competition id — what a row needs to
 *  draw the competition's crest and to link it into its own page. */
function competitionRefs(goalooLeagueId: number): CompetitionRefs {
  const cached = COMPETITION_REFS.get(goalooLeagueId);
  if (cached) return cached;
  const comp = findCompetition(`s${goalooLeagueId}`) || findCompetition(`c${goalooLeagueId}`);
  const refs: CompetitionRefs = {
    name: comp?.name ?? '',
    logo: goalooCompetitionLogoUrl(comp?.logo),
    streamId: rblinkLeagueIdForCompetition(goalooLeagueId),
  };
  COMPETITION_REFS.set(goalooLeagueId, refs);
  return refs;
}

/** One appearance. A score only exists when the feed published both halves —
 *  a missing one is never read as 0-0. */
function appearanceOf(raw: unknown[]): GoalooPlayerMatch | null {
  const matchId = toNum(raw[0]);
  const kickoff = kickoffAt(raw[3]);
  const home = str(raw[6]);
  const away = str(raw[7]);
  if (!matchId || !kickoff || !home || !away) return null;
  const hs = str(raw[8]);
  const as = str(raw[9]);
  const played = hs !== '' && as !== '' && Number.isFinite(+hs) && Number.isFinite(+as);
  const leagueId = toNum(raw[40]);
  /** The row's competition reference: same crest and same link as every other row
   *  of that competition, so the badge stays consistent across the log. */
  const league = competitionRefs(leagueId);
  return {
    matchId,
    kickoff,
    leagueId,
    competition: str(raw[4]),
    leagueLogo: league.logo,
    leagueStreamId: league.streamId,
    color: str(raw[5]),
    home: { id: toNum(raw[1]), name: home },
    away: { id: toNum(raw[2]), name: away },
    score: played ? { home: +hs, away: +as } : null,
    streamId: 0,
    season: str(raw[39]),
    minutes: toNum(raw[38]),
    goals: toNum(raw[11]),
    assists: toNum(raw[20]),
    yellow: toNum(raw[14]),
    red: toNum(raw[13]),
    twoYellow: toNum(raw[43]),
    rating: Number.parseFloat(str(raw[17])) || 0,
  };
}

/** One line of the transfer record. */
function transferOf(raw: unknown[]): GoalooPlayerTransfer | null {
  const fromName = str(raw[7]);
  const toName = str(raw[8]);
  if (!fromName || !toName) return null;
  return {
    season: str(raw[0]),
    fromId: toNum(raw[1]),
    fromName,
    fromLogo: goalooTeamLogoUrl(str(raw[9])),
    toId: toNum(raw[2]),
    toName,
    toLogo: goalooTeamLogoUrl(str(raw[10])),
    fromDate: str(raw[3]),
    toDate: str(raw[4]),
    fee: str(raw[5]) === '-' ? '' : str(raw[5]),
    type: transferTypeLabel(toNum(raw[6])),
  };
}

/** Season totals, summed over the appearances the feed lists — nothing else. */
export function playerSeasonTotals(matches: GoalooPlayerMatch[]): GoalooPlayerSeason[] {
  const bySeason = new Map<string, GoalooPlayerSeason>();
  for (const match of matches) {
    const season = match.season || 'Unknown';
    const totals = bySeason.get(season) ?? {
      season,
      matches: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
    };
    totals.matches += 1;
    totals.minutes += match.minutes;
    totals.goals += match.goals;
    totals.assists += match.assists;
    totals.yellow += match.yellow;
    totals.red += match.red;
    bySeason.set(season, totals);
  }
  return [...bySeason.values()].sort((a, b) => b.season.localeCompare(a.season));
}

/** One row's contribution to its competition × season aggregate — the very
 *  fields the feed's own `initTechStats` reads off each `playerCount` row. The
 *  competition's own reference travels once per aggregate, not per row. */
type TechCounters = Omit<
  GoalooPlayerTech,
  'leagueId' | 'leagueLogo' | 'leagueStreamId' | 'competition' | 'season'
>;

function techCountersOf(raw: unknown[]): TechCounters {
  return {
    // The feed counts one appearance per row and sums every other field as
    // published (a blank one parses to 0, so it contributes nothing).
    count: 1,
    minutes: toNum(raw[38]),
    rating: toNum(raw[17]),
    goals: toNum(raw[11]),
    penalty: toNum(raw[12]),
    assists: toNum(raw[20]),
    red: toNum(raw[13]),
    yellow: toNum(raw[14]),
    shots: toNum(raw[18]),
    shotsOnTarget: toNum(raw[19]),
    fouled: toNum(raw[27]),
    offsides: toNum(raw[15]),
    best: toNum(raw[16]),
    passes: toNum(raw[21]),
    passesAccurate: toNum(raw[22]),
    keyPasses: toNum(raw[23]),
    longPasses: toNum(raw[24]),
    throughBalls: toNum(raw[25]),
    breakLoose: toNum(raw[26]),
    tackles: toNum(raw[33]),
    interceptions: toNum(raw[29]),
    clearances: toNum(raw[36]),
    steals: toNum(raw[31]),
    blocked: toNum(raw[30]),
    headers: toNum(raw[35]),
    fouls: toNum(raw[28]),
  };
}

/**
 * The Tech Stats table: one aggregate per competition and season, summed over
 * every match the feed lists in that pair — the feed's own `_techStatsInfo.add`
 * semantics (every field of every row is added on, `count` included), so a
 * value the feed leaves blank simply contributes nothing.
 *
 * The order is the feed's too: competitions ascending by id (`renderTechSelect`
 * sorts the map's keys), each one with its seasons in the order the feed
 * published them — newest first, because the match log itself is newest-first.
 * A row whose competition or season the feed left blank is dropped rather than
 * folded into an "unknown" bucket.
 */
export function playerTechTotals(rows: readonly unknown[][]): GoalooPlayerTech[] {
  const byPair = new Map<string, GoalooPlayerTech>();
  for (const raw of rows) {
    const leagueId = toNum(raw[40]);
    const season = str(raw[39]);
    if (!leagueId || !season) continue;
    const key = `${leagueId}|${season}`;
    const counters = techCountersOf(raw);
    const existing = byPair.get(key);
    if (!existing) {
      const league = competitionRefs(leagueId);
      byPair.set(key, {
        leagueId,
        competition: str(raw[4]),
        leagueLogo: league.logo,
        leagueStreamId: league.streamId,
        season,
        ...counters,
      });
      continue;
    }
    for (const field of Object.keys(counters) as (keyof TechCounters)[]) {
      existing[field] += counters[field];
    }
  }
  return [...byPair.values()].sort((a, b) => a.leagueId - b.leagueId);
}

/** Radar axis labels, in the feed's own order (`RadarInfo` fields 1-6). */
const RADAR_OUTFIELD = ['PAC', 'SHO', 'PHY', 'PAS', 'DEF', 'DRI'];
const RADAR_KEEPER = ['DIV', 'HAN', 'POS', 'KIC', 'SPD', 'REF'];

/** The six-axis attribute radar, `null` when the feed publishes none (which is
 *  most players) or publishes it without its six axes.
 *
 *  The kind is read exactly the way the host's `initAttribute` reads it: field 0
 *  `== 1` is the outfield radar and ANYTHING else takes the goalkeeper path —
 *  the live feed publishes 2 for keepers, so a stricter `== 2` test would drop
 *  every keeper the day it publishes a third value. */
function radarOf(value: unknown): GoalooPlayerAttribute | null {
  const raw = row(value);
  if (raw.length < 7) return null;
  const outfield = toNum(raw[0]) === 1;
  const labels = outfield ? RADAR_OUTFIELD : RADAR_KEEPER;
  return {
    outfield,
    skills: labels.map((label, i) => ({ label, value: toNum(raw[i + 1]) })),
  };
}

/**
 * One player, ready for the page: bio, current club, match log with its
 * `/watch/{id}` targets, per-season totals, the per-competition Tech Stats
 * aggregates, the attribute radar and the transfer record.
 *
 * `null` for an id the feed does not answer, so the route can 404 instead of
 * rendering an empty shell.
 */
export async function getGoalooPlayer(id: string | number): Promise<GoalooPlayer | null> {
  const playerId = Math.trunc(Number(id));
  if (!Number.isInteger(playerId) || playerId <= 0) return null;

  let json: Record<string, unknown>;
  try {
    const res = await fetch(goalooPlayerUrl(playerId), {
      headers: { accept: 'application/json' },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!json) return null;

  const info = row(json.PlayerInfo);
  const name = str(info[1]);
  if (!name) return null;

  /** The published match log, read once: the same rows feed the appearance list,
   *  the season totals and the per-competition Tech Stats aggregates. */
  const appearances = row(json.playerCount).map(row);
  const matches: GoalooPlayerMatch[] = [];
  for (const raw of appearances) {
    const match = appearanceOf(raw);
    if (match) matches.push(match);
  }
  matches.sort((a, b) => b.kickoff - a.kickoff);

  const transfers: GoalooPlayerTransfer[] = [];
  for (const raw of row(json.TransferInfo)) {
    const transfer = transferOf(row(raw));
    if (transfer) transfers.push(transfer);
  }
  transfers.sort((a, b) => b.fromDate.localeCompare(a.fromDate));

  const streamIds = await joinStreamIds(
    matches.map(
      (m): GoalooFixtureRef => ({
        matchId: m.matchId,
        leagueId: m.leagueId,
        kickoff: m.kickoff,
        home: m.home.name,
        away: m.away.name,
      })
    )
  );
  for (const match of matches) match.streamId = streamIds.get(match.matchId) ?? 0;

  /** The player's competition: the feed publishes its id only, so the name, the
   *  crest and the stream link all come from the static catalogue
   *  (lib/competitions.ts) — the same reference every match row carries. */
  const leagueId = toNum(info[15]);
  const league = competitionRefs(leagueId);

  return {
    id: toNum(info[0]) || playerId,
    name,
    photo: goalooPlayerPhotoUrl(str(info[2])),
    teamId: toNum(info[3]),
    teamName: str(info[4]),
    teamLogo: goalooTeamLogoUrl(str(info[5])),
    country: str(info[6]),
    countryFlag: goalooTeamLogoUrl(str(info[7])),
    number: str(info[8]),
    marketValue: str(info[9]),
    contract: str(info[10]),
    dateOfBirth: str(info[11]),
    height: str(info[12]),
    weight: str(info[13]),
    foot: footLabel(toNum(info[14])),
    leagueId,
    leagueName: league.name,
    leagueLogo: league.logo,
    leagueStreamId: league.streamId,
    matches,
    seasons: playerSeasonTotals(matches),
    tech: playerTechTotals(appearances),
    attribute: radarOf(json.RadarInfo),
    transfers,
    updatedAt: str(json.LastUpdateTime),
  };
}


