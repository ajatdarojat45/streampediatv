'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';

/** Header pill for the competition directory. It used to be the first tab of
 *  the sport row; it now sits in the header itself, beside the theme toggle, so
 *  the directory is reachable from every page without taking a tab away from
 *  the sports. Like the tab it replaced, it lights up for the directory *and*
 *  for every competition detail page underneath it (`/competition/{id}`), so a
 *  visitor reading one competition still sees where they came from. */
const PILL =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-[9px] text-sm font-semibold no-underline transition-all duration-150 max-[640px]:px-2.5 max-[640px]:py-2';
const PILL_IDLE = `${PILL} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const PILL_ACTIVE = `${PILL} border-transparent text-white [background:var(--grad)] shadow-[0_6px_18px_rgba(26,115,232,0.25)]`;

export function CompetitionsLink() {
  const pathname = usePathname();
  const active = pathname === '/competitions' || pathname.startsWith('/competition/');

  return (
    <Link
      href="/competitions"
      className={active ? PILL_ACTIVE : PILL_IDLE}
      aria-label="Competitions"
      title="Competitions — browse by continent and federation"
      aria-current={active ? 'page' : undefined}
    >
      <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
      {/* The header is tight on phones, so the label folds away there and the
       *  globe (with the accessible name above) carries the link. */}
      <span className="max-[640px]:hidden">Competitions</span>
    </Link>
  );
}
