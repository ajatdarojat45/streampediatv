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
 */
import {
  goalooClubScheduleUrl,
  goalooClubTransfersUrl,
  goalooClubUrl,
  goalooCompetitionLogoUrl,
  goalooTeamLogoUrl,
  goalooPlayerPhotoUrl,
  parseGoalooKickoff,
} from './goaloo';
import { joinStreamIds, rblinkLeagueIdForCompetition, type GoalooFixtureRef } from './goalooJoin';
import type {
  GoalooClub,
  GoalooClubPerson,
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

/** One row of the schedule ajax (`MatchList`), whose fields are named and
 *  string-typed. `State` `"0"` is the feed's own "not played yet". */
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
  return {
    matchId,
    kickoff,
    leagueId,
    competition: competitions.get(leagueId) || '',
    color: '',
    home: { id: toNum(raw.HomeID), name: home },
    away: { id: toNum(raw.AwayID), name: away },
    score: null,
    streamId: 0,
  };
}

/** One transfer row: the counterpart club and the type come from the feed, the
 *  fee stays as published ("" when it is "-" or absent). */
function transferOf(raw: Record<string, unknown>): GoalooTransfer | null {
  const playerId = toNum(raw.playerId);
  const playerName = str(raw.playerName);
  if (!playerId || !playerName) return null;
  const fee = str(raw.money);
  return {
    playerId,
    playerName,
    photo: goalooPlayerPhotoUrl(str(raw.playerPic)),
    clubId: toNum(raw.teamId),
    fee: fee === '-' ? '' : fee,
    date: str(raw.time),
    type: transferTypeLabel(toNum(raw.type)),
    joined: raw.isJoined === true,
  };
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
    competitions,
    results,
    fixtures,
    transferYears,
    transfers,
    updatedAt: str(json.teamLastUpdateTime),
  };
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


