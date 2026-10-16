'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, ChevronDown, type LucideIcon } from 'lucide-react';
import { MatchRowSkeleton } from '@/components/Match';
import { EmptyMatches, type EmptyKind } from '@/components/EmptyMatches';
import { groupMatchesByLeague, LeagueGroupSection } from '@/components/LeagueGroup';
import { isLiveStatus, sortMatchesByPhase } from '@/lib/matchProto';
import { useSportMatches } from '@/lib/queries';
import { sportLabel, sportIcon, sportRank, watchHref } from '@/lib/sports';
import AdBanner from '@/components/AdBanner';
import { ADSENSE_CLIENT, AD_SLOTS } from '@/lib/ads';
import { COUNT, COUNT_IDLE, ERROR, ICON_BTN, INPUT } from '@/components/ui';
import {
  StatusFilter,
  filterMatches,
  matchFilterCounts,
  matchFilterLabel,
  type MatchFilter,
} from '@/components/StatusFilter';
import type { Match } from '@/lib/types';

interface MatchGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  /** The sport this group is — what the sections are ordered by. */
  sport: number;
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
  /** The count pill turns live-red only when this sport actually has a match
   *  in play — the same reserved-red rule the cards follow. */
  const hasLive = group.items.some((m) => isLiveStatus(m.status));
  return (
    <section className="mb-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-surface-2"
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-bold text-text">
          <group.icon className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate">{group.label}</span>
          <span className={hasLive ? `${COUNT} bg-live-soft text-live-ink` : COUNT_IDLE}>{group.items.length}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`}
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
  // The same filter row the category feeds carry, so both feeds are narrowed
  // by one vocabulary instead of two.
  const [tab, setTab] = useState<MatchFilter>('all');

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

  // Order: live → upcoming → finished, then grouped by sport (shared rules —
  // lib/matchProto.ts for the order, lib/sports.ts for the sport order).
  const sorted = useMemo(() => sortMatchesByPhase(filtered), [filtered]);

  // The counts and the visible rows both read off what the search left, so a
  // tab never promises rows the search has already taken away.
  const counts = useMemo(() => matchFilterCounts(filtered), [filtered]);
  const visible = useMemo(() => filterMatches(sorted, tab), [sorted, tab]);
  const liveCount = counts.live;

  // Group the feed by sport: the sports with a match in play first, then the
  // canonical sport order the nav and the picker read in — a section keeps its
  // place between two loads instead of following whichever match sorted first.
  const groups = useMemo<MatchGroup[]>(() => {
    const map = new Map<number, Match[]>();
    for (const m of visible) {
      const st = m.sportType ?? 90;
      const arr = map.get(st) ?? [];
      arr.push(m);
      map.set(st, arr);
    }
    return [...map.entries()]
      .map(([st, items]) => ({
        key: `sport-${st}`,
        label: sportLabel(st),
        icon: sportIcon(st),
        sport: st,
        items,
      }))
      .sort((a, b) => {
        const liveA = a.items.some((m) => isLiveStatus(m.status)) ? 0 : 1;
        const liveB = b.items.some((m) => isLiveStatus(m.status)) ? 0 : 1;
        return liveA - liveB || sportRank(a.sport) - sportRank(b.sport);
      });
  }, [visible]);

  const tabLabel = matchFilterLabel(tab);
  const emptyKind: EmptyKind = query ? 'search' : list.length === 0 ? 'none' : 'filter';
  const emptyTitle =
    list.length === 0 ? 'No matches' : query ? 'No results' : `No ${tabLabel.toLowerCase()} matches`;
  const emptyDesc = list.length === 0
    ? 'The server may be rejecting the request — try another source or reload.'
    : query
      ? `No matches for "${query.trim()}". Try a different keyword or clear the search.`
      : `No ${tabLabel.toLowerCase()} matches across the sports right now — another tab may have some.`;
  // One button clears whatever emptied the list: the search, or the filter.
  const clearList = query ? () => setQuery('') : tab !== 'all' ? () => setTab('all') : undefined;

  return (
    <>
      {/* Top banner — before the content. */}
      <AdBanner slotId={AD_SLOTS.topLeaderboard} client={ADSENSE_CLIENT} category="live" size="leaderboard" />


      {/* Toolbar — what the page is, how much of it there is, and what narrows
       *  it, in one row: label + counters on the left, the search and the
       *  refresh on the right (the search drops to its own full-width row
       *  inside it on a phone, where a slim field would be unusable). */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-[15px] font-bold text-text">Matches</h2>
        {matches && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-[12px] text-muted [&_strong]:font-bold [&_strong]:text-text">
              <strong>{counts.all}</strong> matches
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live-border bg-live-soft px-2.5 py-1 text-[12px] text-live-ink">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              {liveCount} live
            </span>
          </>
        )}
        <div className="ml-auto flex w-full min-w-0 items-center gap-2 min-[641px]:w-auto min-[641px]:min-w-[220px] min-[641px]:flex-1 min-[641px]:max-w-[360px]">
          <input
            className={INPUT}
            type="search"
            placeholder="Search teams, leagues, or matches…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className={ICON_BTN}
            onClick={() => void matchesQuery.refetch()}
            disabled={matchesQuery.isFetching}
            title="Refresh"
            aria-label="Refresh"
          >
            {matchesQuery.isFetching ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {/* Which slice of the feed is on screen. Directly above the sections it
       *  narrows, so one tap turns the whole feed into "just the live ones". */}
      <StatusFilter value={tab} counts={counts} onChange={setTab} />

      {err && <div className={ERROR}>{err}</div>}

      {busy && !matches && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => <MatchRowSkeleton key={i} />)}
        </div>
      )}

      {!busy && matches && visible.length === 0 && (
        <EmptyMatches
          kind={emptyKind}
          title={emptyTitle}
          desc={emptyDesc}
          clearLabel={query ? 'Clear search' : 'Show all matches'}
          onClear={clearList}
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
