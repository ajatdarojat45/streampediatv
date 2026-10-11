'use client';

import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ArrowDown,
  ArrowUp,
  CircleDot,
  CircleStop,
  Flag,
  Play,
  RectangleVertical,
  Repeat,
  Volleyball,
  X,
  type LucideProps,
} from 'lucide-react';
import type { MatchEvent, MatchEvents, Team } from '@/lib/types';
import { eventMinute, eventTypeLabel } from '@/lib/matchProto';
import { playerAvatarUrl } from '@/lib/logos';

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
 *  left of the home name, away logo on the right of the away name. */
function TeamChip({ name, logo, align }: { name?: string; logo?: string; align: 'home' | 'away' }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis ${
        align === 'away' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <TeamLogo name={name} logo={logo} />
      <span className="min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-[14px] font-semibold">{name ?? '—'}</span>
    </span>
  );
}

/** Match-phase markers: kick-off opens the timeline, full-time closes it. At
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

/** Match-phase order: kick-off before every in-play event, full-time after them.
 *  Neither carries a usable minute (kick-off omits it; full-time's "90" would
 *  otherwise sort ahead of 90+ stoppage-time events), so rank them explicitly. */
const phaseRank = (type: number): number =>
  type === KICK_OFF ? -1 : FULL_TIME.has(type) ? 1 : 0;

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

/** Icon + accent text colour + spine dot colour for an event type. All event
 *  glyphs are Lucide icons (no emoji) so they match the rest of the UI and
 *  render consistently across platforms. */
type EventIcon = ComponentType<LucideProps>;
function eventMeta(code: number): { Icon: EventIcon; cls: string; dot: string; filled?: boolean } {
  switch (code) {
    case 101:
    case 103:
    case 10020:
      return { Icon: Volleyball, cls: 'text-[#16a34a]', dot: 'bg-[#16a34a]' };
    case 102:
      return { Icon: Volleyball, cls: 'text-[#dc2626]', dot: 'bg-[#dc2626]' };
    case 104:
    case 10021:
      return { Icon: X, cls: 'text-muted', dot: 'bg-[#9ca3af]' };
    case 106:
      return { Icon: RectangleVertical, cls: 'text-[#eab308]', dot: 'bg-[#eab308]', filled: true };
    case 107:
    case 108:
      return { Icon: RectangleVertical, cls: 'text-[#dc2626]', dot: 'bg-[#dc2626]', filled: true };
    case 105:
      return { Icon: Repeat, cls: 'text-accent', dot: 'bg-accent' };
    case 109:
      return { Icon: Flag, cls: 'text-muted', dot: 'bg-[#9ca3af]' };
    case 10001: // kick off
      return { Icon: Play, cls: 'text-[#16a34a]', dot: 'bg-[#16a34a]' };
    case 10002: // full time: EVENT_END / FINISH / extra time / penalty finish
    case 10005:
    case 10010:
    case 10022:
      return { Icon: CircleStop, cls: 'text-muted', dot: 'bg-[#9ca3af]' };
    default:
      return { Icon: CircleDot, cls: 'text-muted', dot: 'bg-[#9ca3af]' };
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

/** Secondary line under the player name (assist / own goal / sub-out / note). */
function subLine(e: MatchEvent): ReactNode {
  if ((e.eventType === 101 || e.eventType === 103) && e.assistant?.name)
    return (
      <span className="w-full truncate text-[11px] leading-tight text-muted">
        assist: {e.assistant.name}
      </span>
    );
  if (e.eventType === 102)
    return <span className="w-full truncate text-[11px] leading-tight text-muted">own goal</span>;
  if (e.eventType === 105 && e.substitutionOut?.name)
    return (
      <span className="inline-flex w-full items-center gap-1 truncate text-[11px] leading-tight text-muted">
        <ArrowDown size={11} className="shrink-0 text-[#dc2626]" />
        {e.substitutionOut.name}
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
  const { Icon, cls, dot, filled } = eventMeta(e.eventType);
  const away = side === 'away';
  const player = e.scorer ?? e.offender ?? e.substitutionIn;
  const main =
    e.eventType === 105 ? (
      <span className="inline-flex w-full items-center gap-1 truncate text-[13px] font-semibold leading-tight">
        <ArrowUp size={13} className="shrink-0 text-[#16a34a]" />
        {e.substitutionIn?.name ?? 'Substitution'}
      </span>
    ) : (
      <span className="w-full truncate text-[13px] font-semibold leading-tight">
        {player?.name || eventTypeLabel(e.eventType)}
      </span>
    );
  const card = (
    <div
      className={`col-start-2 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 max-[640px]:gap-2 max-[640px]:px-2.5 ${
        away ? 'flex-row-reverse text-right sm:col-start-3' : 'sm:col-start-1'
      }`}
    >
      <Icon size={16} strokeWidth={2.25} fill={filled ? 'currentColor' : 'none'} className={`shrink-0 ${cls}`} />
      <Avatar name={player?.name} logo={player?.logo} sportType={sportType} />
      <span className={`flex min-w-0 flex-1 flex-col ${away ? 'items-end' : 'items-start'}`}>
        {main}
        {subLine(e)}
      </span>
    </div>
  );
  // Centre spine: minute on top, then the score, then a coloured dot that sits
  // on the vertical line. The dot flows *below* the text (not absolutely
  // positioned) so it never covers the scoreline. On ≥640px it stays centred on
  // the line because the spine column is the middle, equally-flanked 1fr/auto/1fr
  // column; on mobile it sits in the leftmost auto column instead.
  const spine = (
      <span className="col-start-1 flex w-11 shrink-0 flex-col items-center sm:col-start-2">
        <span className="rounded bg-panel px-1.5 text-[12px] font-bold tabular-nums text-muted">{eventMinute(e)}</span>
        {e.score && <span className="mt-0.5 rounded bg-panel px-1 text-[10px] tabular-nums text-muted">{e.score}</span>}
      {/* Dot with a ring cut out so it punches through the vertical line. */}
      <span
        aria-hidden
        className={`mt-1 h-2.5 w-2.5 rounded-full ring-2 ring-panel ${dot}`}
      />
    </span>
  );
  // Mobile: the spine hugs the left edge and the card takes the remaining width
  // (two half-width columns are far too cramped on a phone). ≥640px: home cards
  // on the left, away cards on the right, spine pinned centre.
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-2.5 sm:grid-cols-[1fr_auto_1fr]">
      {spine}
      {card}
    </div>
  );
}

/** Neutral match-phase marker (kick-off / full-time). Neither event carries a
 *  team or player, so instead of a side card each renders as a text pill on the
 *  spine. On ≥640px the line runs down the centre of the row, so the pill is
 *  centred over it and stacked *above* the dot for kick-off (the timeline opens
 *  there) and *below* it for full-time (it closes there): the pill's own opaque
 *  background masks the line behind it, and because pill and dot are on separate
 *  rows they can never collide. On phones the line hugs the left edge — far too
 *  close to the panel for a pill centred on it to fit — so the pill keeps the
 *  usual right-of-the-dot position that every other row uses. */
function MarkerRow({ e }: { e: MatchEvent }) {
  const { dot } = eventMeta(e.eventType);
  const opening = e.eventType === KICK_OFF;
  const pill = (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1">
      <span className="text-[12px] font-bold uppercase tracking-wide text-muted">
        {eventTypeLabel(e.eventType)}
      </span>
      {e.score && (
        <span className="rounded bg-panel px-1.5 text-[11px] font-bold tabular-nums text-muted">
          {e.score}
        </span>
      )}
    </span>
  );
  return (
    // Mobile: dot pinned on the left spine, pill beside it (54px clear of it).
    // ≥640px: switch to a column so the pill stacks above/below the dot.
    <div className="relative flex items-center pl-[54px] sm:flex-col sm:gap-1 sm:pl-0">
      {opening && pill}
      <span
        aria-hidden
        className={`absolute left-[22px] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel sm:static sm:translate-x-0 sm:translate-y-0 ${dot}`}
      />
      {!opening && pill}
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
  // Kick-off first, full-time last, in-play events in minute order (stable).
  list.sort((a, b) => {
    const byPhase = phaseRank(a.eventType) - phaseRank(b.eventType);
    return byPhase !== 0 ? byPhase : minuteValue(a) - minuteValue(b);
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
            <TeamChip name={homeTeam?.name} logo={homeTeam?.logo} align="home" />
          </div>
          <div className="flex min-w-0 flex-1 justify-end">
            <TeamChip name={awayTeam?.name} logo={awayTeam?.logo} align="away" />
          </div>
        </div>
      <div className="relative mt-1">
        {/* Vertical timeline line. On ≥640px it runs down the centre column (both
            side columns are equal 1fr) so it meets every event's dot; on mobile
            the spine is the leftmost 22px-wide column, so the line shifts with
            it. Each dot's ring masks the line where they overlap, so events
            still read as distinct nodes. */}
        <div
          aria-hidden
          className="absolute bottom-4 left-[22px] top-4 z-0 w-px -translate-x-1/2 bg-border sm:left-1/2"
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
