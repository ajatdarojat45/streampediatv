/**
 * The Goaloo worldwide catalogue (data/competitions.json) plus the matcher that
 * pairs a Goaloo competition with its Rblink league.
 *
 * The join matters because only Rblink knows the streaming ids: a fixture is
 * watchable as `/watch/{matchId}?sport=football`, while Goaloo is the authority
 * on the competition list itself (it publishes 989 competitions across 128
 * countries, far more than Rblink exposes through its own league picker).
 *
 * Matching is precision-first: a wrong pair puts an unrelated stream on a
 * competition page, which is worse than showing no stream at all. Names are
 * therefore reduced to "real" tokens before anything is compared — stopwords,
 * filler (`national`, `football`, `men`, `group`) and the country word itself
 * are dropped, class spellings collapse to one form (`Lig` = `Liga` = `Ligue` =
 * `League`) and adjectives resolve to their country (`French` → `france`).
 * A pair only survives when
 *
 *   1. the two countries agree (or the Rblink row publishes no country at all
 *      AND the names are identical),
 *   2. the two sides do not disagree on a differentiator (a number, `U17`,
 *      `women`, `youth`, `futsal`, …),
 *   3. they do not disagree on a named tier (`Serie C` is not `Serie A`, and
 *      `Coppa Italia Serie C` is not the `Coppa Italia`),
 *   4. and either one side's tokens are a subset of the other's ignoring filler
 *      (`England League 1` picks up `English Football League One`), or the
 *      shared part still contains a word that names the competition while
 *      everything the two names disagree on is filler or a class spelling
 *      (`England Championship` picks up `English Football League Championship`).
 *
 * That last condition is what stops `National Football League` collapsing onto
 * `Premier League` and `FA Vase` onto `FA Trophy` — the over-matches this
 * matcher exists to prevent.
 *
 * Tuned against the full 1220-row scan: 454 competitions resolve, 405 of them
 * on an exact token match and 49 through the filler-tolerant rules. Every
 * precision probe (`England Nacional League Cup`, `Russia National Football
 * League`, `Lithuania TOPLYGA`, `FA Vase`, `Chile Primera B`, `Estonia Esi
 * Liiga`, …) resolves to nothing rather than to the wrong league.
 */
import catalogue from '@/data/competitions.json';
import type { GoalooCompetition, RblinkLeague } from './types';

/** Every competition in the Goaloo catalogue. Static build-time data. */
export const GOALOO_COMPETITIONS: GoalooCompetition[] = (
  catalogue as unknown as { competitions: GoalooCompetition[] }
).competitions;

const byPath = new Map(GOALOO_COMPETITIONS.map((c) => [c.path, c]));

/** Look a competition up by its feed key — the `[key]` segment of the route. */
export function findCompetition(path: string): GoalooCompetition | undefined {
  return byPath.get(path);
}

/** Filler the catalogue and the scan disagree on without meaning anything:
 *  `English Football League Cup` ≡ `England League Cup`, `Danish Division 3
 *  Group A` ≡ `Denmark Division 3`. Never used to distinguish two names. */
const FILLER = new Set([
  'football', 'soccer', 'association', 'national', 'professional', 'men', 'mens',
  'open', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'group', 'stage', 'round',
  'phase', 'series', 'fifa', 'uefa', 'afc', 'caf', 'concacaf', 'ofc', 'conmebol',
  'federation', 'federacion', 'federatie',
]);

/** Words that DO change what a competition is. Two names may only pair when
 *  neither adds one the other lacks. */
const DIFFERENTIATORS = new Set([
  'super', 'club', 'clubs', 'women', 'womens', 'woman', 'womans', 'ladies',
  'youth', 'junior', 'junioren', 'reserve', 'olympic', 'olympics', 'beach',
  'futsal', 'indoor', 'champions', 'champion', 'winners', 'winner', 'europa',
  'conference', 'nations', 'world', 'international', 'friendlies', 'friendly',
  'qualification', 'qualifier', 'qualifiers', 'preliminary', 'preliminaries',
  'play', 'offs', 'playoff', 'playoffs', 'games',
]);

const STOPWORDS = new Set(['the', 'of', 'de', 'du', 'la', 'el', 'and']);

/** Spelled-out ordinals — `League One` ≡ `League 1`. */
const NUMERALS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  first: '1', second: '2', third: '3', fourth: '4',
  i: '1', ii: '2', iii: '3', iv: '4',
};

/** Class words: the same idea under two spellings (`Super Lig` = `Super
 *  League`). Canonicalised before comparison, and tolerated as a surplus word —
 *  never as the *only* shared word, so `National Football League` cannot fall
 *  onto `Premier League`. Deliberately excludes cup/trophy/shield: those name
 *  different competitions even when everything else lines up (FA Vase vs FA
 *  Trophy). */
const CLASS_EQUIVALENTS: Record<string, string> = {
  lig: 'league',
  liga: 'league',
  ligue: 'league',
  leag: 'league',
};

const CLASS_WORDS = new Set(['league', 'serie', 'division']);

/** Country spellings the two publishers disagree on. */
const COUNTRY_ALIASES: Record<string, string> = {
  holland: 'netherlands',
  'south korea': 'korea',
  usa: 'usa',
  'united states': 'usa',
  uae: 'uae',
  'united arab emirates': 'uae',
  'czech republic': 'czechia',
  'ir iran': 'iran',
  'korea republic': 'korea',
  'korea dpr': 'north korea',
  'congo dr': 'dr congo',
  'bosnia and herzegovina': 'bosnia',
  'bosnia & herzegovina': 'bosnia',
  'fyr macedonia': 'north macedonia',
  macedonia: 'north macedonia',
};

/** Country adjectives the stem rule in `buildRblinkIndex` cannot infer
 *  (`danish` does not look like `denmark`; `french` and `france` agree on two
 *  letters where the rule demands three). */
const COUNTRY_ADJECTIVES: Record<string, string> = {
  french: 'france',
  danish: 'denmark', norwegian: 'norway', dutch: 'netherlands', swiss: 'switzerland',
  polish: 'poland', icelandic: 'iceland', greek: 'greece', japanese: 'japan',
  korean: 'korea', chinese: 'china', thai: 'thailand', indonesian: 'indonesia',
  malaysian: 'malaysia', vietnamese: 'vietnam', indian: 'india', russian: 'russia',
  ukrainian: 'ukraine', turkish: 'turkey', croatian: 'croatia', serbian: 'serbia',
  slovenian: 'slovenia', bosnian: 'bosnia', albanian: 'albania', romanian: 'romania',
  bulgarian: 'bulgaria', hungarian: 'hungary', moldovan: 'moldova', belarusian: 'belarus',
  armenian: 'armenia', azerbaijani: 'azerbaijan', georgian: 'georgia', israeli: 'israel',
  iranian: 'iran', iraqi: 'iraq', saudi: 'saudi arabia', qatari: 'qatar', emirati: 'uae',
  kuwaiti: 'kuwait', moroccan: 'morocco', egyptian: 'egypt', tunisian: 'tunisia',
  algerian: 'algeria', kenyan: 'kenya', nigerian: 'nigeria', ghanaian: 'ghana',
  senegalese: 'senegal', cameroonian: 'cameroon', chilean: 'chile', peruvian: 'peru',
  bolivian: 'bolivia', colombian: 'colombia', uruguayan: 'uruguay', paraguayan: 'paraguay',
  ecuadorian: 'ecuador', venezuelan: 'venezuela', mexican: 'mexico', cuban: 'cuba',
  jamaican: 'jamaica', honduran: 'honduras', guatemalan: 'guatemala', panamanian: 'panama',
  canadian: 'canada', australian: 'australia', estonian: 'estonia', latvian: 'latvia',
  lithuanian: 'lithuania', cypriot: 'cyprus', scottish: 'scotland', welsh: 'wales',
  irish: 'ireland', english: 'england', andorran: 'andorra',
};

/** Lowercase, strip accents and possessives, collapse punctuation to spaces. */
const normalize = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Meaningful words of a name (stopwords dropped). */
const rawWords = (value: unknown): string[] =>
  normalize(value).split(' ').filter((t) => t && !STOPWORDS.has(t));

/** Canonical country key (`Holland` → `netherlands`). */
export function countryKey(value: unknown): string {
  const n = normalize(value);
  return COUNTRY_ALIASES[n] || n;
}

/* ---------- the join ---------- */

/** A Rblink row with everything the comparison needs pre-computed. The scan is
 *  compared against the whole catalogue (989 × 1220), so tokenising a row once
 *  instead of once per competition is what keeps the directory render fast. */
interface PreparedLeague {
  league: RblinkLeague;
  country: string;
  /** Name tokens, country words already removed. */
  tokens: string[];
  /** Differentiators present (numbers, `u17`, `women`, …) as a sorted key. */
  signature: string;
}

export interface RblinkMatchIndex {
  leagues: PreparedLeague[];
  adjectives: Map<string, string>;
}

/** `A` is a subset of `B` once filler is ignored. */
const subsetIgnoringFiller = (a: string[], b: string[]): boolean =>
  a.every((t) => b.includes(t) || FILLER.has(t));

const extra = (a: string[], b: string[]): string[] => [...new Set(a.filter((x) => !b.includes(x)))];

/** A tier marker (`Serie C`, `Division 2`, `Liga A`) sitting next to a class
 *  word names one specific tier, so the two names must agree on it — otherwise
 *  `Coppa Italia Serie C` would be paired with the `Coppa Italia` itself. The
 *  marker is read from either side of the class word because publishers order
 *  them differently (`Division One` / `Second League`). */
const TIER_MARKER = /^[a-h]$|^\d+$/;

function tierMarkers(tokens: string[]): string[] {
  const isClass = (t?: string) => !!t && CLASS_WORDS.has(t);
  /** Nearest neighbour that is not filler — `First Football League` still puts
   *  the marker beside `league`. */
  const skipFiller = (from: number, step: number): string | undefined => {
    for (let i = from; i >= 0 && i < tokens.length; i += step) {
      if (!FILLER.has(tokens[i])) return tokens[i];
    }
    return undefined;
  };
  const markers: string[] = [];
  tokens.forEach((t, i) => {
    if (!TIER_MARKER.test(t)) return;
    if (isClass(skipFiller(i - 1, -1)) || isClass(skipFiller(i + 1, 1))) markers.push(t);
  });
  return markers.sort();
}

const signatureOf = (tokens: string[]): string =>
  [...new Set(tokens.filter((t) => DIFFERENTIATORS.has(t) || /^\d+$/.test(t) || /^u\d+$/.test(t)))]
    .sort()
    .join(',');

/** Name tokens with the (redundant) country words dropped, ordinals folded to
 *  digits and adjectives resolved to their country key. */
function tokensFor(name: unknown, country: unknown, adjectives: Map<string, string>): string[] {
  const countryKeyOf = countryKey(country);
  return rawWords(name)
    .map(
      (t) =>
        NUMERALS[t] ||
        adjectives.get(t) ||
        COUNTRY_ALIASES[t] ||
        CLASS_EQUIVALENTS[t] ||
        t
    )
    .filter((t) => t !== countryKeyOf);
}

/** Build the lookup tables once: the country adjectives a scan teaches us, plus
 *  every row in comparable form. A word only counts as a country adjective when
 *  it shares a 3-letter stem with its country (`english`~`england`), which keeps
 *  regional names (`paulista`, `carioca`, `victoria`) out of the table. */
export function buildRblinkIndex(leagues: RblinkLeague[]): RblinkMatchIndex {
  const countryNames = new Set<string>();
  for (const l of leagues) {
    const c = countryKey(l.country);
    if (c) countryNames.add(c);
  }

  const observed = new Map<string, Map<string, number>>();
  for (const l of leagues) {
    const c = countryKey(l.country);
    if (!c) continue;
    for (const t of rawWords(l.name)) {
      if (t === c || t.length < 4 || DIFFERENTIATORS.has(t) || FILLER.has(t)) continue;
      if (countryNames.has(t) || COUNTRY_ADJECTIVES[t]) continue;
      if (!observed.has(t)) observed.set(t, new Map());
      const m = observed.get(t)!;
      m.set(c, (m.get(c) || 0) + 1);
    }
  }

  const adjectives = new Map<string, string>(Object.entries(COUNTRY_ADJECTIVES));
  for (const [t, m] of observed) {
    // Ambiguous words prove nothing, and a single sighting is too thin.
    if (m.size !== 1) continue;
    const [c, seen] = [...m.entries()][0];
    if (seen >= 2 && c.length >= 3 && t.slice(0, 3) === c.slice(0, 3)) adjectives.set(t, c);
  }

  return {
    leagues: leagues.map((league) => {
      const tokens = tokensFor(league.name, league.country, adjectives);
      return {
        league,
        country: countryKey(league.country),
        tokens,
        signature: signatureOf(tokens),
      };
    }),
    adjectives,
  };
}

export interface RblinkMatch {
  league: RblinkLeague;
  /** `exact` = identical token sets, `likely` = filler-only difference. */
  tier: 'exact' | 'likely';
}

/** Pair one competition with its Rblink league, or `null` when nothing is
 *  trusted enough to be shown next to it. */
export function matchRblinkLeague(
  comp: GoalooCompetition,
  index: RblinkMatchIndex
): RblinkMatch | null {
  const tokens = tokensFor(comp.name, comp.country, index.adjectives);
  const country = countryKey(comp.country);
  const signature = signatureOf(tokens);
  const found = new Set(tokens);

  let exact: RblinkLeague | null = null;
  let likely: RblinkLeague | null = null;
  let likelyCost = Number.POSITIVE_INFINITY;

  for (const row of index.leagues) {
    const sameCountry = Boolean(country) && Boolean(row.country) && country === row.country;
    const sameTokens =
      tokens.length === row.tokens.length &&
      found.size === new Set(row.tokens).size &&
      row.tokens.every((t) => found.has(t));

    if (sameTokens) {
      // An identical name is trusted even without a country, but a row that
      // publishes one must still agree — "ACL" must not absorb every cup.
      if (sameCountry || !row.country || !country) {
        const current = exact;
        if (!current || (row.league.teams || 0) > (current.teams || 0)) exact = row.league;
      }
      continue;
    }

    if (!sameCountry || signature !== row.signature) continue;
    const rowFound = new Set(row.tokens);
    const shared = tokens.filter((t) => rowFound.has(t));
    const surplus = [...extra(tokens, row.tokens), ...extra(row.tokens, tokens)];
    // Strict path — one side is a pure subset of the other and the superset side
    // only adds filler: `England League Cup` ← `English Football League Cup`.
    const strictToRow = subsetIgnoringFiller(tokens, row.tokens) && row.tokens.every((t) => found.has(t));
    const strictToComp = subsetIgnoringFiller(row.tokens, tokens) && tokens.every((t) => rowFound.has(t));
    // Soft path — the shared part carries a word that actually names the
    // competition (not a class word, not filler) and everything the two names
    // disagree on is filler or a class spelling: `England Championship` ←
    // `English Football League Championship`. Without the distinctive-shared
    // requirement this would pair `National Football League` with `Premier
    // League`, which is exactly the over-match this matcher exists to prevent.
    const distinctive = shared.some((t) => !CLASS_WORDS.has(t) && !FILLER.has(t));
    const weakSurplus = surplus.every((t) => FILLER.has(t) || CLASS_WORDS.has(t));
    // A named tier has to line up on both sides before anything else is judged.
    const compTiers = tierMarkers(tokens);
    const rowTiers = tierMarkers(row.tokens);
    const sameTier = compTiers.join(',') === rowTiers.join(',');
    if (!sameTier || (!strictToRow && !strictToComp && !(distinctive && weakSurplus))) continue;
    const cost = surplus.length;
    if (cost < likelyCost || (cost === likelyCost && (row.league.teams || 0) > (likely?.teams || 0))) {
      likely = row.league;
      likelyCost = cost;
    }
  }

  if (exact) return { league: exact, tier: 'exact' };
  return likely ? { league: likely, tier: 'likely' } : null;
}
