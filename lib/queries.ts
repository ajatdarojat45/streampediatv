import { keepPreviousData, useQuery, useMutation } from '@tanstack/react-query';
import { getMatches, getMatchDetail, getMatchAnalysis, getMatchLineup, getMatchEvent, getMatchStatistic, getStreamUrl, getAllLiveMatches, getLeagueDetail, getLeagueMatches, getLeagueSeasons, getLeagueStandings, getLeaguePlayerTotals } from '@/app/actions';

/** Never auto-retry a rate-limit (HTTP 429): re-hitting immediately makes the
 * upstream limiter angrier and starves the UI. Other errors get one retry. */
const isRateLimited = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('429');

/** Single-sport list = ONE upstream request per poll, so it can refresh briskly.
 * 30s (was 45s): only one sport is fetched, so this is cheap and keeps the
 * focused view feeling live. A little jitter de-syncs multiple tabs. */
const singlePollInterval = (): number => 30_000 + Math.floor(Math.random() * 4_000);

const SINGLE_POLL = {
  staleTime: 20_000,
  refetchInterval: singlePollInterval,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** Aggregate "All/Live" fans out to every sport (16 upstream requests per
 * poll). Poll it much slower (75s, was 45s) so that burst lands roughly half
 * as often — this is the dominant upstream cost and the main HTTP 429 driver.
 * Live scores still refresh well within ~1.5 min. refetchOnWindowFocus /
 * Reconnect stay OFF: TanStack defaults them to true, so alt-tabbing back
 * would trigger a 16-sport fan-out per focus. */
const allLivePollInterval = (): number => 75_000 + Math.floor(Math.random() * 8_000);

const ALL_LIVE_POLL = {
  staleTime: 30_000,
  refetchInterval: allLivePollInterval,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** Bounded retry. A 429 gets a short self-healing window (2 retries) so a
 * category switch rides out a transient limiter window instead of failing and
 * forcing a manual Refresh; a regular error gets at most one retry. The
 * previous `!isRateLimited(error) || failureCount < 1` was wrong for non-429
 * errors (it returned `true` forever → infinite retry → the list stayed blank).
 * getAllLiveMatches is resilient (skips failed sports, returns ok with partial
 * data) so the fan-out never throws and never retries the whole 16-sport burst;
 * only cheap single-sport/detail requests retry, so this can't re-amplify. */
const retryPolicy = (failureCount: number, error: unknown): boolean =>
  isRateLimited(error) ? failureCount < 2 : failureCount < 1;

/** Exponential backoff, capped. A 429 needs real wall-clock time to clear, so
 * start it at 2s; other errors at 1s. Cap at 10s so a transient failure never
 * strands the UI for too long. */
const retryDelay = (attemptIndex: number, error: unknown): number =>
  Math.min((isRateLimited(error) ? 2000 : 1000) * 2 ** attemptIndex, 10_000);

/** Match list for the currently-selected category, as a SINGLE always-enabled
 * query whose key mirrors the active sport. sportType 0 = "All/Live" (fans out
 * to every sport), any other value = that one sport.
 *
 * Why one query instead of gating two with `enabled`: in React Query v5 a
 * query that mounts while `enabled: false` does not adopt/run a newly-changed
 * queryKey until it is refetched manually. The old
 * `useMatches(..., !isLive)` + `useAllLiveMatches(isLive)` pair therefore left
 * the freshly-selected category stuck in `pending` with no fetch — data only
 * appeared after clicking Refresh. A single always-enabled query fetches on
 * every key change immediately, and `placeholderData: keepPreviousData` keeps
 * the previous category visible (no blank flash) while the new one loads. */
export function useSportMatches(sportType: number) {
  const isAllLive = sportType === 0;
  return useQuery({
    queryKey: isAllLive ? ['live-matches'] : ['matches', 'data', sportType],
    queryFn: async () => {
      const res = isAllLive
        ? await getAllLiveMatches()
        : await getMatches({ source: 'data', sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    placeholderData: keepPreviousData,
    retry: retryPolicy,
    retryDelay,
    ...(isAllLive ? ALL_LIVE_POLL : SINGLE_POLL),
  });
}

/** Match detail, cached by (matchId, sportType). No background polling: the
 * detail page is read-then-play, and re-hitting the rate-limited endpoint on
 * every window focus is exactly what triggers HTTP 429. Keep data fresh for
 * 30s and disable focus/reconnect refetch (TanStack defaults these to true). */
const DETAIL_POLL = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

/** Match detail, cached by (matchId, sportType). */
export function useMatchDetail(matchId: string | number, sportType?: number) {
  return useQuery({
    queryKey: ['match', matchId, sportType],
    queryFn: async () => {
      const res = await getMatchDetail({ matchId, sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(matchId),
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Head-to-head / match analysis for a detail page. No background polling:
 *  the detail page is read-then-play and the analysis endpoint is rate-limited. */
export function useMatchAnalysis(matchId: string | number, sportType?: number) {
  return useQuery({
    queryKey: ['match-analysis', matchId, sportType],
    queryFn: async () => {
      const res = await getMatchAnalysis({ matchId, sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(matchId) && Number(sportType) > 0,
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Match lineup for a detail page. No background polling (see useMatchAnalysis). */
export function useMatchLineup(matchId: string | number, sportType?: number) {
  return useQuery({
    queryKey: ['match-lineup', matchId, sportType],
    queryFn: async () => {
      const res = await getMatchLineup({ matchId, sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(matchId) && Number(sportType) > 0,
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Match events (goals, cards, substitutions) for a detail page. No background
 *  polling (see useMatchAnalysis). */
export function useMatchEvent(matchId: string | number, sportType?: number) {
  return useQuery({
    queryKey: ['match-event', matchId, sportType],
    queryFn: async () => {
      const res = await getMatchEvent({ matchId, sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(matchId) && Number(sportType) > 0,
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Match statistics (possession, shots, cards, …) for a detail page. No
 *  background polling (see useMatchAnalysis). */
export function useMatchStatistic(matchId: string | number, sportType?: number) {
  return useQuery({
    queryKey: ['match-statistic', matchId, sportType],
    queryFn: async () => {
      const res = await getMatchStatistic({ matchId, sportType, language: 0 });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(matchId) && Number(sportType) > 0,
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

export interface StreamUrlInput {
  matchId: string | number;
  streamId: number;
  sportType?: number;
  siteType?: number;
  continent?: string;
  country?: string;
}

/** Stream URL is ephemeral (signed), so it is fetched on demand (not cached). */
export function useStreamUrl() {
  return useMutation({
    mutationFn: async (input: StreamUrlInput) => {
      const res = await getStreamUrl(input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });
}

/* ---------- competition (league) family ----------
 * Same shape as the match-detail hooks above: read-then-leave pages, so no
 * background polling — the /api/league/* endpoints share the rate-limited
 * DT_LEAGUE budget and a competition page opens four of them at once. */

export interface LeagueInput {
  leagueId: string | number;
  sportType?: number;
  /** Omit for the competition's current season. */
  seasonId?: number | string;
  /** Gate the request (e.g. only the visible tab fetches) — defaults to on. */
  enabled?: boolean;
}

/** Common gate: a valid id + sport, plus the caller's own switch. */
const leagueReady = (leagueId: string | number, sportType: number | undefined, on?: boolean): boolean =>
  (on ?? true) && Boolean(leagueId) && Number(sportType) > 0;

/** Competition header: name, crest, country, season and aggregate stats. */
export function useLeagueDetail({ leagueId, sportType, seasonId, enabled }: LeagueInput) {
  return useQuery({
    queryKey: ['league', leagueId, sportType, seasonId ?? 0],
    queryFn: async () => {
      const res = await getLeagueDetail({ leagueId, sportType, language: 0, seasonId });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: leagueReady(leagueId, sportType, enabled),
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Competition fixtures (grouped by stage/round on the page). */
export function useLeagueMatches({ leagueId, sportType, seasonId, enabled }: LeagueInput) {
  return useQuery({
    queryKey: ['league-matches', leagueId, sportType, seasonId ?? 0],
    queryFn: async () => {
      const res = await getLeagueMatches({ leagueId, sportType, language: 0, seasonId });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: leagueReady(leagueId, sportType, enabled),
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Competition seasons, newest first (season picker). */
export function useLeagueSeasons({ leagueId, sportType, enabled }: LeagueInput) {
  return useQuery({
    queryKey: ['league-seasons', leagueId, sportType],
    queryFn: async () => {
      const res = await getLeagueSeasons({ leagueId, sportType });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: leagueReady(leagueId, sportType, enabled),
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Competition standings table. */
export function useLeagueStandings({ leagueId, sportType, seasonId, enabled }: LeagueInput) {
  return useQuery({
    queryKey: ['league-standings', leagueId, sportType, seasonId ?? 0],
    queryFn: async () => {
      const res = await getLeagueStandings({ leagueId, sportType, language: 0, seasonId });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: leagueReady(leagueId, sportType, enabled),
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}

/** Competition player statistics (top scorers, assists, cards). The payload is
 *  the heaviest of the league family, so it is gated on the Statistics tab. */
export function useLeaguePlayerTotals({ leagueId, sportType, seasonId, enabled }: LeagueInput) {
  return useQuery({
    queryKey: ['league-player-totals', leagueId, sportType, seasonId ?? 0],
    queryFn: async () => {
      const res = await getLeaguePlayerTotals({ leagueId, sportType, language: 0, seasonId });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: leagueReady(leagueId, sportType, enabled),
    retry: retryPolicy,
    retryDelay,
    ...DETAIL_POLL,
  });
}
