'use client';

import { useId, useMemo, useState } from 'react';
import { Activity, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { TeamLogo } from '@/components/Match';
import { useMatchTrend } from '@/lib/queries';
import { formatMatchDate, matchDateMs } from '@/lib/datetime';
import { eventTypeLabel, isStarted, matchLabel } from '@/lib/matchProto';
import type { Match, TrendPoint } from '@/lib/types';

/* Match Chart — the momentum series of one fixture.
 *
 * Source: /api/match/trend (PBMatchTrendResp, endpoint code 102, the signature
 * the match detail uses). The payload ships one entry per minute of play plus
 * the incidents that produced them, and the value is SIGNED: positive = the
 * home side is on top, negative = the away side (verified against the goal
 * events of finished matches — an away goal is followed by negative momentum,
 * a home goal by positive).
 *
 * The series saturates at ±100, so the vertical scale is FIXED to that range
 * instead of being fitted per fixture: two matches of the same competition then
 * read at the same scale and a flat game looks flat. */

/** Surface panel (`.panel`) — the same card the watch page uses. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
const ERROR =
  'mb-3 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]';
const SELECT =
  'w-full cursor-pointer appearance-none rounded-full border border-border bg-panel py-2 pl-3.5 pr-9 text-[13px] font-semibold text-text outline-none transition-colors hover:border-[#c7ccd2] focus:border-accent';
const PILL =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-panel px-3.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50';
const EMPTY =
  'rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted';
const CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-bold [&_strong]:text-text';
const SKELETON = 'h-[200px] animate-pulse rounded bg-[#e8eaed] [[data-theme=dark]_&]:bg-border-soft';

/** Side colours — the pair the live board uses for home and away. */
const HOME = '#1a73e8';
const AWAY = '#d93025';

/** Chart viewport. The SVG is stretched to the panel width and the strokes are
 *  `non-scaling-stroke`, so the line stays hairline at every size. */
const W = 720;
const H = 200;
const PAD_X = 10;
const PAD_Y = 14;
const MID = H / 2;

/** Momentum is published in [-100, 100]; anything outside is clamped so a bad
 *  upstream value cannot throw the line off the canvas. */
const clamp = (v: number): number => Math.max(-100, Math.min(100, v));

/** Events worth a marker line: goals, cards and the half-time whistle. Corners
 *  and substitutions are listed under the chart, but marking them would carpet
 *  it (the busiest fixture probed carried 33 events, most of them corners). */
const MARKED = new Set([101, 102, 103, 106, 107, 108, 10003]);

const isGoal = (type?: number): boolean => type === 101 || type === 102 || type === 103;

/** Signed rendering for the peak summary ("+80", "-40", "0"). */
const signed = (v: number): string => `${v > 0 ? '+' : ''}${Math.round(v)}`;

/** An upstream 400 is how the feed answers a category that publishes no
 *  momentum at all — basketball, tennis and cricket were all probed and all
 *  answered 400 while football answered the full series — so it resolves to the
 *  "nothing published" state instead of an error a visitor could not retry
 *  away. A 429 or a 5xx still surfaces as a failure. */
const unsupported = (error: unknown): boolean =>
  error instanceof Error && /\b400\b/.test(error.message);

/** Fixture label for the drop-down. `matchLabel` appends the competition name,
 *  which would repeat on every option of this page, so the two clubs are used
 *  here and the date rides beside them. */
const fixtureLabel = (m: Match): string =>
  m.home?.name && m.away?.name ? `${m.home.name} vs ${m.away.name}` : matchLabel(m);

/** One entry of the chart's own geometry, built once per payload. */
interface Chart {
  from: number;
  to: number;
  px: (minute: number) => number;
  py: (value: number) => number;
  /** Poly-line through every point. */
  line: string;
  /** The same line closed onto the axis — the fill between line and axis. */
  area: string;
  /** Strongest home (max) and away (min) reading of the match. */
  peak: TrendPoint;
  trough: TrendPoint;
}

export function MatchChart({ matches, sportType }: { matches: Match[]; sportType: number }) {
  /** Newest fixture first — the drop-down leads with what a visitor just saw. */
  const options = useMemo(
    () =>
      [...matches].sort(
        (a, b) => (matchDateMs(b.matchDate) ?? 0) - (matchDateMs(a.matchDate) ?? 0)
      ),
    [matches]
  );

  /** Landing fixture: the most recent one that has actually kicked off — a
   *  fixture that has not started has no momentum to draw — else the newest. */
  const fallbackId = useMemo(() => {
    const pick =
      options.find((m) => isStarted(m.status) && m.matchId !== undefined) ??
      options.find((m) => m.matchId !== undefined);
    return pick?.matchId !== undefined ? String(pick.matchId) : '';
  }, [options]);

  /** '' = follow the default above, so the chart lands on a played fixture
   *  without an effect having to set state after mount. */
  const [picked, setPicked] = useState('');
  const matchId = picked || fallbackId;
  const match = useMemo(
    () => options.find((m) => String(m.matchId) === matchId),
    [options, matchId]
  );

  const trendQuery = useMatchTrend(matchId, sportType, Boolean(matchId));
  const points = useMemo(() => trendQuery.data?.points ?? [], [trendQuery.data]);
  const events = useMemo(() => trendQuery.data?.events ?? [], [trendQuery.data]);

  /** Clip ids must be unique per document; React's `useId` carries colons that
   *  are awkward inside `url(#…)`, so they are stripped. */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const homeClip = `match-chart-home-${uid}`;
  const awayClip = `match-chart-away-${uid}`;

  const chart: Chart | null = useMemo(() => {
    if (points.length === 0) return null;
    const minutes = points.map((p) => p.minute);
    const from = Math.min(...minutes);
    const to = Math.max(...minutes);
    const span = Math.max(1, to - from);
    const px = (minute: number): number => PAD_X + ((minute - from) / span) * (W - PAD_X * 2);
    const py = (value: number): number => MID - (clamp(value) / 100) * (MID - PAD_Y);
    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.minute).toFixed(2)} ${py(p.value).toFixed(2)}`)
      .join(' ');
    const area = `${line} L ${px(to).toFixed(2)} ${MID} L ${px(from).toFixed(2)} ${MID} Z`;
    const peak = points.reduce((best, p) => (p.value > best.value ? p : best), points[0]);
    const trough = points.reduce((worst, p) => (p.value < worst.value ? p : worst), points[0]);
    return { from, to, px, py, line, area, peak, trough };
  }, [points]);

  /** Marker lines, in minute order (the payload already is, but a phase entry
   *  repeats a minute, so the sort keeps each cluster together). */
  const marks = useMemo(
    () => events.filter((e) => MARKED.has(e.eventType ?? 0)).sort((a, b) => a.minute - b.minute),
    [events]
  );

  /** Every incident the feed reported, oldest first — the list under the chart. */
  const timeline = useMemo(() => [...events].sort((a, b) => a.minute - b.minute), [events]);

  /** Which side an incident belongs to — the competition's own club names. */
  const sideName = (side?: number): string =>
    side === 1 ? match?.home?.name ?? 'Home' : side === 2 ? match?.away?.name ?? 'Away' : '';

  const sideColor = (side?: number): string =>
    side === 1 ? HOME : side === 2 ? AWAY : 'currentColor';

  if (matches.length === 0) {
    return <p className={EMPTY}>No fixtures published for this season.</p>;
  }

  const score =
    match?.homeScore !== undefined && match?.awayScore !== undefined
      ? `${match.homeScore} – ${match.awayScore}`
      : '';

  /** A category the feed publishes no momentum for reads as "nothing yet". */
  const noTrend = trendQuery.isError && unsupported(trendQuery.error);

  return (
    <div>
      {/* Controls — the fixture drop-down (newest first) and a chart-only
          reload: the page's own Refresh does not reach this component's query. */}
      <section className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <label htmlFor="match-chart-fixture" className="text-[13px] font-semibold text-muted">
          Match
        </label>
        <span className="relative inline-flex min-w-[220px] flex-1">
          <select
            id="match-chart-fixture"
            className={SELECT}
            value={matchId}
            onChange={(e) => setPicked(e.target.value)}
          >
            {options.map((m) => {
              const id = String(m.matchId ?? '');
              if (!id) return null;
              return (
                <option key={id} value={id}>
                  {fixtureLabel(m)}
                  {m.matchDate ? ` · ${formatMatchDate(m.matchDate)}` : ''}
                </option>
              );
            })}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </span>
        <button
          type="button"
          className={PILL}
          onClick={() => void trendQuery.refetch()}
          disabled={trendQuery.isFetching}
          title="Reload the momentum chart"
        >
          {trendQuery.isFetching ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
          Reload chart
        </button>
      </section>

      <section className={PANEL}>
        {/* Legend — home above the axis, away below it, exactly as the areas
            are painted; the middle carries the score line when the feed has
            one. */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-2">
            <TeamLogo
              path={match?.home?.logo}
              name={match?.home?.name}
              sportType={sportType}
              size="league"
            />
            <span className="min-w-0 truncate text-[13px] font-semibold">
              {match?.home?.name ?? 'Home'}
            </span>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: HOME }}
              aria-hidden="true"
            />
          </span>
          {score ? (
            <strong className="text-[15px] tabular-nums">{score}</strong>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <Activity size={14} aria-hidden="true" /> Momentum
            </span>
          )}
          <span className="inline-flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: AWAY }}
              aria-hidden="true"
            />
            <span className="min-w-0 truncate text-[13px] font-semibold">
              {match?.away?.name ?? 'Away'}
            </span>
            <TeamLogo
              path={match?.away?.logo}
              name={match?.away?.name}
              sportType={sportType}
              size="league"
            />
          </span>
        </div>
        {trendQuery.isLoading && <div className={SKELETON} />}

        {!trendQuery.isLoading && trendQuery.isError && !noTrend && (
          <div className={`${ERROR} mb-0`}>
            {trendQuery.error instanceof Error
              ? `Could not load the chart: ${trendQuery.error.message}`
              : 'Could not load the chart for this fixture.'}
          </div>
        )}

        {!trendQuery.isLoading && (noTrend || !trendQuery.isError) && !chart && (
          <p className={EMPTY}>No momentum data published for this fixture yet.</p>
        )}

        {chart && (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-[200px] w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Momentum by minute: ${
                match?.home?.name ?? 'home'
              } above the axis, ${match?.away?.name ?? 'away'} below it`}
            >
              <defs>
                <clipPath id={homeClip}>
                  <rect x="0" y="0" width={W} height={MID} />
                </clipPath>
                <clipPath id={awayClip}>
                  <rect x="0" y={MID} width={W} height={MID} />
                </clipPath>
              </defs>

              {/* Zero line and the ±50 guides — the scale is fixed to the feed's
                  own -100…100 momentum so two fixtures stay comparable. */}
              {[50, 0, -50].map((v) => (
                <line
                  key={v}
                  x1={PAD_X}
                  x2={W - PAD_X}
                  y1={chart.py(v)}
                  y2={chart.py(v)}
                  stroke="currentColor"
                  strokeWidth={v === 0 ? 1 : 0.75}
                  strokeDasharray={v === 0 ? undefined : '3 5'}
                  className="text-border"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* One area per side, each clipped to its half of the canvas. */}
              <path
                d={chart.area}
                fill={HOME}
                fillOpacity="0.22"
                clipPath={`url(#${homeClip})`}
              />
              <path
                d={chart.area}
                fill={AWAY}
                fillOpacity="0.22"
                clipPath={`url(#${awayClip})`}
              />

              <path
                d={chart.line}
                fill="none"
                stroke="currentColor"
                className="text-text"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Incidents: a dashed line at the minute plus a square on the axis
                  — filled and side-coloured for a goal, hollow for a card or the
                  half-time whistle. */}
              {marks.map((e, i) => {
                const x = chart.px(e.minute);
                const color = sideColor(e.side);
                const title = `${e.minute}' ${eventTypeLabel(e.eventType) || 'Event'}${
                  sideName(e.side) ? ` — ${sideName(e.side)}` : ''
                }`;
                return (
                  <g key={`${e.minute}-${e.eventType ?? 0}-${i}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={4}
                      y2={H - 4}
                      stroke={color}
                      strokeWidth={1}
                      strokeDasharray="2 4"
                      opacity={0.5}
                      vectorEffect="non-scaling-stroke"
                    />
                    <rect
                      x={x - 3}
                      y={e.side === 2 ? MID + 4 : MID - 10}
                      width={6}
                      height={6}
                      rx={1}
                      fill={isGoal(e.eventType) ? color : 'transparent'}
                      stroke={color}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{title}</title>
                    </rect>
                  </g>
                );
              })}
            </svg>
            {/* Minute axis — start, middle and end of the tracked window. */}
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted">
              <span>{chart.from}&#39;</span>
              <span>{Math.round((chart.from + chart.to) / 2)}&#39;</span>
              <span>{chart.to}&#39;</span>
            </div>

            {/* The two extremes, the honest summary of the shape above. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
              <span>
                Home peak{' '}
                <strong className="text-text">{signed(chart.peak.value)}</strong> ({chart.peak.minute}
                &#39;)
              </span>
              <span>
                Away peak{' '}
                <strong className="text-text">{signed(chart.trough.value)}</strong> (
                {chart.trough.minute}&#39;)
              </span>
              <span>{points.length} minutes tracked</span>
            </p>

            {timeline.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {timeline.map((e, i) => (
                  <li key={`${e.minute}-${e.eventType ?? 0}-${i}`} className={CHIP}>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: sideColor(e.side) }}
                      aria-hidden="true"
                    />
                    <strong>{e.minute}&#39;</strong>
                    {eventTypeLabel(e.eventType) || 'Event'}
                    {sideName(e.side) && <span>· {sideName(e.side)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
