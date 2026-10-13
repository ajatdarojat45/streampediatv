'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { MatchAnalysis, Match, Team } from '@/lib/types';
import { computeH2HSummary, matchLabel } from '@/lib/matchProto';
import { LocalTime } from '@/components/LocalTime';
import { ClubLink } from '@/components/ClubLink';
import { watchHref } from '@/lib/sports';

/** Surface panel, matching the `.panel` style used across the detail page. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';

/** Logo sizes — kept identical to the match-card `LOGO_SIZE` tokens:
 *  team `h-6 w-6 rounded-md`, league `h-4 w-4 rounded-[4px]`, monogram `text-[11px]`. */
const TEAM_LOGO_SIZE = 'h-6 w-6';
const LEAGUE_LOGO_SIZE = 'h-4 w-4';

/** A card's own click target, laid over the card. Every card here hosts links
 *  of its own (each club's crest + name → ClubLink) and a link may never nest
 *  inside another, so the card-wide navigation cannot be the root element; it
 *  is an absolutely positioned link instead, with the club links lifted above
 *  it (`relative z-10`, see ClubLink). Same pattern as the list rows. */
const ROW_OVERLAY = 'absolute inset-0 rounded-lg';

/** How many past meetings the list previews before the "Show all" toggle. */
const H2H_PREVIEW = 5;

/** Team logo with a monogram fallback. */
function TeamLogo({ name, logo, size = TEAM_LOGO_SIZE }: { name?: string; logo?: string; size?: string }) {
  if (logo) {
    return <img src={logo} alt={name ?? ''} loading="lazy" className={`${size} shrink-0 rounded-md object-contain`} />;
  }
  return (
    <span
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-md bg-[#e8eaed] text-[11px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft`}
    >
      {(name ?? '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** Compact team label used in the W/D/L summary header. Typography/spacing
 *  matches the match-card `TEAM_SIDE`/`TEAM_NAME` constants. Crest and name are
 *  one link into the club's own page when the feed's name resolved to one
 *  (ClubLink) — in the meeting rows it is what makes the club reachable, since
 *  the card's own click target is the meeting (see `MeetingRow`). */
function TeamChip({ team, align }: { team?: Team; align: 'home' | 'away' }) {
  return (
    <ClubLink
      id={team?.clubId}
      name={team?.name}
      className={`inline-flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis ${
        align === 'home' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <TeamLogo name={team?.name} logo={team?.logo} />
      <span className="min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-[14px] font-semibold">{team?.name ?? '—'}</span>
    </ClubLink>
  );
}

/** One past meeting: home : away, date, and (above the score) the competition
 *  they met in. Structure mirrors the match card: league row on top
 *  (full-width, centred), then the team grid, then the date row — with the
 *  same sizes/margins (mb-2 / min-w-[72px] / mt-2) so positions stay fixed.
 *  The card's own click target is that meeting's detail page (`/watch/[id]`, the
 *  route the list rows open) so a result can be drilled into — laid over the
 *  card because the clubs inside are links of their own. `matchId` is
 *  always present on the analysis payload, the plain card is the defensive
 *  fallback for a malformed entry. */
function MeetingRow({ m, sportType }: { m: Match; sportType?: number }) {
  const league = m.league;
  const stage = m.stage || m.round || m.group;
  const competition = league?.name || stage;
  const card =
    'block w-full rounded-lg border border-l-[3px] border-border border-l-[#9ca3af] bg-card px-3.5 py-2.5';
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
          <TeamChip team={m.home} align="home" />
        </div>

        <div className="flex min-w-[72px] items-center justify-center px-1">
          <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums">
            {m.homeScore ?? 0} : {m.awayScore ?? 0}
          </span>
        </div>

        <div className="flex min-w-0">
          <TeamChip team={m.away} align="away" />
        </div>
      </div>

      <span className="mt-2 flex justify-center">
        <span className="text-[11px] text-muted"><LocalTime ts={m.matchDate} /></span>
      </span>
    </div>
  );

  const hover =
    'transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow';
  if (m.matchId == null) return <div className={card}>{body}</div>;
  // The clubs inside are links now, so the card-wide navigation is an overlay
  // link carrying the fixture's own name (the visible text belongs to the club
  // links and can no longer be the label of this element).
  const label = matchLabel(m);
  return (
    <div className={`relative ${card} ${hover}`}>
      {body}
      <Link
        href={watchHref(m.matchId, m.sportType ?? sportType)}
        className={ROW_OVERLAY}
        aria-label={label}
      />
    </div>
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
            <TeamChip team={homeTeam} align="home" />
          </div>
          <span className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-[11px] text-muted">
            {summary.total} meetings
          </span>
          <div className="flex min-w-0 flex-1 justify-end">
            <TeamChip team={awayTeam} align="away" />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Home team's win % — left */}
          <span className="shrink-0 tabular-nums">
            <span className="text-[15px] font-extrabold text-[#16a34a]">{summary.winPct}%</span>
            <span className="ml-0.5 text-[11px] font-semibold text-muted">W</span>
          </span>

          <div className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e5e7eb] [[data-theme=dark]_&]:bg-border-soft">
            <div className="h-full bg-[#16a34a]" style={{ width: `${summary.winPct}%` }} />
            <div className="h-full bg-[#9ca3af]" style={{ width: `${summary.drawPct}%` }} />
            <div className="h-full bg-[#dc2626]" style={{ width: `${summary.lossPct}%` }} />
          </div>

          {/* Away team's win % (= home's loss %) — right */}
          <span className="shrink-0 tabular-nums">
            <span className="text-[11px] font-semibold text-muted">W</span>
            <span className="ml-0.5 text-[15px] font-extrabold text-[#16a34a]">{summary.lossPct}%</span>
          </span>
        </div>

        <div className="mt-1 text-center text-[11px] text-muted">
          {summary.drawPct}% draws ({summary.draws})
        </div>
      </div>

      {/* Past meetings, most recent first — the section collapses as a whole and
          the list previews `H2H_PREVIEW` meetings, the rest behind "Show all". */}
      <div className="mt-1 border-t border-[rgba(0,0,0,0.06)] pt-3 [[data-theme=dark]_&]:border-[rgba(255,255,255,0.08)]">
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
            className={`shrink-0 text-muted transition-transform duration-200 ${
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
                  className={`shrink-0 transition-transform duration-200 ${
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

