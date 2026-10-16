import { getMatchDetail, getMatches } from '@/app/actions';
import type { Match, MatchStreamView, NowgoalMatchHeader } from '@/lib/types';

/* The live player's own match behind a publisher match — what `/matches/[id]`
 * offers as that match's streaming link.
 *
 * The two feeds number their matches in their own spaces: 3003849 is
 * Arsenal-Coventry on the publisher's side and a Korean fixture of 2015 on the
 * player's, so the match behind a page is found by what it *is* rather than by
 * id — both sides' names, which are spelled identically in the two feeds
 * ("Sydney FC", "Western Sydney", "PSIM Yogyakarta") because they read the same
 * underlying schedule. A pairing that cannot be made is not an error: the page
 * simply has no stream to offer for that match.
 *
 * The kick-off stamps are deliberately *not* used to pair them. The two feeds
 * stamp the same fixtures under different conventions: the player writes the
 * nominal kick-off (`2026-10-16T09:00:00Z` for Sydney FC-Western Sydney), while
 * the publisher's own detail page writes that same nominal time and labels it
 * GMT+8 (`doorTime = '09:10:00.000+08:00'`, `startDate = '2026-10-16'`), so the
 * page's stamp — which the app takes the label at its word on — sits a fixed
 * offset from the player's rather than beside it. The sides alone carry the
 * pairing, and the day's list holds one fixture per pairing; a stamp is only
 * used to pick between candidates when a list happens to carry several.
 *
 * What it costs: one read of the sport's live list — the same payload the live
 * pages poll, so it is usually already warm in the action's own cache — plus,
 * for a match that list carries, one read of that match's own detail for its
 * channel names. The second read is kept for a minute (a page's channels change
 * far more slowly than its visitors arrive), and a match that has finished costs
 * nothing at all: its stream is over, and its page shows the publisher's
 * highlight instead. */

/** Football — the only sport the publisher's own match pages cover. */
const SPORT_TYPE = 1;
/** A channel list is kept this long: a live match's page is rendered far more
 *  often than its channels change, and the player's own request limit is better
 *  spent on the lists the directory polls. */
const CHANNEL_TTL_MS = 60_000;

/** Words a side's name may carry on one feed and not the other: the articles and
 *  prepositions (`Atlético de Rafaela` / `Atletico Rafaela`) and the club shapes
 *  that get written both ways (`Bengaluru FC` / `Bengaluru`). */
const NOISE = new Set([
  'ac', 'afc', 'bk', 'ca', 'cd', 'cf', 'club', 'da', 'de', 'del', 'do', 'fc',
  'fk', 'if', 'ik', 'sc', 'sk', 'sv', 'the',
]);

/** A side's name reduced to the words the two feeds can be compared on: case
 *  folded, accents stripped, punctuation and the shapes above dropped. */
function nameKey(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !NOISE.has(word));
}

/** Is one feed's name for a side the other's? Word for word, or one of them
 *  spelled out further than the other (`Western Sydney` → `Western Sydney
 *  Wanderers`) — the slack a pairing needs, given that both sides have to
 *  agree. */
function sameSide(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!shorter.every((word, index) => word === longer[index])) return false;
  // A lone word stands for a side only when it is a name in its own right.
  return shorter.length > 1 || shorter[0].length >= 3;
}

/** How far apart two kick-off stamps are, `0` when either side omits one. The
 *  two conventions above make the number meaningless as a test of identity, so
 *  it is only ever used to order the candidates of one pairing. */
function kickoffGap(a: number | null | undefined, b: number | null | undefined): number {
  return a && b ? Math.abs(a - b) : 0;
}

/** The player's own row for a publisher match, or `null` when its list does not
 *  carry the fixture (it covers the day's fixtures only) or carries it under
 *  sides spelled too differently to be paired. The sides carry the pairing (see
 *  the note above); the kick-off only settles a list that carries the pairing
 *  twice. */
export function findPlayerMatch(rows: Match[], header: NowgoalMatchHeader): Match | null {
  const home = nameKey(header.home.name);
  const away = nameKey(header.away.name);
  if (!home.length || !away.length) return null;
  let found: Match | null = null;
  let gap = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const rowHome = row.home?.name ?? '';
    const rowAway = row.away?.name ?? '';
    if (!rowHome || !rowAway) continue;
    if (!sameSide(home, nameKey(rowHome)) || !sameSide(away, nameKey(rowAway))) continue;
    const next = kickoffGap(header.kickoffMs, row.matchDate);
    if (next < gap) {
      found = row;
      gap = next;
    }
  }
  return found;
}

/** One match's channel names, as the player publishes them for it — the same
 *  list, in the same words, that the player's own page offers. The channels are
 *  filtered on the player's own "playable" code rather than on `isPlayable`:
 *  the detail payload carries each channel's `streamStatus` but no URL at all
 *  (the URL is resolved for the one channel a viewer picks, see `getStreamUrl`),
 *  so `isPlayable` would empty the list. */
async function readChannels(match: Match): Promise<MatchStreamView> {
  const matchId = match.matchId ?? 0;
  const sportType = match.sportType ?? SPORT_TYPE;
  const read = await getMatchDetail({ matchId, sportType });
  const offered = read.ok ? read.data.streams ?? read.data.channels ?? [] : [];
  const seen = new Set<string>();
  const channels: string[] = [];
  for (const [index, channel] of offered.entries()) {
    if ((channel.streamStatus ?? channel.status) !== 1) continue;
    const label =
      channel.fullName || channel.name || `Channel #${channel.streamId ?? channel.channelId ?? index + 1}`;
    // The payload can list one broadcaster twice, once per site it serves it
    // from; a pill is only worth drawing once.
    if (seen.has(label)) continue;
    seen.add(label);
    channels.push(label);
  }
  return {
    matchId,
    sportType,
    competition: match.league?.name ?? '',
    status: match.status,
    channels,
  };
}

/** The channel lists in flight, so two visitors of the same match share one read
 *  rather than queueing two behind the player's own throttle. */
const channelCache = new Map<string, { at: number; value: MatchStreamView }>();
const channelReads = new Map<string, Promise<MatchStreamView>>();

/** The player's own view of a publisher match: the channels it is offered with,
 *  the competition it files it under and the state it publishes for it. `null`
 *  when the player does not carry the match at all, or when the match has
 *  finished — a stream that is over is nothing to link to, and the page shows
 *  the publisher's highlight in its place. */
export async function getMatchStream(header: NowgoalMatchHeader): Promise<MatchStreamView | null> {
  // The publisher's own state field: `-1` finished, `-10`…`-14` cancelled,
  // pending, abandoned, paused, postponed. None of them is streaming.
  if (header.stateCode < 0) return null;

  const list = await getMatches({ sportType: SPORT_TYPE });
  if (!list.ok) return null;
  const match = findPlayerMatch(list.data.list, header);
  if (!match?.matchId) return null;

  const key = String(match.matchId);
  const cached = channelCache.get(key);
  if (cached && Date.now() - cached.at < CHANNEL_TTL_MS) return cached.value;
  const inFlight = channelReads.get(key);
  if (inFlight) return inFlight;

  const read = readChannels(match)
    .then((value) => {
      channelCache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => channelReads.delete(key));
  channelReads.set(key, read);
  return read;
}
