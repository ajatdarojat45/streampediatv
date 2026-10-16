'use client';

import type { ComponentType } from 'react';
import { CalendarX2, Inbox, SearchX } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { BTN_ACCENT, BTN_GHOST, PANEL_EMPTY } from '@/components/ui';

/** Empty-state kind → icon + default copy. `search` = query returned nothing,
 *  `filter` = a status tab is empty, `none` = the feed itself is empty. */
export type EmptyKind = 'search' | 'filter' | 'none';

const KIND_META: Record<EmptyKind, { Icon: ComponentType<LucideProps>; title: string; desc: string }> = {
  search: {
    Icon: SearchX,
    title: 'No results',
    desc: 'No matches match your search. Try a different keyword or clear the search.',
  },
  filter: {
    Icon: CalendarX2,
    title: 'Nothing here yet',
    desc: 'There are no matches in this view right now. Check another tab.',
  },
  none: {
    Icon: Inbox,
    title: 'No matches',
    desc: 'There are no matches in this category right now. Pull to refresh or try again later.',
  },
};

/** Centered empty state for "no matches": contextual icon in a soft badge,
 *  title, description, and optional action buttons (clear search / retry). */
export function EmptyMatches({
  kind,
  title,
  desc,
  clearLabel = 'Clear search',
  onClear,
  onRetry,
  retryBusy = false,
}: {
  kind: EmptyKind;
  title?: string;
  desc?: string;
  /** The clear button's own words — a failed search is cleared, a filter is
   *  stepped out of ("Show all matches"). */
  clearLabel?: string;
  onClear?: () => void;
  onRetry?: () => void;
  retryBusy?: boolean;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.Icon;
  return (
    <section className={`${PANEL_EMPTY} flex flex-col items-center`}>
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="m-0 mb-1.5 text-[17px] font-bold">{title ?? meta.title}</h2>
      <p className="m-0 mb-4 max-w-[380px] text-[13px] text-muted">{desc ?? meta.desc}</p>
      {(onClear || onRetry) && (
        <span className="flex flex-wrap items-center justify-center gap-2">
          {onClear && (
            <button type="button" onClick={onClear} className={BTN_GHOST}>
              {clearLabel}
            </button>
          )}
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={retryBusy} className={BTN_ACCENT}>
              Try again
            </button>
          )}
        </span>
      )}
    </section>
  );
}
