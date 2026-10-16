'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { MatchAnalysis, Match, Team } from '@/lib/types';
import { computeH2HSummary } from '@/lib/matchProto';
import { LocalTime } from '@/components/LocalTime';
import { watchHref } from '@/lib/sports';
import {
  PANEL,
} from '@/components/ui';


/** Logo sizes — kept identical to the match-card `LOGO_SIZE` tokens:
 *  team `h-6 w-6 rounded-md`, league `h-4 w-4 rounded-[4px]`, monogram `text-[11px]`. */
const TEAM_LOGO_SIZE = 'h-6 w-6';
const LEAGUE_LOGO_SIZE = 'h-4 w-4';

/** How many past meetings the list previews before the "Show all" toggle. */
const H2H_PREVIEW = 5;

/** Team logo with a monogram fallback. */
function TeamLogo({ name, logo, size = TEAM_LOGO_SIZE }: { name?: string; logo?: string; size?: string }) {
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

/** Compact team label used in the W/D/L summary header. Typography/spacing
 *  matches the match-card `TEAM_SIDE`/`TEAM_NAME` constants. */
function TeamChip({ name, logo, align }: { name?: string; logo?: string; align: 'home' | 'away' }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis ${
        align === 'home' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <TeamLogo name={name} logo={logo} />
      <span className="min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-[14px] font-semibold">{name ?? '—'}</span>
    </span>
  );
}

/** One past meeting: home : away, date, and (above the score) the competition
 *  they met in. Structure mirrors the match card: league row on top
 *  (full-width, centred), then the team grid, then the date row — with the
 *  same sizes/margins (mb-2 / min-w-[72px] / mt-2) so positions stay fixed.
 *  The card itself is a link into that meeting's own detail page (`/watch/[id]`,
 *  the route the list rows open) so a result can be drilled into; `matchId` is
 *  always present on the analysis payload, the plain card is the defensive
 *  fallback for a malformed entry. */
function MeetingRow({ m, sportType }: { m: Match; sportType?: number }) {
  const league = m.league;
  const stage = m.stage || m.round || m.group;
  const competition = league?.name || stage;
  const card =
    'block w-full rounded-lg border border-l-[3px] border-border border-l-[var(--neutral)] bg-card px-3.5 py-2.5';
  const body = (
    <div className="flex min-w-0 flex-col">
      {competition && (
        <span className="mb-2 flex items-center justify-center gap-1 text-[11px] leading-tight text-muted">
          {league?.logo && (
            <img
              src={league.logo}
              alt=""
              loading="lazy"
              className={`${LEAGUE_LOGO_SIZE} shrink-0 rounded-[4px] object-contain`}
            />
          )}
          <span className="min-w-0 max-w-[260px] truncate">
            {league?.name ?? competition}
            {stage && league?.name ? ` · ${stage}` : ''}
          </span>
        </span>
      )}
      <div className="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <div className="flex min-w-0 justify-end">
          <TeamChip name={m.home?.name} logo={m.home?.logo} align="home" />
        </div>

        <div className="flex min-w-[72px] items-center justify-center px-1">
          <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums">
            {m.homeScore ?? 0} : {m.awayScore ?? 0}
          </span>
        </div>

        <div className="flex min-w-0">
          <TeamChip name={m.away?.name} logo={m.away?.logo} align="away" />
        </div>
      </div>

      <span className="mt-2 flex justify-center">
        <span className="text-[11px] text-muted"><LocalTime ts={m.matchDate} /></span>
      </span>
    </div>
  );

  if (m.matchId == null) return <div className={card}>{body}</div>;
  return (
    <Link
      href={watchHref(m.matchId, m.sportType ?? sportType)}
      className={`${card} transition-[border-color,transform,box-shadow] hover:-translate-y-px hover:shadow`}
    >
      {body}
    </Link>
  );
}

export function H2H({
  analysis,
  homeTeam,
  awayTeam,
  sportType,
}: {
  analysis: MatchAnalysis;
  homeTeam?: Team;
  awayTeam?: Team;
  sportType?: number;
}) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const summary = computeH2HSummary(analysis.h2h, homeTeam);
  const h2h = [...analysis.h2h].sort((a, b) => (b.matchDate ?? 0) - (a.matchDate ?? 0));
  const hasMore = h2h.length > H2H_PREVIEW;
  const shown = expanded ? h2h : h2h.slice(0, H2H_PREVIEW);

  if (!h2h.length) return null;

  return (
    <section className={PANEL}>
      <h3 className="mb-3 mt-0 text-[15px] font-bold">Head to Head</h3>

      {/* Win / draw / loss summary framed by both teams. Each team's win
          percentage sits on its own side (home left, away right); the bar shows
          the W/D/L split from the home team's perspective. */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1">
            <TeamChip name={homeTeam?.name} logo={homeTeam?.logo} align="home" />
          </div>
          <span className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-[11px] text-muted">
            {summary.total} meetings
          </span>
          <div className="flex min-w-0 flex-1 justify-end">
            <TeamChip name={awayTeam?.name} logo={awayTeam?.logo} align="away" />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Home team's win % — left */}
          <span className="shrink-0 tabular-nums">
            <span className="text-[15px] font-extrabold text-success-ink">{summary.winPct}%</span>
            <span className="ml-0.5 text-[11px] font-semibold text-muted">W</span>
          </span>

          <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
            <div className="h-full bg-success" style={{ width: `${summary.winPct}%` }} />
            <div className="h-full bg-neutral" style={{ width: `${summary.drawPct}%` }} />
            <div className="h-full bg-live" style={{ width: `${summary.lossPct}%` }} />
          </div>

          {/* Away team's win % (= home's loss %) — right */}
          <span className="shrink-0 tabular-nums">
            <span className="text-[11px] font-semibold text-muted">W</span>
            <span className="ml-0.5 text-[15px] font-extrabold text-success-ink">{summary.lossPct}%</span>
          </span>
        </div>

        <div className="mt-1 text-center text-[11px] text-muted">
          {summary.drawPct}% draws ({summary.draws})
        </div>
      </div>

      {/* Past meetings, most recent first — the section collapses as a whole and
          the list previews `H2H_PREVIEW` meetings, the rest behind "Show all". */}
      <div className="mt-1 border-t border-border-soft pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
        >
          <span className="text-[13px] font-semibold text-muted">
            Past meetings ({summary.total})
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && (
          <div className="mt-2 flex flex-col gap-2">
            {shown.map((m) => (
              <MeetingRow key={m.matchId} m={m} sportType={sportType} />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mx-auto mt-1 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-semibold text-accent"
              >
                {expanded ? 'Show less' : `Show all ${h2h.length} meetings`}
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

