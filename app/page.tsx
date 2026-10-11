'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, ChevronDown, type LucideIcon } from 'lucide-react';
import { MatchRowSkeleton } from '@/components/Match';
import { EmptyMatches } from '@/components/EmptyMatches';
import { groupMatchesByLeague, LeagueGroupSection } from '@/components/LeagueGroup';
import { isLiveStatus } from '@/lib/matchProto';
import { matchDateMs } from '@/lib/datetime';
import { useSportMatches } from '@/lib/queries';
import { sportLabel, sportIcon, watchHref } from '@/lib/sports';
import AdBanner from '@/components/AdBanner';
import { ADSENSE_CLIENT, AD_SLOTS } from '@/lib/ads';
import type { Match } from '@/lib/types';

interface MatchGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  isLive: boolean;
  items: Match[];
}

/** Render one sport group on the home feed. Matches are split into per-league
 *  sub-sections so the league name shows once per header, not per card.
 *  The sport header is a toggle — collapsed groups show only the header row. */
function SportGroupSection({
  group,
  onMatchClick,
  defaultOpen = true,
}: {
  group: MatchGroup;
  onMatchClick: (m: Match) => void;
  defaultOpen?: boolean;
}) {
  const leagueGroups = useMemo(() => groupMatchesByLeague(group.items), [group.items]);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-[22px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mb-2.5 flex w-full cursor-pointer items-center justify-between rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-border-soft/60"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]">
          <group.icon className="h-[15px] w-[15px]" />
          {group.label}
          <span className="rounded-full border border-border bg-panel px-2 py-px text-[11px] font-bold text-muted">{group.items.length}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-4">
          {leagueGroups.map((lg) => (
            <LeagueGroupSection key={lg.key} group={lg} onMatchClick={onMatchClick} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchListContent() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  // The home page is the aggregate "Live" feed across every sport.
  const matchesQuery = useSportMatches(0);
  const matches = matchesQuery.data ?? null;
  const busy = matchesQuery.isLoading;
  const err =
    matchesQuery.isError && !matches
      ? matchesQuery.error instanceof Error
        ? matchesQuery.error.message
        : String(matchesQuery.error)
      : '';

  const list = matches?.list ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      [m.home?.name, m.away?.name, m.league?.name, m.name, m.title, m.group]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [list, query]);

  // Order: live → upcoming → finished.
  const sorted = useMemo(() => {
    const rank = (m: Match): number => {
      if (isLiveStatus(m.status)) return 0;
      if (!m.status) return 1;
      return 2;
    };
    const byTime = (a: Match, b: Match): number =>
      (matchDateMs(a.matchDate) ?? Infinity) - (matchDateMs(b.matchDate) ?? Infinity);
    return [...filtered].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return ra === 2 ? byTime(b, a) : byTime(a, b);
    });
  }, [filtered]);

  const liveCount = list.filter((m) => isLiveStatus(m.status)).length;

  // Group the live feed by sport type.
  const groups = useMemo<MatchGroup[]>(() => {
    const map = new Map<number, Match[]>();
    for (const m of sorted) {
      const st = m.sportType ?? 90;
      const arr = map.get(st) ?? [];
      arr.push(m);
      map.set(st, arr);
    }
    return [...map.entries()].map(([st, items]) => ({
      key: `sport-${st}`,
      label: sportLabel(st),
      icon: sportIcon(st),
      isLive: true,
      items,
    }));
  }, [sorted]);

  const emptyTitle = query ? 'No results' : 'No matches';
  const emptyDesc = list.length === 0
    ? 'The server may be rejecting the request — try another source or reload.'
    : query
      ? `No matches for "${query.trim()}". Try a different keyword or clear the search.`
      : 'There are no live matches right now. Check back soon.';

  return (
    <>
      {/* Top banner — before the content. */}
      <AdBanner slotId={AD_SLOTS.topLeaderboard} client={ADSENSE_CLIENT} category="live" size="leaderboard" />


      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted">Live</span>
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-sm)] border border-border bg-panel text-base text-muted transition-all hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void matchesQuery.refetch()}
            disabled={matchesQuery.isFetching}
            title="Refresh"
          >
            {matchesQuery.isFetching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {/* Search + counters. The row is a horizontal scroll container (same
       *  pattern as the sport nav) so on narrow/mobile screens the input and
       *  the match/live pills can be swiped into view instead of being
       *  clipped by the viewport. */}
      <section className="mb-[18px] flex flex-nowrap items-center gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <input
          className="min-w-[170px] flex-1 rounded-xl border border-border bg-panel px-4 py-[11px] text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
          type="search"
          placeholder="Search teams, leagues, or matches…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches && (
          <span className="flex shrink-0 gap-2.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-3.5 py-1.5 text-[13px] text-muted [&_strong]:text-text"><strong>{list.length}</strong> matches</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.4)] bg-live-soft px-3.5 py-1.5 text-[13px] text-[#d93025]"><span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />{liveCount} live</span>
          </span>
        )}
      </section>

      {err && (
        <div className="mb-4 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]">
          {err}
        </div>
      )}

      {busy && !matches && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => <MatchRowSkeleton key={i} />)}
        </div>
      )}

      {!busy && matches && sorted.length === 0 && (
        <EmptyMatches
          kind={query ? 'search' : 'none'}
          title={emptyTitle}
          desc={emptyDesc}
          onClear={query ? () => setQuery('') : undefined}
          onRetry={list.length === 0 ? () => void matchesQuery.refetch() : undefined}
          retryBusy={matchesQuery.isFetching}
        />
      )}

      {groups.map((g, idx) => (
        <Fragment key={g.key}>
          <SportGroupSection
            group={g}
            onMatchClick={(m) => router.push(watchHref(m.matchId, m.sportType ?? 0))}
          />

          {/* In-feed banner — between the first group and the rest. */}
          {idx === 0 && groups.length > 1 && (
            <AdBanner slotId="home-infeed" category="live" size="rectangle" />
          )}
        </Fragment>
      ))}

      {/* Bottom content banner — after the list. */}
      <AdBanner slotId={AD_SLOTS.contentBannerBottom} client={ADSENSE_CLIENT} category="live" size="leaderboard" />

    </>
  );
}

export default function HomePage() {
  return <MatchListContent />;
}
