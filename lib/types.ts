// Domain types shared across the app.

import type { LucideIcon } from 'lucide-react';

export type MatchSource = 'data' | 'live';

export interface Team {
  teamId?: number;
  playerId?: number;
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

/* ------------------------------------------------------------------------- *
 * NowGoal football competition catalogue — the federation/competition feed
 * behind `/competitions` (see lib/nowgoal.ts).
 * ------------------------------------------------------------------------- */

/** One competition row of the feed: `36,ENG PR,1,0,2026-2027,2025-2026,...`. */
export interface NowgoalCompetition {
  /** Publisher's competition id — also the id in its own `/league/{id}` page. */
  id: string;
  /** Short label the feed itself shows in a compact grid, e.g. "ENG PR". */
  name: string;
  /** Third field: `1` = league, `2` = cup (the publisher's own split). */
  kind: 'league' | 'cup';
  /** Fourth field: `true` for a top-flight league — cups always read `false`. */
  topTier: boolean;
  /** Newest season label of the feed, e.g. "2026-2027" (empty when unlisted).
   *  The feed also lists every past season; nothing renders those. */
  season: string;
}

/** One federation (country / region) of the feed, with the competitions it runs. */
export interface NowgoalFederation {
  /** Feed key, e.g. "InfoID_1" (England). */
  id: string;
  /** Country or region name, e.g. "England". */
  name: string;
  /** Badge path exactly as published, e.g. "images/164326923816.png". */
  flag: string;
  /** Continent key 0–5 — see NOWGOAL_CONTINENTS in lib/nowgoal.ts. */
  area: string;
  competitions: NowgoalCompetition[];
}

/** Shape of `data/nowgoal-competitions.json` — the committed feed snapshot. */
export interface NowgoalCatalogueFile {
  /** ISO timestamp of the generator run that wrote the file. */
  generatedAt: string;
  /** Feed URL the snapshot was parsed from. */
  origin: string;
  federations: NowgoalFederation[];
}

/** A competition ready to render: the feed row plus its crest and its page. */
export interface NowgoalCompetitionEntry extends NowgoalCompetition {
  /** Absolute crest URL, or `''` when the feed publishes none. */
  crest: string;
  /** Absolute competition page on the publisher's site. */
  href: string;
}

/** A federation ready to render: absolute badge URL + resolved continent label. */
export interface NowgoalFederationEntry {
  id: string;
  name: string;
  /** Absolute badge URL, or `''` when the feed publishes none. */
  badge: string;
  area: string;
  continent: string;
  competitions: NowgoalCompetitionEntry[];
}

/** One continent of the directory (the feed's own six area buckets). */
export interface NowgoalContinent {
  key: string;
  label: string;
  federations: number;
  competitions: number;
}

/** The whole `/competitions` directory: federations, continent tabs, totals. */
export interface NowgoalCatalogue {
  federations: NowgoalFederationEntry[];
  continents: NowgoalContinent[];
  totals: {
    federations: number;
    competitions: number;
    leagues: number;
    cups: number;
  };
  /** `nowgoal` when the live feed answered, `snapshot` when the committed file did. */
  source: 'nowgoal' | 'snapshot';
  /** When the catalogue in use was read: the fetch time for a live read, the
   *  generator run that wrote the snapshot for a fallback (`''` if neither). */
  generatedAt: string;
}
