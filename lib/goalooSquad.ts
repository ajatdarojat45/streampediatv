/**
 * Which player page a Rblink player belongs to.
 *
 * A Rblink payload names a footballer by its own `playerId` — an id only the
 * stream side understands — while `/player/{id}` is built from a Goaloo feed.
 * The two feeds share no player identifier either (a lineup id the DataAPI
 * publishes has no document on the Goaloo host, while every id the Goaloo club
 * feed publishes does), so the bridge is again the published name, resolved with
 * the same spelling rules the club bridge uses (lib/clubNames.ts).
 *
 * A player's name on its own is far weaker evidence than a club's: thousands of
 * footballers share one, and the feeds spell one man two ways ("M. Salah" /
 * "Mohamed Salah"). What makes the match precise is the SCOPE. Every row this
 * module touches already belongs to a club — a team-sheet row is one of the two
 * sides on the pitch, a leaderboard row names the club it was recorded for — so
 * a name is only ever looked up inside that club's own squad, where a clash is
 * rare and a wrong pick almost impossible.
 *
 * The squad is the club feed's own `lineupDetail` (lib/goalooClub.ts), i.e. the
 * very list the club page renders: reading it costs ONE request per club, which
 * is why it is fetched on demand here (Next's five-minute data cache + an
 * in-process index cache + in-flight coalescing) rather than precomputed into a
 * data file the way the 14,676-club index is. A match page can touch at most two
 * clubs; a competition leaderboard touches the clubs its rows name, a few at a
 * time.
 *
 * Precision first, as everywhere else in this app: a name resolves only when the
 * squad speaks with one voice —
 *
 *   1. spelled exactly like a squad member (after folding case, accents and
 *      punctuation), and only one member is spelled that way; or
 *   2. folding to the same key (decoration dropped), again uniquely; or
 *   3. naming the same man with a different spelling: the same tokens in any
 *      order, or a given name that agrees — spelled the same, or abbreviated to
 *      an initial ("M. Salah" / "Mohamed Salah") — together with one shared
 *      token, and only when exactly one member qualifies. A bare surname is
 *      never enough in a squad where a dozen players could carry it.
 *
 * Anything else — a player the squad does not list (a loan, a departed player, a
 * youth-team call-up), a name two members could both claim — resolves to `0`,
 * and the caller renders that name as plain text.
 *
 * Football only: the Goaloo player feed exists for the football club pages.
 */
import { goalooClubUrl } from './goaloo';
import { clubNameText } from './clubNames';
import type { LeaguePlayerTotals, MatchEvents, MatchLineup, Team } from './types';

/** The app's football category — the only sport these player pages cover. */
const FOOTBALL = 1;

/** Fold a player name exactly the way the club rules do, minus two assumptions
 *  that only hold for clubs:
 *
 *   - an apostrophe is dropped rather than turned into a word break, because the
 *     two feeds spell one man "Callum O'Hare" and "Callum OHare"; and
 *   - a single letter is KEPT. In a club name "c" was the decoration of
 *     "C. Koln"; in a person's name a lone letter is his given name, which is
 *     what "C.Doyle" has to bring to a sheet that spells him "Callum Doyle". */
function playerText(name: string): string {
  return clubNameText(name.replace(/['\u2019]/g, ''));
}

/** Name parts that never tell two players of one surname apart — dropped before
 *  a comparison, so "Smith Jr" still lines up with "Smith". */
const SUFFIX = new Set(['jr', 'junior', 'snr', 'senior', 'ii', 'iii', 'filho', 'neto']);

/** A player name reduced to comparable tokens (see {@link samePlayer}). */
function playerTokens(name: string): string[] {
  return playerText(name)
    .split(' ')
    .filter((t) => t.length > 0 && !SUFFIX.has(t));
}

/** A player name as one lookup key — the tokens, minus a bare number. */
function playerKey(name: string): string {
  return playerTokens(name)
    .filter((t) => !/^\d+$/.test(t))
    .join(' ');
}

/** How long the club feed stays fresh (the window lib/goalooClub.ts uses). */
const REVALIDATE = 300;
/** And how long a decoded squad index is reused in this process. The upstream
 *  cache above already spares the request; this spares the parse and the index
 *  build, which a 1k-row leaderboard would otherwise repeat per row. */
const CACHE_TTL = 10 * 60_000;
/** How many clubs a leaderboard may fetch at once (the document is large). */
const CONCURRENCY = 6;

/** One squad member, as the club feed publishes him. */
interface Member {
  name: string;
  id: number;
}

/** A club's squad, reduced to the lookups the three rules need. */
export interface Squad {
  /** Folded published name → ids (one member, or a spelling two members share). */
  text: Map<string, number[]>;
  /** Name key → ids. */
  key: Map<string, number[]>;
  /** Naming token → the ids that carry it. */
  tokens: Map<string, number[]>;
  /** Id → the names published for it. */
  names: Map<number, string[]>;
}

/** A squad the feed did not publish (or did not answer for). */
const EMPTY: Squad = { text: new Map(), key: new Map(), tokens: new Map(), names: new Map() };

const cache = new Map<number, { at: number; squad: Squad }>();
const inflight = new Map<number, Promise<Squad>>();

function push(map: Map<string, number[]>, key: string, id: number): void {
  if (!key) return;
  const list = map.get(key);
  if (!list) map.set(key, [id]);
  else if (!list.includes(id)) list.push(id);
}

/** One `lineupDetail` row — `[id, number, name, …]`, guarded exactly like the
 *  club page's own reader (lib/goalooClub.ts `personOf`). */
function memberOf(raw: unknown): Member | null {
  const row = Array.isArray(raw) ? raw : [];
  const id = typeof row[0] === 'number' && Number.isFinite(row[0]) ? row[0] : 0;
  const name = typeof row[2] === 'string' ? row[2].trim() : '';
  return id > 0 && name ? { name, id } : null;
}

/** Index a club feed document's squad. */
function indexOf(json: unknown): Squad {
  const rows = (json as { lineupDetail?: unknown } | null)?.lineupDetail;
  if (!Array.isArray(rows)) return EMPTY;
  const squad: Squad = { text: new Map(), key: new Map(), tokens: new Map(), names: new Map() };
  for (const raw of rows) {
    const member = memberOf(raw);
    if (!member) continue;
    push(squad.text, playerText(member.name), member.id);
    push(squad.key, playerKey(member.name), member.id);
    for (const token of playerTokens(member.name)) push(squad.tokens, token, member.id);
    const names = squad.names.get(member.id);
    if (names) names.push(member.name);
    else squad.names.set(member.id, [member.name]);
  }
  return squad;
}

/** Fetch and index one club's squad. A failure is an empty squad — never a
 *  thrown page and never a wrong link. The host answers an id it does not know
 *  with an HTML soft-404, hence the content-type guard (lib/goalooClub.ts). */
async function fetchSquad(teamId: number): Promise<Squad> {
  try {
    const res = await fetch(goalooClubUrl(teamId), {
      headers: { accept: 'application/json' },
      next: { revalidate: REVALIDATE },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.includes('json')) return EMPTY;
    return indexOf(await res.json());
  } catch {
    return EMPTY;
  }
}

/** One club's squad: cached for ten minutes, fetched at most once at a time. */
export async function goalooSquad(teamId: number): Promise<Squad> {
  const id = Math.trunc(Number(teamId));
  if (!Number.isInteger(id) || id <= 0) return EMPTY;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.squad;
  const running = inflight.get(id);
  if (running) return running;
  const p = fetchSquad(id)
    .then((squad) => {
      cache.set(id, { at: Date.now(), squad });
      return squad;
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

/** Do two published spellings denote the same player?
 *
 *  Stricter than `sameClub` (lib/clubNames.ts), and it has to be: a club's full
 *  name is distinctive, while a surname is carried by a dozen players around one
 *  league, so a shared surname is never evidence on its own. Two things have to
 *  agree here — the SURNAME, spelled the same or abbreviated to its initial
 *  ("Kieffer M." / "Kieffer Moore"), and the GIVEN name, likewise spelled the
 *  same or abbreviated ("M. Salah" / "Mohamed Salah") — or the names must hold
 *  the very same tokens in another order ("Salah Mohamed"). That is what keeps
 *  "Sam Jones" and "John Smith" away from a squad's "Sam Smith". */
function samePlayer(a: string, b: string): boolean {
  const left = playerTokens(a);
  const right = playerTokens(b);
  if (!left.length || !right.length) return false;
  const rset = new Set(right);
  if (left.length === rset.size && left.every((t) => rset.has(t))) return true;
  const lLast = left[left.length - 1];
  const rLast = right[right.length - 1];
  if (!initialOf(lLast, rLast) && !initialOf(rLast, lLast)) return false;
  return initialOf(left[0], right[0]) || initialOf(right[0], left[0]);
}

/** `short` is the same name part as `full`, written as one letter ("k" / "kieffer"). */
function initialOf(short: string, full: string): boolean {
  return short.length === 1 ? full.startsWith(short) : short === full;
}

/** The id a squad answers a name with — the three rules in the header, in that
 *  order, and `0` whenever the squad cannot name the player with certainty. */
export function lookupPlayer(squad: Squad, name?: string): number {
  const query = (name ?? '').trim();
  if (!query) return 0;

  // 1. The same spelling, only case/punctuation folded.
  const text = playerText(query);
  const spelled = text ? squad.text.get(text) : undefined;
  if (spelled?.length === 1) return spelled[0];

  // 2. The same name once decoration is dropped.
  const key = playerKey(query);
  const exact = key ? squad.key.get(key) : undefined;
  if (exact?.length === 1) return exact[0];

  // 3. Loose fallback: members sharing a token with the name, kept only when
  //    their own published name passes the `samePlayer` test — and only when
  //    exactly one member qualifies.
  const candidates = new Set<number>();
  for (const token of playerTokens(query)) {
    for (const id of squad.tokens.get(token) ?? []) candidates.add(id);
  }
  const hits: number[] = [];
  for (const id of candidates) {
    if (squad.names.get(id)?.some((published) => samePlayer(query, published))) hits.push(id);
  }
  return hits.length === 1 ? hits[0] : 0;
}

/** The two clubs of one match, addressed by their Goaloo ids (`0` = the side the
 *  club bridge could not resolve, which is simply looked up as nothing). */
export interface MatchSides {
  home?: number;
  away?: number;
}

/** Fill in `playerPageId` on one player row — no-op for a payload that is not
 *  football, for a row that already carries an id, and for a name the squad
 *  cannot vouch for (the field then stays absent). */
function attachPlayer(player: Team | undefined, squad: Squad, sportType?: number): void {
  if (!player || player.playerPageId || sportType !== FOOTBALL) return;
  const id = lookupPlayer(squad, player.name);
  if (id) player.playerPageId = id;
}

/** Nearest the caller can get to both squads of a match: at most two clubs. */
async function squadsFor(sides: MatchSides): Promise<{ home: Squad; away: Squad }> {
  const [home, away] = await Promise.all([goalooSquad(sides.home ?? 0), goalooSquad(sides.away ?? 0)]);
  return { home, away };
}

/** Run the club-feed fetches a few at a time (each one is a large document). */
async function mapLimit<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}

/** Attach the player pages of one match's team sheet. Each side is looked up in
 *  its OWN squad, so a name is never matched against the opponent's players. */
export async function attachMatchLineupPlayerIds(
  lineup: MatchLineup,
  sportType: number | undefined,
  sides: MatchSides
): Promise<void> {
  if (sportType !== FOOTBALL) return;
  const { home, away } = await squadsFor(sides);
  for (const row of lineup.home) attachPlayer(row.player, home, sportType);
  for (const row of lineup.away) attachPlayer(row.player, away, sportType);
}

/** Attach the player pages of a match's event list — scorer, assistant,
 *  offender and both halves of a substitution. The event's own `teamSide`
 *  decides which squad the names are read in; an event the feed left without a
 *  side is only resolved when both squads name the same player. */
export async function attachMatchEventPlayerIds(
  events: MatchEvents,
  sportType: number | undefined,
  sides: MatchSides
): Promise<void> {
  if (sportType !== FOOTBALL) return;
  const squads = await squadsFor(sides);
  for (const e of events) {
    const known = e.teamSide === 1 || e.teamSide === 2;
    const primary = e.teamSide === 2 ? squads.away : squads.home;
    const other = e.teamSide === 2 ? squads.home : squads.away;
    for (const player of [e.scorer, e.assistant, e.offender, e.substitutionIn, e.substitutionOut]) {
      if (!player || player.playerPageId) continue;
      const id = lookupPlayer(primary, player.name);
      if (!id) continue;
      if (!known && lookupPlayer(other, player.name) !== id) continue;
      player.playerPageId = id;
    }
  }
}

/** Attach the player pages of a competition leaderboard. Every row names the
 *  club it was recorded for, which is the squad its player is read in — the
 *  distinct clubs are fetched a few at a time, each of them once, and a row
 *  whose club did not resolve simply stays plain text. */
export async function attachLeaguePlayerIds(
  totals: LeaguePlayerTotals,
  sportType: number | undefined
): Promise<void> {
  if (sportType !== FOOTBALL) return;
  const squads = new Map<number, Squad>();
  const clubIds = new Set<number>();
  for (const row of totals.rows) {
    const clubId = row.teamId !== undefined ? totals.teams[row.teamId]?.clubId ?? 0 : 0;
    if (clubId) clubIds.add(clubId);
  }
  await mapLimit([...clubIds], CONCURRENCY, async (clubId) => {
    squads.set(clubId, await goalooSquad(clubId));
  });
  for (const row of totals.rows) {
    if (row.playerId === undefined || row.teamId === undefined) continue;
    const clubId = totals.teams[row.teamId]?.clubId ?? 0;
    const squad = clubId ? squads.get(clubId) : undefined;
    if (squad) attachPlayer(totals.players[row.playerId], squad, sportType);
  }
}


