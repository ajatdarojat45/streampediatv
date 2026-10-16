'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, Clock, CircleCheck, Loader2, RefreshCw, ChevronDown, type LucideIcon } from 'lucide-react';
import { useRB } from '@/components/RBProvider';
import { MatchRowSkeleton } from '@/components/Match';
import { EmptyMatches, type EmptyKind } from '@/components/EmptyMatches';
import { groupMatchesByLeague, LeagueGroupSection } from '@/components/LeagueGroup';
import { matchPhase, sortMatchesByPhase, type MatchPhase } from '@/lib/matchProto';
import { useSportMatches } from '@/lib/queries';
import { watchHref } from '@/lib/sports';
import AdBanner from '@/components/AdBanner';
import { ADSENSE_CLIENT, AD_SLOTS } from '@/lib/ads';
import type { Match } from '@/lib/types';
import { COUNT_IDLE, ERROR, ICON_BTN, INPUT } from '@/components/ui';
import {
  StatusFilter,
  filterMatches,
  matchFilterCounts,
  matchFilterLabel,
  type MatchFilter,
} from '@/components/StatusFilter';

/** The three sections a category feed is drawn in. Their order is the order
 *  lib/matchProto.ts sorts every list in, so a section never disagrees with the
 *  rows inside it. */
const MATCH_GROUPS: { key: MatchPhase; label: string; icon: LucideIcon }[] = [
  { key: 'live', label: 'Live', icon: Radio },
  { key: 'upcoming', label: 'Upcoming', icon: Clock },
  { key: 'finished', label: 'Finished', icon: CircleCheck },
];


/* Group heading (`.group-title` / `.group-title.is-live`). */
const GROUP_TITLE = 'inline-flex items-center gap-2 text-[13px] font-bold text-text';
const GROUP_TITLE_LIVE =
  'inline-flex items-center gap-2 text-[13px] font-bold text-live-ink';

interface MatchGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  isLive: boolean;
  items: Match[];
}

interface SportCategoryMatchesProps {
  sportType: number;
  category: string;
  label: string;
}

/** Render one Live/Upcoming/Finished status group. Every group is split into
 *  per-league sub-sections so the league name shows once per header,
 *  not per card. The status header is a toggle — collapsed groups show only
 *  the header row. The caller decides which group starts expanded: the first
 *  non-empty group (live → upcoming → finished) opens by default so the list
 *  never looks empty, while the rest start collapsed.
 *
 *  `showHeader` is off when the caller has already pinned this phase with the
 *  filter row above — the tab says "Live", so the section no longer has to, and
 *  the league groups move up under the tab they belong to. */
function StatusGroupSection({
  group,
  onMatchClick,
  defaultOpen,
  showHeader = true,
}: {
  group: MatchGroup;
  onMatchClick: (m: Match) => void;
  defaultOpen?: boolean;
  showHeader?: boolean;
}) {
  const leagueGroups = useMemo(
    () => groupMatchesByLeague(group.items),
    [group.items]
  );
  const openByDefault = defaultOpen ?? group.isLive;
  const [open, setOpen] = useState(openByDefault);
  /** The league sub-sections of this status, drawn at one open state. */
  const leagues = (expand: boolean) => (
    <div className="flex flex-col gap-4">
      {leagueGroups.map((lg) => (
        <LeagueGroupSection key={lg.key} group={lg} onMatchClick={onMatchClick} defaultOpen={expand} />
      ))}
    </div>
  );
  // No header (the filter row above already names this phase): the league
  // groups move straight up under that tab, expanded.
  if (!showHeader) {
    return (
      <section className="mb-[22px]">
        {group.items.length === 0 ? (
          <p className="px-1 text-[13px] text-muted">
            No {group.label.toLowerCase()} matches right now.
          </p>
        ) : (
          leagues(true)
        )}
      </section>
    );
  }
  const body =
    group.items.length === 0 ? (
      <p className="px-1 text-[13px] text-muted">
        No {group.label.toLowerCase()} matches right now.
      </p>
    ) : (
      leagues(openByDefault)
    );
  return (
    <section className="mb-[22px]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mb-2.5 flex w-full cursor-pointer items-center justify-between rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-border-soft/60"
      >
        <span className={group.isLive ? GROUP_TITLE_LIVE : GROUP_TITLE}>
          <group.icon className="h-[15px] w-[15px]" />
          {group.label}
          <span className={COUNT_IDLE}>{group.items.length}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && body}
    </section>
  );
}

/** Match list for /sports/[category] — the same layout as the home page
 *  (one toolbar with the search in it, the same status filter row, the same
 *  grouped MatchRow list), scoped to one sport, plus top & in-feed AdBanner
 *  slots. */
export function SportCategoryMatches({ sportType, category, label }: SportCategoryMatchesProps) {
  const router = useRouter();
  const { setCfg } = useRB();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<MatchFilter>('all');

  // Keep the shared config aligned so the watch page resolves this sport.
  useEffect(() => {
    setCfg((c) => (c.sportType === sportType ? c : { ...c, sportType }));
  }, [sportType, setCfg]);

  const matchesQuery = useSportMatches(sportType);
  const matches = matchesQuery.data;
  const busy = matchesQuery.isLoading;
  const err = matchesQuery.isError
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

  // Order: live → upcoming → finished (lib/matchProto.ts — the same rule the
  // home feed orders and filters by).
  const sorted = useMemo(() => sortMatchesByPhase(filtered), [filtered]);

  // Counts and rows both read off what the search left behind, so a tab never
  // promises rows the search has already taken away.
  const counts = useMemo(() => matchFilterCounts(filtered), [filtered]);
  const liveCount = counts.live;
  const visible = useMemo(() => filterMatches(sorted, tab), [sorted, tab]);

  const groups = useMemo<MatchGroup[]>(
    () =>
      MATCH_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        icon: g.icon,
        isLive: g.key === 'live',
        items: visible.filter((m) => matchPhase(m.status) === g.key),
      // Keep the Live group on the "All" tab even when it has no matches so the
      // section header never disappears — but only while there are matches to
      // show. When the list is empty (or a search has no hits) the empty state
      // stands alone. Upcoming/Finished are still dropped when empty, and Live
      // drops too on a pinned tab (the empty state shows instead).
      })).filter(
        (g) => g.items.length > 0 || (g.isLive && tab === 'all' && visible.length > 0)
      ),
    [visible, tab]
  );

  // First group that actually has matches — it opens by default so an empty
  // Live group never forces the whole list to render collapsed.
  const firstOpenKey = groups.find((g) => g.items.length > 0)?.key;

  const tabLabel = matchFilterLabel(tab);
  const emptyKind: EmptyKind = query ? 'search' : list.length === 0 ? 'none' : 'filter';
  const emptyTitle =
    list.length === 0 ? 'No matches' : query ? 'No results' : `No ${tabLabel.toLowerCase()} matches`;
  const emptyDesc =
    list.length === 0
      ? 'The server may be rejecting the request — try another source or reload.'
      : query
        ? `No matches for "${query.trim()}". Try a different keyword or clear the search.`
        : `There are no ${tabLabel.toLowerCase()} ${label.toLowerCase()} matches right now. Try another tab.`;

  return (
    <>
      {/* Top banner — before the title/content. */}
      <AdBanner slotId={AD_SLOTS.topLeaderboard} client={ADSENSE_CLIENT} category={category} size="leaderboard" />


      {/* Toolbar — the sport's name, its counters, the way back to the feed and
       *  the search, in one row: the search and the refresh on the right (the
       *  search drops to its own full-width row inside it on a phone). The
       *  home feed carries the same toolbar, so the two read as siblings. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-[15px] font-bold text-text">{label}</h2>
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
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent no-underline hover:underline"
          >
            ← All sports
          </Link>
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

      {/* The status tabs, on the same row layout as the home feed's: the one
       *  control that turns the whole category into a phase at a time. */}
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
          onClear={query ? () => setQuery('') : tab !== 'all' ? () => setTab('all') : undefined}
          onRetry={list.length === 0 ? () => void matchesQuery.refetch() : undefined}
          retryBusy={matchesQuery.isFetching}
        />
      )}

      {groups.map((g, idx) => (
        // Key includes the active tab so switching tabs remounts the group and
        // re-applies `defaultOpen`.
        <Fragment key={`${tab}-${g.key}`}>
          <StatusGroupSection
            group={g}
            onMatchClick={(m) => router.push(watchHref(m.matchId, m.sportType ?? sportType))}
            // The first non-empty group expands by default: live when it has
            // matches, otherwise upcoming, otherwise finished. An empty Live
            // group stays visible (All tab) but collapsed.
            defaultOpen={g.key === firstOpenKey}
            // A pinned tab already names the phase it shows, so its section
            // header would only repeat the tab: the league groups move up.
            showHeader={tab === 'all'}
          />

          {/* In-feed banner — between the first group and the rest of the list. */}
          {idx === 0 && groups.length > 1 && (
            <AdBanner slotId="sports-category-infeed" category={category} size="rectangle" />
          )}
        </Fragment>
      ))}

      {/* Bottom content banner — after the list. */}
      <AdBanner slotId={AD_SLOTS.contentBannerBottom} client={ADSENSE_CLIENT} category={category} size="leaderboard" />
    </>
  );
}

