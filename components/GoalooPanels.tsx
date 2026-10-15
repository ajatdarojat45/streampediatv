'use client';

/**
 * The Goaloo half of the `/watch/{id}` tab strip — the second publisher's own
 * numbers, drawn INSIDE the Rblink tabs (components/MatchTabs.tsx) rather than
 * in a panel of their own.
 *
 * Only Goaloo publishes these, which is why the tabs take their content from
 * this module: the technical statistics of every single period (Overview), both
 * team sheets with each player's rating and the minute he came on or went off
 * (Lineups) and the two clubs' recent form, where their goals land inside the
 * ninety minutes and their HT/FT record (Form). The catalogue's own statistics
 * and lineup are the FALLBACK behind the first two, so a fixture Goaloo does not
 * carry — and every other category — keeps the tabs it always had.
 *
 * The team sheets are drawn in the catalogue's OWN lineup panel
 * (components/Lineup, `LineupShell`): the same heading with the player count,
 * the same eleven-then-bench reading, the same rows — the publisher's marks (a
 * goal with its minute, a card, the minute he came on or went off) and his
 * rating simply take the place of the event badges only the Rblink feed carries.
 *
 * All of it is drawn from ONE server read (lib/goalooLive.ts) — the same read
 * the player's incident clips come from, so the tab strip and the player share a
 * single payload. Every club and player printed here links into this app's own
 * `/club/{id}` and `/player/{id}` pages: the ids on the Goaloo page are the very
 * ids those routes are addressed by.
 */
import { useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  RectangleVertical,
  Star,
  Volleyball,
} from 'lucide-react';
import { LineupShell, type LineupColumn } from '@/components/Lineup';
import { GoalooLogo } from '@/components/GoalooLogo';
import { goalooLiveMatchUrl } from '@/lib/goalooLive';
import type {
  GoalooLiveBucket,
  GoalooLiveFormRow,
  GoalooLiveHtFt,
  GoalooLiveMatch,
  GoalooLivePlayer,
  GoalooLiveSide,
  GoalooLiveStatRow,
  LineupPlayer,
} from '@/lib/types';

/** Surface panel, matching the `.panel` style used across the detail page. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** The formation, drawn beside the club name in the shared lineup shell where
 *  the catalogue's own header draws nothing: a quiet pill that never shrinks. */
const FORMATION =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border px-1.5 py-px text-[10px] font-semibold text-muted';
/** The chip a sheet row's marks are drawn in — the very metrics the catalogue's
 *  own event badges use (components/Lineup `EventBadges`), so a row reads the
 *  same whichever half of the strip filled it. */
const BADGE =
  'inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] font-bold leading-tight';
/** Split bar: home on the left, away on the right. */
const BAR = 'flex h-2 overflow-hidden rounded-full bg-[#e5e7eb] [[data-theme=dark]_&]:bg-border-soft';

/** Rating colour: strong, average, poor — the publisher's own scale is 1–10. */
function ratingClass(rating: number): string {
  if (rating >= 7.5) return 'text-[#16a34a]';
  if (rating >= 6.5) return 'text-accent';
  return 'text-muted';
}

/** Badge colour by the label Goaloo prints, in the palette the catalogue's own
 *  event badges are coloured in: green goal, accent assist, card colours. A
 *  dismissal is checked before the yellow it followed, so a second yellow reads
 *  red the way it does in the Rblink timeline. */
function markClass(label: string): string {
  if (/assist/i.test(label)) return 'text-accent';
  if (/goal|penalty scored/i.test(label)) return 'text-[#16a34a]';
  if (/red|second yellow/i.test(label)) return 'text-[#dc2626]';
  if (/yellow/i.test(label)) return 'text-[#eab308]';
  return 'text-muted';
}

/** The Lucide glyph the catalogue's lineup draws for a mark: the page names its
 *  marks in words, the shell's badges are icons. A mark outside the families
 *  below (`VAR`, `Miss`, …) keeps its own label instead, so nothing the
 *  publisher writes is lost to a glyph that does not fit. */
function markIcon(label: string): ReactNode | null {
  if (/sub out/i.test(label)) return <ArrowDown size={12} />;
  if (/sub in/i.test(label)) return <ArrowUp size={12} />;
  if (/assist/i.test(label)) return <Star size={11} />;
  if (/goal|penalty scored/i.test(label)) return <Volleyball size={11} />;
  if (/yellow|red/i.test(label)) return <RectangleVertical size={11} fill="currentColor" />;
  return null;
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

/** What one row carries at its end, where the catalogue's lineup draws its event
 *  badges: the publisher's marks — a goal, an assist, a card, the minute a
 *  substitute came on or went off — and his rating. The glyphs are the very ones
 *  `EventBadges` draws, with the published minute as the chip's text, and the
 *  publisher's own wording travels in the chip's title: a mark outside the six
 *  the catalogue knows (`VAR`, `Miss`, …) is printed in words instead. */
function SheetTail({ player }: { player?: GoalooLivePlayer }) {
  if (!player) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {player.marks.map((mark, i) => {
        const icon = markIcon(mark.label);
        const title = mark.time ? `${mark.label} ${mark.time}` : mark.label;
        return (
          <span
            key={`${mark.label}-${i}`}
            title={title}
            aria-label={title}
            className={`${BADGE} ${markClass(mark.label)}`}
          >
            {icon}
            <span>{icon ? mark.time : title}</span>
          </span>
        );
      })}
      {player.rating !== null && (
        <span
          title={`Rating ${player.rating.toFixed(1)}`}
          aria-label={`Rating ${player.rating.toFixed(1)}`}
          className={`${BADGE} tabular-nums ${ratingClass(player.rating)}`}
        >
          {player.rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}

/** One Goaloo team sheet as a side of the shared lineup panel (components/Lineup,
 *  `LineupShell`): the eleven and the bench in the publisher's OWN formation
 *  order — the page prints them that way, so the shell is handed the lists the
 *  way `splitLineup` hands over the catalogue's — the formation as the note
 *  beside the club, and the publisher's crest through GoalooLogo, which carries
 *  the broken-URL fallback such a host needs. A name links to its own player page
 *  whenever the id the page printed resolves (`playerPageId`). */
function column(side: GoalooLiveSide): LineupColumn {
  /** The publisher's rows in the shell's own shape: starter (1) or bench (2),
   *  the shirt number as printed, and the Goaloo player the name links by. */
  const rows = (players: GoalooLivePlayer[], bench: boolean): LineupPlayer[] =>
    players.map((p) => ({
      appearance: bench ? 2 : 1,
      number: p.number || undefined,
      player: { name: p.name, playerPageId: p.id },
    }));
  // The tail is drawn per row, so the rows carry nothing but what the shell
  // reads; the marks and the rating are found again by the id they link with.
  const byId = new Map([...side.starters, ...side.substitutes].map((p) => [p.id, p] as const));
  return {
    team: { name: side.team.name, clubId: side.team.id },
    crest: <GoalooLogo src={side.team.logo} name={side.team.name} size="sm" />,
    note: side.formation ? <span className={FORMATION}>{side.formation}</span> : undefined,
    starters: rows(side.starters, false),
    subs: rows(side.substitutes, true),
    tail: (row) => <SheetTail player={byId.get(row.player?.playerPageId ?? 0)} />,
  };
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

/** The publisher's credit — whose numbers the tab is printing, and the way back
 *  to the page they were read from. */
function GoalooCredit({ scheduleId }: { scheduleId: number }) {
  return (
    <a
      href={goalooLiveMatchUrl(scheduleId)}
      target="_blank"
      rel="noreferrer noopener"
      title="Open this match on Goaloo28.com"
      className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-muted no-underline transition-colors duration-150 hover:text-accent"
    >
      Goaloo28.com <ExternalLink size={12} />
    </a>
  );
}

/** The frame every Goaloo tab shares: the panel surface, the heading, the credit
 *  and the body — the same shape the catalogue's own panels draw (Stats /
 *  Lineup / H2H), so both halves of the strip sit together without a change of
 *  idiom. */
function GoalooPanel({
  title,
  scheduleId,
  children,
}: {
  title: string;
  scheduleId: number;
  children: ReactNode;
}) {
  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-[15px] font-bold">{title}</h3>
        <GoalooCredit scheduleId={scheduleId} />
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Overview — the technical statistics of the phase the reader picked. The
 *  publisher files one table per period (FT / 1st Half / 2nd Half / ET) and the
 *  switcher is drawn only where there is more than one: a match that never left
 *  the ninety minutes reads as a single table. */
export function GoalooStatsPanel({ match }: { match: GoalooLiveMatch }) {
  const [period, setPeriod] = useState(0);
  const index = Math.min(period, Math.max(0, match.stats.length - 1));
  return (
    <GoalooPanel title="Match Statistics" scheduleId={match.scheduleId}>
      {match.stats.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {match.stats.map((entry, i) => (
            <button
              key={entry.key}
              type="button"
              aria-pressed={i === index}
              onClick={() => setPeriod(i)}
              className={i === index ? PERIOD_ON : PERIOD_OFF}
            >
              {entry.key}
            </button>
          ))}
        </div>
      )}
      <StatRows rows={match.stats[index]?.rows ?? []} />
    </GoalooPanel>
  );
}

/** Lineups — the publisher's team sheets, drawn in the catalogue's OWN lineup
 *  panel (components/Lineup, `LineupShell`): the same collapsible heading with
 *  the player count, both elevens side by side with each club's formation beside
 *  its name, and the one shared "Substitutes" toggle over the two benches. What
 *  only the publisher carries — every player's rating, and the minute he came on
 *  or went off — is drawn in the badges at the end of his row. Home first, away
 *  second: the order the Goaloo page itself prints the sheets in. */
export function GoalooLineupsPanel({ match }: { match: GoalooLiveMatch }) {
  // The page publishes both sheets or neither, so a side it left out is handed
  // over empty and the shell drops that half instead of printing a bare header.
  const empty: LineupColumn = { starters: [], subs: [] };
  const [home, away] = match.lineups.map(column);
  return (
    <LineupShell
      home={home ?? empty}
      away={away ?? empty}
      credit={<GoalooCredit scheduleId={match.scheduleId} />}
    />
  );
}

/** Form — the two clubs' recent numbers: their three- and ten-match averages,
 *  where their goals land inside the ninety minutes (with how often they miss),
 *  and their half-time/full-time record over the last two seasons. */
export function GoalooFormPanel({ match }: { match: GoalooLiveMatch }) {
  return (
    <GoalooPanel title="Form" scheduleId={match.scheduleId}>
      <div className="flex flex-col gap-6">
        {match.form.length > 0 && (
          <FormTable rows={match.form} home={match.home.name} away={match.away.name} />
        )}
        {match.buckets.length > 0 && <GoalTimes buckets={match.buckets} />}
        {match.htft && <HtFtTable table={match.htft} />}
      </div>
    </GoalooPanel>
  );
}

/** While the publisher's page is being read: one quiet panel, so the tab that is
 *  about to be filled never flashes the catalogue's own numbers first — and a
 *  slow Goaloo host never looks like a tab with nothing more on it. */
export function GoalooPendingPanel() {
  return (
    <section className={PANEL}>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Loader2 className="animate-spin" size={16} /> Loading the Goaloo match centre…
      </div>
    </section>
  );
}
