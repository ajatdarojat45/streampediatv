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
 *                 homeName, awayName, homeScore, awayScore, …, goals(11),
 *                 red(13), yellow(14), rating(17), assists(20), minutes(38),
 *                 season(39), compId(40)]
 *   TransferInfo: [season, fromId, toId, fromDate, toDate, fee, type, fromName,
 *                  toName, fromLogo, toLogo]
 *
 * The match log (`playerCount`) is the same fixture list the club pages read,
 * so it is joined to the stream catalogue by the shared bridge in
 * lib/goalooJoin.ts: an appearance the stream catalogue knows links straight to
 * `/watch/{id}`, and one it does not stays plain text. Season totals are simple
 * sums over the appearances the feed publishes — labelled as such on the page,
 * because the feed's own aggregate block (`CountSum`) never says what it counts.
 */
import { goalooPlayerPhotoUrl, goalooPlayerUrl, goalooTeamLogoUrl } from './goaloo';
import { transferTypeLabel } from './goalooClub';
import { findCompetition } from './competitions';
import { joinStreamIds, rblinkLeagueIdForCompetition, type GoalooFixtureRef } from './goalooJoin';
import type {
  GoalooPlayer,
  GoalooPlayerMatch,
  GoalooPlayerSeason,
  GoalooPlayerTransfer,
} from './types';

/** How many appearances the page lists (the feed publishes one row per match). */
export const PLAYER_MATCHES = 20;

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
  return {
    matchId,
    kickoff,
    leagueId: toNum(raw[40]),
    competition: str(raw[4]),
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

/**
 * One player, ready for the page: bio, current club, match log with its
 * `/watch/{id}` targets, per-season totals and the transfer record.
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

  const matches: GoalooPlayerMatch[] = [];
  for (const raw of row(json.playerCount)) {
    const match = appearanceOf(row(raw));
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

  /** The player's competition: the feed publishes its id only, so the name and
   *  the stream link come from the static catalogue (lib/competitions.ts). */
  const leagueId = toNum(info[15]);
  const competition = findCompetition(`s${leagueId}`) || findCompetition(`c${leagueId}`);

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
    leagueName: competition?.name ?? '',
    leagueStreamId: rblinkLeagueIdForCompetition(leagueId),
    matches,
    seasons: playerSeasonTotals(matches),
    transfers,
    updatedAt: str(json.LastUpdateTime),
  };
}


