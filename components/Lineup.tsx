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
import { ClubLink } from '@/components/ClubLink';
import { PlayerLink } from '@/components/PlayerLink';

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
  tail,
}: {
  p: LineupPlayer;
  sportType: number;
  stats?: PlayerEventStats;
  side: 'home' | 'away';
  /** Drawn at the END of the row instead of the event badges — what a Goaloo
   *  sheet carries and the catalogue's feed does not: the publisher's own marks
   *  (a goal with its minute, a card, the minute he came on) and his rating. */
  tail?: ReactNode;
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
  /** Photo and name travel together into the player's own page (PlayerLink
   *  renders the same content as plain text for a name the squad could not
   *  resolve, or any other sport). */
  const person = (
    <PlayerLink
      id={p.player?.playerPageId}
      name={p.player?.name}
      className={`flex min-w-0 flex-1 items-center gap-2 ${side === 'away' ? 'flex-row-reverse' : ''}`}
    >
      {avatarEl}
      {text}
    </PlayerLink>
  );

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${
        side === 'away' ? 'flex-row-reverse' : ''
      } ${sub ? 'opacity-70' : ''}`}
    >
      {number}
      {person}
      {tail !== undefined ? tail : <EventBadges stats={stats} />}
    </div>
  );
}

/** Team header (logo + name), mirrored for the away side. Crest and name are a
 *  single link into the club's own page when the feed's name resolved to one
 *  (ClubLink renders plain text for a team it could not resolve). `crest` and
 *  `note` are the two things the sources draw differently: a Goaloo crest comes
 *  off another host and carries its own broken-URL fallback (GoalooLogo), and a
 *  Goaloo sheet publishes the formation, which the catalogue's feed does not. */
function TeamHeader({
  team,
  side,
  crest,
  note,
}: {
  team?: Team;
  side: 'home' | 'away';
  /** Crest element; the default draws `team.logo` off the Rblink logo host. */
  crest?: ReactNode;
  /** Drawn after the club name — mirrored with the rest of the header. */
  note?: ReactNode;
}) {
  const title = team?.name;
  return (
    <ClubLink
      id={team?.clubId}
      name={title}
      className={`mb-2 flex min-w-0 items-center gap-2 ${
        side === 'away' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      {crest ??
        (team?.logo ? (
          <img src={team.logo} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded object-contain" />
        ) : (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#e8eaed] text-[11px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft">
            {(title ?? '?').charAt(0).toUpperCase()}
          </span>
        ))}
      <span className="min-w-0 truncate text-[14px] font-bold">
        {title ?? (side === 'home' ? 'Home' : 'Away')}
      </span>
      {note}
    </ClubLink>
  );
}

/** A single side's player list — an optional team header over the rows. Shared
 *  by the Starting XI grid and the (single-toggle) substitutes grid so both use
 *  identical row styling; the bench grid omits the header (it sits under the
 *  same two columns, already introduced by the Starting XI header). */
function PlayerColumn({
  team,
  side,
  players,
  sportType,
  statsMap,
  tail,
  crest,
  note,
  showHeader = true,
}: {
  team?: Team;
  side: 'home' | 'away';
  players: LineupPlayer[];
  sportType: number;
  statsMap?: Map<number, PlayerEventStats>;
  /** Drawn at the end of each row instead of the event badges (a Goaloo sheet). */
  tail?: (player: LineupPlayer) => ReactNode;
  /** Crest element for the team header (a Goaloo crest, typically). */
  crest?: ReactNode;
  /** Drawn beside the club name (the Goaloo sheet's formation). */
  note?: ReactNode;
  showHeader?: boolean;
}) {
  return (
    <div className="min-w-0">
      {showHeader && <TeamHeader team={team} side={side} crest={crest} note={note} />}
      <div className="flex flex-col gap-0.5">
        {players.map((p, i) => (
          <PlayerRow
            key={`${side}-${p.player?.playerId ?? p.number}-${i}`}
            p={p}
            sportType={sportType}
            side={side}
            stats={statsMap?.get(p.player?.playerId ?? 0)}
            tail={tail?.(p)}
          />
        ))}
      </div>
    </div>
  );
}

/** One side of the shell: the club, the eleven and the bench — ALREADY ordered
 *  by the caller (the catalogue sorts a lineup by position, `splitLineup`; a
 *  Goaloo sheet arrives in the formation order its publisher prints) — plus the
 *  three things the two sources draw differently: the crest, the note beside the
 *  club name (a Goaloo formation) and the tail of every row (the catalogue's
 *  event badges, a Goaloo mark with its minute and rating). */
export interface LineupColumn {
  team?: Team;
  /** Crest element; the default draws `team.logo` off the Rblink logo host. */
  crest?: ReactNode;
  /** Drawn beside the club name — the formation a Goaloo sheet publishes. */
  note?: ReactNode;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
  /** Per-player event stats, keyed by `player.playerId` (catalogue rows). */
  statsMap?: Map<number, PlayerEventStats>;
  /** Drawn at the end of each row — {@link EventBadges}, unless the caller puts
   *  something of its own there. */
  tail?: (player: LineupPlayer) => ReactNode;
}

/** Whether a side has anything to draw at all: a half-filed read (the Goaloo
 *  page prints both sheets or neither) must leave neither a stray "Away" header
 *  nor an empty half behind. */
const hasSide = (column: LineupColumn): boolean =>
  !!column.team || column.starters.length > 0 || column.subs.length > 0;

/** The lineup panel, drawn the same whichever publisher answered: a collapsible
 *  heading with the player count, the two starting elevens under one header per
 *  club, and ONE shared "Substitutes" toggle that reveals both benches (the H2H
 *  "Past meetings" idiom). The catalogue's own lineup (this module, {@link Lineup})
 *  and a Goaloo sheet (components/GoalooPanels) hand in the same two columns, so
 *  the Lineups tab reads identically in either half of the strip. */
export function LineupShell({
  home,
  away,
  sportType = 1,
  credit,
}: {
  home: LineupColumn;
  away: LineupColumn;
  sportType?: number;
  /** Drawn at the end of the heading — the Goaloo credit, whose numbers these
   *  are and where they were read from. */
  credit?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  // One shared substitute toggle for BOTH teams: the bench lists live in a
  // single grid that expands/collapses as a whole, so the two sides stay in sync.
  const [subsOpen, setSubsOpen] = useState(false);
  const total = home.starters.length + home.subs.length + away.starters.length + away.subs.length;
  const subCount = home.subs.length + away.subs.length;
  const twoSides = hasSide(home) && hasSide(away);
  const twoBenches = home.subs.length > 0 && away.subs.length > 0;

  return (
    <section className={PANEL}>
      <div className="mb-3 flex w-full items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
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
        {/* The credit sits OUTSIDE the toggle (an anchor inside a button is not
            a thing): the heading stays one click target and the Goaloo panel
            keeps its attribution. */}
        {credit}
      </div>

      {open && (
        <div>
          {/* Starting XI — home on the left, away on the right, split by a
              vertical rule. Stacks to a single column on narrow screens (and
              drops the rule, and the empty half, while only one side is out). */}
          <div
            className={`grid grid-cols-1 gap-x-5 gap-y-5 ${
              twoSides ? 'md:grid-cols-[1fr_auto_1fr]' : ''
            }`}
          >
            {hasSide(home) && (
              <PlayerColumn
                side="home"
                team={home.team}
                crest={home.crest}
                note={home.note}
                players={home.starters}
                sportType={sportType}
                statsMap={home.statsMap}
                tail={home.tail}
              />
            )}
            {twoSides && <div aria-hidden className="hidden w-px self-stretch bg-border md:block" />}
            {hasSide(away) && (
              <PlayerColumn
                side="away"
                team={away.team}
                crest={away.crest}
                note={away.note}
                players={away.starters}
                sportType={sportType}
                statsMap={away.statsMap}
                tail={away.tail}
              />
            )}
          </div>

          {/* One shared "Substitutes" toggle spanning both columns (H2H
              "Past meetings" style): a single control sitting between the
              Starting XI and the benches, so expanding it reveals BOTH teams. */}
          {subCount > 0 && (
            <button
              type="button"
              onClick={() => setSubsOpen((v) => !v)}
              aria-expanded={subsOpen}
              className="mt-4 flex w-full cursor-pointer items-center justify-between gap-2 border-0 border-t border-border bg-transparent p-0 pt-3 text-left"
            >
              <span className="text-[13px] font-semibold text-muted">
                Substitutes ({subCount})
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-muted transition-transform duration-200 ${subsOpen ? 'rotate-180' : ''}`}
              />
            </button>
          )}

          {subCount > 0 && subsOpen && (
            <div
              className={`mt-3 grid grid-cols-1 gap-x-5 gap-y-5 ${
                twoBenches ? 'md:grid-cols-[1fr_auto_1fr]' : ''
              }`}
            >
              {home.subs.length > 0 && (
                <PlayerColumn
                  side="home"
                  players={home.subs}
                  sportType={sportType}
                  statsMap={home.statsMap}
                  tail={home.tail}
                  showHeader={false}
                />
              )}
              {twoBenches && (
                <div aria-hidden className="hidden w-px self-stretch bg-border md:block" />
              )}
              {away.subs.length > 0 && (
                <PlayerColumn
                  side="away"
                  players={away.subs}
                  sportType={sportType}
                  statsMap={away.statsMap}
                  tail={away.tail}
                  showHeader={false}
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** The catalogue's own lineup — the fallback behind a Goaloo sheet. The payload
 *  is one flat list per club, so each side is split into its eleven and its
 *  bench (both sorted by position) and handed to {@link LineupShell}, with the
 *  per-player event stats the Timeline tab already computed. */
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
  if (!lineup.home.length && !lineup.away.length) return null;
  const home = splitLineup(lineup.home);
  const away = splitLineup(lineup.away);
  return (
    <LineupShell
      sportType={sportType}
      home={{ team: homeTeam, ...home, statsMap: homeStats }}
      away={{ team: awayTeam, ...away, statsMap: awayStats }}
    />
  );
}
