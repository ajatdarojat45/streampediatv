'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { MatchAnalysis, Match, Team, MatchOutcome } from '@/lib/types';
import { matchOutcome } from '@/lib/matchProto';
import { LocalTime } from '@/components/LocalTime';
import { watchHref } from '@/lib/sports';

/** Surface panel, matching the `.panel` style used across the detail page. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';

/** Logo sizes — kept identical to the match-card `LOGO_SIZE` tokens (see H2H). */
const TEAM_LOGO_SIZE = 'h-6 w-6';
const LEAGUE_LOGO_SIZE = 'h-4 w-4';

/** Outcome → background token, shared by the per-row badge and the form dots. */
const OUTCOME_BG: Record<MatchOutcome, string> = {
  W: 'bg-[#16a34a]',
  D: 'bg-[#9ca3af]',
  L: 'bg-[#dc2626]',
};

/** How many of the most recent results the compact form strip shows, and how
 *  many fixtures a collapsed list previews before the "Show all" toggle. */
const FORM_LEN = 5;

/** Sort comparators: latest result first, soonest fixture first. */
const byDateDesc = (a: Match, b: Match): number => (b.matchDate ?? 0) - (a.matchDate ?? 0);
const byDateAsc = (a: Match, b: Match): number => (a.matchDate ?? 0) - (b.matchDate ?? 0);

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

/** Compact team label (typography/spacing mirrors the match-card `TeamChip`). */
function TeamChip({ name, logo, align }: { name?: string; logo?: string; align: 'home' | 'away' }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis ${
        align === 'home' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <span className="min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-[14px] font-semibold">{name ?? '—'}</span>
      <TeamLogo name={name} logo={logo} />
    </span>
  );
}

/** W / D / L pill for a single result. */
function OutcomeBadge({ outcome }: { outcome: MatchOutcome | null }) {
  if (!outcome) return null;
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[11px] font-bold text-white ${OUTCOME_BG[outcome]}`}
    >
      {outcome}
    </span>
  );
}

/** Does a match side correspond to the reference team? teamId first, name as
 *  fallback (mirrors the resolution used by `matchOutcome`). */
function isSameTeam(t: Team | undefined, ref: Team | undefined): boolean {
  if (!t || !ref) return false;
  if (t.teamId !== undefined && ref.teamId !== undefined) return t.teamId === ref.teamId;
  return !!t.name && t.name === ref.name;
}

/** One fixture row for a team: competition on top, then home : away (or "vs"
 *  for an upcoming tie) with the result badge next to the reference side, and
 *  the kick-off below. The left border carries the result colour (green/win,
 *  grey/draw, red/loss) or the accent for an upcoming fixture — the same
 *  structure as the H2H `MeetingRow`. The card is a link into that fixture's
 *  own detail page (`/watch/[id]`, the route the list rows open); the plain
 *  card is only the defensive fallback when `matchId` is missing. */
function FormRow({ m, refTeam, played, sportType }: { m: Match; refTeam?: Team; played: boolean; sportType?: number }) {
  const league = m.league;
  const stage = m.stage || m.round || m.group;
  const competition = league?.name || stage;
  const outcome = played ? matchOutcome(m, refTeam) : null;
  const border = !played
    ? 'border-l-accent'
    : outcome === 'W'
      ? 'border-l-[#16a34a]'
      : outcome === 'L'
        ? 'border-l-[#dc2626]'
        : 'border-l-[#9ca3af]';
  const homeIsRef = isSameTeam(m.home, refTeam);
  const awayIsRef = isSameTeam(m.away, refTeam);
  const card = `block w-full rounded-lg border border-l-[3px] border-border ${border} bg-card px-3.5 py-2.5`;
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
        <div className="flex min-w-0 items-center justify-end gap-2">
          <TeamChip name={m.home?.name} logo={m.home?.logo} align="home" />
          {played && homeIsRef && <OutcomeBadge outcome={outcome} />}
        </div>

        <div className="flex min-w-[72px] items-center justify-center px-1">
          {played ? (
            <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums">
              {m.homeScore ?? 0} : {m.awayScore ?? 0}
            </span>
          ) : (
            <span className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-wide text-muted">vs</span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          {played && awayIsRef && <OutcomeBadge outcome={outcome} />}
          <TeamChip name={m.away?.name} logo={m.away?.logo} align="away" />
        </div>
      </div>

      <span className="mt-2 flex justify-center">
        <span className="text-[11px] text-muted">
          <LocalTime ts={m.matchDate} />
        </span>
      </span>
    </div>
  );

  if (m.matchId == null) return <div className={card}>{body}</div>;
  return (
    <Link
      href={watchHref(m.matchId, m.sportType ?? sportType)}
      className={`${card} transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow`}
    >
      {body}
    </Link>
  );
}

/** One team's list inside a tab: a header (crest + optional last-5 form strip)
 *  followed by that team's fixtures. Renders nothing when the list is empty.
 *  With `maxVisible` set the list previews that many fixtures and any remainder
 *  sits behind that team's own "Show more" / "Show less" toggle. */
function TeamGroup({
  team,
  matches,
  played,
  showForm = false,
  sportType,
  maxVisible,
}: {
  team?: Team;
  matches: Match[];
  played: boolean;
  showForm?: boolean;
  sportType?: number;
  /** Preview this many fixtures, with the rest behind a per-team toggle. */
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!matches.length) return null;

  const form = showForm
    ? matches
        .slice(0, FORM_LEN)
        .map((m) => matchOutcome(m, team))
        .filter((o): o is MatchOutcome => o !== null)
    : [];
  const hasMore = maxVisible !== undefined && matches.length > maxVisible;
  const shown = expanded ? matches : matches.slice(0, maxVisible);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <TeamChip name={team?.name} logo={team?.logo} align="home" />
        {form.length > 0 && (
          <span className="flex shrink-0 items-center gap-1" title="Recent form">
            {form.map((o, i) => (
              <span
                key={i}
                className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded text-[11px] font-bold text-white ${OUTCOME_BG[o]}`}
              >
                {o}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {shown.map((m, i) => (
          <FormRow
            key={m.matchId ?? `${played ? 'latest' : 'next'}-${i}`}
            m={m}
            refTeam={team}
            played={played}
            sportType={sportType}
          />
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mx-auto flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-semibold text-accent"
          >
            {expanded ? 'Show less' : 'Show more'}
            <ChevronDown
              size={14}
              className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
    </div>
  );
}

/** Props shared by the two matches tabs. */
interface TeamMatchesProps {
  analysis: MatchAnalysis;
  homeTeam?: Team;
  awayTeam?: Team;
  /** Fallback sport code for rows whose own `sportType` is missing. */
  sportType?: number;
}

/** Panel behind both the "Latest Matches" and "Next Matches" tabs: a collapsible
 *  header (title + fixture count, as in Lineup) over the two teams' lists.
 *  Returns null when neither side has a fixture. */
function TeamMatchesPanel({
  title,
  homeTeam,
  homeMatches,
  awayTeam,
  awayMatches,
  played,
  showForm = false,
  sportType,
  maxVisible,
}: {
  title: string;
  homeTeam?: Team;
  homeMatches: Match[];
  awayTeam?: Team;
  awayMatches: Match[];
  played: boolean;
  /** Render each team's last-5 W/D/L strip (`TeamGroup`) — both teams alike. */
  showForm?: boolean;
  sportType?: number;
  /** When set, each team's list previews this many fixtures, with the
   *  remainder behind that team's own "Show more"; leave unset to render all. */
  maxVisible?: number;
}) {
  const [open, setOpen] = useState(true);
  if (!homeMatches.length && !awayMatches.length) return null;
  const total = homeMatches.length + awayMatches.length;

  return (
    <section className={PANEL}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-3 flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="m-0 text-[15px] font-bold">{title}</h3>
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
            {total} {total === 1 ? 'match' : 'matches'}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          <TeamGroup team={homeTeam} matches={homeMatches} played={played} showForm={showForm} sportType={sportType} maxVisible={maxVisible} />
          <TeamGroup team={awayTeam} matches={awayMatches} played={played} showForm={showForm} sportType={sportType} maxVisible={maxVisible} />
        </div>
      )}
    </section>
  );
}

/** "Latest Matches" tab — each team's recent results (most recent first), each
 *  with its own last-5 form strip. Decoded from the analysis payload (107):
 *  `homeLatest` / `awayLatest` (the API returns more than five per team; each
 *  team's list previews `FORM_LEN` and the rest sit behind its own "Show more"). */
export function LatestMatches({ analysis, homeTeam, awayTeam, sportType }: TeamMatchesProps) {
  return (
    <TeamMatchesPanel
      title="Latest Matches"
      homeTeam={homeTeam}
      homeMatches={[...analysis.homeLatest].sort(byDateDesc)}
      awayTeam={awayTeam}
      awayMatches={[...analysis.awayLatest].sort(byDateDesc)}
      played
      showForm
      sportType={sportType}
      maxVisible={FORM_LEN}
    />
  );
}

/** "Next Matches" tab — both teams' upcoming fixtures, soonest first. Decoded
 *  from the analysis payload (107): `homeNext` / `awayNext`. */
export function NextMatches({ analysis, homeTeam, awayTeam, sportType }: TeamMatchesProps) {
  return (
    <TeamMatchesPanel
      title="Next Matches"
      homeTeam={homeTeam}
      homeMatches={[...analysis.homeNext].sort(byDateAsc)}
      awayTeam={awayTeam}
      awayMatches={[...analysis.awayNext].sort(byDateAsc)}
      played={false}
      sportType={sportType}
    />
  );
}
