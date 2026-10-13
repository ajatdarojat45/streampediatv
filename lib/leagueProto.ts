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
//   PBDatLeaguePromotion: 1=promotionId, 2=name, 3=color

import { iterFields } from './proto';
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
  Match,
  PlayerTotal,
  Team,
  TeamStanding,
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

/** PBDataTeamStanding — one table row (overall + home/away splits). */
function decodeTeamStanding(buf: Uint8Array): TeamStanding {
  const s: TeamStanding = {};
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 2: s.total = f.value as number; break;
      case 3: s.won = f.value as number; break;
      case 4: s.draw = f.value as number; break;
      case 5: s.loss = f.value as number; break;
      case 6: s.goals = f.value as number; break;
      case 7: s.goalsAgainst = f.value as number; break;
      case 8: s.points = f.value as number; break;
      case 12: s.homeTotal = f.value as number; break;
      case 13: s.homeWon = f.value as number; break;
      case 14: s.homeDraw = f.value as number; break;
      case 15: s.homeLoss = f.value as number; break;
      case 16: s.homeGoals = f.value as number; break;
      case 17: s.homeGoalsAgainst = f.value as number; break;
      case 18: s.homePoints = f.value as number; break;
      case 22: s.awayTotal = f.value as number; break;
      case 23: s.awayWon = f.value as number; break;
      case 24: s.awayDraw = f.value as number; break;
      case 25: s.awayLoss = f.value as number; break;
      case 26: s.awayGoals = f.value as number; break;
      case 27: s.awayGoalsAgainst = f.value as number; break;
      case 28: s.awayPoints = f.value as number; break;
      case 29: s.groupName = str(f.value); break;
      case 30: s.stageId = f.value as number; break;
      case 31: s.teamId = f.value as number; break;
      case 32: s.promotionId = f.value as number; break;
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
