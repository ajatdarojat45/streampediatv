'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Radio, MoreHorizontal } from 'lucide-react';
import { POPULAR_SPORTS, MORE_SPORTS } from '@/lib/sports';
import { usePrefetchCategory } from '@/lib/streamingQueries';

const TAB_BASE =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-[9px] text-sm font-semibold no-underline transition-all duration-150 max-[640px]:px-[13px] max-[640px]:py-2 max-[640px]:text-[13px]';

const TAB_IDLE = `${TAB_BASE} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB_BASE} border-transparent text-white [background:var(--grad)] shadow-[0_6px_18px_rgba(26,115,232,0.25)]`;
const TAB_LIVE_ACTIVE = `${TAB_BASE} border-transparent text-white [background:linear-gradient(135deg,#ef4444,#f97316)] shadow-[0_6px_18px_rgba(239,68,68,0.3)]`;

const TILE_BASE =
  'flex flex-col items-center gap-2 rounded-xl border px-2.5 py-3.5 text-[13px] font-semibold no-underline transition-all duration-150';
const TILE_IDLE = `${TILE_BASE} border-border bg-card text-muted hover:border-[#c7ccd2] hover:text-text`;
const TILE_ACTIVE = `${TILE_BASE} border-accent bg-accent-soft text-accent`;

const ICON_BTN =
  'bg-transparent px-1.5 py-0.5 text-[13px] text-muted hover:text-text [[data-theme=dark]_&]:text-text';

/** Header navigation bar — mirrors the home page toolbar: a "Live" tab, the
 *  popular sports, and a "More" button that opens the full sport picker. */
export function SportNav() {
  const pathname = usePathname();
  const prefetchCategory = usePrefetchCategory();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string): boolean => pathname === href;

  return (
    <>
      <nav className="mb-4" aria-label="Sport categories">
        <div
          className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          <Link href="/" className={isActive('/') ? TAB_LIVE_ACTIVE : TAB_IDLE}>
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
                className={isActive(href) ? TAB_ACTIVE : TAB_IDLE}
                onMouseEnter={() => prefetchCategory(s.slug)}
                onFocus={() => prefetchCategory(s.slug)}
                onTouchStart={() => prefetchCategory(s.slug)}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
              </Link>
            );
          })}

          <button
            type="button"
            className={TAB_IDLE}
            onClick={() => setShowMore((v) => !v)}
            aria-haspopup="dialog"
            title="More sports"
          >
            <MoreHorizontal className="h-4 w-4 shrink-0" />
            More
          </button>
        </div>
      </nav>

      {showMore && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.6)] p-4 backdrop-blur-[4px]"
          onClick={() => setShowMore(false)}
        >
          <div
            className="m-0 flex max-h-[80vh] w-full max-w-[480px] flex-col overflow-hidden rounded border border-border bg-panel shadow"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-3.5 max-[640px]:px-3.5 max-[640px]:py-3">
              <h2 className="m-0 text-[16px]">All Sports</h2>
              <button type="button" className={ICON_BTN} onClick={() => setShowMore(false)} aria-label="Close">✕</button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2 overflow-y-auto px-[18px] py-3.5 max-[640px]:px-3.5 max-[640px]:py-3">
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

