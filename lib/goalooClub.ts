/**
 * The club feed behind `/club/[id]` — `/jsdata/teamInfo/teamdetail/json/
 * tdl<id>_en.json`, its schedule ajax and its transfer ajax.
 *
 * Everything here is POSITIONAL, exactly like the competition feed in
 * lib/goaloo.ts: a person is `[id, shirt, name, …, photo, …]`, the squad is
 * published as four bucket lists (vanguard/midfielder/rearguard/goalkeeper)
 * whose own labels the page reuses, and a match row is
 * `[matchId, homeId, awayId, kickoff, compId, compShort, colour, home, away,
 * score, …]`. Field numbers that the page host reads in its own bundle were
 * taken from that bundle rather than guessed — the club page's `TeamInfo` is
 * `[id, name, logo, city, stadium, capacity, founded, value, avgAge, compId,
 * compName, compLogo]`, which is why "City" sits at index 3 and the stadium at
 * 4. Every read below is guarded, so an unexpected row is skipped instead of
 * corrupting the page, and a field the feed leaves empty stays empty rather
 * than being replaced with a plausible-looking number.
 *
 * Kickoff stamps are the publisher's clock (UTC+8) and are converted to epoch
 * ms through the shared helper in lib/goaloo.ts. Match rows are then handed to
 * lib/goalooJoin.ts, which is the only place allowed to decide which of them
 * the stream catalogue also knows about.
 *
 * The page's five panels read that same feed family: the club payload below
 * opens it, the Schedule panel fetches one page of the schedule ajax (ten rows,
 * optionally narrowed to one competition), the Transfers panel fetches one of
 * the years `TransferSeason` lists, and the Line up panel renders the squad this
 * payload already carries. Only the Standing and Player data panels read
 * somewhere else — the app's own league endpoints, because the Goaloo host
 * publishes no league table and no per-player totals per competition (see
 * app/club/[id]/page.tsx). No panel fetches anything the visitor has not opened.
 */
import {
  goalooClubSchedulePageUrl,
  goalooClubScheduleUrl,
  goalooClubTransfersUrl,
  goalooClubUrl,
  goalooCompetitionLogoUrl,
  goalooTeamLogoUrl,
  goalooPlayerPhotoUrl,
  parseGoalooKickoff,
} from './goaloo';
import { findCompetition } from './competitions';
import { goalooClubName } from './goalooTeams';
import { joinStreamIds, rblinkLeagueIdForCompetition, type GoalooFixtureRef } from './goalooJoin';
import type {
  GoalooClub,
  GoalooClubHonour,
  GoalooClubPerson,
  GoalooClubSchedulePage,
  GoalooMatchRef,
  GoalooTransfer,
} from './types';

/** The feed republishes a club's squad and schedule a few times a day; five
 *  minutes keeps a page view off the upstream almost always. */
const REVALIDATE = 300;

/** How much of the club's history the page renders (the feed ships all 300+
 *  rows of it in the same payload). */
export const CLUB_RESULTS = 12;
/** How many upcoming fixtures the page renders. */
export const CLUB_FIXTURES = 12;

const row = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** The feed's squad buckets, with the labels the feed itself uses. `rank` is
 *  the publisher's own order (striker → goalkeeper). */
const BUCKETS = [
  { key: 'vanguard', rank: 1, label: 'Striker' },
  { key: 'midfielder', rank: 2, label: 'Midfielder' },
  { key: 'rearguard', rank: 3, label: 'Defender' },
  { key: 'goalkeeper', rank: 4, label: 'Goalkeeper' },
] as const;

/** Photo paths the feed publishes per bucket row (`[id, shirt, name, …, path]`). */
interface BucketEntry {
  rank: number;
  label: string;
  photo: string;
}

/** Fetch one feed document. A failure is `null` — never a thrown page. */
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The feed's clock, in both spellings it ships: the club payload writes
 *  `"2026-10-11 16:30"`, the schedule ajax `"2027/6/5 20:00:00"`. */
function kickoffAt(value: unknown): number {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(str(value));
  if (!m) return 0;
  const pad = (s: string): string => s.padStart(2, '0');
  return parseGoalooKickoff(`${m[1]}-${pad(m[2])}-${pad(m[3])} ${pad(m[4])}:${m[5]}`) ?? 0;
}

/** Clock or numeric field that the ajax spells as a string ("3063120"). */
function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number.parseFloat(str(v));
  return Number.isFinite(n) ? n : 0;
}

/** Reading order of the squad: the feed buckets by striker → goalkeeper, while
 *  a team sheet reads the other way round. 0 = the bucket it did not list. */
const ORDER = [4, 3, 2, 1, 0];
const orderOf = (rank: number): number => {
  const i = ORDER.indexOf(rank);
  return i === -1 ? ORDER.length : i;
};

/** One squad member, from a `lineupDetail` row — the only row carrying a birth
 *  date, a country and a valuation. The bucket it was also listed under is what
 *  supplies the feed's own position label and the photo. */
function personOf(
  raw: unknown[],
  buckets: Map<number, BucketEntry>
): GoalooClubPerson | null {
  const id = num(raw[0]);
  const name = str(raw[2]);
  if (!id || !name) return null;
  const bucket = buckets.get(id);
  return {
    id,
    name,
    number: str(raw[1]),
    photo: goalooPlayerPhotoUrl(bucket?.photo || ''),
    country: str(raw[8]),
    // A player the feed did not bucket still publishes his own position
    // ("Left Winger"); a row with neither stays empty rather than being
    // labelled by guesswork.
    position: bucket?.label || str(raw[7]),
    positionRank: bucket?.rank ?? 0,
    dateOfBirth: str(raw[4]),
    marketValue: str(raw[9]),
    contract: str(raw[10]),
  };
}

/** One match row of the club's own history — positional, guarded, and only
 *  given a score when the feed published both halves of it. */
function historyMatchOf(raw: unknown[]): GoalooMatchRef | null {
  const matchId = num(raw[0]);
  const kickoff = kickoffAt(raw[3]);
  const home = str(raw[7]);
  const away = str(raw[8]);
  if (!matchId || !kickoff || !home || !away) return null;
  const hs = raw[9];
  const as = raw[10];
  const played = typeof hs === 'number' && typeof as === 'number' && hs >= 0 && as >= 0;
  return {
    matchId,
    kickoff,
    leagueId: num(raw[4]),
    competition: str(raw[5]),
    color: str(raw[6]),
    home: { id: num(raw[1]), name: home },
    away: { id: num(raw[2]), name: away },
    score: played ? { home: hs as number, away: as as number } : null,
    streamId: 0,
  };
}

/** The feed's own name for a competition id: the schedule ajax's `SclassList`
 *  when that call carried it, otherwise the static catalogue, which knows every
 *  competition the publisher lists. "" when neither does. */
function competitionNameOf(id: number, known: Map<number, string>): string {
  const name = known.get(id);
  if (name) return name;
  const comp = findCompetition(`s${id}`) || findCompetition(`c${id}`);
  return comp?.name ?? '';
}

/** One row of the schedule ajax (`MatchList`), whose fields are named and
 *  string-typed. `State` `"0"` is the feed's own "not played yet", `"-1"` a
 *  played match — whose score the feed publishes with it — and anything above
 *  zero is in play; the same reading lib/goaloo.ts applies to the competition
 *  feed. A row the feed lists for a competition outside the club's `SclassList`
 *  (an older season's cup, say) still gets its name, from the catalogue. */
function fixtureOf(
  raw: Record<string, unknown>,
  competitions: Map<number, string>
): GoalooMatchRef | null {
  const matchId = toNum(raw.ID);
  const kickoff = kickoffAt(raw.Time);
  const home = str(raw.HomeName);
  const away = str(raw.AwayName);
  if (!matchId || !kickoff || !home || !away) return null;
  const leagueId = toNum(raw.SclassID);
  // A fixture carries no score. A played one carries the two halves the feed
  // published — and only when it published both, so an unpublished score is
  // never rendered as a 0–0.
  const homeScore = str(raw.HomeScore);
  const awayScore = str(raw.AwayScore);
  const played = toNum(raw.State) !== 0 && homeScore !== '' && awayScore !== '';
  return {
    matchId,
    kickoff,
    leagueId,
    competition: competitionNameOf(leagueId, competitions),
    color: '',
    home: { id: toNum(raw.HomeID), name: home },
    away: { id: toNum(raw.AwayID), name: away },
    score: played ? { home: toNum(homeScore), away: toNum(awayScore) } : null,
    streamId: 0,
  };
}

/** One transfer row: the counterpart club and the type come from the feed, the
 *  fee stays as published ("" when it is "-" or absent). The counterpart club's
 *  NAME comes from the club index (lib/goalooTeams), because the feed ships that
 *  club as an id and nothing else. */
function transferOf(raw: Record<string, unknown>): GoalooTransfer | null {
  const playerId = toNum(raw.playerId);
  const playerName = str(raw.playerName);
  if (!playerId || !playerName) return null;
  const fee = str(raw.money);
  const clubId = toNum(raw.teamId);
  return {
    playerId,
    playerName,
    photo: goalooPlayerPhotoUrl(str(raw.playerPic)),
    clubId,
    clubName: goalooClubName(clubId),
    fee: fee === '-' ? '' : fee,
    date: str(raw.time),
    type: transferTypeLabel(toNum(raw.type)),
    joined: raw.isJoined === true,
  };
}

/** The club's honours board (`TeamHonor`): `[title, years, trophyId]`. The title
 *  and the season list are published strings; the third field is the publisher's
 *  own trophy id, which nothing in this app can resolve to an image, so it is
 *  not read. A row without a title is skipped. */
function honoursOf(raw: unknown): GoalooClubHonour[] {
  const out: GoalooClubHonour[] = [];
  for (const entry of row(raw)) {
    const fields = row(entry);
    const title = str(fields[0]);
    if (title) out.push({ title, years: str(fields[1]) });
  }
  return out;
}

/** The feed's transfer-type codes, in the site's own wording. */
export function transferTypeLabel(code: number): string {
  switch (code) {
    case 1: return 'Wholly Owned';
    case 2: return 'Loan';
    case 3: return 'Free Transfer';
    case 4: return 'End of loan';
    case 5: return 'Jointly Owned';
    default: return '';
  }
}

/** Shape of the schedule ajax — the fields the page actually reads. */
interface SchedulePayload {
  MatchList?: Record<string, unknown>[];
  SclassList?: { ID?: string; Name?: string }[];
  TotalPages?: number;
  PlayingPage?: number;
}

/**
 * One club, ready for the page: identity, squad, the club's own competition,
 * recent results, upcoming fixtures and the newest transfer window — with every
 * match row carrying the Rblink matchId it was joined to (0 when the stream
 * catalogue does not know the fixture).
 *
 * `null` for an id the feed does not answer (`/club/1` is not a page), so the
 * route can 404 instead of rendering an empty shell.
 */
export async function getGoalooClub(id: string | number): Promise<GoalooClub | null> {
  const teamId = Math.trunc(Number(id));
  if (!Number.isInteger(teamId) || teamId <= 0) return null;

  const json = await getJson<Record<string, unknown>>(goalooClubUrl(teamId));
  if (!json) return null;

  // TeamInfo: [id, name, logo, city, stadium, capacity, founded, value, avgAge,
  //            compId, compName, compLogo] — the page host's own numbering.
  const info = row(json.TeamInfo);
  const clubId = num(info[0]);
  const name = str(info[1]);
  if (!clubId || !name) return null;

  const buckets = new Map<number, BucketEntry>();
  for (const bucket of BUCKETS) {
    for (const raw of row(json[bucket.key])) {
      const bucketId = num(row(raw)[0]);
      if (bucketId) {
        buckets.set(bucketId, { rank: bucket.rank, label: bucket.label, photo: str(row(raw)[4]) });
      }
    }
  }

  const detail = row(json.lineupDetail);
  const coachRow = row(json.coach)[0];
  const coachId = num(row(coachRow)[0]);

  /** The coach is published twice — in `coach` and as a `lineupDetail` row —
   *  so his details come from the richer row without landing in the squad. */
  const coachPerson = (): GoalooClubPerson | null => {
    if (!coachId) return null;
    const fromDetail = detail.find((r) => num(row(r)[0]) === coachId);
    const person = personOf(row(fromDetail ?? coachRow), buckets);
    return person ? { ...person, position: 'Coach', positionRank: 0 } : null;
  };

  const squad: GoalooClubPerson[] = [];
  for (const raw of detail) {
    const person = personOf(row(raw), buckets);
    if (person && person.id !== coachId) squad.push(person);
  }
  squad.sort(
    (a, b) =>
      orderOf(a.positionRank) - orderOf(b.positionRank) ||
      toNum(b.marketValue) - toNum(a.marketValue) ||
      toNum(a.number) - toNum(b.number) ||
      a.name.localeCompare(b.name)
  );

  const results: GoalooMatchRef[] = [];
  for (const raw of row(json.TeamCount)) {
    const match = historyMatchOf(row(raw));
    if (match) results.push(match);
  }
  results.sort((a, b) => b.kickoff - a.kickoff);

  const transferYears = row(json.TransferSeason)
    .map((y) => str(y))
    .filter((y) => y.length > 0);

  const [schedule, transferRows] = await Promise.all([
    getJson<SchedulePayload>(goalooClubScheduleUrl(teamId)),
    transferYears[0]
      ? getJson<Record<string, unknown>[]>(goalooClubTransfersUrl(teamId, transferYears[0]))
      : Promise.resolve(null),
  ]);

  const competitions = row(schedule?.SclassList).map((c) => {
    const entry = c as { ID?: unknown; Name?: unknown };
    return { id: toNum(entry.ID), name: str(entry.Name) };
  });
  const competitionNames = new Map(competitions.map((c) => [c.id, c.name]));

  const fixtures: GoalooMatchRef[] = [];
  for (const raw of row(schedule?.MatchList)) {
    const entry = raw as Record<string, unknown>;
    if (str(entry.State) !== '0') continue;
    const match = fixtureOf(entry, competitionNames);
    if (match) fixtures.push(match);
  }
  fixtures.sort((a, b) => a.kickoff - b.kickoff);

  const transfers: GoalooTransfer[] = [];
  for (const raw of row(transferRows)) {
    const transfer = transferOf(raw as Record<string, unknown>);
    if (transfer) transfers.push(transfer);
  }

  // One join for both lists: a result and a coming fixture of the same
  // competition are resolved from the SAME upstream fixture table.
  const streamIds = await joinStreamIds([
    ...results.map((m) => ref(m)),
    ...fixtures.map((m) => ref(m)),
  ]);
  for (const list of [results, fixtures]) {
    for (const match of list) match.streamId = streamIds.get(match.matchId) ?? 0;
  }

  return {
    id: clubId,
    name,
    logo: goalooTeamLogoUrl(str(info[2])),
    city: str(info[3]),
    stadium: str(info[4]),
    capacity: str(info[5]),
    founded: str(info[6]),
    marketValue: str(info[7]),
    avgAge: str(info[8]),
    leagueId: num(info[9]),
    leagueName: str(info[10]),
    leagueLogo: goalooCompetitionLogoUrl(str(info[11])),
    leagueStreamId: rblinkLeagueIdForCompetition(num(info[9])),
    coach: coachPerson(),
    squad,
    honours: honoursOf(json.TeamHonor),
    competitions,
    results,
    fixtures,
    transferYears,
    transfers,
    updatedAt: str(json.teamLastUpdateTime),
  };
}

/**
 * One page of a club's schedule — the Schedule panel's payload.
 *
 * The paged ajax is read with `init=0` (ten rows a page, newest first) instead
 * of the `init=1` first-page preview the club payload uses, so every page of the
 * panel holds the same number of rows. `sclassId` narrows the list to one of the
 * competitions the club plays in, and a page beyond the feed's own count lands
 * on the LAST page rather than on an empty list — the count is read from the
 * first answer, so only that edge case costs a second request.
 *
 * Rows carry the score of a played match (see `fixtureOf`) and are joined to the
 * stream catalogue exactly like the club payload's own fixtures. `null` when the
 * feed does not answer at all, so the panel can say so instead of rendering an
 * empty schedule.
 */
export async function getGoalooClubSchedule(
  teamId: string | number,
  page = 1,
  sclassId?: string | number
): Promise<GoalooClubSchedulePage | null> {
  const id = Math.trunc(Number(teamId));
  if (!Number.isInteger(id) || id <= 0) return null;

  const wanted = Math.max(1, Math.trunc(Number(page)) || 1);
  const comp = sclassId ? Math.trunc(Number(sclassId)) || 0 : 0;
  const first = await getJson<SchedulePayload>(goalooClubSchedulePageUrl(id, wanted, comp));
  if (!first) return null;

  const totalPages = Math.max(0, Math.trunc(toNum(first.TotalPages)));
  const at = totalPages > 0 ? Math.min(wanted, totalPages) : wanted;
  const payload =
    at === wanted
      ? first
      : (await getJson<SchedulePayload>(goalooClubSchedulePageUrl(id, at, comp))) ?? first;

  const names = new Map<number, string>();
  for (const entry of row(payload.SclassList)) {
    const item = entry as { ID?: unknown; Name?: unknown };
    const compId = toNum(item.ID);
    if (compId) names.set(compId, str(item.Name));
  }

  const matches: GoalooMatchRef[] = [];
  for (const raw of row(payload.MatchList)) {
    const match = fixtureOf(raw as Record<string, unknown>, names);
    if (match) matches.push(match);
  }

  // One page can span the club's league, both cups and a friendly, so the join
  // is allowed a few competitions (`joinStreamIds` asks about the busiest ones
  // only, one cached upstream call each).
  const streamIds = await joinStreamIds(matches.map(ref), { maxCompetitions: 5 });
  for (const match of matches) match.streamId = streamIds.get(match.matchId) ?? 0;

  return { matches, page: at, totalPages: totalPages || at };
}

/** The feed's transfer date (`dd-mm-yyyy`) → epoch ms; 0 when unreadable. */
function transferDateMs(date: string): number {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(date.trim());
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0;
}

/**
 * A club's transfers for one year, newest first — the Transfers panel's
 * payload. The feed publishes its own year list (`TransferSeason`, up to three
 * decades of them) and that list is what the panel's dropdown offers; one of
 * those years is read here at a time, because the ajax serves one year per
 * request.
 *
 * Arrivals and departures arrive in the SAME list, told apart by `isJoined` —
 * exactly how the panel splits them into its two sub-tabs. An empty list means
 * the feed published no transfer for that year (or did not answer), never a
 * failure of the page.
 */
export async function getGoalooClubTransfers(
  teamId: string | number,
  year: string | number
): Promise<GoalooTransfer[]> {
  const id = Math.trunc(Number(teamId));
  const wanted = Math.trunc(Number(year));
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(wanted) || wanted <= 0) return [];

  const rows = await getJson<Record<string, unknown>[]>(goalooClubTransfersUrl(id, wanted));
  const out: GoalooTransfer[] = [];
  for (const raw of row(rows)) {
    const transfer = transferOf(raw as Record<string, unknown>);
    if (transfer) out.push(transfer);
  }

  // The published date is the panel's sort key. A row whose date the feed did
  // not publish keeps the feed's own order, after every dated row.
  return out
    .map((transfer, index) => ({ transfer, index, at: transferDateMs(transfer.date) }))
    .sort((a, b) => b.at - a.at || a.index - b.index)
    .map((entry) => entry.transfer);
}

/** The join's input for one match row. */
function ref(m: GoalooMatchRef): GoalooFixtureRef {
  return {
    matchId: m.matchId,
    leagueId: m.leagueId,
    kickoff: m.kickoff,
    home: m.home.name,
    away: m.away.name,
  };
}


