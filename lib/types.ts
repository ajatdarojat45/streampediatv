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
  /** Goaloo club page this team belongs to, resolved from its published name by
   *  lib/goalooTeams when the server action decoded the payload. The Rblink
   *  feeds carry no club id of their own, so the field is filled in for football
   *  payloads only and stays ABSENT whenever the name could not be resolved with
   *  certainty — the club then renders as plain text rather than a wrong link.
   *  Ignored by the club/player feeds, which already travel with Goaloo ids. */
  clubId?: number;
  /** Goaloo player page this row's player belongs to — `/player/{id}` — resolved
   *  from the published name by lib/goalooSquad, inside the squad of the club
   *  the row carries. Filled in for football payloads only, and only when that
   *  squad names the player with certainty; absent means the name renders as
   *  plain text rather than a wrong profile. Not read for `teamId` rows, which
   *  are clubs (see {@link clubId}). */
  playerPageId?: number;
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

/** One competition in the Goaloo worldwide catalogue (data/competitions.json).
 *  `path` is the feed's own key — `s<id>` for a round-robin league, `c<id>` for
 *  a cup — and it is stored rather than derived because the catalogue is the
 *  only place that knows which of the two a given id is. */
export interface GoalooCompetition {
  id: number;
  /** Long English name, e.g. "England Premier League". */
  name: string;
  /** Feed short code, e.g. "ENG PR" (kept for compact lists). */
  short: string;
  country: string;
  /** Goaloo region bucket — see GOALOO_AREAS in lib/goaloo.ts. */
  area: number;
  /** 1 = league, 2 = cup. */
  type: number;
  /** 1 when the publisher flags it as a headline competition. */
  hot: number;
  /** Crest path as shipped by the feed; resolve with goalooCompetitionLogoUrl. */
  logo: string;
  color: string;
  /** Season on display, e.g. "2026-2027". */
  season: string;
  /** Season that actually holds the JSON on disk (differs for a handful of
   *  competitions, where the display season leads the published one). */
  seasonDir: string;
  /** `s<id>` / `c<id>`. */
  path: string;
}

export interface GoalooTeam {
  id: number;
  name: string;
  /** Absolute crest URL (already resolved). */
  logo: string;
}

/** One fixture, normalised out of the feed's positional rows. */
export interface GoalooFixture {
  matchId: number;
  /** Raw status code (0 scheduled, -1 finished, >0 in play). */
  status?: number;
  statusKind: 'scheduled' | 'live' | 'finished' | 'unknown';
  /** Kickoff in epoch ms (converted from the feed's UTC+8 clock). */
  kickoff: number;
  homeId: number;
  awayId: number;
  home: GoalooTeam;
  away: GoalooTeam;
  score: { home: number; away: number } | null;
  halfScore: { home: number; away: number } | null;
  /** Stage key the fixture arrived under (`R_7`, `G29090A`). */
  stageKey: string;
  /** Aggregate of the tie this leg belongs to (two-legged rounds only). */
  tie?: { homeId?: number; awayId?: number; aggHome?: number; aggAway?: number };
  /** "Leg 1" / "Leg 2" inside a two-legged tie. */
  legLabel?: string;
}


/** A stage — a cup round or a league matchday — with its fixtures. */
export interface GoalooStage {
  key: string;
  label: string;
  items: GoalooFixture[];
}

export interface GoalooStandingRow {
  rank: number;
  team: GoalooTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface GoalooStandingsGroup {
  key: string;
  name: string;
  rows: GoalooStandingRow[];
}

/** Everything one competition page needs, parsed in one pass. */
export interface GoalooCompetitionDetail {
  comp: GoalooCompetition;
  /** The competition's rules blurb (often empty for minor leagues). */
  about: string;
  teams: GoalooTeam[];
  stages: GoalooStage[];
  standings: GoalooStandingsGroup[];
}

/** One fixture row on a club or player page.
 *
 *  All three Goaloo match feeds (the club's own history, the club's schedule
 *  ajax and a player's match log) publish the same leading fields in the same
 *  order, so one shape carries them all. `streamId` is the Rblink matchId the
 *  row was joined to (see lib/goalooJoin.ts) — `0` when the fixture is not in
 *  the stream catalogue, in which case the row renders as plain text. */
export interface GoalooMatchRef {
  /** Goaloo's own schedule id (the feed keys matches by it). */
  matchId: number;
  /** Kickoff in epoch ms (converted from the feed's UTC+8 clock). */
  kickoff: number;
  /** Goaloo competition id, e.g. 1122 (Indonesia Super League). */
  leagueId: number;
  /** Competition name as published by the feed that carried the row. */
  competition: string;
  /** Competition colour as published (feed UI accent, may be empty). */
  color: string;
  home: { id: number; name: string };
  away: { id: number; name: string };
  /** Final score — `null` for a fixture that has not been played yet. */
  score: { home: number; away: number } | null;
  /** Rblink matchId for `/watch/{id}?sport=football`; 0 = no stream. */
  streamId: number;
}

/** One member of a club's first team, as listed by the club feed. */
export interface GoalooClubPerson {
  id: number;
  name: string;
  /** Shirt number exactly as published ("" when the feed leaves it blank). */
  number: string;
  /** Absolute photo URL ("" when the feed publishes none). */
  photo: string;
  country: string;
  /** Bucket label in the feed's own words: Goalkeeper/Defender/Midfielder/Striker. */
  position: string;
  /** Bucket rank for ordering — 1 striker … 4 goalkeeper, 0 when unlisted. */
  positionRank: number;
  /** Date of birth, `YYYY-MM-DD`, "" when unpublished. */
  dateOfBirth: string;
  /** Market value as published (hundredths of the feed's £M unit), "" if none. */
  marketValue: string;
  /** Contract expiry, "" when unpublished. */
  contract: string;
}

/** A transfer in or out, from `/ajax/GetTeamTransferByYear`.
 *
 *  The feed ships the counterpart club by id only — no name — so the row links
 *  that club's crest and no name is invented for it. */
export interface GoalooTransfer {
  playerId: number;
  playerName: string;
  /** Absolute player photo URL ("" when the feed publishes none). */
  photo: string;
  /** Counterpart club id (the club the player came from / moved to). */
  clubId: number;
  /** Fee as published, "" when the feed publishes none. */
  fee: string;
  /** Date as published (`dd-mm-yyyy`). */
  date: string;
  /** Published transfer type: Loan / Free Transfer / Wholly Owned / … */
  type: string;
  /** `true` = arrival, `false` = departure. */
  joined: boolean;
}

/** Everything one club page needs: the team feed, its schedule and its
 *  transfers, with every match row joined to the stream catalogue. */
export interface GoalooClub {
  id: number;
  name: string;
  /** Absolute crest URL. */
  logo: string;
  city: string;
  stadium: string;
  /** Stadium capacity exactly as published ("" when the feed omits it). */
  capacity: string;
  /** Established date as published ("" when the feed omits it). */
  founded: string;
  /** Squad value in the feed's £M unit as published, "" when omitted. */
  marketValue: string;
  /** Average squad age as published, "" when omitted. */
  avgAge: string;
  /** The club's own competition — the one its feed header names. */
  leagueId: number;
  leagueName: string;
  leagueLogo: string;
  /** Rblink leagueId for `/competition/{id}` — 0 when the stream catalogue
   *  does not pair this competition (the club page then shows it as text). */
  leagueStreamId: number;
  coach: GoalooClubPerson | null;
  /** First team, ordered Goalkeepers → Defenders → Midfielders → Strikers. */
  squad: GoalooClubPerson[];
  /** Competitions the feed lists for this club (schedule ajax `SclassList`). */
  competitions: { id: number; name: string }[];
  /** Played matches, newest first (the club feed's own history rows). */
  results: GoalooMatchRef[];
  /** Not-yet-played fixtures, soonest first (the club's schedule). */
  fixtures: GoalooMatchRef[];
  /** Years the feed publishes transfers for, newest first. */
  transferYears: string[];
  /** The newest published transfer year — arrivals and departures. */
  transfers: GoalooTransfer[];
  /** Feed's own last-update stamp, `YYYY-MM-DD HH:MM:SS` (UTC+8). */
  updatedAt: string;
}

/** One appearance in a player's published match log (`playerCount`). */
export interface GoalooPlayerMatch extends GoalooMatchRef {
  /** Season label as published, e.g. "2026-2027". */
  season: string;
  /** Minutes played; 0 when the feed publishes none. */
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  /** Match rating as published; 0 when the feed publishes none. */
  rating: number;
}

/** One line of a player's transfer record. */
export interface GoalooPlayerTransfer {
  /** Season label as published, e.g. "2021-2022". */
  season: string;
  fromId: number;
  fromName: string;
  /** Absolute crest URL. */
  fromLogo: string;
  toId: number;
  toName: string;
  /** Absolute crest URL. */
  toLogo: string;
  /** Window start / end as published (`YYYY-MM-DD`). */
  fromDate: string;
  toDate: string;
  /** Fee as published, "" when the feed publishes none. */
  fee: string;
  /** Published transfer type: Loan / Free Transfer / Wholly Owned / … */
  type: string;
}

/** Per-season totals summed over the appearances a player's feed lists. */
export interface GoalooPlayerSeason {
  season: string;
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
}

/** Everything one player page needs. */
export interface GoalooPlayer {
  id: number;
  name: string;
  /** Absolute photo URL ("" when the feed publishes none). */
  photo: string;
  /** Current club — the only club the feed states for the player. */
  teamId: number;
  teamName: string;
  teamLogo: string;
  country: string;
  /** Absolute flag URL ("" when the feed publishes none). */
  countryFlag: string;
  /** Shirt number exactly as published ("" when the feed leaves it blank). */
  number: string;
  /** Market value as published (hundredths of the feed's £M unit), "" if none. */
  marketValue: string;
  /** Contract expiry as published, "" when omitted. */
  contract: string;
  /** Date of birth, `YYYY-MM-DD`, "" when unpublished. */
  dateOfBirth: string;
  /** Height in cm as published, "" when omitted. */
  height: string;
  /** Weight in kg as published, "" when omitted. */
  weight: string;
  /** Preferred foot in the feed's own words: Left/Right/Both ("" if unset). */
  foot: string;
  /** The player's competition, as published in his own feed. */
  leagueId: number;
  /** Competition name from the static catalogue ("" when it does not list the
   *  id at all). */
  leagueName: string;
  /** Rblink leagueId for `/competition/{id}`; 0 = no stream for it. */
  leagueStreamId: number;
  /** Appearances, newest first. */
  matches: GoalooPlayerMatch[];
  /** Season totals over those appearances, newest season first. */
  seasons: GoalooPlayerSeason[];
  /** Transfer record, newest first. */
  transfers: GoalooPlayerTransfer[];
  /** Feed's own last-update stamp, `YYYY-MM-DD HH:MM:SS` (UTC+8). */
  updatedAt: string;
}


/** One football competition as published by the Rblink catalogue
 *  (data/rblink-leagues.json, written by tools/gen-rblink-leagues.mjs). This is
 *  the streaming side of the join: it carries the id the /watch route needs. */
export interface RblinkLeague {
  id: number;
  name: string;
  /** Country label as published ("England", "Asian", "International"). */
  country: string;
  countryId: number;
  flag: string;
  logo: string;
  /** URL slug, e.g. "english-premier-league". */
  slug: string;
  teams: number;
  players: number;
  /** Published season window, epoch ms (absent for a few rows). */
  season: { id: number; name: string; start: number; end: number } | null;
  avgGoals: number;
  hot: boolean;
  /** Publisher flags: the competition has fixtures / a table right now. */
  matches: boolean;
  standings: boolean;
}

/** One row of the `/competitions` directory: a competition from the Goaloo
 *  catalogue plus the Rblink league that streams it, when the matcher paired
 *  the two feeds. Plain JSON — the page is a server component and hands these
 *  down as props, so nothing heavier than the fields below leaves the server. */
export interface CompetitionDirectoryRow {
  /** Goaloo feed key (`s<id>` / `c<id>`) — React key and deep-link target. */
  key: string;
  name: string;
  /** Publisher headline flag (`GoalooCompetition.hot === 1`). */
  hot: boolean;
  /** Rblink leagueId for `/competition/{id}?sport=football`; 0 = no stream. */
  streamId: number;
  /** The joined Rblink league publishes fixtures right now. */
  fixtures: boolean;
}

/** One country block of the directory ("England", "International", …). */
export interface CompetitionDirectorySection {
  country: string;
  /** Rows carrying a stream — pre-counted so the filter pills need no scan. */
  streamed: number;
  rows: CompetitionDirectoryRow[];
}

/** Card in the headline strip at the top of `/competitions`. */
export interface CompetitionHighlight {
  key: string;
  name: string;
  country: string;
  /** Absolute crest URL (already resolved through goalooCompetitionLogoUrl). */
  logo: string;
  /** Rblink leagueId — always > 0: highlights are streams by construction. */
  streamId: number;
}

/** Everything `/competitions` renders, assembled once per server process. */
export interface CompetitionDirectory {
  sections: CompetitionDirectorySection[];
  highlights: CompetitionHighlight[];
  /** When the Rblink scan behind the join last ran (shown as provenance). */
  generatedAt: string;
  totals: {
    /** Competitions in the Goaloo catalogue. */
    competitions: number;
    /** Distinct countries across those competitions. */
    countries: number;
    /** Competitions the matcher could pair with a Rblink stream. */
    streamed: number;
  };
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
