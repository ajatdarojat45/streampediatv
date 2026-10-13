// Domain types shared across the app.

import type { LucideIcon } from 'lucide-react';

export type MatchSource = 'data' | 'live';

export interface Team {
  teamId?: number;
  playerId?: number;
  /** PBSportType — carried by PBDataTeam/PBDataPlayer field 2. */
  sportType?: number;
  name?: string;
  nameMap?: Record<number, string>;
  logo?: string;
  country?: string;
  countryLogo?: string;
  hot?: boolean;
  score?: number;
}

export interface League {
  leagueId?: number;
  /** PBSportType — carried by PBDataLeague field 2. */
  sportType?: number;
  name?: string;
  nameMap?: Record<number, string>;
  logo?: string;
  country?: string;
  countryLogo?: string;
  hot?: boolean;
}

export interface Contender {
  sportType?: number;
  name?: string;
  team?: Team;
}

export interface Match {
  source?: MatchSource;
  matchId?: number;
  sportType?: number;
  matchDate?: number;
  status?: number;
  showStatus?: number;
  scoringMatch?: boolean;
  league?: League;
  season?: string;
  stage?: string;
  name?: string;
  title?: string;
  group?: string;
  round?: string;
  hot?: boolean;
  home?: Team;
  away?: Team;
  /** Doubles/multiple players per side (tennis/badminton ganda, ...).
   * Even-indexed contenders = home side, odd-indexed = away side,
   * mirroring HomeContenderState pairing (0+2 vs 1+3). */
  homeTeams?: Team[];
  awayTeams?: Team[];
  homeScore?: number;
  awayScore?: number;
  contenders?: Contender[];
}

export interface Stream {
  streamId?: number;
  channelId?: number;
  name?: string;
  url?: string;
  streamStatus?: number;
  status?: number;
  availableType?: number;
  recommend?: boolean;
  priority?: number;
  siteType?: number;
  fullName?: string;
  urlCdnType?: number;
  headers: Record<string, string>;
  extra: Record<string, string>;
  matchId?: number;
  pageUrl?: string;
}

export interface MatchDetail {
  source?: MatchSource;
  match?: Match;
  streams?: Stream[];
  channels?: Stream[];
}

/** Head-to-head / match analysis payload (PBMatchAnalysisResp, code 107). */
export interface MatchAnalysis {
  /** Past meetings between the two teams (home/away sides alternate per fixture). */
  h2h: Match[];
  /** The home team's recent matches. */
  homeLatest: Match[];
  /** The away team's recent matches. */
  awayLatest: Match[];
  /** The home team's upcoming matches. */
  homeNext: Match[];
  /** The away team's upcoming matches. */
  awayNext: Match[];
}

/** Result of a single match from one team's perspective: win, draw or loss. */
export type MatchOutcome = 'W' | 'D' | 'L';

/** Win / draw / loss summary computed from a head-to-head match list. */
export interface H2HSummary {
  total: number;
  wins: number;
  draws: number;
  losses: number;
  winPct: number;
  drawPct: number;
  lossPct: number;
}

/** One lineup entry (PBDataMatchLineup). */
export interface LineupPlayer {
  player?: Team;
  /** PBPlayerPositionType: 1=Forward, 2=Midfielder, 3=Defender, 4=Goalkeeper. */
  position?: number;
  positionOrder?: number;
  /** PBPlayerAppearanceType: 1=Starting XI, 2=Substitute. */
  appearance?: number;
  /** Shirt number (string, may be empty). */
  number?: string;
}

/** Match lineup payload (PBMatchLineupResp, code 106). */
export interface MatchLineup {
  home: LineupPlayer[];
  away: LineupPlayer[];
}

/** One match event (PBDataMatchEvent): goal, card, substitution, etc. */
export interface MatchEvent {
  /** PBMatchEventType: 101 goal, 102 own goal, 103 penalty goal, 104 penalty missed,
   *  105 substitution, 106 yellow, 107 red, 108 second yellow, 109 corner,
   *  10001 kick off, 10002 full time, 10003 half time, 10005 full time, ... */
  eventType: number;
  /** Match minute label, e.g. "45+2". */
  minute?: string;
  /** Running score after the event, e.g. "1-1". */
  score?: string;
  /** PBTeamSideType: 1 = home, 2 = away. */
  teamSide?: number;
  /** Free-text description (e.g. "Foul"). */
  description?: string;
  /** Goal scorer (goal events). */
  scorer?: Team;
  /** Assist provider (goal events). */
  assistant?: Team;
  /** Card recipient / offender (106/107/108). */
  offender?: Team;
  /** Player coming on (eventType 105). */
  substitutionIn?: Team;
  /** Player going off (eventType 105). */
  substitutionOut?: Team;
}

/** Match events payload (PBMatchEventResp, code 105): 1 = repeated PBDataMatchEvent. */
export type MatchEvents = MatchEvent[];

/** One match statistic row (PBDataMatchStatistic, code 104). */
export interface MatchStat {
  /** PBMatchStatType: 100 ball possession, 101 attacks, 102 dangerous attacks,
   *  103 total shots, 104 shots on target, 105 shots off target, 107 corner kicks,
   *  108 offsides, 109 yellow cards, 110 red cards, 111 keeper saves, ... */
  statType: number;
  /** PBMatchStatRange: 0 = full match, 101 = 1st half, 102 = 2nd half. */
  statRange: number;
  /** Home value for the given stat (count, or percent for ball possession). */
  homeValue?: number;
  /** Away value for the given stat. */
  awayValue?: number;
}

/** Match statistics payload (PBMatchStatisticResp, code 104): 1 = repeated PBDataMatchStatistic. */
export type MatchStats = MatchStat[];

/* ---------- competition (league) family ----------
 * Backed by the /api/league/* endpoints (data.proto → league/*.proto). All of
 * them are signed with the SAME endpoint signature: DT_LEAGUE (code 200). */

/** PBDataSeason: 1=seasonId, 2=sportType, 3=name map, 10=beginDate, 11=endDate. */
export interface LeagueSeason {
  seasonId?: number;
  sportType?: number;
  nameMap?: Record<number, string>;
  name?: string;
  /** Plain season slug carried by PBDataSeasonExtraFtb (field 50.1), e.g. "26-27". */
  extraName?: string;
  /** Season window (ms epoch) as sent by the API. */
  beginDate?: number;
  endDate?: number;
}

/** PBDataStage: 1=stageId, 2=sportType, 3=name map. */
export interface LeagueStage {
  stageId?: number;
  sportType?: number;
  nameMap?: Record<number, string>;
  name?: string;
}

/** PBLeagueExtraFtb.HasData (field 60) — which competition sub-views exist.
 *  The page uses this to hide a tab the feed has no data for. */
export interface LeagueHasData {
  standings?: boolean;
  matches?: boolean;
  playerTotal?: boolean;
  teamTotal?: boolean;
  knockout?: boolean;
}

/** PBLeagueExtraFtb — competition-level aggregates rendered as stat chips.
 *  The percent/`value` fields are STRINGS exactly as the API sends them
 *  (e.g. win "54.0", avgGoals "3.1", teamMarketValue "18.6B€"). */
export interface LeagueExtra {
  /** Share of matches won by the home side (percent, string). */
  win?: string;
  /** Share of draws (percent, string). */
  draw?: string;
  /** Share of losses (percent, string). */
  loss?: string;
  teamCount?: number;
  playerCount?: number;
  teamMarketValue?: string;
  teamForeignPlayers?: string;
  avgAge?: string;
  avgGoals?: string;
  redCards?: string;
  yellowCards?: string;
  /** MVP (best player) of the competition — PBDataPlayer. */
  mvpPlayer?: Team;
  hasData?: LeagueHasData;
  /** Web slug of the competition, e.g. "uefa-champions-league". */
  leagueLink?: string;
  leagueSeasonNameLink?: string;
}

/** Competition detail payload — /api/league/detail, endpoint code 200. */
export interface LeagueDetail {
  league?: League & { level?: number; season?: LeagueSeason };
  extra?: LeagueExtra;
}

/** One table row (PBDataTeamStanding): overall + home/away splits, keyed to a
 *  team by `teamId` (the team itself arrives in the response's own team list). */
export interface TeamStanding {
  teamId?: number;
  stageId?: number;
  groupName?: string;
  promotionId?: number;
  total?: number;
  won?: number;
  draw?: number;
  loss?: number;
  goals?: number;
  goalsAgainst?: number;
  points?: number;
  homeTotal?: number;
  homeWon?: number;
  homeDraw?: number;
  homeLoss?: number;
  homeGoals?: number;
  homeGoalsAgainst?: number;
  homePoints?: number;
  awayTotal?: number;
  awayWon?: number;
  awayDraw?: number;
  awayLoss?: number;
  awayGoals?: number;
  awayGoalsAgainst?: number;
  awayPoints?: number;
}

/** Promotion band (PBDatLeaguePromotion): 1=promotionId, 2=name, 3=color.
 *  `color` is a hex string ("#97D867") used as the row's promotion stripe. */
export interface LeaguePromotion {
  promotionId?: number;
  name?: string;
  color?: string;
}

/** Standings payload — /api/league/team/standing/list, endpoint code 200. */
export interface LeagueStandings {
  rows: TeamStanding[];
  /** teamId → team, so a row can render its crest + name. */
  teams: Record<number, Team>;
  stage?: LeagueStage;
  /** promotionId → band (name + colour). */
  promotions: Record<number, LeaguePromotion>;
}

/** One player's competition totals (PBDataPlayerTotal). The feed is sparse:
 *  a counter the player never recorded is omitted, so every number here is
 *  optional and the UI reads a missing field as 0. */
export interface PlayerTotal {
  playerId?: number;
  teamId?: number;
  goals?: number;
  /** Goals from the penalty spot — a subset of `goals`. */
  penaltyKick?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  /** Per-game strings exactly as the API sends them (e.g. "2.0"). */
  shotsPerGame?: string;
  minutesPerGame?: string;
}

/** Competition player statistics — /api/league/player/total/list, code 200.
 *  The response ships the totals plus its own player/team lists so a row can
 *  render an avatar, a name and a crest without extra requests. */
export interface LeaguePlayerTotals {
  rows: PlayerTotal[];
  /** playerId → player (name + avatar). */
  players: Record<number, Team>;
  /** teamId → team (name + crest). */
  teams: Record<number, Team>;
}

export interface MatchList {
  list: Match[];
  source: MatchSource;
}

export interface Sport {
  value: number;
  label: string;
  /** URL slug used in the dynamic route /sports/[category]. */
  slug: string;
  icon: LucideIcon;
  color: string;
  /** Whether the sport uses a home/away score (defaults to true). */
  scoring?: boolean;
}

export interface AppConfig {
  sportType: number;
  language: number;
  streamId: number;
  channelId: number;
  siteType: number;
  continent: string;
  country: string;
  deviceId: string;
  activationCode: string;
}
