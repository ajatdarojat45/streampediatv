/**
 * The Rblink side of the competition join (data/rblink-leagues.json).
 *
 * Only ever imported by server components: the file is ~540 KB, so it must not
 * travel to the browser. Pages hand the few resolved ids down as props instead.
 */
import data from '@/data/rblink-leagues.json';
import type {
  CompetitionArea,
  CompetitionDirectory,
  CompetitionFederation,
  CompetitionHighlight,
  FederationCompetition,
  GoalooCompetition,
  RblinkLeague,
} from './types';
import { buildRblinkIndex, countryKey, matchRblinkLeague, type RblinkMatch, type RblinkMatchIndex } from './competitions';
import { GOALOO_COMPETITIONS } from './competitions';
import { goalooAreaLabel, goalooCompetitionLogoUrl } from './goaloo';
import { countryLogoUrl } from './logos';

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

/** Country spellings the scan and the catalogue disagree on, in `countryKey`
 *  form (lowercase, punctuation collapsed to spaces — `normalize` in
 *  lib/competitions keeps `Côte d'Ivoire` as `cote d ivoire`). Only ever
 *  consulted for the federation badge: the competition matcher keeps its own
 *  alias table, so folding a spelling here can never change a join. Without
 *  these, ten federations — the ones the two catalogues spell differently —
 *  would draw an initial instead of a badge. */
const BADGE_ALIASES: Record<string, string> = {
  asian: 'asia',
  beach: 'beach soccer',
  'bosnia herzegovina': 'bosnia',
  czech: 'czechia',
  'faroe islands': 'faroe',
  'costa rica': 'costa',
  'trinidad and tobago': 'republic of trinidad',
  'cote d ivoire': 'ivory coast',
};

/** Badge key of a federation name: the matcher's own country key, folded once
 *  more through the spellings above. */
function badgeKey(country: string): string {
  const key = countryKey(country);
  return BADGE_ALIASES[key] ?? key;
}

let badges: Map<string, string> | null = null;

/** Federation badge per country key: the country badge the app already draws
 *  beside a league row (`RblinkLeague.flag`, e.g. `/aelogo/country/eng.png`),
 *  rewritten onto the current logo host by `countryLogoUrl`. Built once per
 *  process — the scan lists a badge for 164 countries. "" is never stored, so a
 *  federation without a badge falls through to its initial. */
function federationBadges(): Map<string, string> {
  if (badges) return badges;
  const map = new Map<string, string>();
  for (const league of RBLINK_LEAGUES) {
    const key = badgeKey(league.country || '');
    if (!key || map.has(key)) continue;
    const url = countryLogoUrl(league.flag);
    if (url) map.set(key, url);
  }
  badges = map;
  return map;
}

/** Where a league sits in the scan. The scan is published by importance (the
 *  Premier League above the Championship), so that position is the ranking the
 *  federation panels sort their streamed competitions by. */
const LEAGUE_RANK = new Map(RBLINK_LEAGUES.map((l, i) => [l.id, i]));

/** Continent tabs, west to east as the publisher files them, with its own
 *  neutral bucket ("International", the world competitions) last — the reading
 *  GOALOO_AREAS itself uses. */
const AREA_TABS = [1, 2, 3, 4, 5, 0];

/** Tab rank of a region bucket; an area the catalogue adds later sorts after
 *  these, by its own value. */
function areaRank(area: number): number {
  const i = AREA_TABS.indexOf(area);
  return i === -1 ? AREA_TABS.length + area : i;
}

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

/** The reverse view of `rblinkLeagueFor`, built on first use: the catalogue
 *  competitions the scan pairs with ONE Rblink league, in pair-quality order
 *  (`exact` names before filler-tolerant ones) and then alphabetically.
 *
 *  The watch page is the reason it exists: an Rblink fixture arrives with a
 *  league id and no Goaloo key at all, and the Goaloo match centre is addressed
 *  by the schedule id of one of the competitions this map lists
 *  (lib/goalooLiveJoin.ts). Concatenating the 989 competitions means running
 *  the matcher over the whole catalogue — the same one-off pass
 *  `competitionDirectory` pays for, and `rblinkLeagueFor` caches each verdict,
 *  so it happens once per process either way. */
const byLeague = new Map<number, GoalooCompetition[]>();

export function goalooCompetitionsForLeague(leagueId: number | string): GoalooCompetition[] {
  if (!byLeague.size) {
    const grouped = new Map<number, { comp: GoalooCompetition; tier: number }[]>();
    for (const comp of GOALOO_COMPETITIONS) {
      const hit = rblinkLeagueFor(comp);
      if (!hit) continue;
      const row = { comp, tier: hit.tier === 'exact' ? 0 : 1 };
      const list = grouped.get(hit.league.id);
      if (list) list.push(row);
      else grouped.set(hit.league.id, [row]);
    }
    for (const [id, rows] of grouped) {
      rows.sort((a, b) => a.tier - b.tier || a.comp.name.localeCompare(b.comp.name));
      byLeague.set(id, rows.map((r) => r.comp));
    }
  }
  return byLeague.get(Number(leagueId)) ?? [];
}

/**
 * The Goaloo catalogue resolved against the Rblink scan — the whole payload
 * behind `/competitions`.
 *
 * Assembled on the server for two reasons: the Rblink file is ~540 KB and must
 * never travel to the browser, and `rblinkLeagueFor` caches its verdict per
 * Goaloo path, so the full 989 × 1220 comparison is paid once per process.
 * Federations and their entries both come out in a stable order, so the page
 * renders identically on every build.
 *
 * The one pass folds the catalogue into the federation grid the page browses
 * by: one item per country — the association behind the competitions, plus the
 * publisher's own region buckets ("Europe" for the UEFA cups, "International"
 * for the world ones) — carrying the competitions it runs for its hover panel,
 * the badge from the scan, and the continent tab it belongs to.
 */
export function competitionDirectory(): CompetitionDirectory {
  /** Streamed rows by Rblink slug — arrays, because the scan does pair a few
   *  slugs with two different ids and those must not be guessed at. */
  const bySlug = new Map<string, CompetitionHighlight[]>();
  /** The same loop, seen as one item per federation: its competitions and the
   *  region bucket it is filed under. Never more than one area per country —
   *  the publisher files all of a country's competitions in one bucket. */
  const byFederation = new Map<string, FederationCompetition[]>();
  const areaOfCountry = new Map<string, number>();
  let streamed = 0;

  for (const comp of GOALOO_COMPETITIONS) {
    const league = rblinkLeagueFor(comp)?.league;
    if (league) streamed += 1;
    const country = comp.country || OTHER_COUNTRY;
    // The federation view of that competition: the feed's own short code as the
    // panel label, and a headline flag from either catalogue — the Goaloo one
    // misses a few majors the scan does flag (`ENG PR` arrives with hot 0).
    const entry: FederationCompetition = {
      key: comp.path,
      name: comp.name,
      short: comp.short || comp.name,
      hot: comp.hot === 1 || Boolean(league?.hot),
      streamId: league?.id ?? 0,
      fixtures: Boolean(league?.matches),
    };
    const fed = byFederation.get(country);
    if (fed) fed.push(entry);
    else byFederation.set(country, [entry]);
    if (!areaOfCountry.has(country)) areaOfCountry.set(country, comp.area);
    // A crest is only worth an image request when a stream sits behind the
    // card, so only paired competitions become strip candidates.
    if (league) {
      const card: CompetitionHighlight = {
        key: comp.path,
        name: comp.name,
        country,
        logo: goalooCompetitionLogoUrl(comp.logo),
        streamId: league.id,
      };
      const cards = bySlug.get(league.slug);
      if (cards) cards.push(card);
      else bySlug.set(league.slug, [card]);
    }
  }

  const badge = federationBadges();
  /** Federations, in the scan's own order. The scan is published by importance
   *  (Premier League, Serie A, La Liga, Bundesliga, Ligue 1, …), so a
   *  federation takes the position of the highest-placed competition it has and
   *  the grid opens on the leagues a reader expects to find first — England,
   *  Italy, Spain, Germany, France — instead of on whichever country happens to
   *  publish the most rows. Federations the scan does not cover at all come
   *  last, alphabetically. Ordering is stable, so the grid renders the same on
   *  every build. */
  const federations: CompetitionFederation[] = [...byFederation]
    .map(([country, competitions]) => {
      // Streamed competitions first, in the scan's own order; everything the
      // matcher could not pair follows, alphabetically. The first entry with a
      // stream is therefore the federation's own rank in that order.
      competitions.sort((a, b) => {
        const ra = a.streamId ? LEAGUE_RANK.get(a.streamId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        const rb = b.streamId ? LEAGUE_RANK.get(b.streamId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
      });
      const area = areaOfCountry.get(country) ?? 0;
      const best = competitions.find((c) => c.streamId > 0);
      const federation: CompetitionFederation = {
        country,
        area,
        areaLabel: goalooAreaLabel(area),
        logo: badge.get(badgeKey(country)) ?? '',
        competitions,
      };
      return {
        rank: best ? LEAGUE_RANK.get(best.streamId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER,
        federation,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.federation.country.localeCompare(b.federation.country))
    .map((entry) => entry.federation);

  /** Continent tabs: one per region bucket the catalogue actually fills, in
   *  display order. Counts are read off the federations above, so a tab never
   *  promises a card the grid cannot draw. */
  const areas: CompetitionArea[] = [...new Set(federations.map((f) => f.area))]
    .sort((a, b) => areaRank(a) - areaRank(b) || a - b)
    .map((area) => {
      const grouped = federations.filter((f) => f.area === area);
      return {
        area,
        label: goalooAreaLabel(area),
        federations: grouped.length,
        competitions: grouped.reduce((n, f) => n + f.competitions.length, 0),
      };
    });

  return {
    federations,
    areas,
    // Featured, by slug, in the order declared above. A slug that paired
    // nothing, or paired twice (the scan publishes five duplicate slugs, e.g.
    // "copa-de-la-liga"), is skipped rather than resolved to a guess.
    highlights: FEATURED_SLUGS.flatMap((slug) => {
      const cards = bySlug.get(slug);
      return cards && cards.length === 1 ? cards : [];
    }),
    generatedAt: RBLINK_GENERATED_AT,
    // One country per federation — the same set the list's country blocks used
    // to be counted from.
    totals: { competitions: GOALOO_COMPETITIONS.length, countries: byFederation.size, streamed },
  };
}
