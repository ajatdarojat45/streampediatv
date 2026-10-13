import { md5 } from './md5';
import { parsePBResponse, extractPayload, parseBodySignatures } from './proto';
import { DATA_API, LIVE_API, RB_HEADERS } from './constants';

export interface RawResponse {
  status: number;
  bytes: Uint8Array;
  headers: Headers;
}

export interface ProtobufResponse {
  status: number;
  url: string;
  pb: ReturnType<typeof parsePBResponse>;
  payload: Uint8Array;
  rawSize: number;
}

/* ---------- Global outbound throttle ----------
 * Every control-plane upstream request funnels through fetchRaw. This
 * scheduler bounds upstream load two ways so the rate limiter never trips:
 *   1. a minimum gap between request STARTS (≈3.3 req/s) — the limiter trips
 *      at ~6.6 req/s, so this keeps steady-state comfortably under it;
 *   2. a small concurrency cap (3) so a burst (getAllLiveMatches across 16
 *      sports, React StrictMode double-invoke, multiple tabs) can never open
 *      more than 3 upstream connections at once.
 * Crucially, the concurrency slot is held until the request SETTLES (not
 * released on start), so the concurrency cap is a true cap; and the 429 backoff
 * lives OUTSIDE this scheduler (see fetchRaw note + queries.ts retryDelay), so a
 * rate-limited retry never occupies a scheduler slot while it sleeps. That last
 * point is what fixes "clicking a category shows nothing until I hit Refresh":
 * the previous fully-serial throttle held every queued request behind the
 * 16-sport Live fan-out (5-13s), so a category switch appeared to do nothing.
 * Streaming media does NOT go through here, so video playback is unaffected.
 * Module state persists per Node server instance — the same assumption the
 * existing sigCache/inflight maps already rely on. */
let activeCount = 0;
let lastReqAt = 0;
const MIN_REQ_GAP_MS = 300;
const MAX_CONCURRENT = 3;

function scheduleUpstream<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const launch = () => {
      // Re-check the cap at launch time: several requests can have their start
      // gap elapse together, and we must not overshoot MAX_CONCURRENT.
      if (activeCount >= MAX_CONCURRENT) {
        setTimeout(tryStart, 50);
        return;
      }
      activeCount += 1;
      lastReqAt = Date.now();
      // Release the slot the moment the request starts (not when it resolves),
      // so a slow upstream response never stalls the rest of the queue.
      fn().then(resolve, reject).finally(() => {
        activeCount -= 1;
      });
    };
    const tryStart = () => {
      if (activeCount >= MAX_CONCURRENT) {
        setTimeout(tryStart, 50);
        return;
      }
      const wait = MIN_REQ_GAP_MS - (Date.now() - lastReqAt);
      if (wait > 0) setTimeout(launch, wait);
      else launch();
    };
    tryStart();
  });
}

/** Fetch one upstream API endpoint, spaced by the global throttle.
 *
 * Do NOT retry HTTP 429 here. React Query is the SINGLE retry layer and runs
 * its backoff client-side, OUTSIDE this scheduler — so a retry never holds a
 * throttle slot. Retrying here as well multiplied every rate-limited call into
 * up to 12 upstream requests (this loop × React Query's retry), which tripped
 * the limiter far harder and made a category switch appear to do nothing until
 * a manual Refresh. Letting React Query own the retry de-amplifies the storm
 * and lets a transient limit self-heal without surfacing to the UI. */
async function fetchRaw(url: string, options?: RequestInit): Promise<RawResponse> {
  return scheduleUpstream(async () => {
    const res = await fetch(url, {
      ...options,
      headers: { ...RB_HEADERS, ...((options?.headers as Record<string, string>) ?? {}) },
    });
    const body = await res.arrayBuffer();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return { status: res.status, bytes: new Uint8Array(body), headers: res.headers };
  });
}

/** GET then parse as PBResponse + extract the payload. */
async function getProtobuf(url: string): Promise<ProtobufResponse> {
  const { status, bytes } = await fetchRaw(url);
  const pb = parsePBResponse(bytes);
  return { status, url, pb, payload: extractPayload(pb), rawSize: bytes.length };
}

/** Fetch endpoint "version" signatures. code 100 = match/live, 102 = match/detail. */
async function getSignatures(base: string, codes: number[], sportType: number) {
  const bsPath = base === LIVE_API ? '/common/bs' : '/api/common/bs';
  const qs = codes.map((c) => `code=${c}`).join('&') + `&sportType=${sportType}&stream=true`;
  const r = await getProtobuf(base + bsPath + '?' + qs);
  return { ...r, signatures: parseBodySignatures(r.payload) };
}

export const getDataBS = (codes: number[], sportType: number) =>
  getSignatures(DATA_API, codes, sportType);

export const getLiveBS = (codes: number[], sportType: number) =>
  getSignatures(LIVE_API, codes, sportType);

export interface MatchQuery {
  version: string;
  language: number;
  sportType: number;
}

export interface MatchDetailQuery extends MatchQuery {
  matchId: number;
}

/* ---------- DataAPI ---------- */

export function getMatchLive({ version, language, sportType }: MatchQuery) {
  const qs = `language=${language}&sportType=${sportType}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/live?${qs}`);
}

export function getMatchDetail({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/detail?${qs}`);
}

export interface StreamDetailQuery {
  matchId: number;
  sportType: number;
  streamId: number;
  siteType: number;
  continent: string;
  country: string;
}

/** Full version: also return the response headers (to capture rb-session). */
export async function getStreamDetailFull({
  matchId,
  sportType,
  streamId,
  siteType,
  continent,
  country,
}: StreamDetailQuery) {
  const qs =
    `matchId=${matchId}&sportType=${sportType}&streamId=${streamId}&siteType=${siteType}` +
    `&continent=${continent}&country=${country}&digit=snd&withOriginal=true`;
  const url = `${DATA_API}/api/stream/detail?${qs}`;
  const { status, bytes, headers } = await fetchRaw(url);
  const pb = parsePBResponse(bytes);
  return {
    status,
    url,
    pb,
    payload: extractPayload(pb),
    rawSize: bytes.length,
    rbSession: headers.get('rb-session') || '',
  };
}

/* ---------- LiveAPI ---------- */

export function getLiveMatchLive({ version, language, sportType }: MatchQuery) {
  const qs = `language=${language}&sportType=${sportType}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${LIVE_API}/sfver${params}${version}/match/live?${qs}`);
}

export function getLiveMatchDetail({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}&stream=true`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${LIVE_API}/sfver${params}${version}/match/detail?${qs}`);
}

/** Match analysis / head-to-head (PBMatchAnalysisResp, endpoint code 107). */
export function getMatchAnalysis({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/analysis?${qs}`);
}

/** Match lineup (PBMatchLineupResp, endpoint code 106). */
export function getMatchLineup({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/lineup?${qs}`);
}

/** Match events (PBMatchEventResp, endpoint code 105): goals, cards, substitutions. */
export function getMatchEvent({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/event?${qs}`);
}

/** Match statistics (PBMatchStatisticResp, endpoint code 104). */
export function getMatchStatistic({ version, matchId, sportType, language }: MatchDetailQuery) {
  const qs = `matchId=${matchId}&sportType=${sportType}&language=${language}`;
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/match/statistic?${qs}`);
}

/* ---------- DataAPI — competition (league) family ----------
 * Every /api/league/* path is signed with the SAME endpoint signature:
 * DT_LEAGUE (code 200) from /api/common/bs. `seasonId` is optional on the
 * detail/fixtures/standings paths (omitted → the API resolves the current
 * season itself) and is ignored by the season list. */

export interface LeagueQuery {
  version: string;
  leagueId: number;
  sportType: number;
  language: number;
  /** Omit for the current season. */
  seasonId?: number;
}

const leagueQs = ({ sportType, language, leagueId, seasonId }: Omit<LeagueQuery, 'version'>) =>
  `language=${language}&sportType=${sportType}&leagueId=${leagueId}` +
  `${seasonId ? `&seasonId=${seasonId}` : ''}&stream=true`;

/** Competition detail — endpoint code 200 (DT_LEAGUE). */
export function getLeagueDetail({ version, ...q }: LeagueQuery) {
  const qs = leagueQs(q);
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/league/detail?${qs}`);
}

/** Competition fixtures — endpoint code 200 (DT_LEAGUE). */
export function getLeagueMatchList({ version, ...q }: LeagueQuery) {
  const qs = leagueQs(q);
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/league/match/list?${qs}`);
}

/** Competition seasons (for the season picker) — endpoint code 200 (DT_LEAGUE). */
export function getLeagueSeasonList({ version, ...q }: Omit<LeagueQuery, 'language'>) {
  const qs = leagueQs({ ...q, language: 0 });
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/league/season/list?${qs}`);
}

/** Competition standings — endpoint code 200 (DT_LEAGUE). */
export function getLeagueTeamStandingList({ version, ...q }: LeagueQuery) {
  const qs = leagueQs(q);
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/league/team/standing/list?${qs}`);
}

/** Competition player statistics (goals, assists, cards, per-game rates) —
 *  endpoint code 200 (DT_LEAGUE). Answers only WITH a seasonId (a season-less
 *  call is rejected with HTTP 499, exactly like fixtures/standings), and the
 *  payload carries the whole competition (1k+ rows) in one response. */
export function getLeaguePlayerTotalList({ version, ...q }: LeagueQuery) {
  const qs = leagueQs(q);
  const params = md5(qs).slice(0, 6);
  return getProtobuf(`${DATA_API}/sfver${params}${version}/api/league/player/total/list?${qs}`);
}
