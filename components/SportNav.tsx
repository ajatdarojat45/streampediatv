'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, MoreHorizontal, Trophy, X } from 'lucide-react';
import { POPULAR_SPORTS, MORE_SPORTS } from '@/lib/sports';
import { usePrefetchCategory } from '@/lib/streamingQueries';
import { ICON_BTN, PANEL_HEAD, TAB_ACTIVE, TAB_IDLE } from '@/components/ui';

/* The header tabs are the app's shared page tabs (components/ui.ts) plus what
 * only a `Link` nav needs: links never underline. */
const NAV_TAB_IDLE = `${TAB_IDLE} no-underline`;
const NAV_TAB_ACTIVE = `${TAB_ACTIVE} no-underline`;
const NAV_ROW =
  'flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** Sport tile inside the "All Sports" dialog. */
const TILE =
  'flex flex-col items-center gap-2 rounded-lg border px-2.5 py-3.5 text-[13px] font-semibold no-underline transition-all';
const TILE_IDLE = `${TILE} border-border bg-card text-muted hover:border-border-hover hover:text-text`;
const TILE_ACTIVE = `${TILE} border-accent bg-accent-soft text-accent`;

/** Header navigation bar — the "Live" tab, the popular sports, and a "More"
 *  button that opens the full sport picker. Every tab shares one active
 *  treatment (accent); red is reserved for live *matches*, not navigation.
 *
 *  The order is the order the two axes are read in: the live feed first, then
 *  the sports people come for (one contiguous run — nothing else splits it),
 *  then the two ways out of the short list, the whole competitions directory
 *  and the all-sports picker, last. */
export function SportNav() {
  const pathname = usePathname();
  const prefetchCategory = usePrefetchCategory();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string): boolean => pathname === href;

  // Escape closes the picker, as it does for the app's other dialogs.
  useEffect(() => {
    if (!showMore) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMore(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showMore]);

  return (
    <>
      <nav className="mb-4" aria-label="Sport categories">
        <div className={NAV_ROW} role="tablist">
          <Link href="/" className={isActive('/') ? NAV_TAB_ACTIVE : NAV_TAB_IDLE}>
            <Radio className="h-4 w-4 shrink-0" />
            Live
          </Link>

          {POPULAR_SPORTS.map((s) => {
            const href = `/sports/${s.slug}`;
            return (
              <Link
                key={s.value}
                href={href}
                role="tab"
                aria-selected={isActive(href)}
                className={isActive(href) ? NAV_TAB_ACTIVE : NAV_TAB_IDLE}
                onMouseEnter={() => prefetchCategory(s.slug)}
                onFocus={() => prefetchCategory(s.slug)}
                onTouchStart={() => prefetchCategory(s.slug)}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
              </Link>
            );
          })}

          {/* Past the sports the short list carries: the directory of every
           *  competition, then the picker of every other sport. */}
          <Link
            href="/competitions"
            role="tab"
            aria-selected={isActive('/competitions')}
            className={isActive('/competitions') ? NAV_TAB_ACTIVE : NAV_TAB_IDLE}
          >
            <Trophy className="h-4 w-4 shrink-0" />
            Competitions
          </Link>

          <button
            type="button"
            className={NAV_TAB_IDLE}
            onClick={() => setShowMore((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={showMore}
            title="More sports"
          >
            <MoreHorizontal className="h-4 w-4 shrink-0" />
            More
          </button>
        </div>
      </nav>

      {showMore && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.55)] p-4 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[480px] flex-col overflow-hidden rounded border border-border bg-panel shadow-md"
            role="dialog"
            aria-modal="true"
            aria-label="All sports"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={PANEL_HEAD}>
              <h2 className="m-0 text-[15px] font-bold">All Sports</h2>
              <button type="button" className={ICON_BTN} onClick={() => setShowMore(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2 overflow-y-auto px-5 py-3.5 max-[640px]:px-3.5">
              {MORE_SPORTS.map((s) => {
                const href = `/sports/${s.slug}`;
                return (
                  <Link
                    key={s.value}
                    href={href}
                    className={isActive(href) ? TILE_ACTIVE : TILE_IDLE}
                    onClick={() => setShowMore(false)}
                  >
                    <s.icon className="h-[22px] w-[22px]" />
                    <span>{s.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

