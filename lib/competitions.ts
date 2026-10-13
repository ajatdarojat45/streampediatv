// Competition directory model — pure helpers shared by the server action that
// builds the directory (app/actions.ts → getCompetitions) and the component
// that renders it (components/CompetitionsDirectory).
//
// Why derived instead of fetched: the upstream API exposes a competition only
// per id (`/api/league/*` — detail, fixtures, seasons, standings, player totals),
// there is NO "list leagues" endpoint. Every match, however, carries its
// competition (PBDataLeague → 1=leagueId, 3=name, 4=logo, 80=country, 90=hot),
// so folding one sport's match feed yields every competition playing right now —
// which is exactly the entry point a competition page needs.

import { matchDateMs } from './datetime';
import { isLiveStatus } from './matchProto';
import type { Match } from './types';

/** One row of the competition directory (`/competitions`). */
export interface CompetitionEntry {
  leagueId: number;
  name: string;
  logo?: string;
  country?: string;
  /** PBSportType of the competition; 0 when the feed carried none. */
  sportType: number;
  /** Trending flag from the feed (PBDataLeague field 90). */
  hot: boolean;
  liveCount: number;
  upcomingCount: number;
  finishedCount: number;
  totalCount: number;
  /** Earliest kick-off still ahead of the collection instant. */
  nextKickoffMs?: number;
  /** Latest kick-off already played. */
  lastKickoffMs?: number;
  /** Row that comes from the server's "seen leagues" registry instead of the
   *  current feed: identity only, no fixtures to count (see getCompetitions). */
  stale?: boolean;
}

/** Status bucket of a match — the same rule the match lists use (live →
 *  upcoming → finished), so a directory row never disagrees with the list it
 *  was folded from. */
function bucketOf(m: Match): 'live' | 'upcoming' | 'finished' {
  if (isLiveStatus(m.status)) return 'live';
  if (!m.status) return 'upcoming';
  return 'finished';
}

/** Fold a match list into one entry per competition, aggregating the numbers a
 *  directory card shows (live / upcoming / finished counts plus the next and
 *  last kick-off). Matches without a league id are skipped — nothing to link. */
export function collectCompetitions(matches: Match[], now: number = Date.now()): CompetitionEntry[] {
  const map = new Map<number, CompetitionEntry>();
  for (const m of matches) {
    const league = m.league;
    const leagueId = league?.leagueId;
    if (leagueId === undefined || leagueId === null) continue;
    let e = map.get(leagueId);
    if (!e) {
      e = {
        leagueId,
        name: league?.name || m.name || m.title || `Competition ${leagueId}`,
        logo: league?.logo,
        country: league?.country,
        sportType: league?.sportType ?? m.sportType ?? 0,
        hot: Boolean(league?.hot),
        liveCount: 0,
        upcomingCount: 0,
        finishedCount: 0,
        totalCount: 0,
      };
      map.set(leagueId, e);
    }
    // First non-empty value wins: every match of a competition carries the same
    // identity, but a sparse row must never blank a value another row supplied.
    if (!e.logo && league?.logo) e.logo = league.logo;
    if (!e.country && league?.country) e.country = league.country;
    if (!e.sportType && (league?.sportType ?? m.sportType)) {
      e.sportType = (league?.sportType ?? m.sportType) as number;
    }
    if (!e.hot && league?.hot) e.hot = true;
    const bucket = bucketOf(m);
    if (bucket === 'live') e.liveCount += 1;
    else if (bucket === 'upcoming') e.upcomingCount += 1;
    else e.finishedCount += 1;
    e.totalCount += 1;
    const ms = matchDateMs(m.matchDate);
    if (ms !== null) {
      if (ms >= now) e.nextKickoffMs = e.nextKickoffMs === undefined ? ms : Math.min(e.nextKickoffMs, ms);
      else e.lastKickoffMs = e.lastKickoffMs === undefined ? ms : Math.max(e.lastKickoffMs, ms);
    }
  }
  return sortCompetitions([...map.values()]);
}

/** Directory order: rows with fixtures first (trending → on air → busiest feed),
 *  registry-only rows last, ties broken by name. */
export function sortCompetitions(entries: CompetitionEntry[]): CompetitionEntry[] {
  return [...entries].sort((a, b) => {
    if (Boolean(a.stale) !== Boolean(b.stale)) return a.stale ? 1 : -1;
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    if ((a.liveCount > 0) !== (b.liveCount > 0)) return a.liveCount > 0 ? -1 : 1;
    if (a.liveCount !== b.liveCount) return b.liveCount - a.liveCount;
    if (a.totalCount !== b.totalCount) return b.totalCount - a.totalCount;
    return a.name.localeCompare(b.name);
  });
}

/** Merge fresh rows with the registry's older rows — fresh data wins per id. */
export function mergeCompetitions(
  fresh: CompetitionEntry[],
  seen: CompetitionEntry[]
): CompetitionEntry[] {
  const byId = new Map<number, CompetitionEntry>();
  for (const e of seen) byId.set(e.leagueId, e);
  for (const e of fresh) byId.set(e.leagueId, e);
  return sortCompetitions([...byId.values()]);
}

