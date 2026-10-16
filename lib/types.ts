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
  /** This app's own route for the competition, `/competitions/{id}`. */
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

/* ------------------------------------------------------------------------- *
 * NowGoal competition detail — one season of one competition, normalised
 * (see lib/nowgoalLeague.ts, which reads the publisher's own season files).
 * ------------------------------------------------------------------------- */

/** A team as the season file names it: id, display name and absolute crest. */
export interface NowgoalTeamRef {
  id: string;
  name: string;
  /** Absolute crest URL, or `''` — the client falls back to the initial. */
  crest: string;
}

/** One fixture of a season file, with both sides resolved to team names. */
export interface NowgoalFixture {
  id: string;
  /** Kick-off in ms since epoch, converted off the feed's GMT+8 wall clock, or
   *  `null` when the file publishes no usable stamp. */
  kickoffMs: number | null;
  /** The feed's own state field: `-1` finished, `0` not started, `-10`…`-14`
   *  cancelled/pending/abandoned/paused/postponed, a positive value in play. */
  state: number;
  home: NowgoalTeamRef;
  away: NowgoalTeamRef;
  /** Full-time score exactly as published (`3-0`), `''` before kick-off. */
  score: string;
  /** Half-time score as published, `''` when the file has none. */
  halfScore: string;
  homeRed: number;
  awayRed: number;
  /** The publisher's own aside on the tie — leg/extra time/penalties notes,
   *  already turned into plain English (see `fixtureNote`), `''` when none. */
  note: string;
}

/** One round (league) or stage/group (cup), with the fixtures filed under it. */
export interface NowgoalRound {
  /** Key inside the season file, e.g. `R_7` (league) or `G29090A` (cup). */
  key: string;
  /** Label the page shows, e.g. `Round 7` or `League Round A`. */
  label: string;
  fixtures: NowgoalFixture[];
}

/** One standings row. The feed publishes two row layouts; both land here. */
export interface NowgoalStandingRow {
  rank: number;
  team: NowgoalTeamRef;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Band colour the feed files the row under (`ColorList`), `''` when none —
   *  the league tables mark promotion/relegation bands with it. */
  band: string;
  /** Cups only: the feed marks the rows that advance to the next stage. */
  qualified: boolean;
}

/** One standings table: a league's total/home/away view, or a cup group. */
export interface NowgoalStandingTable {
  /** `all` · `home` · `away` for a league, `S{stage}{group}` for a cup group,
   *  `S{id}_all` for one section of a competition filed in sub-leagues. */
  key: string;
  label: string;
  rows: NowgoalStandingRow[];
  /** Bands of this table, when the file marks any (a league's promotion and
   *  relegation places); cups mark qualifiers per row instead. */
  bands?: NowgoalStandingBand[];
  /** How many rounds this table can be rebuilt up to — `0` when it is not a
   *  per-round table (a cup group). */
  roundsPlayed?: number;
  /** The sub-league this table belongs to, when the competition files several
   *  (`SubLeagueInfo`), so a per-round rebuild knows which fixtures it counts. */
  scope?: string;
}

/** One player row of the statistics plate, in the file's own column order. */
export interface NowgoalPlayerRow {
  playerId: string;
  name: string;
  /** Photo path as published, resolved by `playerPhoto` into an absolute URL. */
  photo: string;
  teamId: string;
  teamName: string;
  teamCrest: string;
  columns: number[];
}

/** One statistics metric the publisher's own page offers for a plate. */
export interface NowgoalStatMetric {
  id: string;
  label: string;
}

/** A statistics plate as the page renders it: the requested metric, sorted and
 *  paged, already formatted. */
export interface NowgoalStatTable {
  /** Label of the second column (the per-match average, or `''` when the metric
   *  has a single column). */
  secondLabel: string;
  rows: {
    rank: number;
    name: string;
    /** Absolute photo URL, or `''`. */
    photo: string;
    teamName: string;
    teamCrest: string;
    value: string;
    second: string;
  }[];
  page: number;
  pageCount: number;
  total: number;
}

/** A promotion/qualification band of a league table (`ColorList`). */
export interface NowgoalStandingBand {
  color: string;
  label: string;
}

/** One row of the team statistics plate: the team plus its numeric columns. */
export interface NowgoalTeamRow {
  team: NowgoalTeamRef;
  columns: number[];
}

/** Everything the detail page needs about one season of one competition. */
export interface NowgoalSeasonData {
  /** Competition id — the id in its own `/league/{id}` page. */
  id: string;
  /** Which season-file flavour this is: `s{id}` a league, `c{id}` a cup. */
  kind: 'league' | 'cup';
  /** Full name the season file publishes, e.g. `English Premier League`. */
  name: string;
  /** Compact label the file publishes, e.g. `ENG PR`. */
  shortName: string;
  /** Season label this file was read for, e.g. `2026-2027`. */
  season: string;
  /** Absolute competition crest, or `''`. */
  crest: string;
  /** The publisher's own description of the competition, as plain text. */
  description: string;
  /** Teams the season file lists (20 for a league, up to 650 for a cup). */
  teams: number;
  /** Fixtures, one entry per round (league) or stage/group (cup). */
  rounds: NowgoalRound[];
  /** Standings tables: a league carries three views, a cup one per group. */
  tables: NowgoalStandingTable[];
  /** 1-based index into {@link rounds} of the round the publisher's own fixtures
   *  tab opens on: the round in progress for a league, the stage it flags as
   *  current for a cup (`0` when it flags nothing). */
  currentRound: number;
  /** Player rows, still numeric (the requested metric picks the columns). */
  players: NowgoalPlayerRow[];
  /** Team rows of the same plate, still numeric. */
  teamRows: NowgoalTeamRow[];
  /** When the file itself was last written, as ms since epoch. */
  updatedMs: number | null;
}

/** One selectable option of the detail page: a season, a round, a table. */
export interface NowgoalViewOption {
  key: string;
  label: string;
}

/** Which tab of `/competitions/[id]` is open. */
export type NowgoalViewTab = 'overview' | 'standings' | 'fixtures' | 'stats';

/** One strip of the detail page, already narrowed to the open tab: the server
 *  picks the season, the round and the page and hands the client only the rows
 *  that tab shows, so a season file never reaches the browser whole. */
export interface NowgoalCompetitionView {
  id: string;
  kind: 'league' | 'cup';
  name: string;
  shortName: string;
  season: string;
  crest: string;
  /** The publisher's own description of the competition, as plain text. */
  description: string;
  /** Country or region that runs it, as the catalogue files it (`''` when the
   *  competition is not in the catalogue the page could read). */
  federation: string;
  /** Teams the season file lists. */
  teams: number;
  /** Rounds a league publishes / stages a cup publishes. */
  rounds: number;
  /** When the publisher last wrote the season file, ms since epoch. */
  updatedMs: number | null;
  /** The tabs this competition has data for, in display order. */
  tabs: NowgoalViewOption[];
  tab: NowgoalViewTab;
  /** Season dropdown, newest first. */
  seasons: NowgoalViewOption[];
  /** Fixtures tab: the round (league) / stage+group (cup) dropdown and the
   *  fixtures it points at. */
  roundOptions: NowgoalViewOption[];
  round: string;
  roundLabel: string;
  fixtures: NowgoalFixture[];
  /** Standings tab: a league's total/home/away views or a cup's groups. */
  tableOptions: NowgoalViewOption[];
  table: string;
  tableLabel: string;
  standings: NowgoalStandingRow[];
  /** Bands of the league table, for its legend. */
  bands: NowgoalStandingBand[];
  /** Standings tab of a league: the round the table is cut at (`0` = every
   *  round the feed has results for). */
  standingsRoundOptions: NowgoalViewOption[];
  standingsRound: number;
  /** Overview tab: the leading rows of the first table. */
  preview: NowgoalStandingRow[];
  /** Stats tab: the open plate, its metric dropdown and one page of rows. */
  plate: 'player' | 'team';
  /** The plates this season publishes numbers for (`player` and/or `team`). */
  plates: NowgoalViewOption[];
  /** The open plate's metrics, as its dropdown lists them. */
  metricOptions: NowgoalViewOption[];
  metric: string;
  stat: NowgoalStatTable | null;
}
