'use client';

import { useState, type ReactNode } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { ChevronDown, Loader2 } from 'lucide-react';
import { LocalTime } from '@/components/LocalTime';
import type {
  NowgoalMatchAbsence,
  NowgoalMatchEvent,
  NowgoalMatchFixTab,
  NowgoalMatchFixture,
  NowgoalMatchLastTab,
  NowgoalMatchLineupPlayer,
  NowgoalMatchLineupSide,
  NowgoalMatchMeeting,
  NowgoalMatchPeriod,
  NowgoalMatchStatRow,
  NowgoalMatchStrengthRow,
  NowgoalMatchView,
  NowgoalMatchVote,
} from '@/lib/types';

/* One match, three tabs — the publisher's own layout of its match pages, with
 * the rows of the tab that is open:
 *
 *   Detail   the timeline with its `HT`/`FT` markers, the statistics plates the
 *            publisher published and the highlight it links to
 *   Line Up  both formations with the eleven drawn the way the page lays them
 *            out, the bench behind them, and everyone both sides are missing
 *   H2H      the strength comparison, the page's own poll, the head-to-head list
 *            and both sides' form and fixtures, each behind its own buttons
 *
 * Nothing here reads upstream: the server resolved the tab and the plates and
 * handed over exactly the rows of the tab that is open (lib/nowgoalMatch.ts).
 * Every button is a link carrying the same query with one value changed, so the
 * URL always says what is on screen. */

/** Surface panel — the card every page of the app renders. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Tab pill — the same pair the players, competitions and club pages use. */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
/** The smaller pill a plate's own lists are switched with, its count on it. */
const CHIP =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-all';
const CHIP_IDLE = `${CHIP} border-border bg-card text-muted hover:border-[#c7ccd2] hover:text-text`;
const CHIP_ACTIVE = `${CHIP} border-accent bg-accent-soft text-accent`;
const COUNT = 'min-w-5 rounded-full bg-accent-soft px-1.5 text-center text-[10.5px] font-bold';
/** One swipeable row of pills, like the directory's own tab row. */
const ROW =
  'flex flex-nowrap gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/** The dashed box every empty plate renders. */
const EMPTY =
  'm-0 mt-3 rounded-[var(--radius-sm)] border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted';
/** One line of a match table (the head-to-head list and the fixtures). */
const LINE = 'rounded-lg border border-border bg-card px-3.5 py-2.5';

/** The event tones — the goal/assist/card tones the player page's own match log
 *  uses, so a card reads the same wherever it is printed. */
const GOAL_TONE =
  'border-[#c7e3cd] bg-[#e6f4ea] text-[#137333] [[data-theme=dark]_&]:border-border [[data-theme=dark]_&]:bg-[#17351f] [[data-theme=dark]_&]:text-[#6ee7a0]';
const ASSIST_TONE = 'border-border bg-accent-soft text-accent';
const YELLOW_TONE =
  'border-[#f0dfa8] bg-[#fdf6dd] text-[#8a6d1f] [[data-theme=dark]_&]:border-border [[data-theme=dark]_&]:bg-[#2f2a17] [[data-theme=dark]_&]:text-[#e8cf78]';
const RED_TONE =
  'border-[#f3c9c6] bg-[#fce8e6] text-[#c5221f] [[data-theme=dark]_&]:border-border [[data-theme=dark]_&]:bg-[#3a1a17] [[data-theme=dark]_&]:text-[#f87171]';
const DIM_TONE = 'border-border bg-card text-muted';

/** A crest with the monogram fallback every badge in the app carries. */
function Crest({ src, name, size = 'h-6 w-6' }: { src: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-md bg-[#e8eaed] text-[11px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft`}
        aria-hidden="true"
      >
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`${size} shrink-0 object-contain`}
    />
  );
}

/** Spinner for a navigation that is still in flight — Next's own
 *  `useLinkStatus` reports it, so this sits inside the link it belongs to. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null;
}

/** One mark: what a player did in an event, in the tone of what it was. */
function Mark({ text, title, tone }: { text: string; title: string; tone: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${tone}`}
    >
      {text}
    </span>
  );
}

/** One plate of a tab: the app's own panel with its own open state — the lists
 *  of a match are long, so a visitor can put away the ones he is not reading. */
function Plate({
  title,
  meta,
  aside,
  children,
  defaultOpen = true,
}: {
  title: ReactNode;
  meta?: string;
  aside?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
        >
          <span className="text-[15px] font-bold">{title}</span>
          {meta ? <span className="text-[11px] text-muted">{meta}</span> : null}
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {aside}
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

/** One side's name, linked to its own page when the page published its id. */
function SideName({ id, name, className }: { id: string; name: string; className?: string }) {
  if (!id) return <span className={className}>{name}</span>;
  return (
    <Link href={`/teams/${id}`} className={`${className ?? ''} no-underline hover:text-accent`}>
      {name}
    </Link>
  );
}

/** The query of a view with `overrides` applied: the same URL with one value
 *  changed. The tab the match opens on and the plates' own default lists are
 *  left out, so the shortest link is the one a visitor lands on. */
/** The page's own link builder: this match's query with one value changed. */
type Href = (overrides: Partial<Record<'tab' | 'last' | 'fix', string>>) => string;

function matchHref(
  id: string,
  view: NowgoalMatchView,
  overrides: Partial<Record<'tab' | 'last' | 'fix', string>>,
): string {
  const next = { tab: view.tab as string, last: view.last as string, fix: view.fix as string, ...overrides };
  const params = new URLSearchParams();
  if (next.tab && next.tab !== view.tabs[0]?.key) params.set('tab', next.tab);
  if (next.tab === 'h2h') {
    // The plates' own defaults are the head-to-head list and the home side's
    // fixtures, so only a switch away from them has to be written down.
    if (next.last && next.last !== 'h2h') params.set('last', next.last);
    if (next.fix && next.fix !== 'home') params.set('fix', next.fix);
  }
  const search = params.toString();
  return `/matches/${id}${search ? `?${search}` : ''}`;
}

/** The match itself: the competition it is played in, when and where, both sides
 *  with the score the header carries, and the tabs below them. */
function MatchHeader({ view, href }: { view: NowgoalMatchView; href: Href }) {
  const h = view.header;
  const played = h.homeScore !== null && h.awayScore !== null;
  // The publisher's own state word *is* the clock while a match is in play, and
  // it is empty before one kicks off — the badge always says something.
  const badge = h.minute || h.state || 'Scheduled';
  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        {h.competitionId ? (
          <Link
            href={`/competitions/${h.competitionId}`}
            className="font-semibold text-accent no-underline hover:underline"
          >
            {h.competition || 'Competition'}
          </Link>
        ) : (
          <span className="font-semibold">{h.competition}</span>
        )}
        {h.round ? <span>· {h.round}</span> : null}
        {h.venue ? <span>· {h.venue}</span> : null}
        {h.kickoffMs ? (
          <span className="ml-auto">
            <LocalTime ts={h.kickoffMs} variant="long" className="text-muted" />
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
          <SideName
            id={h.home.id}
            name={h.home.name}
            className="min-w-0 truncate text-[15px] font-bold"
          />
          <Crest src={h.home.crest} name={h.home.name} size="h-9 w-9" />
        </span>
        <span className="flex shrink-0 flex-col items-center gap-1">
          <span className="text-[20px] font-extrabold tabular-nums">
            {played ? `${h.homeScore} - ${h.awayScore}` : 'vs'}
          </span>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted">
            {badge}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Crest src={h.away.crest} name={h.away.name} size="h-9 w-9" />
          <SideName
            id={h.away.id}
            name={h.away.name}
            className="min-w-0 truncate text-[15px] font-bold"
          />
        </span>
      </div>

      {h.splits.length ? (
        <p className="m-0 mt-2 text-center text-[11px] text-muted">
          {h.splits.map((split) => `${split.label}: ${split.score}`).join(' · ')}
        </p>
      ) : null}

      <div className={`mt-3 border-t border-[rgba(0,0,0,0.06)] pt-2 [[data-theme=dark]_&]:border-[rgba(255,255,255,0.08)] ${ROW}`} role="tablist" aria-label="Match sections">
        {view.tabs.map((tab) => (
          <Link
            key={tab.key}
            href={href({ tab: tab.key })}
            scroll={false}
            role="tab"
            aria-selected={tab.key === view.tab}
            className={`no-underline ${tab.key === view.tab ? TAB_ACTIVE : TAB_IDLE}`}
          >
            {tab.label}
            <Pending />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The match's own page: the header, the tabs, and the plates of the tab that is
 *  open — all of which the server resolved already. */
export function MatchDetail({ id, view }: { id: string; view: NowgoalMatchView }) {
  const href: Href = (overrides) => matchHref(id, view, overrides);
  return (
    <>
      <MatchHeader view={view} href={href} />
      {view.tab === 'detail' ? <DetailTab view={view} /> : null}
      {view.tab === 'lineup' ? <LineUpTab view={view} /> : null}
      {view.tab === 'h2h' ? <H2HTab view={view} href={href} /> : null}
    </>
  );
}

/** The two-sided bar a comparison row is drawn with: the home share in the green
 *  the statistics rows use, the away share in their red (components/Stats.tsx). */
function Bars({ homePct, awayPct }: { homePct: number; awayPct: number }) {
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[#e5e7eb] [[data-theme=dark]_&]:bg-border-soft">
      <div
        className="h-full bg-[#16a34a] transition-all duration-300"
        style={{ width: `${homePct}%` }}
      />
      <div
        className="h-full bg-[#dc2626] transition-all duration-300"
        style={{ width: `${awayPct}%` }}
      />
    </div>
  );
}

/** The mark of one event and the tone it is drawn in, off the kind the reader
 *  decoded from the publisher's own label — the label itself is the tooltip. */
function EventMark({ event }: { event: NowgoalMatchEvent }) {
  const goals = event.players.filter((player) => player.role === 'scorer').length;
  const mark =
    event.kind === 'goal'
      ? { text: goals > 1 ? `G ${goals}` : 'G', tone: GOAL_TONE }
      : event.kind === 'own-goal'
        ? { text: 'OG', tone: RED_TONE }
        : event.kind === 'penalty'
          ? { text: 'P', tone: GOAL_TONE }
          : event.kind === 'yellow'
            ? { text: 'YC', tone: YELLOW_TONE }
            : event.kind === 'red'
              ? { text: 'RC', tone: RED_TONE }
              : event.kind === 'substitution'
                ? { text: 'SUB', tone: DIM_TONE }
                : event.kind === 'var'
                  ? { text: 'VAR', tone: ASSIST_TONE }
                  : { text: '·', tone: DIM_TONE };
  return <Mark text={mark.text} title={event.label} tone={mark.tone} />;
}

/** One event of the timeline, on its own side of the clock, with the players the
 *  page names — a goal names its scorer and his assistant, a substitution the
 *  player coming on and the one going off. */
function EventRow({ event }: { event: NowgoalMatchEvent }) {
  const body = (
    <span
      className={`flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12.5px] ${
        event.side === 'home' ? 'justify-end text-right' : ''
      }`}
    >
      {event.players.map((player, index) => (
        <span key={`${player.id}-${player.role}-${index}`} className="min-w-0">
          {player.role === 'in' ? <span className="text-muted">↑ </span> : null}
          {player.role === 'out' ? <span className="text-muted">↓ </span> : null}
          {player.name}
          {player.role === 'assist' ? <span className="text-muted"> (ast)</span> : null}
        </span>
      ))}
      {event.score ? <b className="tabular-nums text-muted">{event.score}</b> : null}
    </span>
  );
  const divider = 'border-t border-[rgba(0,0,0,0.06)] [[data-theme=dark]_&]:border-[rgba(255,255,255,0.08)]';
  return (
    <li className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 first:border-t-0 ${divider}`}>
      {event.side === 'home' ? body : <span aria-hidden="true" />}
      <span className="flex shrink-0 items-center gap-1.5">
        <EventMark event={event} />
        <b className="min-w-8 text-center text-[11px] tabular-nums text-muted">{event.minute}</b>
      </span>
      {event.side === 'away' ? body : <span aria-hidden="true" />}
    </li>
  );
}

/** The score the page prints at half-time and at full-time, on its own line
 *  across the list. */
function PeriodRow({ period }: { period: NowgoalMatchPeriod }) {
  return (
    <li className="flex items-center justify-center gap-2 border-t border-[rgba(0,0,0,0.06)] py-2 first:border-t-0 [[data-theme=dark]_&]:border-[rgba(255,255,255,0.08)]">
      <span className="text-[11px] font-bold tracking-wide text-muted">{period.label}</span>
      {period.score ? (
        <span className="text-[12px] font-bold tabular-nums">{period.score}</span>
      ) : null}
    </li>
  );
}

/** One statistics row: both of the publisher's own values with its label between
 *  them and the two-sided bar under them — the shape components/Stats.tsx draws.
 *  The values arrive as the page printed them, so anything that is not a number
 *  (`-`) keeps the row and loses the bar. */
function StatRowLine({ row }: { row: NowgoalMatchStatRow }) {
  const home = Number(row.home.replace('%', ''));
  const away = Number(row.away.replace('%', ''));
  const percent = row.home.includes('%') || row.away.includes('%');
  const numeric = Number.isFinite(home) && Number.isFinite(away) && (home > 0 || away > 0);
  const total = home + away || 1;
  const homePct = percent ? home : Math.round((home / total) * 100);
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-extrabold tabular-nums text-accent">
          {row.home || '—'}
        </span>
        <span className="min-w-0 flex-1 truncate text-center text-[12px] font-semibold text-muted">
          {row.label}
        </span>
        <span className="text-[14px] font-extrabold tabular-nums text-accent">
          {row.away || '—'}
        </span>
      </div>
      {numeric ? <Bars homePct={homePct} awayPct={100 - homePct} /> : null}
    </div>
  );
}

/** One line of the timeline: either an event or the score a period was taken
 *  at. */
type TimelineRow = { period: NowgoalMatchPeriod } | { event: NowgoalMatchEvent };

/** The timeline as one list — the events in the order they happened with the
 *  period markers where the clock they name falls: `HT` behind the events up to
 *  the 45th minute, `FT` (and anything else the page prints) behind them all. */
function timelineOf(events: NowgoalMatchEvent[], periods: NowgoalMatchPeriod[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let index = 0;
  for (const period of periods) {
    const limit = /^HT/i.test(period.label) ? 45 : Number.POSITIVE_INFINITY;
    while (index < events.length && events[index].minuteValue <= limit) {
      rows.push({ event: events[index] });
      index += 1;
    }
    rows.push({ period });
  }
  for (; index < events.length; index += 1) rows.push({ event: events[index] });
  return rows;
}

/** The detail tab: the timeline, the statistics plates the publisher published
 *  and the highlight it links to. A match it has published none of yet — one
 *  that has not kicked off — says so instead of drawing three empty plates. */
function DetailTab({ view }: { view: NowgoalMatchView }) {
  const { header, events, periods, stats, video } = view;
  const rows = timelineOf(events, periods);
  if (!events.length && !stats.length && !video) {
    return (
      <section className={PANEL}>
        <p className={EMPTY}>
          Nothing is published about {header.home.name} vs {header.away.name} yet — the timeline,
          the statistics and the highlight appear here once {header.competition || 'the publisher'}{' '}
          publishes them, and the line ups and the head-to-head record are already on their own
          tabs.
        </p>
      </section>
    );
  }
  return (
    <>
      {events.length ? (
        <Plate title="Timeline">
          <ol className="m-0 list-none p-0">
            {rows.map((row, index) =>
              'period' in row ? (
                <PeriodRow key={`period-${row.period.label}-${index}`} period={row.period} />
              ) : (
                <EventRow
                  key={`event-${row.event.minute}-${row.event.side}-${index}`}
                  event={row.event}
                />
              ),
            )}
          </ol>
        </Plate>
      ) : null}

      {stats.map((group, index) => (
        <Plate
          key={group.label}
          title="Statistics"
          meta={group.label}
          defaultOpen={index === 0}
        >
          <div className="divide-y divide-[rgba(0,0,0,0.06)] [[data-theme=dark]_&]:divide-[rgba(255,255,255,0.08)]">
            {group.rows.map((row, rowIndex) => (
              <StatRowLine key={`${row.label}-${rowIndex}`} row={row} />
            ))}
          </div>
        </Plate>
      ))}

      {video ? (
        <Plate title="Highlight">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border">
            <iframe
              src={video.embed}
              title={`${header.home.name} vs ${header.away.name} highlights`}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </Plate>
      ) : null}
    </>
  );
}

/** One player of a team sheet: his shirt number, his name (linked to his own
 *  page when the sheet carries his id), the publisher's rating for the match and
 *  whatever the page hangs off him — his goals, his cards, the substitution that
 *  took him off. */
function PlayerChip({
  player,
  dimmed = false,
}: {
  player: NowgoalMatchLineupPlayer;
  dimmed?: boolean;
}) {
  return (
    <span
      className={`flex min-w-0 max-w-[164px] flex-col items-center gap-0.5 rounded-lg border border-border px-2 py-1.5 text-center ${
        dimmed ? 'bg-card' : 'bg-panel'
      }`}
    >
      <span className="flex items-center gap-1 text-[10px] font-bold text-muted">
        {player.number ? <span className="tabular-nums">{player.number}</span> : null}
        {player.rating ? (
          <b className="rounded bg-accent-soft px-1 tabular-nums text-accent">{player.rating}</b>
        ) : null}
      </span>
      {player.id ? (
        <Link
          href={`/players/${player.id}`}
          className="min-w-0 max-w-full truncate text-[12px] font-semibold text-text no-underline hover:text-accent"
        >
          {player.name}
        </Link>
      ) : (
        <span className="min-w-0 max-w-full truncate text-[12px] font-semibold">{player.name}</span>
      )}
      {player.events.length ? (
        <span
          className="min-w-0 max-w-full truncate text-[9.5px] text-muted"
          title={player.events.map((event) => [event.label, event.minute].filter(Boolean).join(' ')).join(' · ')}
        >
          {player.events
            .map((event) => [event.label, event.minute].filter(Boolean).join(' '))
            .join(' · ')}
        </span>
      ) : null}
    </span>
  );
}

/** One side's sheet: the formation the page prints, the eleven laid out the way
 *  its own pitch groups them — the goalkeeper's line comes first in that markup,
 *  so the column is reversed and he keeps the bottom of it — and the bench
 *  behind them. */
function LineupSideBlock({
  title,
  crest,
  side,
}: {
  title: string;
  crest: string;
  side: NowgoalMatchLineupSide;
}) {
  return (
    <Plate
      title={
        <span className="flex items-center gap-2">
          <Crest src={crest} name={title} size="h-5 w-5" />
          <span>{title}</span>
        </span>
      }
      meta={side.formation ? `Formation ${side.formation}` : undefined}
    >
      {side.lines.length ? (
        <div className="mt-3 rounded-lg border border-[#d7e6d0] bg-[#eef6ea] px-3 py-4 [[data-theme=dark]_&]:border-border [[data-theme=dark]_&]:bg-[#16241a]">
          <div className="flex flex-col-reverse gap-3">
            {side.lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-start justify-center gap-2">
                {line.map((player, playerIndex) => (
                  <PlayerChip key={`${player.id}-${playerIndex}`} player={player} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {side.bench.length ? (
        <>
          <p className="m-0 mt-4 mb-2 text-[12px] font-bold text-muted">
            Substitutes ({side.bench.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {side.bench.map((player, index) => (
              <PlayerChip key={`${player.id}-${index}`} player={player} dimmed />
            ))}
          </div>
        </>
      ) : null}
    </Plate>
  );
}

/** One side's injured and suspended players, under the publisher's own word for
 *  it (`Injury`, `Suspension`). */
function AbsenceList({ absences }: { absences: NowgoalMatchAbsence[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {absences.map((absence, index) => (
        <li
          key={`${absence.id}-${absence.name}-${index}`}
          className="flex items-center gap-2 border-t border-[rgba(0,0,0,0.06)] py-1.5 first:border-t-0 [[data-theme=dark]_&]:border-[rgba(255,255,255,0.08)]"
        >
          <span className="shrink-0 text-[10.5px] font-bold text-muted">{absence.kind}</span>
          {absence.position ? (
            <span className="shrink-0 rounded border border-border bg-card px-1 text-[10px] font-semibold text-muted">
              {absence.position}
            </span>
          ) : null}
          {absence.id ? (
            <Link
              href={`/players/${absence.id}`}
              className="min-w-0 truncate text-[12.5px] font-semibold text-text no-underline hover:text-accent"
            >
              {absence.name}
            </Link>
          ) : (
            <span className="min-w-0 truncate text-[12.5px] font-semibold">{absence.name}</span>
          )}
          {absence.number ? (
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted">
              {absence.number}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The line up tab: both sheets as the publisher draws them, and everyone the
 *  analysis page lists as out. A match whose sheets it has not published yet —
 *  one that has not kicked off — says so rather than drawing two empty pitches. */
function LineUpTab({ view }: { view: NowgoalMatchView }) {
  const { header, lineup, homeAbsences, awayAbsences } = view;
  const sheets = [
    {
      key: 'home',
      title: header.home.name,
      crest: header.home.crest,
      side: lineup.home,
    },
    {
      key: 'away',
      title: header.away.name,
      crest: header.away.crest,
      side: lineup.away,
    },
  ];
  const drawn = sheets.filter((sheet) => sheet.side.lines.length);
  const absences = [
    { key: 'home', title: header.home.name, list: homeAbsences },
    { key: 'away', title: header.away.name, list: awayAbsences },
  ].filter((entry) => entry.list.length);
  const missing = homeAbsences.length + awayAbsences.length;
  if (!drawn.length && !missing) {
    return (
      <section className={PANEL}>
        <p className={EMPTY}>
          The publisher has not published the team sheets for this match yet. Both line ups, the
          substitutes and the players it lists as out appear here once it does.
        </p>
      </section>
    );
  }
  return (
    <>
      {drawn.map((sheet) => (
        <LineupSideBlock
          key={sheet.key}
          title={sheet.title}
          crest={sheet.crest}
          side={sheet.side}
        />
      ))}
      {missing ? (
        <Plate title="Missing players" meta={`${missing} out`} defaultOpen={!drawn.length}>
          <div className={`grid gap-4 ${absences.length > 1 ? 'min-[720px]:grid-cols-2' : ''}`}>
            {absences.map((entry) => (
              <div key={entry.key} className="min-w-0">
                <p className="m-0 mb-1.5 text-[12.5px] font-bold">{entry.title}</p>
                <AbsenceList absences={entry.list} />
              </div>
            ))}
          </div>
        </Plate>
      ) : null}
    </>
  );
}

/** How a result reads from the side a list follows — the three tones the club
 *  page's own fixtures use (components/TeamDetail.tsx). */
const RESULT: Record<string, string> = {
  W: 'bg-[#e6f4ea] text-[#137333] [[data-theme=dark]_&]:bg-[#17351f] [[data-theme=dark]_&]:text-[#6ee7a0]',
  D: 'bg-[#eef0f2] text-muted [[data-theme=dark]_&]:bg-border-soft',
  L: 'bg-[#fce8e6] text-[#c5221f] [[data-theme=dark]_&]:bg-[#3a1a17] [[data-theme=dark]_&]:text-[#f87171]',
};

/** One line of the strength comparison: both sides' own values with the share of
 *  the two the publisher's own script gave each of them — the shape the
 *  statistics rows are drawn with. */
function StrengthRowLine({ row }: { row: NowgoalMatchStrengthRow }) {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-extrabold tabular-nums text-accent">{row.home}</span>
        <span className="min-w-0 flex-1 truncate text-center text-[12px] font-semibold text-muted">
          {row.label}
        </span>
        <span className="text-[14px] font-extrabold tabular-nums text-accent">{row.away}</span>
      </div>
      <Bars homePct={row.homePct} awayPct={row.awayPct} />
    </div>
  );
}

/** The analysis page's own poll: how many of its readers picked either side, with
 *  the counts behind the two shares. */
function VotePlate({
  vote,
  home,
  away,
}: {
  vote: NowgoalMatchVote;
  home: string;
  away: string;
}) {
  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[15px] font-bold">Who will win?</h3>
        <span className="text-[11px] text-muted">
          {vote.total} {vote.total === 1 ? 'vote' : 'votes'}
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 text-[12px] font-semibold">
        <span className="min-w-0 truncate">
          {home} <b className="tabular-nums text-accent">{vote.homePct}%</b>{' '}
          <span className="font-normal text-muted">({vote.home})</span>
        </span>
        <span className="min-w-0 truncate text-right">
          <span className="font-normal text-muted">({vote.away})</span>{' '}
          <b className="tabular-nums text-accent">{vote.awayPct}%</b> {away}
        </span>
      </div>
      <div className="mt-2">
        <Bars homePct={vote.homePct} awayPct={vote.awayPct} />
      </div>
    </section>
  );
}

/** One of a plate's own buttons: the side (or list) it switches to with how many
 *  rows the server says are behind it. */
function ChipLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={`no-underline ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
    >
      <span className="max-w-[132px] truncate">{label}</span>
      <span className={COUNT}>{count}</span>
      <Pending />
    </Link>
  );
}

/** One meeting of a list: when it was played and in which competition, both
 *  sides, the score with the half-time score behind it, the corners, and how the
 *  side the list follows fared — the row the analysis page prints, with the
 *  meeting linked to its own page when the row carries its id. */
function MeetingRow({ meeting: m }: { meeting: NowgoalMatchMeeting }) {
  return (
    <li
      className={`${LINE} mb-2 grid grid-cols-[110px_1fr_auto_1fr_auto] items-center gap-2.5 max-[760px]:grid-cols-[86px_1fr_auto_1fr] max-[760px]:gap-1.5`}
    >
      <span className="text-[11px] leading-[1.35] text-muted">
        {m.kickoffMs ? <LocalTime ts={m.kickoffMs} /> : m.date || '—'}
        {m.competition ? (
          <span
            className="block truncate text-[10px]"
            title={m.competitionName || m.competition}
          >
            {m.competition}
          </span>
        ) : null}
      </span>
      {[m.home, m.away].map((side, index) => (
        <span key={`${side.id}-${index}`} className="contents">
          {index === 1 ? (
            <span className="min-w-[46px] text-center text-[13px] font-extrabold tabular-nums">
              {m.score ? m.score.replace('-', ' - ') : 'vs'}
              {m.halfScore ? (
                <span className="block text-[10px] font-semibold text-muted">({m.halfScore})</span>
              ) : null}
            </span>
          ) : null}
          <span
            className={`flex min-w-0 items-center ${
              index === 0 ? 'justify-end text-right' : 'text-left'
            }`}
          >
            <SideName
              id={side.id}
              name={side.name}
              className="min-w-0 truncate text-[13px] font-semibold max-[760px]:text-[12.5px]"
            />
          </span>
        </span>
      ))}
      <span className="flex items-center justify-end gap-1.5 max-[760px]:col-span-4 max-[760px]:justify-start">
        {m.corner ? (
          <span className="rounded border border-border px-1 text-[10px] text-muted" title="Corners">
            {m.corner}
          </span>
        ) : null}
        {m.result ? (
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-extrabold ${
              RESULT[m.result] ?? RESULT.D
            }`}
          >
            {m.result}
          </span>
        ) : null}
        {m.matchId ? (
          <Link
            href={`/matches/${m.matchId}`}
            className="text-[11px] font-semibold text-accent no-underline hover:underline"
          >
            Match
          </Link>
        ) : null}
      </span>
    </li>
  );
}

/** One of the next matches the analysis page lists for a side: when it is played
 *  (and how long until then, as that page counts it), which competition, and the
 *  opponent with where it is played. */
function FixtureLine({ fixture: f }: { fixture: NowgoalMatchFixture }) {
  const away = /^a/i.test(f.venue);
  return (
    <li className={`${LINE} mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1`}>
      <span className="text-[11px] leading-[1.35] text-muted">
        {f.kickoffMs ? <LocalTime ts={f.kickoffMs} /> : f.date || '—'}
        {f.competition ? (
          <span
            className="block truncate text-[10px]"
            title={f.competitionName || f.competition}
          >
            {f.competition}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mr-1.5 rounded border border-border bg-panel px-1 text-[10px] font-bold text-muted" title={f.venue}>
          {away ? 'A' : 'H'}
        </span>
        <span className="text-[13px] font-semibold">{f.opponent || '—'}</span>
      </span>
      {f.countdown ? <span className="text-[11px] text-muted">{f.countdown}</span> : null}
    </li>
  );
}

/** The h2h tab: the strength comparison, the page's own poll, and its two
 *  two-sided plates — the head-to-head list between both sides' own recent
 *  matches, and both sides' next fixtures. Every button is a link, so the list
 *  that is open is in the URL and only that list is ever sent to the client. */
function H2HTab({ view, href }: { view: NowgoalMatchView; href: Href }) {
  const { header, strength, vote, last, meetings, lastCounts, fix, fixtures, fixCounts } = view;
  if (!strength.length && !vote && !meetings.length && !fixtures.length) {
    return (
      <section className={PANEL}>
        <p className={EMPTY}>
          The publisher has not published its analysis of {header.home.name} vs {header.away.name}{' '}
          yet — the strength comparison, its poll, the head-to-head record and both sides&apos; form
          and fixtures appear here once it does.
        </p>
      </section>
    );
  }
  const lastTabs: { key: NowgoalMatchLastTab; label: string }[] = [
    { key: 'home', label: header.home.name },
    { key: 'h2h', label: 'Head-to-head' },
    { key: 'away', label: header.away.name },
  ];
  const fixTabs: { key: NowgoalMatchFixTab; label: string }[] = [
    { key: 'home', label: header.home.name },
    { key: 'away', label: header.away.name },
  ];
  const divider = 'divide-y divide-[rgba(0,0,0,0.06)] [[data-theme=dark]_&]:divide-[rgba(255,255,255,0.08)]';
  return (
    <>
      {strength.length ? (
        <Plate title="Strength">
          <div className={divider}>
            {strength.map((row, index) => (
              <StrengthRowLine key={`${row.label}-${index}`} row={row} />
            ))}
          </div>
        </Plate>
      ) : null}

      {vote ? <VotePlate vote={vote} home={header.home.name} away={header.away.name} /> : null}

      <Plate
        title="Last matches"
        meta={
          last === 'h2h'
            ? 'Head-to-head'
            : `${last === 'home' ? header.home.name : header.away.name} form`
        }
        aside={
          <div className={`${ROW} max-w-full`}>
            {lastTabs.map((option) => (
              <ChipLink
                key={option.key}
                href={href({ tab: 'h2h', last: option.key })}
                label={option.label}
                count={lastCounts[option.key] ?? 0}
                active={option.key === last}
              />
            ))}
          </div>
        }
      >
        {meetings.length ? (
          <ul className="m-0 list-none p-0">
            {meetings.map((meeting, index) => (
              <MeetingRow key={`${meeting.matchId}-${index}`} meeting={meeting} />
            ))}
          </ul>
        ) : (
          <p className={EMPTY}>The page lists no matches here.</p>
        )}
      </Plate>

      <Plate
        title="Fixtures"
        aside={
          <div className={`${ROW} max-w-full`}>
            {fixTabs.map((option) => (
              <ChipLink
                key={option.key}
                href={href({ tab: 'h2h', fix: option.key })}
                label={option.label}
                count={fixCounts[option.key] ?? 0}
                active={option.key === fix}
              />
            ))}
          </div>
        }
      >
        {fixtures.length ? (
          <ul className="m-0 list-none p-0">
            {fixtures.map((fixture, index) => (
              <FixtureLine key={`${fixture.opponent}-${fixture.date}-${index}`} fixture={fixture} />
            ))}
          </ul>
        ) : (
          <p className={EMPTY}>The page lists no next matches for this side.</p>
        )}
      </Plate>
    </>
  );
}








