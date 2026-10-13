'use client';

import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ArrowDown,
  ArrowUp,
  CircleDot,
  Flag,
  RectangleVertical,
  Repeat,
  Volleyball,
  Whistle,
  X,
  type LucideProps,
} from 'lucide-react';
import type { MatchEvent, MatchEvents, Team } from '@/lib/types';
import { eventMinute, eventTypeLabel } from '@/lib/matchProto';
import { playerAvatarUrl } from '@/lib/logos';
import { ClubLink } from '@/components/ClubLink';
import { PlayerLink } from '@/components/PlayerLink';

/** Surface panel, matching the `.panel` style used across the detail page. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';

/** Team logo with a monogram fallback. */
function TeamLogo({ name, logo }: { name?: string; logo?: string }) {
  if (logo) {
    return <img src={logo} alt={name ?? ''} loading="lazy" className="h-6 w-6 shrink-0 rounded-md object-contain" />;
  }
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#e8eaed] text-[11px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft"
    >
      {(name ?? '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** Team label with the logo on the OUTER side of the name: home logo on the
 *  left of the home name, away logo on the right of the away name. Crest and
 *  name link to the club's own page when the feed's name resolved to one. */
function TeamChip({ team, align }: { team?: Team; align: 'home' | 'away' }) {
  return (
    <ClubLink
      id={team?.clubId}
      name={team?.name}
      className={`inline-flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis ${
        align === 'away' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <TeamLogo name={team?.name} logo={team?.logo} />
      <span className="min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-[14px] font-semibold">{team?.name ?? '—'}</span>
    </ClubLink>
  );
}

/** Match-phase markers: kick-off and full-time bracket the in-play events. At
 *  full time the feed emits EVENT_END and FINISH together (sometimes in either
 *  order), so they are collapsed into a single closing marker — see `list`). */
const KICK_OFF = 10001;
const FULL_TIME = new Set([10002, 10005, 10010, 10022]);

/** Events that are worth showing on the timeline: player events plus the
 *  kick-off / full-time markers that bracket the match. */
const VISIBLE = new Set([
  101, 102, 103, 104, 105, 106, 107, 108, 109,
  10020, 10021,
  KICK_OFF, ...FULL_TIME,
]);

/** Match-phase order: full-time caps the top of the spine and kick-off caps the
 *  bottom (the timeline reads bottom-up: kick-off → full-time). Neither carries a
 *  usable minute (kick-off omits it; full-time's "90" would otherwise sort within
 *  the in-play events), so rank them explicitly. */
const phaseRank = (type: number): number =>
  FULL_TIME.has(type) ? -1 : type === KICK_OFF ? 1 : 0;

/** True for the neutral phase markers (kick-off / full-time), which have no
 *  team or player and render as a text pill stacked on the spine instead of a
 *  side card. */
const isPhaseMarker = (type: number): boolean => type === KICK_OFF || FULL_TIME.has(type);

/** Sort by match minute, preserving original order within the same minute.
 *  Minute strings look like "45+2" — parse to a comparable number. */
function minuteValue(e: MatchEvent): number {
  const raw = (e.minute ?? '').trim();
  if (!raw) return 0;
  const [base, extra] = raw.split('+');
  const n = Number(base) || 0;
  const x = Number(extra) || 0;
  return n + x * 0.1;
}

/** Icon + accent text colour for an event type. All event glyphs are Lucide
 *  icons (no emoji) so they match the rest of the UI and render consistently
 *  across platforms. */
type EventIcon = ComponentType<LucideProps>;
function eventMeta(code: number): { Icon: EventIcon; cls: string; filled?: boolean } {
  switch (code) {
    case 101:
    case 103:
    case 10020:
      return { Icon: Volleyball, cls: 'text-[#16a34a]' };
    case 102:
      return { Icon: Volleyball, cls: 'text-[#dc2626]' };
    case 104:
    case 10021:
      return { Icon: X, cls: 'text-muted' };
    case 106:
      return { Icon: RectangleVertical, cls: 'text-[#eab308]', filled: true };
    case 107:
    case 108:
      return { Icon: RectangleVertical, cls: 'text-[#dc2626]', filled: true };
    case 105:
      return { Icon: Repeat, cls: 'text-accent' };
    case 109:
      return { Icon: Flag, cls: 'text-muted' };
    case 10001: // kick off
      return { Icon: Whistle, cls: 'text-[#16a34a]' };
    case 10002: // full time: EVENT_END / FINISH / extra time / penalty finish
    case 10005:
    case 10010:
    case 10022:
      return { Icon: Whistle, cls: 'text-muted' };
    default:
      return { Icon: CircleDot, cls: 'text-muted' };
  }
}

/** Player avatar (or an initial chip when there's no image), mirrored-safe. */
function Avatar({
  name,
  logo,
  sportType,
}: {
  name?: string;
  logo?: string;
  sportType?: number;
}) {
  const url = logo ? playerAvatarUrl(sportType, logo) : '';
  const initial = (name || '?').charAt(0).toUpperCase();
  return url ? (
    <img
      src={url}
      alt={name ?? ''}
      loading="lazy"
      className="h-8 w-8 shrink-0 rounded-full bg-[#f1f3f5] object-cover [[data-theme=dark]_&]:bg-border-soft"
    />
  ) : (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8eaed] text-[12px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft">
      {initial}
    </span>
  );
}

/** Substitution lines are icon+label flex rows, so `text-align` can't place them
 *  the way it does plain text. The away side needs them (a) packed against the
 *  card's right edge — otherwise the label hugs the left edge while the avatar
 *  sits far away on the right — and (b) mirrored, so the in/out arrow reads to
 *  the right of the name (`Gonzalo Escalante ↑`) instead of to the left as on
 *  the home side (`↑ Gonzalo Escalante`).
 *  With `flex-row-reverse` the main axis starts at the RIGHT edge, so
 *  `justify-start` is what anchors the row to the right. */
const rowLayout = (away: boolean): string => (away ? 'flex-row-reverse justify-start' : '');

/** Secondary line under the player name (assist / own goal / sub-out / note). */
function subLine(e: MatchEvent, away: boolean): ReactNode {
  if ((e.eventType === 101 || e.eventType === 103) && e.assistant?.name)
    return (
      <span className="w-full truncate text-[11px] leading-tight text-muted">
        assist:{' '}
        <PlayerLink id={e.assistant.playerPageId} name={e.assistant.name}>
          {e.assistant.name}
        </PlayerLink>
      </span>
    );
  if (e.eventType === 102)
    return <span className="w-full truncate text-[11px] leading-tight text-muted">own goal</span>;
  if (e.eventType === 105 && e.substitutionOut?.name)
    return (
      <span
        className={`inline-flex w-full items-center gap-1 truncate text-[11px] leading-tight text-muted ${rowLayout(
          away
        )}`}
      >
        <ArrowDown size={11} className="shrink-0 text-[#dc2626]" />
        <PlayerLink
          id={e.substitutionOut.playerPageId}
          name={e.substitutionOut.name}
          className="min-w-0 truncate"
        >
          {e.substitutionOut.name}
        </PlayerLink>
      </span>
    );
  if (e.description)
    return <span className="w-full truncate text-[11px] leading-tight text-muted">{e.description}</span>;
  return null;
}

function EventRow({
  e,
  side,
  sportType,
}: {
  e: MatchEvent;
  side: 'home' | 'away';
  sportType?: number;
}) {
  const { Icon, cls, filled } = eventMeta(e.eventType);
  const away = side === 'away';
  const player = e.scorer ?? e.offender ?? e.substitutionIn;
  const main =
    e.eventType === 105 ? (
      <span
        className={`inline-flex w-full items-center gap-1 truncate text-[13px] font-semibold leading-tight ${rowLayout(
          away
        )}`}
      >
        <ArrowUp size={13} className="shrink-0 text-[#16a34a]" />
        <PlayerLink
          id={e.substitutionIn?.playerPageId}
          name={e.substitutionIn?.name}
          className="min-w-0 truncate"
        >
          {e.substitutionIn?.name ?? 'Substitution'}
        </PlayerLink>
      </span>
    ) : (
      <span className="w-full truncate text-[13px] font-semibold leading-tight">
        {player?.name ? (
          <PlayerLink id={player.playerPageId} name={player.name}>
            {player.name}
          </PlayerLink>
        ) : (
          eventTypeLabel(e.eventType)
        )}
      </span>
    );
  const card = (
    <div
      className={`row-start-1 flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 max-[640px]:gap-2 max-[640px]:px-2.5 ${
        away
          ? 'col-start-3 flex-row-reverse text-right max-[640px]:col-start-2'
          : 'col-start-1 max-[640px]:col-start-2'
      }`}
    >
      <Icon size={16} strokeWidth={2.25} fill={filled ? 'currentColor' : 'none'} className={`shrink-0 ${cls}`} />
      {/* Photo (avatar) and the name below each link to the player's own page —
          two sibling links, never one inside the other, so the card's own
          layout and the club links it also carries stay valid HTML. */}
      <PlayerLink id={player?.playerPageId} name={player?.name} className="flex shrink-0">
        <Avatar name={player?.name} logo={player?.logo} sportType={sportType} />
      </PlayerLink>
      <span className={`flex min-w-0 flex-1 flex-col ${away ? 'items-end' : 'items-start'}`}>
        {main}
        {subLine(e, away)}
      </span>
    </div>
  );
  // Spine: minute on top, then the score. Desktop keeps it in the middle,
  // equally-flanked 1fr/auto/1fr column; on phones the rail moves to the left
  // edge of the row (see the row grid below) and the events stack to its right.
  const spine = (
      <span className="col-start-2 row-start-1 flex w-11 shrink-0 flex-col items-center max-[640px]:col-start-1">
        <span className="rounded bg-panel px-1.5 text-[12px] font-bold tabular-nums text-muted">{eventMinute(e)}</span>
        {e.score && <span className="mt-0.5 rounded bg-panel px-1 text-[10px] tabular-nums text-muted">{e.score}</span>}
    </span>
  );
  // Desktop: centred spine, home card to its left and away card to its right.
  // Mobile (≤640px): the spine becomes a left rail and BOTH cards render in the
  // column right of it, so every event shares the same left edge. Both items are
  // pinned to row 1 so the explicit column placement can't spill onto a second
  // (implicit) row when the home card is declared after the spine.
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2.5 max-[640px]:grid-cols-[auto_1fr]">
      {spine}
      {card}
    </div>
  );
}

/** Neutral match-phase marker (kick-off / full-time). Neither event carries a
 *  team or player, so instead of a side card each renders as a bare whistle
 *  glyph that caps the end of the spine — no pill and no score. A small opaque
 *  `bg-panel` disc sits behind the glyph so it masks the line and reads as the
 *  line's terminator. It is centred over the mid spine on desktop and over the
 *  left rail on phones. The old `Kick Off` / `Full Time` text is kept off-screen
 *  for screen readers. */
function MarkerRow({ e }: { e: MatchEvent }) {
  return (
    // Desktop: centred column over the mid spine. Mobile: the spine is a 44px
    // (`w-11`) left rail, so the column is clamped to that width and the disc
    // centres on the rail (the line sits at `left-[22px]`).
    <div className="flex flex-col items-center max-[640px]:w-11">
      <span className="inline-flex items-center justify-center rounded-full bg-panel p-1">
        <Whistle size={16} strokeWidth={2.25} className="text-muted" aria-hidden />
        <span className="sr-only">{eventTypeLabel(e.eventType)}</span>
      </span>
    </div>
  );
}

export function Timeline({
  events,
  sportType,
  homeTeam,
  awayTeam,
}: {
  events: MatchEvents;
  sportType?: number;
  homeTeam?: Team;
  awayTeam?: Team;
}) {
  const [open, setOpen] = useState(true);
  // The feed emits both EVENT_END and FINISH at full time — keep a single
  // closing marker, preferring FINISH because it carries the final score.
  const closing = events.filter((e) => FULL_TIME.has(e.eventType));
  const final = closing.find((e) => e.score) ?? closing[0];
  const list = events.filter((e) => VISIBLE.has(e.eventType) && !FULL_TIME.has(e.eventType));
  if (final) list.push(final);
  // Full-time caps the top and kick-off caps the bottom; the in-play events in
  // between run newest → oldest (descending minute), so the timeline reads from
  // the last event back to the earliest. Stable within the same minute.
  list.sort((a, b) => {
    const byPhase = phaseRank(a.eventType) - phaseRank(b.eventType);
    return byPhase !== 0 ? byPhase : minuteValue(b) - minuteValue(a);
  });

  if (!list.length) return null;

  return (
    <section className={PANEL}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-3 flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[15px] font-bold">Timeline</span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
            {list.length} events
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
      <>
        {/* Team legend — same header pattern as the Stats/H2H tabs: home on the
            left, away on the right, aligned with the event columns below. */}
        <div className="mt-3 mb-3 flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1">
            <TeamChip team={homeTeam} align="home" />
          </div>
          <div className="flex min-w-0 flex-1 justify-end">
            <TeamChip team={awayTeam} align="away" />
          </div>
        </div>
      <div className="relative mt-1">
        {/* Vertical timeline line: down the centre column on desktop (both side
            columns are equal 1fr) and down the middle of the 44px (`w-11`) spine
            rail at the left edge on phones, matching the mobile row grid in
            `EventRow`. */}
        <div
          aria-hidden
          className="absolute bottom-4 left-1/2 top-4 z-0 w-px -translate-x-1/2 bg-border max-[640px]:left-[22px]"
        />
        <div className="relative z-10 flex flex-col gap-1.5">
          {list.map((e, i) =>
            isPhaseMarker(e.eventType) ? (
              <MarkerRow key={`${e.eventType}-${i}`} e={e} />
            ) : (
              <EventRow
                key={`${e.eventType}-${e.minute}-${i}`}
                e={e}
                side={e.teamSide === 2 ? 'away' : 'home'}
                sportType={sportType}
              />
            )
          )}
        </div>
      </div>
      </>
      )}
    </section>
  );
}
