'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Trophy } from 'lucide-react';
import { TeamLogo, MatchRow } from '@/components/Match';
import { leagueHref } from '@/lib/sports';
import type { Match } from '@/lib/types';

/** One league sub-group inside a Live/Upcoming/Finished status group. */
export interface LeagueGroup {
  key: string;
  name: string;
  logo?: string;
  /** Competition identity — when known, the group header itself links to
   *  `/competition/<id>` (see `LeagueGroupSection`); absent on the live feed,
   *  where the header stays plain text instead of a dead link. */
  leagueId?: number;
  sportType?: number;
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
      g = {
        key,
        name,
        logo: m.league?.logo,
        leagueId: m.league?.leagueId,
        sportType: m.sportType,
        items: [],
      };
      map.set(key, g);
      order.push(key);
    }
    if (!g.logo && m.league?.logo) g.logo = m.league.logo;
    if (g.leagueId === undefined && m.league?.leagueId !== undefined) {
      g.leagueId = m.league.leagueId;
    }
    if (g.sportType === undefined && m.sportType !== undefined) g.sportType = m.sportType;
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
 *  The header name opens the competition page (`/competition/<id>`, the list's
 *  "up" navigation) and the trailing chevron toggles the group — two separate
 *  targets, so a collapsed group shows only its header row. */
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
  const href = leagueHref(group.leagueId, group.sportType);
  /** Header content: league logo, name and the fixture count. When the league
   *  id is known (the match feed carries it) the whole cluster is one `<Link>`
   *  into `/competition/<id>`; otherwise it stays a plain span so there is no
   *  dead link. Mirrors how the native app treats a league header. */
  const label = (
    <>
      {group.logo && (
        <TeamLogo path={group.logo} name={group.name} kind="league" size="league" />
      )}
      <span
        className={`min-w-0 flex-1 truncate${
          href ? ' group-hover:text-accent group-hover:underline' : ''
        }`}
      >
        {group.name}
      </span>
      {/* Trophy = the "opens the competition page" affordance; it only exists
          where the header is actually a link. */}
      {href && (
        <Trophy
          className="h-3.5 w-3.5 shrink-0 text-muted transition-colors group-hover:text-accent"
          aria-hidden="true"
        />
      )}
      <span className="rounded-full border border-border bg-panel px-2 py-px text-[11px] font-bold text-muted">
        {group.items.length}
      </span>
    </>
  );
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1">
        {href ? (
          <Link
            href={href}
            title={`${group.name} — fixtures, results & standings`}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left text-[13px] font-bold text-text no-underline transition-colors hover:bg-border-soft/60"
          >
            {label}
          </Link>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-[13px] font-bold text-text">
            {label}
          </span>
        )}
        {/* Collapse toggle — a sibling of the link (never nested, which would be
            invalid markup): the name navigates, the chevron folds the group. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${group.name}`}
          onClick={() => setOpen((v) => !v)}
          className="-ml-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-border-soft/60 hover:text-text"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          />
        </button>
      </div>
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
