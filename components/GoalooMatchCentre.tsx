'use client';

/**
 * The Goaloo match centre on `/watch/{id}` — the second publisher's half of the
 * player page.
 *
 * The Rblink tabs above it (Overview / Head to Head / Lineups / Timeline) are
 * built from the stream catalogue's own payloads; this panel adds what only
 * Goaloo publishes: the score with its two half scores, both team sheets with
 * each player's rating and the minute he came on or went off, the event list,
 * the technical statistics of every period, the two clubs' recent form, where
 * their goals land inside the ninety minutes, their HT/FT record and the
 * minute-by-minute text feed (lib/goalooLive.ts).
 *
 * Everything is drawn from ONE server read, so the whole panel costs the page
 * one request — and none at all when the fixture is not in the Goaloo
 * catalogue, in which case `matched` comes back false and nothing is rendered.
 * The panel is only mounted for football, and it links every club and player it
 * prints into this app's own `/club/{id}` and `/player/{id}` pages: the ids on
 * the Goaloo page are the very ids those routes are addressed by.
 */
import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useGoalooMatchCentre } from '@/lib/queries';
import { ClubLink } from '@/components/ClubLink';
import { PlayerLink } from '@/components/PlayerLink';
import { GoalooLogo } from '@/components/GoalooLogo';
import { goalooLiveMatchUrl } from '@/lib/goalooLive';
import type {
  GoalooLiveBucket,
  GoalooLiveEvent,
  GoalooLiveFormRow,
  GoalooLiveHtFt,
  GoalooLiveMatch,
  GoalooLivePlayer,
  GoalooLiveSide,
  GoalooLiveStatRow,
  GoalooLiveTextRow,
} from '@/lib/types';

/** Surface panel, matching the `.panel` style used across the detail page. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Small label chip (state, half scores, formation, rating). */
const CHIP =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-panel px-2 py-[2px] text-[11px] font-semibold text-muted';
/** Tab button — the same strip the Rblink tabs draw above (MatchTabs). */
const TAB = '-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-[14px] font-semibold transition-colors duration-150 max-[640px]:px-2 max-[640px]:py-2 max-[640px]:text-[13px]';
/** Split bar: home on the left, away on the right. */
const BAR = 'flex h-2 overflow-hidden rounded-full bg-[#e5e7eb] [[data-theme=dark]_&]:bg-border-soft';

/** Crest with the Goaloo initial fallback (the panel prints club names next to
 *  it, so a broken URL must not leave a hole). */
function Crest({ src, name }: { src: string; name: string }) {
  return <GoalooLogo src={src} name={name} size="sm" />;
}

/** Rating colour: strong, average, poor — the publisher's own scale is 1–10. */
function ratingClass(rating: number): string {
  if (rating >= 7.5) return 'border-[rgba(22,163,74,0.45)] text-[#16a34a]';
  if (rating >= 6.5) return 'border-accent text-accent';
  return 'border-border text-muted';
}

/** Badge colour inside a sheet row, by the label Goaloo prints. */
function markClass(label: string): string {
  if (/goal|penalty scored|assist/i.test(label)) return 'border-[rgba(22,163,74,0.45)] text-[#16a34a]';
  if (/yellow/i.test(label)) return 'border-[rgba(217,119,6,0.5)] text-[#d97706]';
  if (/red|second yellow/i.test(label)) return 'border-[rgba(220,38,38,0.5)] text-[#dc2626]';
  return 'border-border text-muted';
}

/** One number out of a published value (`58%`, `1.42`, `2`) — `null` when the
 *  value is not a number at all, which is how a "-" cell keeps its text and
 *  loses its bar. */
function asNumber(value: string): number | null {
  const n = Number.parseFloat(String(value).replace('%', ''));
  return Number.isFinite(n) ? n : null;
}


/** Statistics of one period: `home — label — away` with the split bar under it,
 *  exactly the reading the Rblink Overview tab uses, so the two panels sit
 *  together without a change of idiom. */
function StatRows({ rows }: { rows: GoalooLiveStatRow[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((row) => {
        const home = asNumber(row.home);
        const away = asNumber(row.away);
        const total = home !== null && away !== null ? home + away : 0;
        const homePct = total > 0 ? Math.round(((home ?? 0) / total) * 100) : 50;
        return (
          <div key={row.label} className="py-2">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-extrabold tabular-nums text-accent">{row.home}</span>
              <span className="min-w-0 flex-1 truncate text-center text-[12px] font-semibold text-muted">
                {row.label}
              </span>
              <span className="text-[15px] font-extrabold tabular-nums text-accent">{row.away}</span>
            </div>
            <div className={BAR}>
              <div className="h-full bg-[#16a34a] transition-all duration-300" style={{ width: `${homePct}%` }} />
              <div className="h-full bg-[#dc2626] transition-all duration-300" style={{ width: `${100 - homePct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One team sheet: the formation, the eleven (shirt, name, badges, rating) and
 *  the bench. A name links to its own player page whenever the id the page
 *  printed resolves (PlayerLink), and the club's crest and name into
 *  `/club/{id}` (ClubLink). */
function Sheet({ side, align }: { side: GoalooLiveSide; align: 'home' | 'away' }) {
  const row = (player: GoalooLivePlayer) => (
    <li
      key={`${player.id}-${player.number}`}
      className={`flex min-w-0 items-center gap-2 py-[3px] ${
        align === 'away' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-muted">
        {player.number || '–'}
      </span>
      <PlayerLink id={player.id} name={player.name} className="min-w-0 truncate text-[13px]">
        {player.name}
      </PlayerLink>
      <span className={`flex shrink-0 items-center gap-1 ${align === 'away' ? 'flex-row-reverse' : ''}`}>
        {player.marks.map((mark, i) => (
          <span key={`${mark.label}-${i}`} className={`${CHIP} ${markClass(mark.label)}`}>
            {mark.label}
            {mark.time ? ` ${mark.time}` : ''}
          </span>
        ))}
        {player.rating !== null && (
          <span className={`${CHIP} tabular-nums ${ratingClass(player.rating)}`}>
            {player.rating.toFixed(1)}
          </span>
        )}
      </span>
    </li>
  );

  return (
    <div className="min-w-0 flex-1">
      <ClubLink id={side.team.id} name={side.team.name} className="mb-2 flex min-w-0 items-center gap-2">
        <Crest src={side.team.logo} name={side.team.name} />
        <span className="min-w-0 truncate text-[14px] font-bold">{side.team.name}</span>
        {side.formation && <span className={CHIP}>{side.formation}</span>}
      </ClubLink>
      <ul className="m-0 list-none p-0">{side.starters.map(row)}</ul>
      {side.substitutes.length > 0 && (
        <>
          <h4 className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Substitutes
          </h4>
          <ul className="m-0 list-none p-0 opacity-90">{side.substitutes.map(row)}</ul>
        </>
      )}
    </div>
  );
}

/** The event list, in the publisher's own order — period headings (`FT 2-0`)
 *  included, so the phases sit exactly where the page puts them. */
function EventList({ events }: { events: GoalooLiveEvent[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {events.map((event, i) => {
        if (!event.label) {
          return (
            <li key={`${event.kind}-${event.minute}-${i}`} className="flex items-center gap-3 py-2">
              <span className="w-10 shrink-0 text-right text-[12px] font-bold tabular-nums text-muted">
                {event.minute}
              </span>
              <span
                className={`${CHIP} ${markClass(event.kind)}`}
                title={event.kind}
              >
                {event.kind || 'Event'}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {event.side === 'away' ? event.away : event.home}
              </span>
            </li>
          );
        }
        return (
          <li
            key={`period-${event.label}-${i}`}
            className="mt-2 mb-1 border-b border-border-soft pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted"
          >
            {event.label}
          </li>
        );
      })}
    </ul>
  );
}


/** The minute-by-minute feed. Newest first — on a live page the line that just
 *  happened is what a reader is looking for — and capped behind a toggle,
 *  because a finished match ships a hundred lines or more. */
function TextFeed({ rows }: { rows: GoalooLiveTextRow[] }) {
  const [all, setAll] = useState(false);
  const ordered = [...rows].reverse();
  const shown = all ? ordered : ordered.slice(0, 24);
  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {shown.map((line) => (
          <li key={line.id} className="flex gap-3">
            <span className="w-11 shrink-0 text-right text-[12px] font-bold tabular-nums text-muted">
              {line.minute}
            </span>
            {/* The feed prints the minute inside the line as well ("1' Goal!
                …"); the badge above already shows it, so it is dropped here. */}
            <span className="min-w-0 flex-1 text-[13px] leading-[1.5]">
              {line.minute
                ? line.text.replace(/^\s*\d{1,3}(?:\+\d{1,2})?['′]\s*/, '')
                : line.text}
            </span>
          </li>
        ))}
      </ul>
      {ordered.length > shown.length && (
        <button
          type="button"
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-accent"
          onClick={() => setAll(true)}
        >
          Show all {ordered.length} lines
        </button>
      )}
    </div>
  );
}

/** Both clubs' recent form: three-match and ten-match averages, home then away
 *  in each pair — the page's own column order. */
function FormTable({ rows, home, away }: { rows: GoalooLiveFormRow[]; home: string; away: string }) {
  const th = 'px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted';
  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${th} text-right`}>{home} · 3</th>
            <th className={`${th} text-right`}>{away} · 3</th>
            <th className={`${th} text-center`}>Metric</th>
            <th className={`${th} text-left`}>{home} · 10</th>
            <th className={`${th} text-left`}>{away} · 10</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border-soft">
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{row.recent3[0]}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.recent3[1]}</td>
              <td className="px-2 py-1.5 text-center text-[12px] text-muted">{row.label}</td>
              <td className="px-2 py-1.5 text-left font-semibold tabular-nums">{row.recent10[0]}</td>
              <td className="px-2 py-1.5 text-left tabular-nums">{row.recent10[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where each club's goals fall inside the ninety minutes, per window: the
 *  scored bars on the home/away sides and the missed totals under them, scaled
 *  to the largest value in the two windows on screen. */
function GoalTimes({ buckets }: { buckets: GoalooLiveBucket[] }) {
  const spans = [...new Set(buckets.map((b) => b.span))];
  const max = Math.max(...buckets.map((b) => Math.max(b.home, b.away)), 1);
  return (
    <div className="flex flex-col gap-5">
      {spans.map((span) => {
        const scored = buckets.filter((b) => b.span === span && b.kind === 'scored');
        const missed = buckets.filter((b) => b.span === span && b.kind === 'missed');
        return (
          <div key={span}>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{span}</h4>
            <div className="flex flex-col gap-2">
              {scored.map((row) => {
                const miss = missed.find((m) => m.label === row.label);
                return (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-right text-[12px] font-bold tabular-nums text-[#16a34a]">
                      {row.home}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <div className={BAR}>
                        <div className="h-full bg-[#16a34a]" style={{ width: `${(row.home / max) * 100}%` }} />
                      </div>
                      <div className={BAR}>
                        <div className="h-full bg-[#dc2626]" style={{ width: `${(row.away / max) * 100}%` }} />
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-left text-[12px] font-bold tabular-nums text-[#dc2626]">
                      {row.away}
                    </span>
                    <span className="w-12 shrink-0 text-center text-[11px] tabular-nums text-muted">{row.label}</span>
                    <span className="w-14 shrink-0 text-left text-[11px] tabular-nums text-muted">
                      missed {miss ? `${miss.home}/${miss.away}` : '–'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/** Half-time / full-time records over the last two seasons. */
function HtFtTable({ table }: { table: GoalooLiveHtFt }) {
  const th = 'px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted';
  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={th} />
            {table.teams.map((team) => (
              <th key={team.name} colSpan={2} className={`${th} text-center text-text`}>
                {team.name}
                {team.matches ? ` (${team.matches})` : ''}
              </th>
            ))}
          </tr>
          <tr>
            <th className={th} />
            {table.teams.flatMap((team) =>
              table.columns.map((column, i) => (
                <th key={`${team.name}-${column}-${i}`} className={`${th} text-center`}>
                  {column}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label} className="border-t border-border-soft">
              <td className="px-2 py-1.5 text-[12px] text-muted">{row.label}</td>
              {row.cells.map((cell, i) => (
                <td key={`${row.label}-${i}`} className="px-2 py-1.5 text-center tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Period switcher pill (FT / 1st Half / 2nd Half / ET). */
const PERIOD_BASE =
  'cursor-pointer rounded-full border px-2.5 py-[3px] text-[12px] font-semibold transition-all duration-150';
const PERIOD_ON = `${PERIOD_BASE} border-accent bg-accent-soft text-accent`;
const PERIOD_OFF = `${PERIOD_BASE} border-border bg-panel text-muted hover:text-text`;

type TabId = 'text' | 'stats' | 'lineups' | 'events' | 'form';

export interface GoalooMatchCentreProps {
  matchId: string | number;
  sportType?: number;
  /** The join's keys — see GoalooMatchCentreParams in app/actions.ts. */
  leagueId?: number | string;
  kickoff?: number;
  home?: string;
  away?: string;
  /** Whether the match is in play (shortens the read window, arms polling). */
  live?: boolean;
}


export function GoalooMatchCentre({
  matchId,
  sportType = 1,
  leagueId,
  kickoff,
  home,
  away,
  live = false,
}: GoalooMatchCentreProps) {
  const [active, setActive] = useState<TabId | null>(null);
  const [period, setPeriod] = useState(0);
  const query = useGoalooMatchCentre({ matchId, sportType, leagueId, kickoff, home, away, live });
  const payload = query.data;
  const match: GoalooLiveMatch | null = payload?.matched ? payload.live : null;

  if (!match) {
    // Still reading: one quiet line, so a slow Goaloo host never looks like a
    // page with nothing more on it. Anything else — a fixture the catalogue does
    // not carry, a page that could not be read — draws nothing at all, and the
    // Rblink tabs above simply stand as the page's own match section.
    if (query.isPending && !query.isError) {
      return (
        <div className={PANEL}>
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="animate-spin" size={16} /> Loading the Goaloo match centre…
          </div>
        </div>
      );
    }
    return null;
  }

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'text', label: 'Live Text', show: match.text.length > 0 },
    { id: 'stats', label: 'Statistics', show: match.stats.length > 0 },
    { id: 'lineups', label: 'Team Sheets', show: match.lineups.length > 0 },
    { id: 'events', label: 'Events', show: match.events.length > 0 },
    {
      id: 'form',
      label: 'Form',
      show: match.form.length > 0 || match.buckets.length > 0 || Boolean(match.htft),
    },
  ];
  const available = tabs.filter((t) => t.show);
  const inPlay = live || Boolean(match.minute);
  // A match in play opens on the text feed (that is the live thing), everything
  // else on the statistics — the panel's own reading order.
  const fallback = inPlay && match.text.length > 0 ? 'text' : available[0]?.id;
  const current = active && available.some((t) => t.id === active) ? active : fallback;
  const periodIndex = Math.min(period, Math.max(0, match.stats.length - 1));
  const chosen = match.stats[periodIndex];
  const chip = `${CHIP} text-text`;


  return (
    <section className={PANEL} aria-label="Goaloo match centre">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-[15px] font-bold">Match centre</h3>
        {match.state && <span className={chip}>{match.state}</span>}
        {match.score && (
          <span className={chip}>
            <span className="tabular-nums">{match.score.home}</span>
            <span className="opacity-60">–</span>
            <span className="tabular-nums">{match.score.away}</span>
          </span>
        )}
        {match.halves.map((half) => (
          <span key={half.label} className={CHIP}>
            {half.label} {half.value}
          </span>
        ))}
        <a
          href={goalooLiveMatchUrl(match.scheduleId)}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted no-underline transition-colors duration-150 hover:text-accent"
          title="Open this match on Goaloo28.com"
        >
          Goaloo28.com <ExternalLink size={12} />
        </a>
      </div>

      {available.length === 0 ? (
        <p className="mb-0 mt-3 text-[13px] text-muted">
          This match has not been published in detail yet.
        </p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="mb-0 flex w-max min-w-full flex-nowrap items-stretch gap-1 border-b border-border max-[640px]:gap-0.5">
              {available.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  aria-selected={tab.id === current}
                  className={`${TAB} ${
                    tab.id === current
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3">
            {current === 'text' && <TextFeed rows={match.text} />}

            {current === 'stats' && (
              <div>
                {match.stats.length > 1 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {match.stats.map((entry, i) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => setPeriod(i)}
                        className={i === periodIndex ? PERIOD_ON : PERIOD_OFF}
                      >
                        {entry.key}
                      </button>
                    ))}
                  </div>
                )}
                <StatRows rows={chosen?.rows ?? []} />
              </div>
            )}

            {current === 'lineups' && (
              <div className="flex flex-col gap-6 min-[720px]:flex-row min-[720px]:gap-8">
                {match.lineups.map((side, i) => (
                  <Sheet key={side.team.id || i} side={side} align={i === 0 ? 'home' : 'away'} />
                ))}
              </div>
            )}

            {current === 'events' && <EventList events={match.events} />}

            {current === 'form' && (
              <div className="flex flex-col gap-6">
                {match.form.length > 0 && (
                  <FormTable rows={match.form} home={match.home.name} away={match.away.name} />
                )}
                {match.buckets.length > 0 && <GoalTimes buckets={match.buckets} />}
                {match.htft && <HtFtTable table={match.htft} />}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

