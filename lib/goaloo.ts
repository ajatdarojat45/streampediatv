// Goaloo28 competition feed — the worldwide catalogue behind /competitions.
//
// Two upstream shapes are involved:
//   1. the catalogue itself — `data/competitions.json`, produced offline by
//      `tools/gen-competitions.mjs` and imported statically, so the directory
//      page never touches the network;
//   2. one JSON per competition + season —
//      `/jsData/matchResult/json/{season}/{path}_en.json`, where `path` is
//      `s<id>` for a round-robin league and `c<id>` for a cup.
//
// The per-competition feed is deliberately loose JSON: fixtures are POSITIONAL
// arrays, a two-legged tie is itself an array whose last element is the LIST of
// its legs, and a single competition mixes both shapes. Every read below is
// guarded, so an unexpected row is skipped instead of corrupting the page.
//
// Kickoff stamps are the publisher's clock — China Standard Time (UTC+8) — and
// are converted to epoch ms here so they sit next to Rblink kickoffs without a
// second conversion at the edge.
//
// The storefront's other three page types read their own feed, all from this
// same host, and all handled by the URL/image helpers below:
//   3. the club feed — `/jsdata/teamInfo/teamdetail/json/tdl<teamId>_en.json`,
//      plus its `/ajax/getteamschedulebypageno` schedule and
//      `/ajax/GetTeamTransferByYear` transfers (see lib/goalooClub.ts);
//   4. the player feed — `/jsData/playerInfo/player<playerId>_en.json`
//      (see lib/goalooPlayer.ts).
// A club or player page's matches are then bridged to `/watch/{id}` by
// lib/goalooJoin.ts, because the two publishers share no match identifier.

import type {
  GoalooCompetition,
  GoalooCompetitionDetail,
  GoalooFixture,
  GoalooStage,
  GoalooStandingRow,
  GoalooStandingsGroup,
  GoalooTeam,
} from './types';

/** Feed origin. Overridable so a mirror can be swapped in without a rebuild. */
export const GOALOO_ORIGIN =
  process.env.NEXT_PUBLIC_GOALOO_ORIGIN || 'https://football2.goaloo28.com';

/** Image origin. The feed only ships relative paths, and this is the host that
 *  answers them with a real `image/png` — the page hosts reply to the same
 *  path with an HTML soft-404. */
export const GOALOO_IMAGE_ORIGIN =
  process.env.NEXT_PUBLIC_GOALOO_IMAGE_ORIGIN || 'https://imgcms.thscore.fun';

/** The feed's clock is UTC+8 — verified against the Rblink kickoffs, where the
 *  same fixtures land on identical instants on both sides. */
const GOALOO_UTC_OFFSET_MS = 8 * 3600 * 1000;

/** Goaloo's region buckets, as carried by `area` in the catalogue. */
export const GOALOO_AREAS: Record<number, string> = {
  0: 'World',
  1: 'Europe',
  2: 'America',
  3: 'Asia',
  4: 'Oceania',
  5: 'Africa',
};

export function goalooAreaLabel(area: number | undefined): string {
  return GOALOO_AREAS[area ?? 0] ?? 'Other';
}

/** Competition crest: `league_match/images/…png` → an absolute URL. */
export function goalooCompetitionLogoUrl(path?: string): string {
  const p = (path || '').trim();
  if (!p) return '';
  if (/^https?:/i.test(p)) return p;
  return `${GOALOO_IMAGE_ORIGIN}/football/Image/${p.replace(/^\/+/, '')}`;
}

/** Team crest: `images/14/…png` → `…/football/Image/team/images/14/…png`. */
export function goalooTeamLogoUrl(path?: string): string {
  const p = (path || '').trim();
  if (!p) return '';
  if (/^https?:/i.test(p)) return p;
  return `${GOALOO_IMAGE_ORIGIN}/football/Image/team/${p.replace(/^\/+/, '')}`;
}

/** Player photo — `images/209310/…png` → `…/football/Image/player/…`. Same
 *  shape as a team crest, one directory over; a country flag travels through
 *  {@link goalooTeamLogoUrl} because the feed serves flags from the team
 *  directory. */
export function goalooPlayerPhotoUrl(path?: string): string {
  const p = (path || '').trim();
  if (!p) return '';
  if (/^https?:/i.test(p)) return p;
  return `${GOALOO_IMAGE_ORIGIN}/football/Image/player/${p.replace(/^\/+/, '')}`;
}

/** The feed's own 24px club crest, addressed by id alone (`/mini/fbteam/42.png`).
 *  Needed wherever the feed publishes a club without a name — the transfer rows
 *  carry the counterpart club as an id and nothing else. */
export function goalooMiniTeamLogoUrl(teamId: number | string): string {
  return `${GOALOO_IMAGE_ORIGIN}/mini/fbteam/${Number(teamId) || 0}.png`;
}

/** The club feed — one JSON per team, the club page's primary payload. */
export function goalooClubUrl(teamId: number | string): string {
  return `${GOALOO_ORIGIN}/jsdata/teamInfo/teamdetail/json/tdl${Number(teamId)}_en.json`;
}

/** The club's schedule — a paged ajax the page host renders server-side. The
 *  first call (`init=1`, no `sclassId`) answers with the club's competitions,
 *  the page holding the matches around now, and the first page of fixtures. */
export function goalooClubScheduleUrl(
  teamId: number | string,
  page = 1,
  sclassId?: number | string
): string {
  const comp = sclassId ? `&sclassId=${Number(sclassId)}` : '';
  return `${GOALOO_ORIGIN}/ajax/getteamschedulebypageno?id=${Number(teamId)}&pageNo=${page}${comp}&init=${page === 1 && !sclassId ? 1 : 0}`;
}

/** One page of the club's schedule ajax, as the page host paginates it:
 *  `init=0`, ten rows a page. `init=1` (see above) is the publisher's own
 *  first-page preview — fifty rows plus the club's competition list — which the
 *  club payload reads once; the Schedule panel pages through THIS one instead,
 *  so every page holds the same number of rows. */
export function goalooClubSchedulePageUrl(
  teamId: number | string,
  page = 1,
  sclassId?: number | string
): string {
  const comp = sclassId ? `&sclassId=${Number(sclassId)}` : '';
  return `${GOALOO_ORIGIN}/ajax/getteamschedulebypageno?id=${Number(teamId)}&pageNo=${Math.max(1, Math.trunc(Number(page)) || 1)}${comp}&init=0`;
}

/** The club's transfers for one year, split by `isJoined` (in / out). */
export function goalooClubTransfersUrl(teamId: number | string, year: number | string): string {
  return `${GOALOO_ORIGIN}/ajax/GetTeamTransferByYear?teamId=${Number(teamId)}&year=${year}`;
}

/** The player feed — one JSON per player (`player<id>_en.json`). */
export function goalooPlayerUrl(playerId: number | string): string {
  return `${GOALOO_ORIGIN}/jsData/playerInfo/player${Number(playerId)}_en.json`;
}

/** The per-season JSON holding one competition's fixtures and standings. */
export function goalooCompetitionUrl(
  comp: Pick<GoalooCompetition, 'path' | 'seasonDir'>
): string {
  return `${GOALOO_ORIGIN}/jsData/matchResult/json/${comp.seasonDir}/${comp.path}_en.json`;
}

/** `"2026-09-09 00:45"` (UTC+8 wall clock) → epoch ms. `null` when the feed
 *  leaves the stamp empty, which happens for bracket slots with no date yet. */
export function parseGoalooKickoff(value: unknown): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(
    typeof value === 'string' ? value.trim() : ''
  );
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - GOALOO_UTC_OFFSET_MS;
}

/** `0` = scheduled, `-1` = finished, `> 0` = in play (the feed counts live
 *  periods there). Anything else is reported as unknown rather than guessed. */
export type GoalooStatusKind = 'scheduled' | 'live' | 'finished' | 'unknown';

export function goalooStatusKind(status: number | undefined): GoalooStatusKind {
  if (status === 0) return 'scheduled';
  if (status === -1) return 'finished';
  if (typeof status === 'number' && status > 0) return 'live';
  return 'unknown';
}

/** `"2-3"` → `{ home: 2, away: 3 }`; `null` for an empty placeholder. */
function parseScore(value: unknown): { home: number; away: number } | null {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(typeof value === 'string' ? value.trim() : '');
  return m ? { home: +m[1], away: +m[2] } : null;
}

/** Team rows are `[teamId, name, "", "images/14/…png"]`; the crest is detected
 *  by shape, so the position never has to be trusted. */
function collectTeams(raw: unknown, into: Map<number, GoalooTeam>): void {
  if (!Array.isArray(raw)) return;
  for (const row of raw) {
    if (!Array.isArray(row) || typeof row[0] !== 'number' || typeof row[1] !== 'string') continue;
    if (into.has(row[0])) continue;
    const logo = row.find((x) => typeof x === 'string' && /images\//i.test(x));
    into.set(row[0], { id: row[0], name: row[1].trim(), logo: goalooTeamLogoUrl(logo) });
  }
}

/** Cup stages are declared in `CupKindList` (`[id, …, "League Round", …]`). */
function cupKindNames(raw: unknown): Map<number, string> {
  const out = new Map<number, string>();
  if (!Array.isArray(raw)) return out;
  for (const row of raw) {
    if (Array.isArray(row) && typeof row[0] === 'number' && typeof row[2] === 'string') {
      out.set(row[0], row[2]);
    }
  }
  return out;
}

/** Stage key → label. `G<id><group>` keys are cup stages (the trailing letters
 *  are the group inside the stage), `R_<n>` keys are league matchdays. */
function stageLabel(key: string, cupNames: Map<number, string>): string {
  const cup = /^G(\d+)([A-Z]*)$/.exec(key);
  if (cup) {
    const name = cupNames.get(+cup[1]);
    if (name) return cup[2] ? `${name} · Group ${cup[2]}` : name;
    return key;
  }
  const round = /^R_(\d+)$/.exec(key);
  if (round) return `Round ${round[1]}`;
  return key;
}

/** Cup stages keep the feed's own order — it is chronological, Round 1 →
 *  League Round — while league matchdays sort numerically by round number. */
function stageOrder(key: string, cupNames: Map<number, string>): number {
  const cup = /^G(\d+)/.exec(key);
  if (cup) return 1_000_000 + [...cupNames.keys()].indexOf(+cup[1]);
  const round = /^R_(\d+)$/.exec(key);
  return round ? +round[1] : 999_999;
}

/** `SubLeagueInfo` declares the divisions a competition splits into — `[id,
 *  "East", …]` (the Austrian 3.Liga names four of them, the Indonesian Super
 *  League one, called simply "League"). Only the id and the name are read. */
function subLeagueNames(raw: unknown): Map<number, string> {
  const out = new Map<number, string>();
  if (!Array.isArray(raw)) return out;
  for (const row of raw) {
    if (!Array.isArray(row) || typeof row[0] !== 'number' || typeof row[1] !== 'string') continue;
    const name = row[1].trim();
    if (name) out.set(row[0], name);
  }
  return out;
}

/** One round of a schedule, with everything needed to address, label and order it. */
interface ScheduleRound {
  /** The key the round is addressed by (`R_7`, `G24122A`, or `sub_1422.R_7` when
   *  the competition files more than one division). */
  key: string;
  label: string;
  /** The round's own key inside its division — what orders rounds within it. */
  base: string;
  /** The division's index in `SubLeagueInfo` (0 for a competition without one). */
  order: number;
  rows: unknown;
}

/** Unfold `ScheduleList` into rounds. The feed files a schedule one of two ways:
 *  flat — one key per round (`R_7` matchdays, `G<stage><group>` cup rounds) — or
 *  under a division key (`ScheduleList.sub_1422.R_7`) when the competition splits
 *  into divisions which each number their matchdays from `R_1` again. A split
 *  competition therefore addresses its rounds by division (`sub_1422.R_7`) and
 *  labels them with the division's name; a single-division one keeps the plain
 *  `R_7` key and label, so its rounds stay unique on their own. */
function scheduleRounds(
  schedule: Record<string, unknown>,
  cupNames: Map<number, string>,
  subs: Map<number, string>
): ScheduleRound[] {
  const rounds: { key: string; base: string; sub: string; rows: unknown }[] = [];
  for (const [key, value] of Object.entries(schedule)) {
    if (Array.isArray(value)) {
      rounds.push({ key, base: key, sub: '', rows: value });
      continue;
    }
    // A division: its own keys are the rounds.
    if (!value || typeof value !== 'object') continue;
    for (const [inner, rows] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(rows)) rounds.push({ key: `${key}.${inner}`, base: inner, sub: key, rows });
    }
  }

  const split = new Set(rounds.map((r) => r.sub)).size > 1;
  const declared = [...subs.keys()];
  return rounds.map((r) => {
    const id = Number(/^sub_(\d+)$/.exec(r.sub)?.[1] ?? NaN);
    const division = subs.get(id);
    const label = stageLabel(r.base, cupNames);
    return {
      key: split ? r.key : r.base,
      label: split && division ? `${division} · ${label}` : label,
      base: r.base,
      order: split ? Math.max(0, declared.indexOf(id)) : 0,
      rows: r.rows,
    };
  });
}

/** One positional match row: `[matchId, compId, status, "date", homeId, awayId,
 *  "score", "halfScore", …]`. The feed pads and reuses the tail per stage, so
 *  only the leading fields are read. */
function matchRow(row: unknown[], stageKey: string): GoalooFixture | null {
  if (row.length < 7 || typeof row[0] !== 'number') return null;
  const homeId = row[4];
  const awayId = row[5];
  if (typeof homeId !== 'number' || typeof awayId !== 'number') return null;
  const kickoff = parseGoalooKickoff(row[3]);
  if (kickoff === null) return null;
  const status = typeof row[2] === 'number' ? row[2] : undefined;
  return {
    matchId: row[0],
    status,
    statusKind: goalooStatusKind(status),
    kickoff,
    homeId,
    awayId,
    // Filled by the caller once the squad lists are read.
    home: { id: homeId, name: `Team ${homeId}`, logo: '' },
    away: { id: awayId, name: `Team ${awayId}`, logo: '' },
    score: parseScore(row[6]),
    halfScore: parseScore(row[7]),
    stageKey,
  };
}

/** Flatten `ScheduleList` into one list. A two-legged tie is a 5-element row —
 *  `[homeId, awayId, aggHome, aggAway, legs[]]` — whose legs are ordinary match
 *  rows taking turns at home; both legs carry the tie's aggregate so a two-leg
 *  round can still show who went through. */
function flattenStage(rows: unknown, stageKey: string, into: GoalooFixture[]): void {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const legs = Array.isArray(row[4]) ? (row[4] as unknown[]) : null;
    if (legs) {
      const multi = legs.length > 1;
      legs.forEach((leg, index) => {
        const fixture = Array.isArray(leg) ? matchRow(leg, stageKey) : null;
        if (!fixture) return;
        fixture.tie = {
          homeId: typeof row[0] === 'number' ? row[0] : undefined,
          awayId: typeof row[1] === 'number' ? row[1] : undefined,
          aggHome: typeof row[2] === 'number' ? row[2] : undefined,
          aggAway: typeof row[3] === 'number' ? row[3] : undefined,
        };
        fixture.legLabel = multi ? `Leg ${index + 1}` : undefined;
        into.push(fixture);
      });
      continue;
    }
    const fixture = matchRow(row, stageKey);
    if (fixture) into.push(fixture);
  }
}

/** `Standings` → one table per stage/group (`S29090A` = stage 29090, group A).
 *  Row layout: `[rank, teamId, played, won, drawn, lost, GF, GA, GD, points, …]`.
 *  Only cups carry a published table in this feed; leagues return none — which
 *  is reported as an empty list, never as a fabricated table. */
function parseStandings(
  raw: unknown,
  cupNames: Map<number, string>,
  teams: Map<number, GoalooTeam>
): GoalooStandingsGroup[] {
  if (!raw || typeof raw !== 'object') return [];
  const groups: GoalooStandingsGroup[] = [];

  /** One published table, resolved against the squad list. */
  const table = (key: string, value: unknown[]): void => {
    const rows: GoalooStandingRow[] = [];
    for (const row of value) {
      if (!Array.isArray(row) || typeof row[1] !== 'number') continue;
      const team = teams.get(row[1]);
      if (!team) continue;
      const num = (i: number): number => (typeof row[i] === 'number' ? row[i] : 0);
      rows.push({
        rank: num(0),
        team,
        played: num(2),
        won: num(3),
        drawn: num(4),
        lost: num(5),
        goalsFor: num(6),
        goalsAgainst: num(7),
        goalDiff: num(8),
        points: num(9),
      });
    }
    if (!rows.length) return;
    const m = /^S(\d+)([A-Z]*)$/.exec(key);
    const name = m ? (cupNames.get(+m[1]) || key) + (m[2] ? ` · Group ${m[2]}` : '') : key;
    groups.push({ key, name, rows });
  };

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      table(key, value);
      continue;
    }
    // A competition that splits into divisions files its tables one level deep,
    // exactly as it files its rounds — and the inner keys are the real keys.
    if (!value || typeof value !== 'object') continue;
    for (const [inner, rows] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(rows)) table(inner, rows);
    }
  }
  return groups;
}

/** The longest string in `LeagueInfo` is the competition's own blurb; the
 *  shorter ones are the name, the short code, the season and the crest path. */
function leagueInfoAbout(info: unknown): string {
  if (!Array.isArray(info)) return '';
  const long = info.find((x): x is string => typeof x === 'string' && x.length > 120);
  return (long || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise one competition-season payload. Every fixture gets its two teams
 *  attached, rounds are unfolded and ordered (a competition that splits into
 *  divisions orders them by division first, then by round), and the standings
 *  (when the feed publishes them) are keyed to those same teams. */
export function parseGoalooCompetition(
  raw: unknown,
  comp: GoalooCompetition
): GoalooCompetitionDetail {
  const json = (raw ?? {}) as Record<string, unknown>;
  const teams = new Map<number, GoalooTeam>();
  // Cups ship the clubs taking part in the current stage (TeamList); leagues
  // ship the whole division (TeamInfo). Reading both covers each shape, and
  // the standings then resolve against the same map.
  collectTeams(json.TeamList, teams);
  collectTeams(json.TeamInfo, teams);

  const cupNames = cupKindNames(json.CupKindList);
  const schedule = (json.ScheduleList ?? {}) as Record<string, unknown>;
  // Cups keep the feed's own chronological order (Round 1 → League Round),
  // league matchdays sort by round number, and a competition that splits into
  // divisions keeps the divisions in the order `SubLeagueInfo` declares them.
  const rounds = scheduleRounds(schedule, cupNames, subLeagueNames(json.SubLeagueInfo)).sort(
    (a, b) =>
      a.order - b.order ||
      stageOrder(a.base, cupNames) - stageOrder(b.base, cupNames) ||
      a.key.localeCompare(b.key)
  );

  const stages: GoalooStage[] = [];
  for (const round of rounds) {
    const items: GoalooFixture[] = [];
    flattenStage(round.rows, round.key, items);
    if (!items.length) continue;
    for (const fixture of items) {
      const home = teams.get(fixture.homeId);
      const away = teams.get(fixture.awayId);
      if (home) fixture.home = home;
      if (away) fixture.away = away;
    }
    items.sort((a, b) => a.kickoff - b.kickoff || a.matchId - b.matchId);
    stages.push({ key: round.key, label: round.label, items });
  }

  return {
    comp,
    about: leagueInfoAbout(json.LeagueInfo),
    teams: [...teams.values()].sort((a, b) => a.name.localeCompare(b.name)),
    stages,
    standings: parseStandings(json.Standings, cupNames, teams),
  };
}
