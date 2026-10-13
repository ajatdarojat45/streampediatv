'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy } from 'lucide-react';

/** Header menu entry (app/layout.tsx) into the competition directory.
 *
 *  The sport tabs below the header list sports, so the way into
 *  `/competitions` — the index of every competition, reachable without going
 *  through a match — belongs to the site chrome instead. Styled like the other
 *  header controls (ThemeToggle): a pill on desktop, icon-only on phones so the
 *  sticky header keeps its height and never crowds the logo. */
export function CompetitionsMenu() {
  const pathname = usePathname();
  // The directory and a competition page reached from it are one section.
  const active = pathname === '/competitions' || pathname.startsWith('/competition/');

  return (
    <Link
      href="/competitions"
      aria-current={active ? 'page' : undefined}
      title="Competitions"
      className={`inline-flex h-[38px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold no-underline transition-all duration-150 max-[640px]:h-9 max-[640px]:w-9 max-[640px]:justify-center max-[640px]:px-0 ${
        active
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text'
      }`}
    >
      <Trophy size={16} className="shrink-0" />
      <span className="max-[640px]:hidden">Competitions</span>
    </Link>
  );
}
