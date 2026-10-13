'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Flame, Loader2, RefreshCw } from 'lucide-react';
import { TeamLogo } from '@/components/Match';
import { LocalTime } from '@/components/LocalTime';
import { EmptyMatches } from '@/components/EmptyMatches';
import { SPORTS, leagueHref, sportLabel, sportSlug } from '@/lib/sports';
import type { CompetitionEntry } from '@/lib/competitions';
import AdBanner from '@/components/AdBanner';
import { ADSENSE_CLIENT, AD_SLOTS } from '@/lib/ads';

/* Filter-tab pills (`.filter-tab`) — the same chrome the match lists use, so the
 * directory reads as one more view of the same site. Active state is a separate
 * string so its color utilities do not fight the idle ones. */
const FILTER_TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const FILTER_TAB_IDLE = `${FILTER_TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const FILTER_TAB_ACTIVE = `${FILTER_TAB} border-accent bg-accent-soft text-accent`;

const FILTER_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const FILTER_COUNT_IDLE = `${FILTER_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const FILTER_COUNT_ACTIVE = `${FILTER_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;

const REFRESH_BTN =
  'inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-sm)] border border-border bg-panel text-base text-muted transition-all hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50';

/** One competition card: crest, name, sport/country/fixture count and either
 *  the live count, the next kick-off, or nothing for a registry-only row.
 *  The whole card is one `<Link>` into `/competition/<id>?sport=<slug>` — the
 *  same target the league header of a match list uses. */
function CompetitionCard({ entry }: { entry: CompetitionEntry }) {
  const next = !entry.stale && entry.liveCount === 0 ? entry.nextKickoffMs : undefined;
  return (
    <Link
      href={leagueHref(entry.leagueId, entry.sportType)}
      className="group flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card px-3.5 py-3 no-underline transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-[#c7ccd2] hover:shadow"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <TeamLogo path={entry.logo} name={entry.name} kind="league" size="head" />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-text transition-colors group-hover:text-accent">
          {entry.name}
        </span>
        {entry.hot && (
          <Flame
            className="h-3.5 w-3.5 shrink-0 text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]"
            aria-label="Trending competition"
          />
        )}
        {entry.liveCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.4)] bg-live-soft px-2.5 py-1 text-[11px] font-bold text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]">
            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-current" />
            {entry.liveCount}
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        )}
      </span>

      <span className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
        <span>{sportLabel(entry.sportType)}</span>
        {entry.country && (
          <>
            <span aria-hidden="true">·</span>
            <span className="min-w-0 truncate">{entry.country}</span>
          </>
        )}
        {!entry.stale && entry.totalCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {entry.totalCount} {entry.totalCount === 1 ? 'fixture' : 'fixtures'}
            </span>
          </>
        )}
      </span>

      {next !== undefined ? (
        <span className="text-[12px] text-muted">
          Next: <LocalTime ts={next} variant="short" className="text-text" />
        </span>
      ) : entry.stale ? (
        <span className="text-[12px] text-muted">No fixtures in the feed window</span>
      ) : null}
    </Link>
  );
}

interface CompetitionsDirectoryProps {
  /** Rows built server-side by getCompetitions (already sorted). */
  entries: CompetitionEntry[];
  /** `?sport=<slug>` of the request, used as the initial chip selection. */
  initialSport?: string;
  /** Server-side failure message, rendered as a banner instead of a crash. */
  error?: string;
}

/** Competition directory (`/competitions`): every competition the match feed can
 *  see, reachable without opening a match first — the entry point a user needs to
 *  browse fixtures, results and standings of a competition that is not kicking
 *  off right now.
 *
 *  The rows arrive as props (server-rendered), so the sport chips and the search
 *  box are pure client-side filters over an already-complete list: no extra
 *  upstream call, no spinner, instant response. `?sport=` is mirrored into the
 *  URL with a shallow history update, so a filtered view stays shareable. */
export function CompetitionsDirectory({ entries, initialSport = '', error = '' }: CompetitionsDirectoryProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sport, setSport] = useState(initialSport);
  const [query, setQuery] = useState('');

  /** Sports that actually have competitions in the feed — a chip that can only
   *  ever show an empty list is worse than no chip. */
  const chips = useMemo(() => {
    const counts = new Map<number, number>();
    for (const e of entries) counts.set(e.sportType, (counts.get(e.sportType) ?? 0) + 1);
    return SPORTS.filter((s) => (counts.get(s.value) ?? 0) > 0).map((s) => ({
      ...s,
      count: counts.get(s.value) ?? 0,
    }));
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (sport && sportSlug(e.sportType) !== sport) return false;
      if (!q) return true;
      return [e.name, e.country, sportLabel(e.sportType)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [entries, sport, query]);

  /** Counters follow the ACTIVE filter: a chip click narrows both the grid and
   *  the badges, so "33 competitions · 4 live" describes exactly what is on
   *  screen instead of the unfiltered total. */
  const liveTotal = useMemo(() => visible.reduce((n, e) => n + e.liveCount, 0), [visible]);

  const pickSport = (slug: string): void => {
    setSport(slug);
    // Shallow history update: the list is already on the client, so switching a
    // chip must not re-run the server render just to choose which rows to show.
    // The URL still reflects the filter, so the view stays shareable/crawlable.
    const url = slug ? `/competitions?sport=${slug}` : '/competitions';
    window.history.replaceState(null, '', url);
  };

  const emptyTitle = query ? 'No results' : 'No competitions';
  const emptyDesc = entries.length === 0
    ? 'The match feed returned no competitions and none have been seen yet. Try again in a moment.'
    : query
      ? `No competition matches "${query.trim()}". Try another keyword or clear the search.`
      : 'No competition in this sport has matches right now. Try another sport.';

  return (
    <>
      {/* Top banner — before the content. */}
      <AdBanner slotId={AD_SLOTS.topLeaderboard} client={ADSENSE_CLIENT} category="competitions" size="leaderboard" />

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent no-underline hover:underline">
          ← Live
        </Link>
        <div className="inline-flex items-center gap-3">
          <span className="font-mono text-xs text-muted">Competitions</span>
          <button
            type="button"
            className={REFRESH_BTN}
            onClick={() => startTransition(() => router.refresh())}
            disabled={pending}
            title="Refresh"
          >
            {pending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      <h1 className="m-0 mb-1 text-[22px] font-extrabold leading-tight">Competitions</h1>
      <p className="m-0 mb-4 text-[13px] text-muted">
        Browse every competition — fixtures, results, standings and player stats.
      </p>

      {/* Search + counters. Same horizontal scroll container pattern as the match
       *  lists: on narrow screens the input and the pills can be swiped into view
       *  instead of being clipped by the viewport. */}
      <section className="mb-[18px] flex flex-nowrap items-center gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <input
          className="min-w-[170px] flex-1 rounded-xl border border-border bg-panel px-4 py-[11px] text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
          type="search"
          placeholder="Search competitions or countries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="flex shrink-0 gap-2.5 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel px-3.5 py-1.5 text-[13px] text-muted [&_strong]:text-text">
            <strong>{visible.length}</strong> competitions
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.4)] bg-live-soft px-3.5 py-1.5 text-[13px] text-[#d93025]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
            {liveTotal} live
          </span>
        </span>
      </section>

      {/* Sport chips — All + every sport that has at least one competition. */}
      <section className="mb-4 flex flex-nowrap gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={sport === ''}
          onClick={() => pickSport('')}
          className={sport === '' ? FILTER_TAB_ACTIVE : FILTER_TAB_IDLE}
        >
          All sports
          <span className={sport === '' ? FILTER_COUNT_ACTIVE : FILTER_COUNT_IDLE}>{entries.length}</span>
        </button>
        {chips.map((s) => {
          const active = sport === s.slug;
          return (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pickSport(s.slug)}
              className={active ? FILTER_TAB_ACTIVE : FILTER_TAB_IDLE}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              {s.label}
              <span className={active ? FILTER_COUNT_ACTIVE : FILTER_COUNT_IDLE}>{s.count}</span>
            </button>
          );
        })}
      </section>

      {error && (
        <div className="mb-4 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]">
          {error}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyMatches
          kind={query ? 'search' : 'filter'}
          title={emptyTitle}
          desc={emptyDesc}
          onClear={query ? () => setQuery('') : undefined}
          onRetry={entries.length === 0 ? () => startTransition(() => router.refresh()) : undefined}
          retryBusy={pending}
        />
      ) : (
        <>
          {/* Competition cards — one per competition in the feed. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5">
            {visible.map((e) => (
              <CompetitionCard key={e.leagueId} entry={e} />
            ))}
          </div>

          {/* Rows without fixtures come from the server's seen-leagues registry:
           *  they keep a competition reachable after its last fixture left the
           *  feed window, which is the point of having a directory at all. */}
          {visible.some((e) => e.stale) && (
            <p className="mt-3 text-[12px] text-muted">
              Competitions marked “No fixtures in the feed window” have no match listed right now; their page
              still carries the current season, standings and squad data.
            </p>
          )}
        </>
      )}

      {/* Bottom content banner — after the list. */}
      <AdBanner slotId={AD_SLOTS.contentBannerBottom} client={ADSENSE_CLIENT} category="competitions" size="leaderboard" />
    </>
  );
}
