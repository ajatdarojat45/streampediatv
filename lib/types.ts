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

/* ------------------------------------------------------------------------- *
 * NowGoal club detail — one club, one competition and one season at a time
 * (see lib/nowgoalTeam.ts, which reads the publisher's own club page).
 * ------------------------------------------------------------------------- */

/** One player of a club's squad list, as the club's own detail file files them
 *  (`lineupDetail`, with the photo the position lists carry). */
export interface NowgoalSquadPlayer {
  id: string;
  name: string;
  /** Absolute photo URL, or `''` when the file files the player in no position
   *  list (only its lineup row, which carries no photo). */
  photo: string;
  /** Shirt number as published, `''` when the file has none. */
  number: string;
  /** The group the file files them under — `Forward`, `Midfielder`, `Defender`
   *  or `Goalkeeper` — or `''` when it files them under none. */
  group: string;
  /** The file's own role text, e.g. `Centre Forward`, `Left-Back`. */
  role: string;
  /** Birthday as published (`2001-03-17`), `''` when it has none. */
  birthday: string;
  /** Age in years at the file's own last update, `null` without a birthday. */
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  country: string;
  /** Estimated value in millions of pounds — the file publishes it in £10k
   *  units, so `1500` is £15M (the publisher's own `toExp` divides by 100).
   *  `null` when the file has no value for the player. */
  valueMillions: number | null;
  /** Contract expiry as published (`2027-06-30`), `''` when it has none. */
  contractExpiry: string;
}

/** One honour of the club's own list (`TeamHonor`). */
export interface NowgoalHonour {
  /** The honour as the file names it, e.g. `ITALIAN CHAMPION`. */
  title: string;
  /** The seasons it was won in, as published (`75/76`), newest first. */
  seasons: string[];
}

/** The club itself, as its own detail file describes it (`TeamInfo`, `coach`). */
export interface NowgoalTeamInfo {
  id: string;
  name: string;
  /** Absolute crest, or `''` — the client falls back to the initial. */
  crest: string;
  city: string;
  stadium: string;
  /** Capacity as published, `null` when the file has none. */
  capacity: number | null;
  /** Year the club was founded, as published (`1906`), `''` when unknown. */
  founded: string;
  /** Estimated squad value in millions of pounds, `null` when unknown. */
  valueMillions: number | null;
  /** Average age of the squad as published (`26.1`), `''` when unknown. */
  avgAge: string;
  /** The competition the club is filed under, and its crest — the id is the one
   *  `/competitions/[id]` reads, so the page can link to it. */
  leagueId: string;
  leagueName: string;
  leagueCrest: string;
  coach: { id: string; name: string; photo: string } | null;
  honours: NowgoalHonour[];
  /** The publisher's own style notes (`teamCharacter`). It publishes no legend
   *  for the two fields that file them, so only their texts are kept. */
  traits: string[];
  /** When the file itself was last written, ms since epoch. */
  updatedMs: number | null;
}

/** One fixture of the club's own schedule endpoint, which publishes the two
 *  sides inline rather than as ids into a table. */
export interface NowgoalTeamFixture extends NowgoalFixture {
  /** Competition the fixture is filed under (`SclassID`). */
  competitionId: string;
  /** That competition's name, as the endpoint's own list names it. */
  competition: string;
  /** The competition's country flag, or `''`. */
  countryFlag: string;
  /** The rank the endpoint publishes per side — a league position (`16`), or a
   *  competition-coded one (`ITA D1-14`) for a match outside that league. `''`
   *  when it has none (a fixture not played yet). */
  rank: { home: string; away: string };
  /** The club's own rating for the match, `null` when the endpoint has none. */
  rating: number | null;
  /** How the club fared in a finished fixture — `''` before it is played. */
  result: '' | 'W' | 'D' | 'L';
}

/** One competition the club played in, with the seasons it played it in (the
 *  club file's `TeamOrderInfo`, and its `PlayerStatsSclassList` for the
 *  competitions it publishes a player plate for). */
export interface NowgoalTeamCompetition {
  id: string;
  name: string;
  /** `cup` for a competition whose season file is a cup's (`c{id}`). */
  kind: 'league' | 'cup';
  /** Seasons the club has data for, newest first. */
  seasons: NowgoalViewOption[];
  /** Per season, the section of that competition's season file the club's
   *  matches are filed under — a sub-league's section, a cup's group — as
   *  `{ [season]: sectionId }`. Empty for a competition the source publishes no
   *  sections for. */
  sections: Record<string, string>;
}

/** One transfer of the club's own endpoint. */
export interface NowgoalTeamTransfer {
  playerId: string;
  name: string;
  /** Absolute photo URL, or `''`. */
  photo: string;
  /** The other club's id — the endpoint publishes no name for it — and its
   *  crest, or `''`. */
  teamId: string;
  teamCrest: string;
  /** Fee as published (`-` for an undisclosed one, `€ 12.5M` otherwise). */
  fee: string;
  /** Date of the move as published, turned into `YYYY-MM-DD`. */
  date: string;
  /** The publisher's own kind of move (`Full Ownership`, `Loan`, …). */
  type: string;
  /** `in` when the player joined this club, `out` when he left it. */
  direction: 'in' | 'out';
}

/** One fact of the club's own season: a label and an already-formatted value. */
export interface NowgoalTeamFact {
  label: string;
  value: string;
}

/** The club's own row of one view of a competition's table. */
export interface NowgoalTeamRecord {
  /** The view's own label: `Total`, `Home`, `Away`, or a cup group's name. */
  label: string;
  row: NowgoalStandingRow;
}

/** The club's recent results, newest first. */
export interface NowgoalTeamForm {
  results: ('W' | 'D' | 'L')[];
  /** What the run is, in words (`Last 6 matches, newest first`). */
  note: string;
}

/** The club's own numbers for one competition and season: its rows in the
 *  competition's table plus what its finished fixtures of that competition add
 *  up to. Everything here is read from the competition's own season file, so a
 *  number either comes from the publisher's own table or is derived from the
 *  fixtures it publishes — nothing is estimated. */
export interface NowgoalTeamSeasonStats {
  /** The club's own row of every view the file publishes for its section, in
   *  the file's own order (`Total`, `Home`, `Away`, or the group it was drawn
   *  in when the competition is a cup). */
  records: NowgoalTeamRecord[];
  /** Facts derived from the club's finished fixtures of that competition. */
  facts: NowgoalTeamFact[];
  form: NowgoalTeamForm;
  /** Played fixtures the derived facts were read from. */
  played: number;
}

/** The open competition's table, as the club's own page shows it. */
export interface NowgoalTeamStanding {
  /** The tables the club's section of that competition publishes, as the
   *  fallback dropdown lists them. */
  tableOptions: NowgoalViewOption[];
  /** The region pills (`All` · `Home` · `Away`) when the section publishes
   *  them — a league does, a cup group does not. */
  viewOptions: NowgoalViewOption[];
  table: string;
  label: string;
  rows: NowgoalStandingRow[];
  bands: NowgoalStandingBand[];
}

/** Which tab of `/teams/[id]` is open. */
export type NowgoalTeamTab = 'fixtures' | 'players' | 'stats' | 'standing' | 'info' | 'transfers';

/** Which plate of the players tab is open. */
export type NowgoalTeamPlayerTab = 'lineup' | 'data';

/** `/teams/[id]`: one club, with the rows of the tab that is open. The server
 *  picks the competition, the season and the page and hands the client only
 *  what that tab shows, so neither a squad plate nor a season file reaches the
 *  browser whole. */
export interface NowgoalTeamView {
  info: NowgoalTeamInfo;
  /** The tabs this club has data for, in display order. */
  tabs: NowgoalViewOption[];
  tab: NowgoalTeamTab;

  /* Fixtures tab — the club's own schedule endpoint, ten fixtures a page. */
  /** Competitions the endpoint files the club's fixtures under, `All` first
   *  (key `0`). */
  competitions: NowgoalViewOption[];
  competition: string;
  fixtures: NowgoalTeamFixture[];
  fixturePage: number;
  fixturePageCount: number;

  /* Players tab. */
  playerTab: NowgoalTeamPlayerTab;
  /** The club's squad, as its own lineup lists it (the coach is not in it).
   *  Only the players tab is sent it; every other tab gets an empty list and
   *  reads {@link squadSize} for the count. */
  squad: NowgoalSquadPlayer[];
  /** Players the club's own file lists. */
  squadSize: number;
  /** Competitions the file publishes a player plate for, newest season first. */
  playerCompetitions: NowgoalViewOption[];
  /** The open player competition (an id of {@link playerCompetitions}). */
  playerCompetition: string;
  /** Seasons of the selected player competition, newest first. */
  playerSeasons: NowgoalViewOption[];
  playerSeason: string;
  /** The open plate's metrics, as its dropdown lists them. */
  metricOptions: NowgoalViewOption[];
  metric: string;
  stat: NowgoalStatTable | null;

  /* Stats and standing tabs — both cut from one competition's season file, and
   * both offered over the competitions the club's own file lists. */
  seasonCompetitions: NowgoalViewOption[];
  statCompetition: string;
  /** Seasons of the selected stats competition, newest first. */
  statSeasons: NowgoalViewOption[];
  statSeason: string;
  stats: NowgoalTeamSeasonStats | null;
  standCompetition: string;
  /** Seasons of the selected standing competition, newest first. */
  standSeasons: NowgoalViewOption[];
  standSeason: string;
  standing: NowgoalTeamStanding | null;

  /* Transfers tab. */
  transferYears: NowgoalViewOption[];
  transferYear: string;
  transferDirection: 'in' | 'out';
  transfers: NowgoalTeamTransfer[];
}

/* ------------------------------------------------------------------------- *
 * NowGoal player detail — one player, one competition and one season at a time
 * (see lib/nowgoalPlayer.ts, which reads the publisher's own player page).
 * ------------------------------------------------------------------------- */

/** One attribute of the player's own radar (`RadarInfo`), on the publisher's own
 *  0–100 scale. */
export interface NowgoalPlayerAttribute {
  /** The publisher's own short label — `PAC`, `SHO`, `PHY`, `PAS`, `DEF` and
   *  `DRI` for an outfield player, `DIV`, `HAN`, `POS`, `KIC`, `SPD` and `REF`
   *  for a goalkeeper. It publishes no longer name for any of them. */
  key: string;
  /** The value as published (`0`–`100`). */
  value: number;
}

/** The player himself, as his own detail file describes him (`PlayerInfo`,
 *  `RadarInfo`). */
export interface NowgoalPlayerInfo {
  id: string;
  name: string;
  /** Absolute photo URL, or `''` — the page falls back to its own icon. */
  photo: string;
  /** The club the file files him under, and its crest — the id is the one
   *  `/teams/[id]` reads, so the page can link to it. */
  teamId: string;
  teamName: string;
  teamCrest: string;
  country: string;
  /** The country's flag, addressed the way the publisher's own header does, or
   *  `''`. */
  countryFlag: string;
  /** Shirt number as published, `''` when the file has none. */
  number: string;
  /** Estimated value in millions of pounds — the file publishes it in £10k
   *  units, so `500` is £5M (the publisher's own `toExp` divides by 100).
   *  `null` when the file has no value for him. */
  valueMillions: number | null;
  /** Contract expiry as published (`2029-06-30`), `''` when it has none. */
  contractExpiry: string;
  /** Birthday as published (`2000-02-18`), `''` when it has none. */
  birthday: string;
  /** Age in years at the file's own last update, `null` without a birthday. */
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Preferred foot as the publisher's own map names it — `Left`, `Right` or
   *  `Both` — or `''`. */
  foot: string;
  /** The competition the player's own page opens its statistics on (`PlayerInfo`
   *  index 15), which is the one he plays in now. `''` when it names none. */
  competitionId: string;
  /** That competition's crest, addressed the way every other crest in the app is
   *  (the site's own `_miniLeaguePicUrl`), or `''`. */
  competitionCrest: string;
  /** The six attributes of his own radar, in the publisher's own order. */
  attributes: NowgoalPlayerAttribute[];
  /** When the file itself was last written, ms since epoch. */
  updatedMs: number | null;
}

/** One figure of the player's own statistics plate: a label and an
 *  already-formatted value. */
export interface NowgoalPlayerFact {
  label: string;
  value: string;
}

/** One block of the player's own statistics plate (`Important`, `Offensive`,
 *  `Passing`, `Defensive`), as the publisher's own page lays it out. */
export interface NowgoalPlayerStatBlock {
  label: string;
  facts: NowgoalPlayerFact[];
}

/** The player's own numbers for one competition and one season, added up off
 *  the rows of his own match log that are filed under them — nothing here is
 *  estimated, and every label is the publisher's own. */
export interface NowgoalPlayerSeasonStats {
  competitionId: string;
  competition: string;
  season: string;
  /** Matches of that competition and season his own log files him in. */
  matches: number;
  blocks: NowgoalPlayerStatBlock[];
}

/** The player's own numbers for one match, as the log files them — the columns
 *  the publisher's own statistics plate adds up (`initTechStats`). */
export interface NowgoalPlayerMatchStats {
  /** Minutes he was on the pitch. */
  minutes: number;
  /** The rating the publisher published for him, or `null` when it published
   *  none — it files a `0` for a match it has no rating for. */
  rating: number | null;
  goals: number;
  /** The goals of his that were penalties, which the plate prints beside the
   *  goals (`Goals(P)`). */
  penalties: number;
  assists: number;
  /** The three card marks of the publisher's own rows. */
  red: number;
  yellow: number;
  twoYellow: number;
  shots: number;
  /** Shots on goal (`Shots (SOG)`). */
  shotsOnTarget: number;
  fouled: number;
  offsides: number;
  /** Matches the publisher filed him as the best player of. */
  best: number;
  passes: number;
  passesCompleted: number;
  keyPasses: number;
  longPasses: number;
  throughBalls: number;
  breakLoose: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  steals: number;
  blocked: number;
  headers: number;
  fouls: number;
}

/** One match of the player's own log (`playerCount`), which the publisher files
 *  once per match the player appears in. */
export interface NowgoalPlayerMatch {
  id: string;
  /** Kick-off as ms since epoch, or `null` for a stamp it could not read. */
  kickoffMs: number | null;
  competitionId: string;
  competition: string;
  /** The competition's country flag, or `''`. */
  countryFlag: string;
  home: { id: string; name: string; crest: string };
  away: { id: string; name: string; crest: string };
  /** The final score as published (`2-1`). */
  score: string;
  /** Competition season the match is filed under (`2026-2027`). */
  season: string;
  stats: NowgoalPlayerMatchStats;
  /** The publisher's own highlight link for the match, `''` when it has none. */
  highlights: string;
}

/** One move of the player's own transfer list (`TransferInfo`). */
export interface NowgoalPlayerTransfer {
  /** The season label the file files the move under (`2025-2026`). */
  season: string;
  /** The club he moved to. */
  teamId: string;
  teamName: string;
  teamCrest: string;
  /** The club he moved from — the publisher publishes both ends of a move,
   *  unlike the club's own transfer endpoint. */
  fromTeamId: string;
  fromTeamName: string;
  fromTeamCrest: string;
  /** Fee the file publishes, in millions of pounds — it stores it in £10k
   *  units, so `750` is £7.5M — or `null` when it has none. */
  feeMillions: number | null;
  /** Date of the move as published, `YYYY-MM-DD`. */
  date: string;
  /** The publisher's own kind of move (`Full Ownership`, `Loan`, …), `''` for
   *  one its map does not carry. */
  type: string;
}

/** Which tab of `/players/[id]` is open. */
export type NowgoalPlayerTab = 'info' | 'stats' | 'matches' | 'transfer';

/** `/players/[id]`: one player, with the rows of the tab that is open. The
 *  server picks the competition, the season and the page and hands the client
 *  only what that tab shows, so a career log of two hundred matches never
 *  reaches the browser whole. */
export interface NowgoalPlayerView {
  info: NowgoalPlayerInfo;
  /** The tabs this player has data for, in display order. */
  tabs: NowgoalViewOption[];
  tab: NowgoalPlayerTab;

  /* Stats tab — one competition and one season of the player's own log. */
  /** Competitions the log files him in, most recent match first. */
  statCompetitions: NowgoalViewOption[];
  statCompetition: string;
  /** Seasons of the selected competition, newest first. */
  statSeasons: NowgoalViewOption[];
  statSeason: string;
  stats: NowgoalPlayerSeasonStats | null;

  /* Matches tab — the log, ten to a page, newest first. Only the open page is
   *  ever sent to the client. */
  matches: NowgoalPlayerMatch[];
  matchPage: number;
  matchPageCount: number;
  /** Matches the log holds in total. */
  matchCount: number;

  /* Transfer tab — his whole career, newest first. */
  transfers: NowgoalPlayerTransfer[];
}

/* ------------------------------------------------------------------------- *
 * NowGoal match detail — one match, read off the publisher's own two pages
 * (see lib/nowgoalMatch.ts): its detail page carries the timeline, the events,
 * the statistics and the lineups, its analysis page the two teams' form, the
 * strength comparison, the head-to-head list, the fixtures and the injuries.
 * ------------------------------------------------------------------------- */

/** One side of a match, as the publisher's own header names it. */
export interface NowgoalMatchSide {
  id: string;
  name: string;
  /** Absolute crest URL, or `''` — the client falls back to the initial. */
  crest: string;
}

/** The match itself: what it is, when it kicked off, and where it stands. */
export interface NowgoalMatchHeader {
  /** Competition id (the publisher's own, also the `/competitions/[id]` id). */
  competitionId: string;
  competition: string;
  /** The publisher's own round/stage line (`Round 1`), `''` when it prints none. */
  round: string;
  /** Kick-off in ms since epoch, off the page's GMT+8 wall clock, or `null`. */
  kickoffMs: number | null;
  /** Venue as the page's own markup publishes it, `''` when none. */
  venue: string;
  home: NowgoalMatchSide;
  away: NowgoalMatchSide;
  /** Full-time goals, `null` before the first one is scored. */
  homeScore: number | null;
  awayScore: number | null;
  /** The publisher's own state word for the header (`Finished`, `Not Started`). */
  state: string;
  /** The publisher's own state field: `-1` finished, `0` not started, a
   *  positive value in play, `-10`…`-14` cancelled/pending/abandoned/paused/
   *  postponed. */
  stateCode: number;
  /** The clock the page prints next to the score while a match is in play
   *  (`63'`), `''` when it prints none. */
  minute: string;
  /** Half-time and second-half splits, in the order the page prints them, each
   *  as the publisher labelled it (`Score 1st Half`, `2-0`). */
  splits: { label: string; score: string }[];
}

/** One entry of the match's own event list, as the publisher's detail page
 *  files it — a goal with its scorer and assist, a card, or a substitution with
 *  the two players it swaps. */
export interface NowgoalMatchEvent {
  /** The publisher's own event label, verbatim (`Goal`, `Yellow Card`,
   *  `Substitution`, …). */
  label: string;
  /** What that label means, for the icon and the colour the row is drawn in. */
  kind: 'goal' | 'own-goal' | 'penalty' | 'yellow' | 'red' | 'substitution' | 'var' | 'other';
  /** The clock the page prints (`82'`), decoded off the page's own entity. */
  minute: string;
  /** Minute as a number, for laying the marker out on the timeline. */
  minuteValue: number;
  side: 'home' | 'away';
  /** The running score after this event (`3-0`), `''` when the row carries none. */
  score: string;
  /** Who the row names, in the order it names them. A goal names its scorer and
   *  (when the page publishes one) his assistant, a substitution the player who
   *  comes on and the one he replaces, and a card or any other event simply the
   *  player it is filed against (`player`). */
  players: { id: string; name: string; role: 'scorer' | 'assist' | 'in' | 'out' | 'player' }[];
}

/** One period marker of the event list — the page prints the score at half-time
 *  and at full-time as its own row. */
export interface NowgoalMatchPeriod {
  /** The publisher's own abbreviation (`HT`, `FT`). */
  label: string;
  /** The score it was taken at (`2-0`), `''` when the page prints none. */
  score: string;
}

/** One statistics row: the label the publisher prints between the two values. */
export interface NowgoalMatchStatRow {
  label: string;
  home: string;
  away: string;
}

/** One of the page's statistics views (`FT`, `1st Half`, `2nd Half`, `ET`). */
export interface NowgoalMatchStatGroup {
  /** The publisher's own button label. */
  label: string;
  rows: NowgoalMatchStatRow[];
}



/** One player of a lineup, with the events the page hangs off him. */
export interface NowgoalMatchLineupPlayer {
  id: string;
  /** Shirt number the page prints (`1`), `''` when it prints none. */
  number: string;
  name: string;
  /** The publisher's own rating for this match (`7.0`), `''` when it rated him
   *  nothing (a substitute who stayed on the bench, a match not yet rated). */
  rating: string;
  /** What the page shows beside him: his goals, assists, cards and whether he
   *  came on or off, each with its own clock. */
  events: { label: string; minute: string }[];
}

/** One team's lineup: the formation, the starting eleven as the publisher lays
 *  it out on its own pitch (one group per line), and the substitutes. */
export interface NowgoalMatchLineupSide {
  /** Formation the page prints (`4-2-3-1`), `''` when it prints none. */
  formation: string;
  /** The starting eleven, grouped the way the publisher's own pitch groups it
   *  (goalkeeper first, then each line out). */
  lines: NowgoalMatchLineupPlayer[][];
  /** The substitutes, in the order the page benches them. */
  bench: NowgoalMatchLineupPlayer[];
}

/** The lineups of this match — empty formations and groups when the publisher
 *  has not published them yet (a match that has not kicked off). */
export interface NowgoalMatchLineup {
  home: NowgoalMatchLineupSide;
  away: NowgoalMatchLineupSide;
}

/** The highlight video the page publishes, when it publishes one. */
export interface NowgoalMatchVideo {
  /** YouTube id, or `''` when the page's own link is not a YouTube one. */
  id: string;
  /** Embed URL (`https://www.youtube.com/embed/{id}`), `''` when there is none. */
  embed: string;
}

/** One line of the analysis page's strength comparison. */
export interface NowgoalMatchStrengthRow {
  label: string;
  /** The two sides' own values, already formatted (`1.67`, `7.15`, `3-1-2`). */
  home: string;
  away: string;
  /** The share each side holds of the two values (`56`), split the way the
   *  publisher's own strength script splits them. */
  homePct: number;
  awayPct: number;
}

/** The analysis page's own "Who will win?" poll: how many readers picked
 *  either side (the publisher's buttons are Home and Away). */
export interface NowgoalMatchVote {
  home: number;
  away: number;
  homePct: number;
  awayPct: number;
  total: number;
}

/** One meeting of a last-matches list (the head-to-head list or either side's
 *  own recent matches), as the analysis page's row publishes it. */
export interface NowgoalMatchMeeting {
  /** Schedule id of that meeting — `/matches/{id}` in this app, `''` when the
   *  row carries none. */
  matchId: string;
  /** Competition short label (`ENG PR`) and the full name behind it. */
  competition: string;
  competitionName: string;
  /** Kick-off in ms since epoch, or `null` when the row's stamp is unusable. */
  kickoffMs: number | null;
  /** The row's own stamp, as published (`2026-08-16 14:00:00`). */
  date: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
  /** Full-time score (`3-0`) and half-time score (`2-0`), `''` when none. */
  score: string;
  halfScore: string;
  /** Corners (`2-4`) and the half-time corners behind them, `''` when none. */
  corner: string;
  halfCorner: string;
  /** How the side the list follows fared: `W`, `D`, `L`, or `''`. */
  result: 'W' | 'D' | 'L' | '';
}

/** What the publisher publishes about the match itself (`/detail/{id}`). */
export interface NowgoalMatchDetail {
  header: NowgoalMatchHeader;
  /** The period markers of the event list (half-time, full-time). */
  periods: NowgoalMatchPeriod[];
  /** The events, in the match's own order — the page prints them newest-first
   *  and the reader turns them around. */
  events: NowgoalMatchEvent[];
  /** The statistics views the page publishes (its `FT` plate always, the half
   *  plates when it has them, extra time only for a match that went there). */
  stats: NowgoalMatchStatGroup[];
  lineup: NowgoalMatchLineup;
  video: NowgoalMatchVideo | null;
}

/** What the publisher publishes around the match (`/analysis/{id}`). */
export interface NowgoalMatchAnalysis {
  strength: NowgoalMatchStrengthRow[];
  vote: NowgoalMatchVote | null;
  /** The head-to-head list, most recent first. */
  meetings: NowgoalMatchMeeting[];
  /** Each side's own recent results, most recent first. */
  homeForm: NowgoalMatchMeeting[];
  awayForm: NowgoalMatchMeeting[];
  /** Each side's own next matches. */
  homeFixtures: NowgoalMatchFixture[];
  awayFixtures: NowgoalMatchFixture[];
  /** Each side's injured and suspended players. */
  homeAbsences: NowgoalMatchAbsence[];
  awayAbsences: NowgoalMatchAbsence[];
}

/** Which tab of `/matches/[id]` is open. */
export type NowgoalMatchTab = 'detail' | 'lineup' | 'h2h';

/** Which list of the h2h tab's "last matches" plate is open. */
export type NowgoalMatchLastTab = 'home' | 'h2h' | 'away';

/** Which side's list of the h2h tab's "fixtures" plate is open. */
export type NowgoalMatchFixTab = 'home' | 'away';

/** `/matches/[id]`: one match, with the rows of the tab that is open. The
 *  server reads the publisher's own two pages (one read each, cached) and hands
 *  the client only the lists that tab shows, so a head-to-head list of fifty
 *  meetings never reaches the browser while the timeline is the open tab. */
export interface NowgoalMatchView {
  header: NowgoalMatchHeader;
  /** The tabs this match has data for, in display order. */
  tabs: NowgoalViewOption[];
  tab: NowgoalMatchTab;

  /* Detail tab — the match's own timeline, events, statistics and highlight. */
  periods: NowgoalMatchPeriod[];
  events: NowgoalMatchEvent[];
  stats: NowgoalMatchStatGroup[];
  video: NowgoalMatchVideo | null;

  /* Line up tab — the two formations and everyone the page lists as out. */
  lineup: NowgoalMatchLineup;
  homeAbsences: NowgoalMatchAbsence[];
  awayAbsences: NowgoalMatchAbsence[];

  /* H2H tab — the strength split, the poll, and the two two-sided plates. Each
   * plate sends only the list it has open (see `last` / `fix`), with the four
   * counts so the closed buttons can still say how much is behind them. */
  strength: NowgoalMatchStrengthRow[];
  vote: NowgoalMatchVote | null;
  last: NowgoalMatchLastTab;
  meetings: NowgoalMatchMeeting[];
  lastCounts: Record<NowgoalMatchLastTab, number>;
  fix: NowgoalMatchFixTab;
  fixtures: NowgoalMatchFixture[];
  fixCounts: Record<NowgoalMatchFixTab, number>;
}

/** One fixture of the analysis page's own "Fixture (3 Matches)" list — the
 *  publisher's own next matches for each side. */
export interface NowgoalMatchFixture {
  competition: string;
  competitionName: string;
  kickoffMs: number | null;
  date: string;
  /** Where the listed side plays it (`Home`, `Away`), as the page prints it. */
  venue: string;
  opponent: string;
  /** The page's own countdown (`10 Days`), `''` when it prints none. */
  countdown: string;
}

/** One injured or suspended player of the analysis page's own lists. */
export interface NowgoalMatchAbsence {
  /** The section the page files him under — its own word for it (`Injury`). */
  kind: string;
  /** Position code the page prints (`RB`, `CM`), `''` when it prints none. */
  position: string;
  number: string;
  id: string;
  name: string;
}

/* ------------------------------------------------------------------------- *
 * The live player's own match behind a publisher match
 * ------------------------------------------------------------------------- */

/** The app's own player, seen from a publisher match page: the match it carries
 *  behind `/matches/[id]`, when it carries it at all. The two feeds number their
 *  matches in their own spaces (see lib/matchStream.ts), so this is resolved on
 *  the server by the two sides rather than by id, and handed to the page — which
 *  only renders it. */
export interface MatchStreamView {
  /** The player's own match id: its player page is `/watch/{matchId}`. */
  matchId: number;
  /** The sport the player files the match under — the category its player page
   *  opens with (`?sport=football`). */
  sportType: number;
  /** What the player calls the competition (`Brazilian Serie A`); the page's own
   *  name for it may be spelled differently, so it is shown as the player's. */
  competition: string;
  /** The player's own status code for the match (`101` first half, `102` half
   *  time, `0`/absent before kick-off), rendered with the app's `statusLabel`. */
  status?: number;
  /** The broadcasters the player lists for the match, as it names them (`MAX UK`,
   *  `ESPN+ US`), in its own order. Empty until it publishes them, which for a
   *  match that has not kicked off happens near kick-off. */
  channels: string[];
}
