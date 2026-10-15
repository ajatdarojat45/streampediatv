/**
 * Finding the Goaloo match behind a Rblink matchId — the reverse of
 * lib/goalooJoin.ts, and the Goaloo half of the watch page's join.
 *
 * lib/goalooJoin.ts walks the other way: a Goaloo club or player page lists
 * Goaloo fixtures and asks which of them the stream catalogue can also play, so
 * it reads Rblink fixtures through `getLeagueMatches` and pairs them by kick-off
 * + club names. The watch page starts from the Rblink side — it has a matchId
 * and nothing else — and needs the opposite answer: the Goaloo SCHEDULE ID of
 * that very fixture, because that id is what addresses the match centre
 * (lib/goalooLive.ts). Both directions therefore share the same two keys, the
 * kick-off instant and the two club names, and the same matcher (lib/clubNames),
 * so a fixture either pairs on both pages or on neither.
 *
 * The bridge is short because the Goaloo side is already parsed: the competition
 * feed behind `/competition/{…}` carries one row per fixture with its schedule
 * id, its kick-off (converted from the feed's UTC+8 clock by lib/goaloo.ts) and
 * both clubs, and those rows are reached through the same catalogue pairing the
 * competition directory uses — an Rblink league id resolves to the Goaloo
 * competitions filed under it (`goalooCompetitionsForLeague`).
 *
 * Precision first, exactly like the forward join: a single surviving candidate
 * is the answer, several are reported as none, and no id is ever estimated.
 * Feeds are read through lib/goalooCompetition, which caches one parsed season
 * per process and revalidates it on the feed's own five-minute window — the very
 * read a `/competition/{s|c<id>}` page of the same competition performs, so the
 * two pages share it and a watch page costs no extra upstream request.
 */
import { goalooCompetitionFixtures } from './goalooCompetition';
import { goalooCompetitionsForLeague } from './rblinkLeagues';
import { sameClub } from './clubNames';

/** How many candidate competitions one lookup may read. A league id usually
 *  pairs with one or two (a league and the cup of the same name); the cap keeps
 *  a pathological id from turning a page view into a crawl. */
const MAX_COMPETITIONS = 4;

export interface RblinkFixtureRef {
  /** The Rblink league the fixture belongs to (`Match.league.id`). */
  leagueId: number | string;
  /** Kick-off in epoch ms (see `matchDateMs`). */
  kickoff: number;
  /** Both sides, as Rblink spells them. */
  home: string;
  away: string;
}

/**
 * The Goaloo schedule id of the fixture an Rblink match refers to, or `null`
 * when nothing is trusted enough to draw a match centre from.
 */
export async function goalooScheduleIdForMatch(ref: RblinkFixtureRef): Promise<number | null> {
  const leagueId = Number(ref.leagueId) || 0;
  if (!leagueId || !ref.kickoff || !ref.home || !ref.away) return null;
  for (const comp of goalooCompetitionsForLeague(leagueId).slice(0, MAX_COMPETITIONS)) {
    const list = await goalooCompetitionFixtures(comp.path, comp.seasonDir);
    if (!list || !list.length) continue;
    const hits = list.filter(
      (fixture) =>
        fixture.kickoff === ref.kickoff &&
        sameClub(ref.home, fixture.home.name) &&
        sameClub(ref.away, fixture.away.name)
    );
    if (hits.length === 1) return hits[0].matchId;
    // Ambiguity is reported, never guessed at — a wrong match centre would put
    // another fixture's lineups and statistics on this page.
    if (hits.length > 1) return null;
  }
  return null;
}
