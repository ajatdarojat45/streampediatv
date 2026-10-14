// Protobuf decoders for the competition (league) family — /api/league/*.
// All four endpoints are signed with the same DT_LEAGUE (code 200) signature.
//
// Field mapping from the decompiled sources:
//   PBLeagueDetailResp:           1 = PBDataLeague, 50 = PBLeagueExtra
//   PBLeagueExtra:                1 = PBLeagueExtraFtb
//   PBLeagueExtraFtb: 10=win 11=draw 12=loss (percent STRINGS), 20=teamCount,
//                     21=playerCount, 22=teamMarketValue, 23=teamForeignPlayers,
//                     30=avgAge, 31=avgGoals, 40=redCards, 41=yellowCards,
//                     50=mvpPlayer (PBDataPlayer), 60=hasData (HasData),
//                     70=leagueLink, 71=leagueSeasonNameLink
//   HasData:          2=standings 3=matches 4=playerTotal 5=teamTotal 6=knockout
//   PBLeagueMatchListResp:        1 = repeated PBDataMatch
//                                 (the same PBDataMatch as match/live — reused)
//   PBLeagueSeasonListResp:       1 = repeated PBDataSeason
//   PBLeagueTeamStandingListResp: 1 = repeated PBDataTeamStanding,
//                                 2 = repeated PBDataTeam, 3 = PBDataStage,
//                                 4 = repeated PBDatLeaguePromotion
//   PBDataTeamStanding: 2=total 3=won 4=draw 5=loss 6=goals 7=goalsAgainst
//                       8=points, 12..18 home*, 22..28 away*, 29=groupName,
//                       30=stageId, 31=teamId, 32=promotionId
//                       (a value the feed has not got arrives as -1 — read with
//                        numberValue, see proto.ts)
//   PBDatLeaguePromotion: 1=promotionId, 2=name, 3=color

import { iterFields, numberValue } from './proto';
import {
  decodeDataTeam,
  decodeDataPlayer,
  decodeDataLeague,
  decodeDataSeason,
  decodeDataStage,
  decodeDataMatch,
} from './matchProto';
import { countryLogoUrl, playerAvatarUrl, teamLogoUrl } from './logos';
import { matchDateMs } from './datetime';
import type {
  LeagueDetail,
  LeagueExtra,
  LeagueHasData,
  LeaguePlayerTotals,
  LeaguePromotion,
  LeagueSeason,
  LeagueStandings,
  LeagueTeamTotals,
  Match,
  PlayerTotal,
  Team,
  TeamStanding,
  TeamTotal,
} from './types';

const dec = new TextDecoder('utf-8', { fatal: false });
const str = (b: number | Uint8Array): string =>
  typeof b === 'number' ? '' : dec.decode(b as Uint8Array);

/* ---------- PBLeagueExtra (field 50 → ftb at field 1) ---------- */

/** PBLeagueExtraFtb.HasData (field 60): which sub-views the feed actually has. */
function decodeHasData(buf: Uint8Array): LeagueHasData {
  const h: LeagueHasData = {};
  for (const f of iterFields(buf)) {
    if (f.field === 2) h.standings = !!f.value;
    else if (f.field === 3) h.matches = !!f.value;
    else if (f.field === 4) h.playerTotal = !!f.value;
    else if (f.field === 5) h.teamTotal = !!f.value;
    else if (f.field === 6) h.knockout = !!f.value;
  }
  return h;
}

/** PBLeagueExtraFtb — the aggregate block (win/draw/loss %, team count, MVP, …). */
function decodeLeagueExtraFtb(buf: Uint8Array, lang: number): LeagueExtra {
  const e: LeagueExtra = {};
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 10: e.win = str(f.value); break;
      case 11: e.draw = str(f.value); break;
      case 12: e.loss = str(f.value); break;
      case 20: e.teamCount = f.value as number; break;
      case 21: e.playerCount = f.value as number; break;
      case 22: e.teamMarketValue = str(f.value); break;
      case 23: e.teamForeignPlayers = str(f.value); break;
      case 30: e.avgAge = str(f.value); break;
      case 31: e.avgGoals = str(f.value); break;
      case 40: e.redCards = str(f.value); break;
      case 41: e.yellowCards = str(f.value); break;
      case 50:
        if (f.wire === 2) {
          const p = decodeDataPlayer(f.value as Uint8Array, lang);
          // Player avatars live under the sport's `player/` path, not `team/`.
          if (p.logo) p.logo = playerAvatarUrl(p.sportType, p.logo);
          e.mvpPlayer = p;
        }
        break;
      case 60: if (f.wire === 2) e.hasData = decodeHasData(f.value as Uint8Array); break;
      case 70: e.leagueLink = str(f.value); break;
      case 71: e.leagueSeasonNameLink = str(f.value); break;
      default: break;
    }
  }
  return e;
}

/** PBLeagueExtra (field 50): 1 = PBLeagueExtraFtb (only football is mapped). */
function decodeLeagueExtra(buf: Uint8Array, lang: number): LeagueExtra {
  let extra: LeagueExtra = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1 && f.wire === 2) extra = decodeLeagueExtraFtb(f.value as Uint8Array, lang);
  }
  return extra;
}

/* ---------- detail ---------- */

/** PBLeagueDetailResp: 1 = PBDataLeague, 50 = PBLeagueExtra. */
export function decodeLeagueDetailResp(payload: Uint8Array, lang: number): LeagueDetail {
  const out: LeagueDetail = {};
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) {
      let level: number | undefined;
      let season: LeagueSeason | undefined;
      for (const g of iterFields(f.value as Uint8Array)) {
        if (g.field === 5) level = g.value as number;
        else if (g.field === 20 && g.wire === 2) season = decodeDataSeason(g.value as Uint8Array, lang);
      }
      const league = decodeDataLeague(f.value as Uint8Array, lang);
      // The competition crest is a full URL on the competition/ path — keep it
      // absolute (countryLogoUrl only normalises the host).
      if (league.logo) league.logo = countryLogoUrl(league.logo);
      out.league = { ...league, level, season };
    } else if (f.field === 50 && f.wire === 2) {
      out.extra = decodeLeagueExtra(f.value as Uint8Array, lang);
    }
  }
  return out;
}

/* ---------- fixtures ---------- */

/** PBLeagueMatchListResp: 1 = repeated PBDataMatch (identical to match/live). */
export function decodeLeagueMatchListResp(payload: Uint8Array, lang: number): Match[] {
  const out: Match[] = [];
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) out.push(decodeDataMatch(f.value as Uint8Array, lang));
  }
  return out;
}

/* ---------- seasons ---------- */

/** PBLeagueSeasonListResp: 1 = repeated PBDataSeason. */
export function decodeLeagueSeasonListResp(payload: Uint8Array, lang: number): LeagueSeason[] {
  const out: LeagueSeason[] = [];
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) out.push(decodeDataSeason(f.value as Uint8Array, lang));
  }
  return out;
}

/* ---------- standings ---------- */

/** PBDataTeamStanding — one table row (overall + home/away splits).
 *
 *  Every counter and id is read through `numberValue`, because the feed marks a
 *  value it has not got with `-1`: that sentinel travels as the 10-byte varint
 *  2^64-1 (league 4976's table carries exactly that in field 8 of one row), and
 *  read unsigned it reaches the table as `18446744073709552000` — one such cell
 *  is wide enough to stretch the whole column it sits in. Such a field simply
 *  stays absent, which is how every other unpublished field arrives. */
function decodeTeamStanding(buf: Uint8Array): TeamStanding {
  const s: TeamStanding = {};
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 2: s.total = numberValue(f.value); break;
      case 3: s.won = numberValue(f.value); break;
      case 4: s.draw = numberValue(f.value); break;
      case 5: s.loss = numberValue(f.value); break;
      case 6: s.goals = numberValue(f.value); break;
      case 7: s.goalsAgainst = numberValue(f.value); break;
      case 8: s.points = numberValue(f.value); break;
      case 12: s.homeTotal = numberValue(f.value); break;
      case 13: s.homeWon = numberValue(f.value); break;
      case 14: s.homeDraw = numberValue(f.value); break;
      case 15: s.homeLoss = numberValue(f.value); break;
      case 16: s.homeGoals = numberValue(f.value); break;
      case 17: s.homeGoalsAgainst = numberValue(f.value); break;
      case 18: s.homePoints = numberValue(f.value); break;
      case 22: s.awayTotal = numberValue(f.value); break;
      case 23: s.awayWon = numberValue(f.value); break;
      case 24: s.awayDraw = numberValue(f.value); break;
      case 25: s.awayLoss = numberValue(f.value); break;
      case 26: s.awayGoals = numberValue(f.value); break;
      case 27: s.awayGoalsAgainst = numberValue(f.value); break;
      case 28: s.awayPoints = numberValue(f.value); break;
      case 29: s.groupName = str(f.value); break;
      case 30: s.stageId = numberValue(f.value); break;
      case 31: s.teamId = numberValue(f.value); break;
      case 32: s.promotionId = numberValue(f.value); break;
      default: break;
    }
  }
  return s;
}

/** PBDatLeaguePromotion: 1=promotionId, 2=name, 3=color (#RRGGBB). */
function decodePromotion(buf: Uint8Array): LeaguePromotion {
  const p: LeaguePromotion = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1) p.promotionId = f.value as number;
    else if (f.field === 2 && f.wire === 2) p.name = str(f.value);
    else if (f.field === 3 && f.wire === 2) p.color = str(f.value);
  }
  return p;
}

/** PBLeagueTeamStandingListResp: 1=rows, 2=teams, 3=stage, 4=promotions.
 *  Rows carry only `teamId`, so the response's own team list is folded into a
 *  lookup the UI resolves a crest + name from. */
export function decodeLeagueTeamStandingListResp(
  payload: Uint8Array,
  lang: number
): LeagueStandings {
  const out: LeagueStandings = { rows: [], teams: {}, promotions: {} };
  for (const f of iterFields(payload)) {
    if (f.wire !== 2) continue;
    if (f.field === 1) out.rows.push(decodeTeamStanding(f.value as Uint8Array));
    else if (f.field === 2) {
      const t = decodeDataTeam(f.value as Uint8Array, lang);
      if (t.teamId !== undefined) out.teams[t.teamId] = t;
    } else if (f.field === 3) out.stage = decodeDataStage(f.value as Uint8Array, lang);
    else if (f.field === 4) {
      const p = decodePromotion(f.value as Uint8Array);
      if (p.promotionId !== undefined) out.promotions[p.promotionId] = p;
    }
  }
  return out;
}

/** Resolve a standings row's team from the payload's own team lookup. */
export function standingTeam(standings: LeagueStandings, row: TeamStanding): Team | undefined {
  return row.teamId !== undefined ? standings.teams[row.teamId] : undefined;
}

/* ---------- player totals ---------- */

/** PBDataPlayerTotal — one player's competition counters. The feed omits every
 *  field a player never recorded (a defender with no goal has field 10 absent),
 *  so a missing value is simply 0 for the UI. Field map (league scale): 9
 *  penalty goals, 10 goals, 11 assists, 12 shots/game, 21 minutes/game,
 *  22 yellow cards, 23 red cards, 27 teamId, 28 playerId. */
function decodePlayerTotal(buf: Uint8Array): PlayerTotal {
  const t: PlayerTotal = {};
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 9: t.penaltyKick = f.value as number; break;
      case 10: t.goals = f.value as number; break;
      case 11: t.assists = f.value as number; break;
      case 12: t.shotsPerGame = str(f.value); break;
      case 21: t.minutesPerGame = str(f.value); break;
      case 22: t.yellowCards = f.value as number; break;
      case 23: t.redCards = f.value as number; break;
      case 27: t.teamId = f.value as number; break;
      case 28: t.playerId = f.value as number; break;
      default: break;
    }
  }
  return t;
}

/** PBLeaguePlayerTotalListResp: 1 = repeated PBDataPlayerTotal,
 *  2 = repeated PBDataTeam, 3 = repeated PBDataPlayer.
 *  A totals row carries ids only, so both lookups are folded into maps the UI
 *  resolves a name/avatar/crest from (same trick as the standings payload).
 *  Avatars/crests are expanded server-side so the first paint has real URLs. */
export function decodeLeaguePlayerTotalListResp(
  payload: Uint8Array,
  lang: number
): LeaguePlayerTotals {
  const out: LeaguePlayerTotals = { rows: [], players: {}, teams: {} };
  for (const f of iterFields(payload)) {
    if (f.wire !== 2) continue;
    if (f.field === 1) out.rows.push(decodePlayerTotal(f.value as Uint8Array));
    else if (f.field === 2) {
      const t = decodeDataTeam(f.value as Uint8Array, lang);
      if (t.logo) t.logo = teamLogoUrl(t.sportType, t.logo);
      if (t.teamId !== undefined) out.teams[t.teamId] = t;
    } else if (f.field === 3) {
      const p = decodeDataPlayer(f.value as Uint8Array, lang);
      if (p.logo) p.logo = playerAvatarUrl(p.sportType, p.logo);
      if (p.playerId !== undefined) out.players[p.playerId] = p;
    }
  }
  return out;
}

/** Resolve a totals row to its player (name + avatar). */
export function totalPlayer(totals: LeaguePlayerTotals, row: PlayerTotal): Team | undefined {
  return row.playerId !== undefined ? totals.players[row.playerId] : undefined;
}

/** Resolve a totals row to the team (name + crest) the player played for. */
export function totalTeam(totals: LeaguePlayerTotals, row: PlayerTotal): Team | undefined {
  return row.teamId !== undefined ? totals.teams[row.teamId] : undefined;
}

/* ---------- competition team totals (the "Team" half of Tech Stat) ----------
 * PBLeagueTeamTotalListResp: 1 = repeated PBDataTeamTotal, 2 = repeated PBDataTeam
 * PBDataTeamTotal: 10=goals, 11=ballPossession, 12=shotsPerGame,
 *                  13=penaltiesWon, 14=accuratePassesPerGame, 15=keyPassesPerGame,
 *                  16=accurateLongBallsPerGame, 17=accurateCrossesPerGame,
 *                  18=goalsConceded, 19=interceptionsPerGame, 20=clearancesPerGame,
 *                  21=blockedShotsPerGame, 22=yellowCards, 23=redCards,
 *                  24=turnoversPerGame, 25=foulsPerGame, 26=teamId
 * (Verified field by field against a full season of the live response: the
 *  counters are varints, the percent / per-game values are strings.) */

/** One PBDataTeamTotal row. */
export function decodeTeamTotal(buf: Uint8Array): TeamTotal {
  const t: TeamTotal = {};
  for (const f of iterFields(buf)) {
    if (f.wire === 2) {
      const v = str(f.value);
      switch (f.field) {
        case 11: t.ballPossession = v; break;
        case 12: t.shotsPerGame = v; break;
        case 13: t.penaltiesWon = v; break;
        case 14: t.accuratePassesPerGame = v; break;
        case 15: t.keyPassesPerGame = v; break;
        case 16: t.accurateLongBallsPerGame = v; break;
        case 17: t.accurateCrossesPerGame = v; break;
        case 19: t.interceptionsPerGame = v; break;
        case 20: t.clearancesPerGame = v; break;
        case 21: t.blockedShotsPerGame = v; break;
        case 24: t.turnoversPerGame = v; break;
        case 25: t.foulsPerGame = v; break;
        default: break;
      }
    } else {
      switch (f.field) {
        case 10: t.goals = f.value as number; break;
        case 18: t.goalsConceded = f.value as number; break;
        case 22: t.yellowCards = f.value as number; break;
        case 23: t.redCards = f.value as number; break;
        case 26: t.teamId = f.value as number; break;
        default: break;
      }
    }
  }
  return t;
}

/** PBLeagueTeamTotalListResp → the totals table plus the clubs it references
 *  (same trick as the player totals: crests are expanded here, server-side, so
 *  the first paint has real URLs). */
export function decodeLeagueTeamTotalListResp(payload: Uint8Array, lang: number): LeagueTeamTotals {
  const out: LeagueTeamTotals = { rows: [], teams: {} };
  for (const f of iterFields(payload)) {
    if (f.wire !== 2) continue;
    if (f.field === 1) out.rows.push(decodeTeamTotal(f.value as Uint8Array));
    else if (f.field === 2) {
      const t = decodeDataTeam(f.value as Uint8Array, lang);
      if (t.logo) t.logo = teamLogoUrl(t.sportType, t.logo);
      if (t.teamId !== undefined) out.teams[t.teamId] = t;
    }
  }
  return out;
}

/** Resolve a team totals row to its club (name + crest). */
export function teamTotalTeam(totals: LeagueTeamTotals, row: TeamTotal): Team | undefined {
  return row.teamId !== undefined ? totals.teams[row.teamId] : undefined;
}

/* ---------- fixtures: stage/round buckets (fixtures tab) ---------- */

/** One bucket of fixtures — a collapsible section on the fixtures tab. */
export interface StageGroup {
  /** Raw `stage|group|round` tuple, so a bucket keeps its identity when the
   *  label is disambiguated. */
  key: string;
  /** Human heading — always unique within the list (see `groupFixtures`). */
  label: string;
  items: Match[];
}

/** Stage values that carry no information of their own: a domestic league tags
 *  *every* match with "League", so as a heading it would repeat on all 38
 *  rounds. They are dropped and replaced by the round instead. */
const GENERIC_STAGE = /^(league|regular season|regular|fixtures|round robin|main round)$/i;
/** A bare round number ("13") reads better with the prefix; anything the feed
 *  already names ("Round of 16") is used as it is. */
const NUMERIC = /^\d+$/;

/** "13" → "Round 13"; "Round 16" → unchanged. */
function roundLabel(round: string): string {
  return NUMERIC.test(round) ? `Round ${round}` : round;
}

/** Heading from the feed's own stage/group/round triple:
 *  `Apertura · Group 1 · Round 9`, `Round 13`, `Apertura-Final`, `Fixtures`.
 *  The round is appended only when the stage does not already name the phase
 *  ("Final", "Quarterfinals", "Round of 16"), or when the bucket sits inside a
 *  group — where one stage spans several rounds. */
function stageLabel(stage: string, group: string, round: string): string {
  const parts: string[] = [];
  const st = stage.trim();
  if (st && !GENERIC_STAGE.test(st)) parts.push(st);
  if (group) parts.push(/^group\b/i.test(group) ? group : `Group ${group}`);
  if (round && (parts.length === 0 || Boolean(group))) parts.push(roundLabel(round));
  return parts.length > 0 ? parts.join(' · ') : 'Fixtures';
}

/** Buckets that share the same heading, in list order. */
function groupByLabel(buckets: StageGroup[]): Map<string, StageGroup[]> {
  const out = new Map<string, StageGroup[]>();
  for (const b of buckets) {
    const list = out.get(b.label);
    if (list) list.push(b);
    else out.set(b.label, [b]);
  }
  return out;
}

/** Fixtures bucketed by stage (cups) / group / round, in kick-off order.
 *  The upstream list is sorted by date and split on first sight of a
 *  `stage|group|round` tuple, so every bucket stays in playing order.
 *
 *  The feed repeats the same stage across a whole season (every domestic league
 *  calls all its rounds "League", every Apertura round is just "Apertura"), so
 *  the raw stage would label dozens of sections identically. A second pass
 *  therefore makes every heading unique: the round is appended when the
 *  colliding buckets all carry one ("Group stage · Group 1 · Round 3"), and a
 *  chronological "Fixture n" number is the last resort (the two Colombian
 *  "Semifinal" buckets). */
export function groupFixtures(matches: Match[]): StageGroup[] {
  const sorted = [...matches].sort(
    (a, b) => (matchDateMs(a.matchDate) ?? 0) - (matchDateMs(b.matchDate) ?? 0)
  );
  const byKey = new Map<string, StageGroup>();
  const rounds = new Map<string, string>();
  for (const m of sorted) {
    const stage = m.stage ?? '';
    const group = m.group ?? '';
    const round = m.round ?? '';
    const key = `${stage}|${group}|${round}`;
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { key, label: stageLabel(stage, group, round), items: [] };
      byKey.set(key, bucket);
      rounds.set(key, round);
    }
    bucket.items.push(m);
  }
  const buckets = [...byKey.values()];
  for (const dupes of groupByLabel(buckets).values()) {
    if (dupes.length < 2) continue;
    if (dupes.every((b) => rounds.get(b.key))) {
      for (const b of dupes) b.label = `${b.label} · ${roundLabel(rounds.get(b.key) as string)}`;
    }
  }
  // Still identical (same stage, no round, several buckets — e.g. a two-legged
  // "Semifinal"): number them in kick-off order, which is also what the order
  // on screen is, so the visitor can tell the sections apart.
  for (const dupes of groupByLabel(buckets).values()) {
    if (dupes.length < 2) continue;
    dupes.forEach((b, i) => {
      b.label = `${b.label} · Fixture ${i + 1}`;
    });
  }
  return buckets;
}

/* ---------- knockout bracket (the “Match Chart” tab) ----------
 * The feed publishes no bracket of its own: a cup's rounds arrive as ordinary
 * fixtures tagged with the round in `stage` — "1/8-Finals", "Quarterfinals",
 * "Semifinals", "Final" (verified against the live Copa Argentina, Copa
 * Libertadores and Club World Cup payloads) — while a round-robin league tags
 * every fixture with the generic "League" plus a round NUMBER. `buildBracket`
 * therefore re-reads the fixture list the Schedule tab already pays for and
 * rebuilds the bracket from it.
 *
 * Two decisions keep it honest on the messy real data:
 *   - Only rounds that NAME themselves are bracket rounds. A plain "Round 5" is
 *     never accepted, because that very label is what a domestic league numbers
 *     its 38 matchdays with and what several cups call their group matchdays
 *     ("Round 1" = matchday 1 at the Gold Cup); taking those would paint group
 *     fixtures as bracket columns.
 *   - Buckets on the road INTO the bracket — qualifying rounds, group stages,
 *     the league phase and the play-off round — are dropped, however they are
 *     worded, so a season still inside its group stage simply has no bracket to
 *     show yet.
 */

/** One tie of a knockout round — the single fixture, or both legs of it. */
export interface BracketTie {
  /** Identity of the two sides (or of the one leg, while a slot is still open),
   *  stable across refetches so React keys and aggregates never drift. */
  key: string;
  /** The legs in playing order — one entry for a single-match tie. */
  legs: Match[];
  /** The side that played at HOME in the first leg; the away side of a
   *  two-legged tie visits in the reverse order. */
  home?: Team;
  away?: Team;
  /** Goals over the legs present (the aggregate the column prints). */
  homeGoals: number;
  awayGoals: number;
  /** Which side goes through: 1 = home, 2 = away, `undefined` while the tie is
   *  open — either unplayed, or level on aggregate (the feed ships no shoot-out
   *  score, so a level tie stays undecided rather than guessed). */
  winner?: 1 | 2;
}

/** One column of the bracket, widest round first. */
export interface BracketRound {
  key: string;
  /** The feed's own round name ("1/8-Finals", "Quarterfinals", "Final"). */
  label: string;
  /** Teams entering the round (16 for an "1/8-Finals") — what orders the
   *  columns widest → final. */
  size: number;
  ties: BracketTie[];
}

/** Rounds the feed names outright. The list is ordered by SPECIFICITY: a
 *  "Quarter-final" contains the word "final", so every longer name has to be
 *  tested before the bare final, and the 1/N-Finals fraction is matched whole
 *  (slash included) so "1/16-Finals" can never be read as "1/6-Finals". */
const KO_NAMES: Array<{ re: RegExp; teams: (m: RegExpMatchArray) => number }> = [
  /** "1/8-Finals" = 1/8 of the bracket, i.e. 16 teams. */
  { re: /1\s*\/\s*(\d+)\s*[- ]*finals?\b/i, teams: (m) => 2 * Number(m[1]) },
  { re: /\b(?:round of|last)\s*(\d+)\b/i, teams: (m) => Number(m[1]) },
  { re: /quarter\s*-?\s*finals?\b/i, teams: () => 8 },
  { re: /semi\s*-?\s*finals?\b/i, teams: () => 4 },
  { re: /eighth\s*-?\s*finals?\b/i, teams: () => 16 },
  { re: /sixteenth\s*-?\s*finals?\b/i, teams: () => 32 },
  { re: /\bfinals?\b/i, teams: () => 2 },
  /** A round the feed only calls a knockout round — its width is read from the
   *  ties it holds instead (see `buildBracket`). */
  { re: /knock\s*-?\s*out/i, teams: () => 0 },
];

/** Buckets on the road INTO the bracket (or inside a round-robin stage): not
 *  bracket rounds, however they are worded. "Third Round Qualifying" and the
 *  UCL's "Qualifying Round 3" are caught here, which is what keeps a season
 *  that has not reached its knockout stage yet from painting a fake bracket. */
const NOT_BRACKET = /qualif|prelim|\bgroup\b|\bleague\b|\bregular\b|friendl|play\s*-?\s*offs?/i;

/** Teams entering the round a bucket names, or `null` when the bucket is not a
 *  bracket round at all. `0` = a knockout round of unknown width. */
function koTeams(text: string): number | null {
  if (!text || NOT_BRACKET.test(text)) return null;
  for (const { re, teams } of KO_NAMES) {
    const m = text.match(re);
    if (m) return teams(m);
  }
  return null;
}

/** A side's identity inside one round — the feed's own teamId when it ships one
 *  (every football fixture does), the published name otherwise. */
const sideKey = (team?: Team): string =>
  team?.teamId !== undefined ? `t${team.teamId}` : team?.name ? `n${team.name}` : '';

/** Fold one leg into the tie it belongs to. The two legs of a tie are the same
 *  pair at the same round once more with the venues swapped, so the sides are
 *  matched as an UNORDERED pair and the goals are booked against the first
 *  leg's home side. */
function addLeg(ties: BracketTie[], byKey: Map<string, BracketTie>, leg: Match): void {
  const h = sideKey(leg.home);
  const a = sideKey(leg.away);
  // A slot the feed has not filled in yet ("Winner SF 1") cannot be paired with
  // anything: it becomes its own tie, keyed by the leg itself.
  const pairable = Boolean(h && a);
  const key = pairable ? [h, a].sort().join('~') : `leg:${leg.matchId ?? ties.length}`;
  let tie = byKey.get(key);
  if (!tie) {
    tie = { key, legs: [], home: leg.home, away: leg.away, homeGoals: 0, awayGoals: 0 };
    byKey.set(key, tie);
    ties.push(tie);
  }
  tie.legs.push(leg);
  // The first leg sets the orientation; a venue-swapped second leg books its
  // goals the other way round.
  const sameWay = !pairable || sideKey(leg.home) === sideKey(tie.home);
  tie.homeGoals += (sameWay ? leg.homeScore : leg.awayScore) ?? 0;
  tie.awayGoals += (sameWay ? leg.awayScore : leg.homeScore) ?? 0;
}

/** The knockout bracket of a competition's season, `[]` when its fixtures hold
 *  none — see the section header for why only named rounds are accepted. */
export function buildBracket(matches: Match[]): BracketRound[] {
  const rounds: Array<{ round: BracketRound; order: number }> = [];
  groupFixtures(matches).forEach((bucket, order) => {
    const [stage = '', round = ''] = bucket.key.split('|');
    // A cup names the phase in `stage` ("1/8-Finals", "Final"); the round field
    // is the fallback for a feed that keeps the phase there instead.
    const named = koTeams(stage) ?? koTeams(round);
    if (named === null || bucket.items.length === 0) return;

    const ties: BracketTie[] = [];
    const byKey = new Map<string, BracketTie>();
    for (const leg of bucket.items) addLeg(ties, byKey, leg);
    for (const tie of ties) {
      if (tie.homeGoals > tie.awayGoals) tie.winner = 1;
      else if (tie.awayGoals > tie.homeGoals) tie.winner = 2;
    }

    rounds.push({
      round: {
        key: bucket.key,
        // The bucket label keeps the feed's own disambiguation ("Semifinal ·
        // Fixture 2"); a group-scoped bucket keeps it too, since a knockout
        // round inside a group is the group's own bracket.
        label: bucket.label,
        size: named > 0 ? named : ties.length * 2,
        ties,
      },
      order,
    });
  });

  // Widest round first, so the columns read like a bracket sheet: 16 besar →
  // 8 besar → … → the final. Rounds of equal width keep the fixture order they
  // were published in (a stable sort).
  return rounds
    .sort((a, b) => b.round.size - a.round.size || a.order - b.order)
    .map((r) => r.round);
}
