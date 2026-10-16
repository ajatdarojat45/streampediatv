'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TeamLogo, MatchRow } from '@/components/Match';
import { COUNT_IDLE } from '@/components/ui';
import type { Match } from '@/lib/types';

/** One league sub-group inside a Live/Upcoming/Finished status group. */
export interface LeagueGroup {
  key: string;
  name: string;
  logo?: string;
  items: Match[];
}

/** Group matches by league, preserving first-seen order. `minSize` defaults to
 *  1 so every league gets its own header (grouped by league name). Only when
 *  `minSize` > 1 are smaller groups merged into trailing "Other Leagues". */
export function groupMatchesByLeague(items: Match[], minSize = 1): LeagueGroup[] {
  const order: string[] = [];
  const map = new Map<string, LeagueGroup>();
  for (const m of items) {
    const name = m.league?.name || m.name || m.title || 'Other Leagues';
    const key =
      m.league?.leagueId != null ? `league-${m.league.leagueId}` : `league-name-${name}`;
    let g = map.get(key);
    if (!g) {
      g = { key, name, logo: m.league?.logo, items: [] };
      map.set(key, g);
      order.push(key);
    }
    if (!g.logo && m.league?.logo) g.logo = m.league.logo;
    g.items.push(m);
  }
  const main: LeagueGroup[] = [];
  const small: Match[] = [];
  for (const key of order) {
    const g = map.get(key)!;
    if (g.items.length >= minSize) main.push(g);
    else small.push(...g.items);
  }
  if (small.length) main.push({ key: 'league-other', name: 'Other Leagues', items: small });
  return main;
}

/** League sub-section: logo + name + count header, then the league's cards.
 *  Cards keep their own category/league row + LIVE label so each card stays
 *  self-explanatory even when the group header is scrolled off-screen.
 *  The header is a toggle — collapsed leagues show only the header row. */
export function LeagueGroupSection({
  group,
  onMatchClick,
  defaultOpen = true,
}: {
  group: LeagueGroup;
  onMatchClick: (m: Match) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mb-1.5 flex w-full cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-surface-2"
      >
        {group.logo && (
          <TeamLogo path={group.logo} name={group.name} kind="league" size="league" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-muted">{group.name}</span>
        <span className={COUNT_IDLE}>{group.items.length}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          {group.items.map((m, i) => (
            <MatchRow
              key={`${m.matchId}-${i}`}
              match={m}
              onClick={() => onMatchClick(m)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
