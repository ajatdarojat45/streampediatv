/**
 * Bridging a Goaloo fixture row to the Rblink stream catalogue.
 *
 * The two publishers describe the same matches and share no identifier: the
 * Goaloo club/player feeds key a fixture by their own schedule id (3062858 =
 * Borneo vs Dewa United, 2026-09-16 16:30 +08), while `/watch/{id}` needs the
 * Rblink matchId for that very kick-off (4474566). Neither payload carries a
 * cross-reference, so the bridge is built here from the only two things the
 * feeds do agree on:
 *
 *   1. the kick-off instant — identical to the millisecond once the feed's
 *      UTC+8 clock is converted (verified across the whole 2026-27 Indonesian
 *      Super League season), and
 *   2. the club names, which the two publishers spell differently often enough
 *      ("Persik Kediri" against "Persatuan sepak bola Indonesia Kediri") that a
 *      plain string compare would pair almost nothing.
 *
 * Precision first — the same rule the competition matcher follows (see
 * lib/competitions.ts): a wrong pair puts an unrelated stream on a match row,
 * which is worse than a row without a stream. A candidate therefore only
 * survives when the instants are equal AND both sides agree, on their full
 * token set or on a shared token that actually names the club, since filler
 * (`fc`, `club`, `united`) must never carry a pair on its own. A kick-off with
 * more than one surviving candidate is reported as no match instead of guessed
 * at, and neither side is ever handed a fabricated id.
 *
 * The Rblink side is read through the app's own league fixture endpoint
 * (`getLeagueMatches`) rather than the raw upstream, so the ids handed out are
 * decoded, cached and rate-limit-aware exactly like every other page's.
 */
import { getLeagueMatches } from '@/app/actions';
import { clubTokens, sameClub } from './clubNames';
import { findCompetition } from './competitions';
import { rblinkLeagueFor } from './rblinkLeagues';
import { matchDateMs } from './datetime';
import type { Match } from './types';

/** One Goaloo fixture row, reduced to what the join needs. */
export interface GoalooFixtureRef {
  /** Goaloo schedule id — the row's identity on the Goaloo side. */
  matchId: number;
  /** Goaloo competition id (1122 = Indonesia Super League). */
  leagueId: number;
  /** Kickoff in epoch ms (already converted from the feed's UTC+8 clock). */
  kickoff: number;
  home: string;
  away: string;
}

/** The club names are reduced and compared with the rules in lib/clubNames.ts,
 *  which the club-page join (lib/goalooTeams) shares. */


/** Both contender names of a Rblink match. Competition fixtures on this feed
 *  ship their clubs inside the title ("A vs B") with no team name of their own,
 *  so the title is the fallback — never the other way round. */
export function rblinkSides(m: Match): [string, string] {
  const title = m.title || m.name || '';
  const parts = title.split(/\s+vs\.?\s+/i);
  const home = m.home?.name || m.homeTeams?.[0]?.name || parts[0] || '';
  const away = m.away?.name || m.awayTeams?.[0]?.name || parts[1] || '';
  return [home.trim(), away.trim()];
}

/** The Rblink league that streams a Goaloo competition, plus the season to ask
 *  for its fixtures — `null` whenever the join cannot be trusted (competition
 *  absent from the catalogue, no Rblink league, no published season). */
async function rblinkFixtures(
  goalooLeagueId: number,
  sportType: number
): Promise<Match[] | null> {
  const comp = findCompetition(`s${goalooLeagueId}`) || findCompetition(`c${goalooLeagueId}`);
  if (!comp) return null;
  const league = rblinkLeagueFor(comp)?.league;
  const seasonId = league?.season?.id;
  if (!league || !seasonId) return null;
  const res = await getLeagueMatches({ leagueId: league.id, sportType, language: 0, seasonId });
  return res.ok ? res.data : null;
}

/** The Rblink league id behind a Goaloo competition, or 0 when the catalogue
 *  does not pair the two — the one value a club or player page needs to link
 *  its competition to `/competition/{id}`. */
export function rblinkLeagueIdForCompetition(goalooLeagueId: number): number {
  const comp = findCompetition(`s${goalooLeagueId}`) || findCompetition(`c${goalooLeagueId}`);
  if (!comp) return 0;
  return rblinkLeagueFor(comp)?.league.id ?? 0;
}

/** Rblink fixtures bucketed by kick-off instant — the join's primary key. */
function byKickoff(matches: Match[]): Map<number, Match[]> {
  const index = new Map<number, Match[]>();
  for (const m of matches) {
    const ms = matchDateMs(m.matchDate);
    if (ms === null) continue;
    const bucket = index.get(ms);
    if (bucket) bucket.push(m);
    else index.set(ms, [m]);
  }
  return index;
}

/**
 * Resolve the Rblink matchId for each Goaloo fixture.
 *
 * Only the most frequent `maxCompetitions` competitions are asked about (a club
 * page shows its own league plus a cup or two; each competition costs one
 * cached upstream call), and every failure — a competition outside the
 * catalogue, no Rblink league, an upstream error — leaves that competition's
 * rows without a stream instead of failing the page.
 */
export async function joinStreamIds(
  items: GoalooFixtureRef[],
  { sportType = 1, maxCompetitions = 3 }: { sportType?: number; maxCompetitions?: number } = {}
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (items.length === 0) return out;

  const perCompetition = new Map<number, GoalooFixtureRef[]>();
  for (const item of items) {
    const list = perCompetition.get(item.leagueId);
    if (list) list.push(item);
    else perCompetition.set(item.leagueId, [item]);
  }
  const wanted = [...perCompetition.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxCompetitions);

  await Promise.all(
    wanted.map(async ([leagueId, rows]) => {
      let fixtures: Match[] | null = null;
      try {
        fixtures = await rblinkFixtures(leagueId, sportType);
      } catch {
        fixtures = null;
      }
      if (!fixtures || fixtures.length === 0) return;
      const index = byKickoff(fixtures);
      for (const row of rows) {
        const bucket = index.get(row.kickoff);
        if (!bucket || bucket.length === 0) continue;
        const hits = bucket.filter((m) => {
          const [home, away] = rblinkSides(m);
          return sameClub(row.home, home) && sameClub(row.away, away);
        });
        // Ambiguity is never resolved by guesswork.
        if (hits.length === 1) out.set(row.matchId, hits[0].matchId ?? 0);
      }
    })
  );

  for (const [key, value] of out) if (!value) out.delete(key);
  return out;
}

