'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleCheck, Loader2, RefreshCw, Share2, ThumbsUp, Trophy, Tv, X } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { Countdown, MatchHead } from '@/components/Match';
import { useUserTimeZone } from '@/components/LocalTime';
import { groupMatchesByLeague, LeagueGroupSection } from '@/components/LeagueGroup';
import {
  isLiveStatus,
  isStarted,
  isPlayable,
  statusLabel,
  computeH2HSummary,
  matchHeading,
} from '@/lib/matchProto';
import { UTC, formatKickoffLong, matchDateMs } from '@/lib/datetime';
import { useSportMatches, useMatchDetail, useMatchAnalysis, useMatchLineup, useMatchEvent, useMatchStatistic, useStreamUrl } from '@/lib/queries';
import { sportSlug, sportTypeFromParam, watchHref } from '@/lib/sports';
import VideoPlayer from '@/components/VideoPlayer';
import AdBanner from '@/components/AdBanner';
import { MatchTabs } from '@/components/MatchTabs';
import type { Match, Stream } from '@/lib/types';

/** Surface panel (`.panel`): bordered card on the app background. */
const PANEL = 'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Panel + centered empty/loading state (`.panel.empty-state`). */
const PANEL_EMPTY =
  'mb-4 rounded border border-border bg-panel px-5 py-10 text-center max-[640px]:px-4 max-[640px]:py-8';
/** Inline error banner (`.error-banner`). */
const ERROR_BANNER =
  'mb-4 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]';
/** Channel label in the player overlay — plain text (no pill). A text-shadow
 * keeps it legible over bright video; the active channel is cyan + underlined. */
const CHANNEL_BASE =
  'pointer-events-auto inline-block max-w-full cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] transition-opacity duration-150';
const CHANNEL_IDLE = `${CHANNEL_BASE} opacity-70 hover:opacity-100`;
const CHANNEL_ACTIVE = `${CHANNEL_BASE} text-[#22d3ee] underline decoration-2 underline-offset-4`;
/** Action pill under the video (`.watch-action-btn`). */
const ACTION_BASE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all duration-150';
const ACTION_IDLE = `${ACTION_BASE} border-border bg-panel text-text hover:border-[#c7ccd2]`;
const ACTION_ACTIVE = `${ACTION_BASE} border-accent bg-accent-soft text-accent`;
/** Fact chip in the match head — season/stage, channels, H2H. */
const META_CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-panel px-2.5 py-[3px] text-[12px] text-muted';

interface ResolvedStream {
  key: number;
  url: string;
  referer: string;
  label: string;
}

export function WatchPageContent({ id }: { id: string }) {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { cfg } = useRB();
  const matchId = id || params.id;
  /** Viewer's own zone (`Asia/Jakarta`, …), `null` until mounted — the kick-off
   *  strings below therefore fall back to the explicit-UTC stamp for the
   *  SSR/first client render and follow the viewer's clock afterwards. */
  const timeZone = useUserTimeZone();

  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState<ResolvedStream | null>(null);
  const [resolveErr, setResolveErr] = useState('');
  const autoPlayedRef = useRef(false);

  /** `?sport=` is the category slug (`football`); a legacy numeric sportType
   *  (`1`) still resolves, so old shared/indexed links keep working. */
  const preferredSport = sportTypeFromParam(searchParams.get('sport'), Number(cfg.sportType) || 0);

  const matchesQuery = useSportMatches(preferredSport);
  /** `?? []` mirrors the guarded reads elsewhere (line 166, SportCategoryMatches):
   *  a payload without `list` must not crash the whole page — the detail query
   *  still resolves and the sport falls back to the URL/default value. */
  const listMatch = (matchesQuery.data?.list ?? []).find((m: Match) => String(m.matchId) === String(matchId));
  const sportType = listMatch?.sportType ?? preferredSport;

  const detailQuery = useMatchDetail(matchId, sportType);
  const analysisQuery = useMatchAnalysis(matchId, sportType);
  const lineupQuery = useMatchLineup(matchId, sportType);
  const eventQuery = useMatchEvent(matchId, sportType);
  const statisticQuery = useMatchStatistic(matchId, sportType);
  const streamMutation = useStreamUrl();

  const detail = detailQuery.data;
  const busy = detailQuery.isLoading;
  const err = detailQuery.isError
    ? detailQuery.error instanceof Error
      ? detailQuery.error.message
      : String(detailQuery.error)
    : '';

  const match = detail?.match ?? listMatch ?? null;
  const streams = detail?.streams ?? detail?.channels ?? [];

  const matchStatus = match?.status;
  /** Live right now — the only state that auto-plays a channel. */
  const live = isLiveStatus(matchStatus);
  /** Finished / cancelled / cut — the stream is over. */
  const finished = (matchStatus ?? 0) >= 10000;
  /** Upcoming with a known kickoff time → the player frame shows a countdown. */
  const started = isStarted(matchStatus);
  const countdownMs = started ? null : matchDateMs(match?.matchDate);
  const endLabel = finished ? statusLabel(matchStatus).toLowerCase() : '';
  /** "2 : 1" — proto3 omits a 0 score, so a 0-3 must read as "0 : 3" instead of
   *  losing the left-hand side. */
  const scoreText = `${match?.homeScore ?? 0} : ${match?.awayScore ?? 0}`;
  const finalScore = matchStatus === 10000 && match ? scoreText : '';

  const streamLabel = (s: Stream, i: number): string =>
    s.fullName || s.name || `Channel #${s.streamId ?? s.channelId ?? i + 1}`;

  const playChannel = async (s: Stream, i: number): Promise<void> => {
    setResolveErr('');
    try {
      const res = await streamMutation.mutateAsync({
        matchId,
        streamId: s.streamId ?? 0,
        sportType,
        siteType: s.siteType ?? cfg.siteType,
        continent: cfg.continent,
        country: cfg.country,
      });
      setPlaying({ key: i, url: res.url, referer: res.referer, label: streamLabel(s, i) });
      // Pause on (auto)select so the pause-ad overlay shows first.
      setPaused(true);
    } catch (e) {
      setResolveErr(e instanceof Error ? e.message : 'Could not resolve stream URL.');
    }
  };

  // Auto-pick the first playable channel once streams are ready — only while
  // the match is actually live (upcoming shows a countdown, finished shows an
  // "ended" notice instead of a player).
  useEffect(() => {
    if (autoPlayedRef.current || !streams.length) return;
    if (!live) return;
    autoPlayedRef.current = true;
    const idx = streams.findIndex((s) => isPlayable(s));
    const pick = idx >= 0 ? idx : 0;
    void playChannel(streams[pick], pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streams, live]);

  // Related matches — adaptive, relevance-ranked (mirrors the adaptive tab
  // ordering). Instead of hard-picking ONE tier (which can leave the rail
  // half-empty), every candidate gets a relevance score and we keep the best
  // few. Priority: live-ness is dominant (live before upcoming), then
  // competition relevance (same league before same category):
  //   0 · live     + same league      (most relevant)
  //   1 · live     + same category
  //   2 · upcoming + same league
  //   3 · upcoming + same category
  //   4 · finished (last resort — rarely present on the live list)
  // Ties break by soonest kickoff (live → most mature first; upcoming → next up).
  // League identity falls back to the (case-insensitive) league name because
  // some payloads omit leagueId while still carrying the league name.
  const leagueId = match?.league?.leagueId;
  const leagueName = match?.league?.name?.trim().toLowerCase();
  const sameLeague = (m: Match): boolean => {
    if (leagueId !== undefined && m.league?.leagueId !== undefined)
      return m.league.leagueId === leagueId;
    const other = m.league?.name?.trim().toLowerCase();
    return !!leagueName && !!other && other === leagueName;
  };
  const others = (matchesQuery.data?.list ?? []).filter(
    (m) => String(m.matchId) !== String(matchId)
  );
  const relevance = (m: Match): number => {
    const same = sameLeague(m);
    if (isLiveStatus(m.status)) return same ? 0 : 1;
    if (!isStarted(m.status)) return same ? 2 : 3; // not live & not finished = upcoming
    return 4; // finished
  };
  const bySoonest = (a: Match, b: Match): number =>
    (matchDateMs(a.matchDate) ?? Infinity) - (matchDateMs(b.matchDate) ?? Infinity);

  const relatedMatches = [...others]
    .sort((a, b) => relevance(a) - relevance(b) || bySoonest(a, b))
    .slice(0, 6);

  // Heading reflects the TOP tier actually present, so the context is explicit.
  // Tier 0/2 mean every shown match is from this competition — filter the list
  // down to same-league matches so the heading never lies (the bug: heading
  // said "this competition" while the sliced list mixed in other leagues).
  const topTier = relatedMatches.length ? relevance(relatedMatches[0]) : 4;
  const sameCompetitionOnly = topTier === 0 || topTier === 2;
  const visibleRelated = sameCompetitionOnly
    ? relatedMatches.filter((m) => sameLeague(m))
    : relatedMatches;
  const relatedLabel =
    topTier === 0
      ? 'Live in this competition'
      : topTier === 1
        ? 'Live matches'
        : topTier <= 3
          ? 'Upcoming matches'
          : 'Recently finished';

  const slug = sportType > 0 ? sportSlug(sportType) : '';
  const backHref = slug ? `/sports/${slug}` : '/';

  const league = match?.league;
  /** H1, player caption and share title — the matchup, not the competition. */
  const title = matchHeading(match);
  /** Kick-off in the viewer's own timezone (UTC until that is known). */
  const kickoff = formatKickoffLong(match?.matchDate, timeZone ?? UTC);
  /** "Season 2026 · Round of 16 · Group A" — cups carry a stage, leagues usually
   *  only a season, so every present part is joined and absent ones dropped.
   *  A bare number in `round` is a matchday, so it gets the "Round" prefix. */
  const round = match?.round
    ? /^\d+$/.test(match.round)
      ? `Round ${match.round}`
      : match.round
    : '';
  const stageLabel = [
    match?.season ? `Season ${match.season}` : '',
    match?.stage,
    round,
    match?.group,
  ]
    .filter(Boolean)
    .join(' · ');
  /** Head-to-head record from the home side's perspective (analysis data the
   *  tabs already fetch, so this adds no upstream request). */
  const h2h = computeH2HSummary(analysisQuery.data?.h2h ?? [], match?.home);
  const channelCount = streams.length;
  /** Who plays whom, in which competition, when — plus the live/final state.
   *  Doubles as the page's SEO description (see generateMetadata). */
  const description = (() => {
    const comp = league?.name ? ` in ${league.name}` : '';
    const where = league?.country && league.country !== league.name ? ` (${league.country})` : '';
    const channels =
      channelCount > 0 ? ` ${channelCount} channel${channelCount > 1 ? 's' : ''} available.` : '';
    if (live) return `${title} is live now${comp}${where} — ${statusLabel(matchStatus)}.${channels}`;
    if (finished) {
      return matchStatus === 10000
        ? `${title} finished ${scoreText}${comp}${where}.`
        : `${title} — this match was ${endLabel}${comp}${where}.`;
    }
    return kickoff ? `${title} kicks off ${kickoff}${comp}${where}.` : `${title}${comp}${where}.`;
  })();

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, text: description, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled or unsupported */
    }
  }, [title, description]);

  const handleRefresh = (): void => {
    autoPlayedRef.current = false;
    setPlaying(null);
    setResolveErr('');
    void Promise.all([detailQuery.refetch(), matchesQuery.refetch()]);
  };

  return (
    <>
      {/* Top banner — below the navbar */}
      <AdBanner slotId="watch-top" category={slug} size="leaderboard" />

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 max-[640px]:gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent no-underline hover:underline"
        >
          ← Back
        </Link>
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-sm border border-border bg-panel text-[16px] text-muted transition-all duration-150 hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleRefresh}
            disabled={detailQuery.isFetching}
            title="Refresh"
          >
            {detailQuery.isFetching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {busy && (
        <section className={PANEL_EMPTY}>
          <span className="text-[14px] text-muted">
            <Loader2 className="animate-spin" size={16} /> Loading match details…
          </span>
        </section>
      )}

      {err && <div className={ERROR_BANNER}>{err}</div>}

      {!busy && !err && match && (
        <>
          {/* 1. Match head — the same card as the match list items, above the
              player: competition, teams, live/final score, state + kick-off,
              the match facts and the page description. */}
          <MatchHead match={match} className="mb-4">
            {(stageLabel || channelCount > 0 || h2h.total > 0) && (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                {stageLabel && (
                  <span className={META_CHIP}>
                    <Trophy size={13} className="shrink-0" aria-hidden="true" />
                    {stageLabel}
                  </span>
                )}
                {channelCount > 0 && (
                  <span className={META_CHIP}>
                    <Tv size={13} className="shrink-0" aria-hidden="true" />
                    {channelCount} {channelCount > 1 ? 'channels' : 'channel'}
                  </span>
                )}
                {h2h.total > 0 && (
                  <span className={META_CHIP}>
                    H2H {h2h.wins}W {h2h.draws}D {h2h.losses}L
                  </span>
                )}
              </div>
            )}
          </MatchHead>

          {/* 2. Main video player + pause ad overlay */}
          <section className={PANEL}>
            <div className="relative">
              {playing ? (
                <VideoPlayer
                  streamUrl={playing.url}
                  referer={playing.referer}
                  title={title}
                  autoPlay={false}
                  muted={false}
                  onPause={() => setPaused(true)}
                  onPlay={() => setPaused(false)}
                />
              ) : countdownMs !== null ? (
                /* Upcoming match — live countdown inside the player frame. */
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black">
                  <div className="p-4 text-center">
                    <p className="mb-1 mt-0 text-xs font-bold uppercase tracking-[0.08em] text-[#9ca3af]">Kick-off in</p>
                    <Countdown targetMs={countdownMs} />
                  </div>
                </div>
              ) : finished ? (
                /* Finished / cancelled / cut — the stream is over. */
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black">
                  <div className="p-4 text-center">
                    <CircleCheck className="mx-auto h-10 w-10 text-[#9ca3af]" />
                    <p className="mt-2.5 text-[14px] font-semibold text-[#e5e7eb]">This match is {endLabel}.</p>
                    {finalScore && (
                      <p className="mt-1 text-[12px] text-[#9ca3af]">Final score {finalScore}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded bg-black">
                  <span className="text-[14px] text-muted">
                    <Loader2 className="animate-spin" size={20} /> Preparing stream…
                  </span>
                </div>
              )}

              {live && streams.length > 0 && (
                <div className="pointer-events-none absolute right-3 top-1/2 z-[5] flex max-h-[calc(100%-24px)] max-w-[50%] -translate-y-1/2 flex-col items-end gap-2 overflow-y-auto">
                  {streams.map((s, i) => {
                    const active = playing?.key === i;
                    return (
                      <button
                        type="button"
                        key={i}
                        className={active ? CHANNEL_ACTIVE : CHANNEL_IDLE}
                        onClick={() => void playChannel(s, i)}
                      >
                        {streamLabel(s, i)}
                      </button>
                    );
                  })}
                </div>
              )}

              {paused && (
                /* `z-10` lifts the pause ad + its close button above the live
                   channel-list overlay (`z-[5]`) so the X stays clickable even
                   when the two overlap at the top-right of the player. */
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[rgba(0,0,0,0.55)] p-4">
                  <AdBanner slotId="watch-pause-ad" category={slug} size="leaderboard" className="!mb-0 max-w-[480px]" />
                  <button
                    type="button"
                    className="absolute right-2.5 top-2.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(0,0,0,0.6)] text-white hover:bg-[rgba(0,0,0,0.8)]"
                    onClick={() => setPaused(false)}
                    aria-label="Close ad"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {resolveErr && <div className={ERROR_BANNER}>{resolveErr}</div>}

          </section>

          {/* 3. Actions under the player — share, like */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" className={ACTION_IDLE} onClick={handleShare}>
              <Share2 size={16} />
              Share
            </button>
            <button
              type="button"
              className={liked ? ACTION_ACTIVE : ACTION_IDLE}
              onClick={() => setLiked((v) => !v)}
            >
              <ThumbsUp size={16} />
              {liked ? 'Liked' : 'Like'}
            </button>
          </div>

          {/* Big ad — above the tabs (Overview / H2H / Lineups / Timeline) */}
          <AdBanner slotId="watch-above-related" category={slug} size="rectangle" />

          {/* H2H / Lineups / Timeline (tabs; auto-shown only where data exists) */}
          <MatchTabs
            analysis={analysisQuery.data}
            lineup={lineupQuery.data}
            events={eventQuery.data}
            stats={statisticQuery.data}
            homeTeam={match?.home}
            awayTeam={match?.away}
            sportType={sportType}
            matchStatus={match?.status}
          />

          {/* Related matches (live/upcoming) — grouped by league name.
              `visibleRelated` is already filtered to this competition when the
              heading says so, so other leagues can never leak in. */}
          {visibleRelated.length > 0 && (
            <section className={PANEL}>
              <h3 className="mb-3 text-[15px] font-bold">{relatedLabel}</h3>
              <div className="flex flex-col gap-4">
                {groupMatchesByLeague(visibleRelated).map((lg) => (
                  <LeagueGroupSection
                    key={lg.key}
                    group={lg}
                    onMatchClick={(m) => router.push(watchHref(m.matchId, m.sportType ?? sportType))}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}