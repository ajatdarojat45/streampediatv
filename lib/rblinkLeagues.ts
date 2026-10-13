/**
 * The Rblink side of the competition join (data/rblink-leagues.json).
 *
 * Only ever imported by server components: the file is ~540 KB, so it must not
 * travel to the browser. Pages hand the few resolved ids down as props instead.
 */
import data from '@/data/rblink-leagues.json';
import type { CompetitionDirectory, CompetitionDirectoryRow, CompetitionHighlight, GoalooCompetition, RblinkLeague } from './types';
import { buildRblinkIndex, matchRblinkLeague, type RblinkMatch, type RblinkMatchIndex } from './competitions';
import { GOALOO_COMPETITIONS } from './competitions';
import { goalooCompetitionLogoUrl } from './goaloo';

const file = data as unknown as { generatedAt: string; count: number; leagues: RblinkLeague[] };

/** Every football competition the Rblink catalogue publishes. */
export const RBLINK_LEAGUES: RblinkLeague[] = file.leagues;

/** When the scan behind this file last ran (shown as provenance on the page). */
export const RBLINK_GENERATED_AT = file.generatedAt;

/** Bucket for catalogue rows that ship without a country ("Other"). */
const OTHER_COUNTRY = 'Other';

/** Marquee competitions for the strip on `/competitions`, in display order.
 *
 *  Keyed by the stream catalogue's own URL slug instead of its numeric id:
 *  slugs are readable, they survive a re-scan that renumbers the catalogue, and
 *  one that disappears — or turns out to be ambiguous — quietly drops out of
 *  the strip instead of pointing a card at the wrong competition. The strip is
 *  only a way in: the 989-row directory below is what makes the page complete,
 *  so it stays around a dozen cards (the crests are the page's only images).
 *
 *  Every slug here is known to survive the join. A few obvious majors are
 *  deliberately missing because the two catalogues name them differently —
 *  Goaloo's "Liga Portugal 1", "USA Major League Soccer" and "Copa Libertadores"
 *  against Rblink's "Portuguese Primera Liga", "United States Major League
 *  Soccer" and "CONMEBOL Copa Libertadores" — and the matcher, which refuses to
 *  pair a name it cannot speak for, leaves them unrouted. They still appear in
 *  the directory below, without a stream. */
const FEATURED_SLUGS = [
  'english-premier-league',
  'uefa-champions-league',
  'spanish-la-liga',
  'italian-serie-a',
  'bundesliga',
  'french-ligue-1',
  'uefa-europa-league',
  'english-football-league-championship',
  'netherlands-eredivisie',
  'saudi-professional-league',
  'argentine-division-1',
  'caf-champions-league',
];

let index: RblinkMatchIndex | null = null;
const resolved = new Map<string, RblinkMatch | null>();

function matchIndex(): RblinkMatchIndex {
  if (!index) index = buildRblinkIndex(RBLINK_LEAGUES);
  return index;
}

export function rblinkLeagueById(id: number | string): RblinkLeague | undefined {
  const wanted = Number(id);
  if (!Number.isFinite(wanted)) return undefined;
  return RBLINK_LEAGUES.find((l) => l.id === wanted);
}

/** The Rblink league that streams a Goaloo competition, or `null`. Resolved
 *  once per competition path — the directory asks for all 989 of them. */
export function rblinkLeagueFor(comp: GoalooCompetition): RblinkMatch | null {
  const hit = resolved.get(comp.path);
  if (hit !== undefined) return hit;
  const match = matchRblinkLeague(comp, matchIndex());
  resolved.set(comp.path, match);
  return match;
}

/** Stream id per Goaloo path, for the ones that have a stream at all. */
export function rblinkStreamIds(comps: GoalooCompetition[]): Map<string, number> {
  const ids = new Map<string, number>();
  for (const comp of comps) {
    const match = rblinkLeagueFor(comp);
    if (match) ids.set(comp.path, match.league.id);
  }
  return ids;
}

/**
 * The Goaloo catalogue resolved against the Rblink scan — the whole payload
 * behind `/competitions`.
 *
 * Assembled on the server for two reasons: the Rblink file is ~540 KB and must
 * never travel to the browser, and `rblinkLeagueFor` caches its verdict per
 * Goaloo path, so the full 989 × 1220 comparison is paid once per process.
 * Sections and their rows both come out alphabetically ordered, so the page
 * renders identically on every build.
 */
export function competitionDirectory(): CompetitionDirectory {
  const byCountry = new Map<string, CompetitionDirectoryRow[]>();
  /** Streamed rows by Rblink slug — arrays, because the scan does pair a few
   *  slugs with two different ids and those must not be guessed at. */
  const bySlug = new Map<string, CompetitionHighlight[]>();
  let streamed = 0;

  for (const comp of GOALOO_COMPETITIONS) {
    const league = rblinkLeagueFor(comp)?.league;
    if (league) streamed += 1;
    const row: CompetitionDirectoryRow = {
      key: comp.path,
      name: comp.name,
      hot: comp.hot === 1,
      streamId: league?.id ?? 0,
      fixtures: Boolean(league?.matches),
    };
    const country = comp.country || OTHER_COUNTRY;
    const rows = byCountry.get(country);
    if (rows) rows.push(row);
    else byCountry.set(country, [row]);
    // A crest is only worth an image request when a stream sits behind the
    // card, so only streamed rows become strip candidates.
    if (league) {
      const card: CompetitionHighlight = {
        key: row.key,
        name: row.name,
        country,
        logo: goalooCompetitionLogoUrl(comp.logo),
        streamId: league.id,
      };
      const cards = bySlug.get(league.slug);
      if (cards) cards.push(card);
      else bySlug.set(league.slug, [card]);
    }
  }

  const sections = [...byCountry]
    .map(([country, rows]) => {
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return { country, rows, streamed: rows.filter((r) => r.streamId > 0).length };
    })
    .sort((a, b) => a.country.localeCompare(b.country));

  return {
    sections,
    // Featured, by slug, in the order declared above. A slug that paired
    // nothing, or paired twice (the scan publishes five duplicate slugs, e.g.
    // "copa-de-la-liga"), is skipped rather than resolved to a guess.
    highlights: FEATURED_SLUGS.flatMap((slug) => {
      const cards = bySlug.get(slug);
      return cards && cards.length === 1 ? cards : [];
    }),
    generatedAt: RBLINK_GENERATED_AT,
    totals: { competitions: GOALOO_COMPETITIONS.length, countries: sections.length, streamed },
  };
}
