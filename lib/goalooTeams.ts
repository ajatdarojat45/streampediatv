/**
 * Which club page a Rblink team belongs to.
 *
 * A Rblink payload identifies a club by its own `teamId` — an id only the
 * stream side understands — while `/club/{id}` is built from a Goaloo feed
 * addressed by a Goaloo id. The feeds share no club identifier, so the bridge
 * is the published name, exactly like the fixture→stream join in
 * lib/goalooJoin.ts, and it is resolved by the same spelling rules
 * (lib/clubNames.ts).
 *
 * Asking Goaloo for the club list of every competition it publishes costs one
 * request per competition (a live feed carries a dozen of them) and cannot be
 * done per page, so that catalogue ships as data instead: `goaloo-teams.json`
 * maps every club name the 989 competition feeds publish (14,676 clubs) to its
 * Goaloo id, produced offline by `tools/gen-goaloo-teams.mjs` — the same
 * pattern as `competitions.json` and `rblink-leagues.json`. A name therefore
 * resolves here with no network, no cache and no await.
 *
 * Precision first, as everywhere else in this app: a wrong club page is worse
 * than a club printed without a link, so a name resolves only when the index
 * speaks with one voice.
 *
 *   1. the name is spelled exactly like a club the feeds publish (after folding
 *      case, accents and punctuation) and that spelling belongs to exactly one
 *      club — nothing had to be inferred at all; or
 *   2. the normalized name matches exactly and belongs to exactly one club; or
 *   3. the name shares a club-naming token with exactly one club (this is what
 *      pairs "Persatuan Sepak Bola Indonesia Kediri" with "Persik Kediri"),
 *      and never when two clubs answer to it.
 *
 * Anything else — an unknown name, a name two clubs share (e.g. a women's or a
 * reserve side spelled like the first team) — resolves to `0`, and the caller
 * renders that club as plain text.
 */
import index from '@/data/goaloo-teams.json';
import { clubNameKey, clubNameText, clubTokens, sameClub } from './clubNames';
import type { Match, Team } from './types';

/** The app's football category — the only sport these club pages cover. */
const FOOTBALL = 1;

interface ClubIndexFile {
  generatedAt: string;
  count: number;
  teams: [string, number][];
}

const file = index as unknown as ClubIndexFile;

/** The spelling the feeds use, folded to case/accents/punctuation → the ids
 *  published that way. The strongest evidence in the file: nothing was dropped
 *  to make the two names meet. */
const byText = new Map<string, number[]>();
/** Normalized name → the ids that answer to it (one club, or a conflict). */
const byKey = new Map<string, number[]>();
/** Club-naming token → the ids that carry it, the loose candidate set. */
const byToken = new Map<string, number[]>();
/** Id → the names the feeds publish for that club. */
const namesById = new Map<number, string[]>();

function push(map: Map<string | number, number[]>, key: string | number, id: number): void {
  const list = map.get(key);
  if (!list) map.set(key, [id]);
  else if (!list.includes(id)) list.push(id);
}

for (const [name, id] of file.teams) {
  const text = clubNameText(name);
  if (text) push(byText, text, id);
  const key = clubNameKey(name);
  if (key) push(byKey, key, id);
  for (const token of clubTokens(name)) push(byToken, token, id);
  const names = namesById.get(id);
  if (names) names.push(name);
  else namesById.set(id, [name]);
}

/** The Goaloo id for a club name — `0` when the index cannot name it with
 *  certainty. The three rules in the header, in that order. */
export function goalooClubId(name?: string): number {
  const query = (name ?? '').trim();
  if (!query) return 0;

  // 1. The same spelling, only case/punctuation folded.
  const text = clubNameText(query);
  const spelled = text ? byText.get(text) : undefined;
  if (spelled?.length === 1) return spelled[0];

  // 2. The same name once decoration (`fc`, `afc`, a bare number) is dropped.
  const key = clubNameKey(query);
  const exact = key ? byKey.get(key) : undefined;
  if (exact?.length === 1) return exact[0];

  // 3. Loose fallback: every club sharing a token with the name, kept only when
  //    that club's own published name passes the `sameClub` test.
  const candidates = new Set<number>();
  for (const token of clubTokens(query)) {
    for (const id of byToken.get(token) ?? []) candidates.add(id);
  }
  const hits: number[] = [];
  for (const id of candidates) {
    if (namesById.get(id)?.some((published) => sameClub(query, published))) hits.push(id);
  }
  return hits.length === 1 ? hits[0] : 0;
}

/** The name the feeds publish for one club id — `""` for an id the index does
 *  not carry. The transfer feed ships the counterpart club as an id and nothing
 *  else, so this is where a name for it comes from; when the index holds more
 *  than one spelling the first in the generated file wins, so one id always
 *  prints the same name. */
export function goalooClubName(id: number | string | undefined): string {
  const wanted = Number(id);
  if (!Number.isFinite(wanted)) return '';
  return namesById.get(wanted)?.[0] ?? '';
}

/** Fill in `clubId` on a team the caller already decoded — no-op for a payload
 *  that is not football, for an already resolved team, and for a name the index
 *  cannot vouch for (`clubId` stays absent and the club renders as text). */
export function attachClubId(team: Team | undefined, sportType?: number): void {
  if (!team || team.clubId || sportType !== FOOTBALL) return;
  const id = goalooClubId(team.name);
  if (id) team.clubId = id;
}

/** Both sides of one match — the plain `home`/`away` and the doubles
 *  `homeTeams`/`awayTeams`. The match's own `sportType` wins: a mixed feed
 *  (the All/Live list) carries one category per row, and only the football
 *  rows have a club page. */
export function attachMatchClubIds(match: Match | undefined, sportType?: number): void {
  if (!match) return;
  const sport = match.sportType || sportType;
  if (sport !== FOOTBALL) return;
  attachClubId(match.home, sport);
  attachClubId(match.away, sport);
  for (const team of match.homeTeams ?? []) attachClubId(team, sport);
  for (const team of match.awayTeams ?? []) attachClubId(team, sport);
}

/** A list of matches — a feed page, a competition's fixtures, a team's recent
 *  results. */
export function attachMatchListClubIds(matches: readonly Match[] | undefined, sportType?: number): void {
  for (const match of matches ?? []) attachMatchClubIds(match, sportType);
}

/** Standalone teams — a standings row, a top-scorer row, both of which point at
 *  their club through an id the payload resolved into a `Team` of its own. */
export function attachTeamClubIds(
  teams: Iterable<Team | undefined> | undefined,
  sportType?: number
): void {
  if (!teams) return;
  for (const team of teams) attachClubId(team, sportType);
}
