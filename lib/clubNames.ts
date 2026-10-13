/**
 * Comparing the two publishers' club names.
 *
 * Rblink and Goaloo share no club identifier, so every bridge in this app is
 * name-based: pairing a Goaloo fixture with its Rblink stream (lib/goalooJoin)
 * and resolving the club page a Rblink team links to (lib/goalooTeams). Both
 * need the same notion of "same club, spelled differently", so the spelling
 * rules live here instead of inside either caller.
 *
 * The two callers want two different reductions of a name, and both are here:
 *
 *   - {@link clubTokens} drops everything that merely decorates a club name
 *     (`fc`, `united`, `city`), which is exactly right when two names from the
 *     same fixture are compared against each other — filler can never be the
 *     evidence that pairs them, so it is removed rather than weighted; and
 *   - {@link clubNameKey} keeps the words that tell two clubs of the same town
 *     apart, because it is used to look a name up in the whole club index,
 *     where collapsing "Manchester United" and "Manchester City" onto one key
 *     would make both of them unresolvable.
 */

/** Clubs the two publishers spell with different words around the name. Never
 *  enough on their own to pair two rows. */
const FILLER = new Set([
  'fc', 'cf', 'sc', 'ac', 'afc', 'club', 'f', 'c', 'united', 'city', 'de', 'the',
  'and', 'as', 'sport', 'sports', 'team',
]);

/** Words a full club name is built from but that say nothing about WHICH club:
 *  "Persatuan Sepakbola Indonesia Jepara" must pair with "Persijap Jepara" on
 *  `jepara`, never on `indonesia`. */
const GENERIC = new Set([
  'persatuan', 'sepak', 'bola', 'sepakbola', 'indonesia', 'football', 'soccer',
  'klub', 'tim',
]);

/** Decoration a club name may still carry into an index key — the filler above
 *  minus `united`/`city`, which DO tell two clubs of one town apart, plus the
 *  words that only ever introduce a name. A bare number goes the same way: the
 *  feed publishes both "1. FC Koln" and "FC Koln" for one club. */
const NAME_FILLER = new Set([
  'fc', 'cf', 'sc', 'ac', 'afc', 'club', 'de', 'the', 'and', 'as', 'of', 'sport',
  'sports', 'team',
]);

/** Lower-cased, de-accented, punctuation folded to spaces. */
function normalize(name: string): string {
  return (name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The club name with only case, accents and punctuation folded — nothing
 *  dropped. Two publishers spelling a name the same way is the strongest
 *  evidence there is, and it survives what {@link clubNameKey} has to ignore:
 *  "AFC Liverpool" and "Liverpool" share a key, but only "Liverpool" is spelled
 *  like the name the feed published. */
export function clubNameText(name: string): string {
  return normalize(name);
}

/** A club name reduced to comparable tokens: lower-cased, de-accented and
 *  stripped of the words above. */
export function clubTokens(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((t) => t.length > 0 && !FILLER.has(t));
}

/** The club name as one comparable key — {@link clubTokens} minus the
 *  decoration, with the distinguishing words (`united`, `city`, `rovers`) kept
 *  and bare numbers dropped. Two clubs share a key only when the feeds spell
 *  them identically, which is what a lookup in the club index relies on. */
export function clubNameKey(name: string): string {
  return normalize(name)
    .split(' ')
    .filter((t) => t.length > 0 && !NAME_FILLER.has(t) && !/^\d+$/.test(t))
    .join(' ');
}

/** Do two published names denote the same club? Either the token sets are
 *  identical (Java United FC = Java United F.C.) or they share a token that
 *  names the club (Persik Kediri = Persatuan sepak bola Indonesia Kediri). */
export function sameClub(a: string, b: string): boolean {
  const left = clubTokens(a);
  const right = clubTokens(b);
  if (left.length === 0 || right.length === 0) return false;
  const rset = new Set(right);
  if (left.length === rset.size && left.every((t) => rset.has(t))) return true;
  return left.some((t) => rset.has(t) && !GENERIC.has(t));
}
