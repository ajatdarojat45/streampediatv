'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  RectangleVertical,
  Star,
  Volleyball,
} from 'lucide-react';
import type { MatchLineup, Team, LineupPlayer } from '@/lib/types';
import { positionLabel, type PlayerEventStats } from '@/lib/matchProto';
import { playerAvatarUrl } from '@/lib/logos';

/** Surface panel, matching the `.panel` style used across the detail page. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';

/** PBPlayerPositionType → compact badge (GK / DEF / MID / FWD). */
const positionAbbr = (code?: number): string =>
  ({ 1: 'FWD', 2: 'MID', 3: 'DEF', 4: 'GK' } as Record<number, string>)[code ?? 0] ?? '';

/** PBPlayerPositionType → pitch line rank: GK → DEF → MID → FWD (undefined last). */
const positionRank = (code?: number): number =>
  ({ 4: 0, 3: 1, 2: 2, 1: 3 } as Record<number, number>)[code ?? 0] ?? 4;

/** Starting XI first, then substitutes; within each group by position line
 *  (GK → DEF → MID → FWD) and then by the order the API provides per line. */
function sortLineup(list: LineupPlayer[]): LineupPlayer[] {
  return [...list].sort((a, b) => {
    const aSub = a.appearance === 2 ? 1 : 0;
    const bSub = b.appearance === 2 ? 1 : 0;
    if (aSub !== bSub) return aSub - bSub;
    const byPosition = positionRank(a.position) - positionRank(b.position);
    if (byPosition !== 0) return byPosition;
    return (a.positionOrder ?? 999) - (b.positionOrder ?? 999);
  });
}

/** Split a team's list into starters and substitutes (both pre-sorted). */
function splitLineup(list: LineupPlayer[]): { starters: LineupPlayer[]; subs: LineupPlayer[] } {
  const sorted = sortLineup(list);
  return {
    starters: sorted.filter((p) => p.appearance !== 2),
    subs: sorted.filter((p) => p.appearance === 2),
  };
}

/** Compact event badges for one player: goal(s), assist, cards, sub arrows.
 *  All glyphs are Lucide icons (no emoji) so they match the timeline tab and
 *  render consistently across platforms. */
function EventBadges({ stats }: { stats?: PlayerEventStats }) {
  if (!stats) return null;
  const { goals, assists, yellow, red, subIn, subOut } = stats;
  const chip = (key: string, cls: string, label: string, icon?: ReactNode) => (
    <span
      key={key}
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] font-bold leading-tight ${cls}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </span>
  );
  return (
    <span className="flex shrink-0 items-center gap-1">
      {goals > 0 && chip('g', 'text-[#16a34a]', goals > 1 ? String(goals) : '', <Volleyball size={11} />)}
      {assists > 0 && chip('a', 'text-accent', `AST${assists > 1 ? ` ${assists}` : ''}`, <Star size={11} />)}
      {subIn && chip('in', 'text-[#16a34a]', '', <ArrowUp size={12} />)}
      {subOut && chip('out', 'text-[#dc2626]', '', <ArrowDown size={12} />)}
      {yellow > 0 && chip('y', 'text-[#eab308]', yellow > 1 ? String(yellow) : '', <RectangleVertical size={11} fill="currentColor" />)}
      {red > 0 && chip('r', 'text-[#dc2626]', red > 1 ? String(red) : '', <RectangleVertical size={11} fill="currentColor" />)}
    </span>
  );
}

function PlayerRow({
  p,
  sportType,
  stats,
  side,
}: {
  p: LineupPlayer;
  sportType: number;
  stats?: PlayerEventStats;
  side: 'home' | 'away';
}) {
  const name = p.player?.name ?? '—';
  const avatar = p.player?.logo ? playerAvatarUrl(sportType, p.player.logo) : '';
  const sub = p.appearance === 2;
  const initial = name.charAt(0).toUpperCase();

  const number = (
    <span className="w-6 shrink-0 text-center text-[13px] font-bold tabular-nums text-muted">
      {p.number ?? ''}
    </span>
  );
  const avatarEl = avatar ? (
    <img
      src={avatar}
      alt={name}
      loading="lazy"
      className="h-8 w-8 shrink-0 rounded-full bg-[#f1f3f5] object-cover [[data-theme=dark]_&]:bg-border-soft"
    />
  ) : (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8eaed] text-[12px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft">
      {initial}
    </span>
  );
  const text = (
    <span
      className={`flex min-w-0 flex-1 flex-col ${
        side === 'away' ? 'items-end text-right' : 'items-start'
      }`}
    >
      <span className="w-full truncate text-[13px] font-semibold leading-tight">{name}</span>
      <span className="text-[11px] leading-tight text-muted">
        {positionAbbr(p.position) || positionLabel(p.position)}
      </span>
    </span>
  );

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${
        side === 'away' ? 'flex-row-reverse' : ''
      } ${sub ? 'opacity-70' : ''}`}
    >
      {number}
      {avatarEl}
      {text}
      <EventBadges stats={stats} />
    </div>
  );
}

/** Team header (logo + name), mirrored for the away side. */
function TeamHeader({
  title,
  logo,
  side,
}: {
  title?: string;
  logo?: string;
  side: 'home' | 'away';
}) {
  return (
    <div
      className={`mb-2 flex min-w-0 items-center gap-2 ${
        side === 'away' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      {logo ? (
        <img src={logo} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded object-contain" />
      ) : (
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#e8eaed] text-[11px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft">
          {(title ?? '?').charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 truncate text-[14px] font-bold">
        {title ?? (side === 'home' ? 'Home' : 'Away')}
      </span>
    </div>
  );
}

/** Collapsible "Substitutes" block — label + rule + count with a chevron,
 *  mirrored per side. Collapsed by default so the starting XI stays the focus;
 *  tap the header to reveal the bench. */
function SubsSection({
  side,
  subs,
  sportType,
  statsMap,
}: {
  side: 'home' | 'away';
  subs: LineupPlayer[];
  sportType: number;
  statsMap?: Map<number, PlayerEventStats>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`my-2 flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-border-soft/60 ${
          side === 'away' ? 'flex-row-reverse' : ''
        }`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Substitutes</span>
        <span className="rounded-full border border-border bg-card px-2 py-px text-[11px] font-bold text-muted">
          {subs.length}
        </span>
        <span className="h-px flex-1 bg-border" />
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5">
          {subs.map((p, i) => (
            <PlayerRow
              key={`b-${p.player?.playerId ?? p.number}-${i}`}
              p={p}
              sportType={sportType}
              side={side}
              stats={statsMap?.get(p.player?.playerId ?? 0)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LineupColumn({
  title,
  logo,
  side,
  list,
  sportType,
  statsMap,
}: {
  title?: string;
  logo?: string;
  side: 'home' | 'away';
  list: LineupPlayer[];
  sportType: number;
  statsMap?: Map<number, PlayerEventStats>;
}) {
  const { starters, subs } = splitLineup(list);
  return (
    <div className="min-w-0">
      <TeamHeader title={title} logo={logo} side={side} />

      {/* Starting XI */}
      <div className="flex flex-col gap-0.5">
        {starters.map((p, i) => (
          <PlayerRow
            key={`s-${p.player?.playerId ?? p.number}-${i}`}
            p={p}
            sportType={sportType}
            side={side}
            stats={statsMap?.get(p.player?.playerId ?? 0)}
          />
        ))}
      </div>

      {/* Collapsible substitutes (only when the team actually named subs) */}
      {subs.length > 0 && (
        <SubsSection side={side} subs={subs} sportType={sportType} statsMap={statsMap} />
      )}
    </div>
  );
}

export function Lineup({
  lineup,
  homeTeam,
  awayTeam,
  sportType,
  homeStats,
  awayStats,
}: {
  lineup: MatchLineup;
  homeTeam?: Team;
  awayTeam?: Team;
  sportType?: number;
  /** Per-player event stats for the home team (goals/assists/cards/subs). */
  homeStats?: Map<number, PlayerEventStats>;
  /** Per-player event stats for the away team. */
  awayStats?: Map<number, PlayerEventStats>;
}) {
  const [open, setOpen] = useState(true);
  if (!lineup.home.length && !lineup.away.length) return null;
  const st = sportType ?? 1;
  const total = lineup.home.length + lineup.away.length;

  return (
    <section className={PANEL}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-3 flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[15px] font-bold">Lineups</span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
            {total} players
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        /* Two sides — home on the left, away on the right — split by a vertical
           rule. Stacks to a single column on narrow screens. */
        <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-[1fr_auto_1fr]">
          <LineupColumn
            side="home"
            title={homeTeam?.name}
            logo={homeTeam?.logo}
            list={lineup.home}
            sportType={st}
            statsMap={homeStats}
          />
          <div aria-hidden className="hidden w-px self-stretch bg-border md:block" />
          <LineupColumn
            side="away"
            title={awayTeam?.name}
            logo={awayTeam?.logo}
            list={lineup.away}
            sportType={st}
            statsMap={awayStats}
          />
        </div>
      )}
    </section>
  );
}
