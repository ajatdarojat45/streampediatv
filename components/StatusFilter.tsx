'use client';

import { COUNT_IDLE, COUNT_ON, PILL_ROW, TAB_ACTIVE, TAB_IDLE } from '@/components/ui';
import { matchPhase, type MatchPhase } from '@/lib/matchProto';
import type { Match } from '@/lib/types';

/** Which slice of a match list is on screen: one phase, or all of them. */
export type MatchFilter = 'all' | MatchPhase;

/** The filter vocabulary, in its one order. The home feed and every category
 *  feed are narrowed by the same four tabs, each with its own count, so the two
 *  pages read as siblings and a visitor only learns one control. */
const FILTERS: { key: MatchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'finished', label: 'Finished' },
];

/** How many matches each tab would show. Counted off the list a search left
 *  behind, so a tab never promises rows the search has taken away. */
export function matchFilterCounts(list: Match[]): Record<MatchFilter, number> {
  const counts: Record<MatchFilter, number> = {
    all: list.length,
    live: 0,
    upcoming: 0,
    finished: 0,
  };
  for (const m of list) counts[matchPhase(m.status)] += 1;
  return counts;
}

/** The rows one tab shows — the whole list on `All`, one phase otherwise. */
export function filterMatches<T extends Match>(list: T[], filter: MatchFilter): T[] {
  if (filter === 'all') return list;
  return list.filter((m) => matchPhase(m.status) === filter);
}

/** Label of a tab, for the empty state's copy ("No live matches"). */
export const matchFilterLabel = (filter: MatchFilter): string =>
  FILTERS.find((f) => f.key === filter)?.label ?? 'All';

/** The All / Live / Upcoming / Finished row that narrows a feed. Lives directly
 *  above the list it filters — and, on a category feed, above the phase
 *  sections themselves, which is why that feed drops a section header once its
 *  own tab is pinned (the tab already says it). */
export function StatusFilter({
  value,
  counts,
  onChange,
}: {
  value: MatchFilter;
  counts: Record<MatchFilter, number>;
  onChange: (value: MatchFilter) => void;
}) {
  return (
    <section className={`mb-4 ${PILL_ROW}`} role="tablist" aria-label="Match status">
      {FILTERS.map((f) => {
        const on = f.key === value;
        return (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={on}
            className={on ? TAB_ACTIVE : TAB_IDLE}
            onClick={() => onChange(f.key)}
          >
            {f.label}
            <span className={on ? COUNT_ON : COUNT_IDLE}>{counts[f.key]}</span>
          </button>
        );
      })}
    </section>
  );
}
