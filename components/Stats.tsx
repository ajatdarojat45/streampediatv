'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MatchStats, MatchStat, Team } from '@/lib/types';
import { statTypeLabel, isPercentStat } from '@/lib/matchProto';
import {
  PANEL,
} from '@/components/ui';


/** Team logo with a monogram fallback. */
function TeamLogo({ name, logo, size = 'h-6 w-6' }: { name?: string; logo?: string; size?: string }) {
  if (logo) {
    return <img src={logo} alt={name ?? ''} loading="lazy" className={`${size} shrink-0 rounded-md object-contain`} />;
  }
  return (
    <span
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold text-muted`}
    >
      {(name ?? '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** Team label with the logo on the OUTER side of the name: home logo on the
 *  left of the home name, away logo on the right of the away name.
 *  Same position as the Timeline tab header. */
function TeamChip({ name, logo, align }: { name?: string; logo?: string; align: 'home' | 'away' }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 ${
        align === 'away' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <TeamLogo name={name} logo={logo} />
      <span className="min-w-0 truncate text-[14px] font-semibold">{name ?? '—'}</span>
    </span>
  );
}

/** One stat comparison row: home value — label + split bar — away value.
 *  Percent stats (e.g. ball possession) are shown as-is; count stats scale the
 *  bar to the larger of the two values. */
function StatRow({ s }: { s: MatchStat }) {
  const home = s.homeValue ?? 0;
  const away = s.awayValue ?? 0;
  const pct = isPercentStat(s.statType);
  const total = home + away || 1;
  const homePct = pct ? home : Math.round((home / total) * 100);
  const awayPct = pct ? away : 100 - homePct;
  const label = statTypeLabel(s.statType);

  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-extrabold tabular-nums text-accent">{home}</span>
        <span className="min-w-0 flex-1 truncate text-center text-[12px] font-semibold text-muted">
          {label}
        </span>
        <span className="text-[15px] font-extrabold tabular-nums text-accent">{away}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-track">
        <div className="h-full bg-success transition-all duration-300" style={{ width: `${homePct}%` }} />
        <div className="h-full bg-live transition-all duration-300" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  );
}

export function Stats({
  stats,
  homeTeam,
  awayTeam,
}: {
  stats: MatchStats;
  homeTeam?: Team;
  awayTeam?: Team;
}) {
  const [open, setOpen] = useState(true);
  if (!stats.length) return null;

  return (
    <section className={PANEL}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <h3 className="m-0 text-[15px] font-bold">Match Statistics</h3>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="mt-3 mb-1 flex items-center gap-2.5">
            <div className="flex min-w-0 flex-1">
              <TeamChip name={homeTeam?.name} logo={homeTeam?.logo} align="home" />
            </div>
            <div className="flex min-w-0 flex-1 justify-end">
              <TeamChip name={awayTeam?.name} logo={awayTeam?.logo} align="away" />
            </div>
          </div>
          <div className="mt-1 divide-y divide-border-soft">
            {stats.map((s) => (
              <StatRow key={s.statType} s={s} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
