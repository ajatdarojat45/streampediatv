'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Radio } from 'lucide-react';
import { inCompetitionSection } from '@/lib/sections';

/**
 * The app's two halves, as one switch.
 *
 * It sits in the header beside the theme toggle, so it is reachable from every
 * page, and it is the only piece of chrome both halves share: the sport row
 * below it (components/SportNav) belongs to the live half and is not drawn on
 * the competition pages, where a club, a player and a competition cross-link
 * each other instead (see lib/sections.ts for the split).
 *
 * The pill style is the one the directory link already used, and the active pill
 * is the header's gradient, so the current half is unmistakable at a glance.
 * On phones both labels fold away and the two icons (with the accessible names
 * below) carry the switch.
 */
const PILL =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-[9px] text-sm font-semibold no-underline transition-all duration-150 max-[640px]:px-2.5 max-[640px]:py-2';
const PILL_IDLE = `${PILL} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const PILL_ACTIVE = `${PILL} border-transparent text-white [background:var(--grad)] shadow-[0_6px_18px_rgba(26,115,232,0.25)]`;

export function SectionSwitch() {
  const pathname = usePathname();
  const competitions = inCompetitionSection(pathname);

  return (
    <nav className="inline-flex shrink-0 items-center gap-2" aria-label="App sections">
      <Link
        href="/"
        className={competitions ? PILL_IDLE : PILL_ACTIVE}
        aria-label="Live"
        title="Live — scores, streams and the player"
        aria-current={competitions ? undefined : 'page'}
      >
        <Radio className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="max-[640px]:hidden">Live</span>
      </Link>
      <Link
        href="/competitions"
        className={competitions ? PILL_ACTIVE : PILL_IDLE}
        aria-label="Competitions"
        title="Competitions — browse by continent and federation"
        aria-current={competitions ? 'page' : undefined}
      >
        <Globe className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="max-[640px]:hidden">Competitions</span>
      </Link>
    </nav>
  );
}
