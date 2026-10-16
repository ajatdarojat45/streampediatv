'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, Info, Loader2, Trophy } from 'lucide-react';
import { LocalTime } from '@/components/LocalTime';
import type {
  NowgoalCompetitionView,
  NowgoalFixture,
  NowgoalStandingRow,
  NowgoalStatTable,
  NowgoalViewOption,
} from '@/lib/types';

/** Surface panel (`class="panel"`), the card every page of the app renders. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Tab pair — the same pill pair the sport pages and the directory use. */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
/** Dropdown button — the control the toolbar row is made of. */
const SELECT =
  'inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-[13px] font-semibold text-text transition-all hover:border-[#c7ccd2] disabled:opacity-50';
/** Dropdown popup. It floats above the content and scrolls on its own, because
 *  a season list runs to two dozen entries. */
const MENU =
  'absolute left-0 top-[calc(100%+6px)] z-30 max-h-[320px] w-[min(78vw,300px)] overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-panel p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)]';
const MENU_ITEM =
  'block w-full rounded px-2.5 py-1.5 text-left text-[13px] text-text transition-colors hover:bg-accent-soft hover:text-accent';
const MENU_ITEM_ON = `${MENU_ITEM} bg-accent-soft font-bold text-accent`;
/** Table cells. */
const TH = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-muted';
const TD = 'px-2 py-2 text-[13px] tabular-nums';
/** Fact chip of the hero. */
const CHIP =
  'inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** Tab row — one swipeable line on a narrow screen, like the directory's. */
const TAB_ROW =
  'flex flex-nowrap gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** One fixture: kick-off, both sides with their crests, the score as published
 *  (or `VS` before kick-off, or the reason it will not be played), the half-time
 *  score, and the publisher's own aside on the tie. */
function FixtureRow({ fixture: f }: { fixture: NowgoalFixture }) {
  const special = f.state < -1 ? (SPECIAL_STATE[f.state] ?? 'Off') : '';
  const played = f.state === -1;
  const live = f.state > 0;
  const score = f.score ? f.score.replace('-', ' - ') : '';
  const aside = [f.note, f.homeRed ? `${f.homeRed} red (home)` : '', f.awayRed ? `${f.awayRed} red (away)` : ''].filter(
    Boolean,
  );
  return (
    <li className="mb-2 rounded-lg border border-border bg-card px-3.5 py-3 max-[640px]:px-3">
      <div className="grid grid-cols-[110px_1fr_auto_1fr] items-center gap-2.5 max-[640px]:grid-cols-[78px_1fr_auto_1fr] max-[640px]:gap-1.5">
        <span className="text-[11px] leading-[1.35] text-muted">
          {f.kickoffMs ? <LocalTime ts={f.kickoffMs} /> : '—'}
        </span>
        <Link
          href={`/teams/${f.home.id}`}
          scroll={false}
          className="flex min-w-0 items-center justify-end gap-2 no-underline text-text hover:text-accent"
        >
          <span className="min-w-0 truncate text-[13.5px] font-semibold max-[640px]:text-[12.5px]">
            {f.home.name}
          </span>
          <Crest src={f.home.crest} name={f.home.name} />
        </Link>
        <span className="min-w-[64px] text-center">
          {special ? (
            <span className="text-[11px] font-semibold text-muted">{special}</span>
          ) : played || live ? (
            <span className="whitespace-nowrap text-[14px] font-extrabold tabular-nums">
              {score || '—'}
            </span>
          ) : (
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">VS</span>
          )}
          {played && f.halfScore ? (
            <span className="mt-0.5 block text-[10.5px] text-muted">HT {f.halfScore}</span>
          ) : null}
          {live ? (
            <span className="mt-0.5 block text-[10.5px] font-semibold text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]">
              Live
            </span>
          ) : null}
        </span>
        <Link
          href={`/teams/${f.away.id}`}
          scroll={false}
          className="flex min-w-0 items-center gap-2 no-underline text-text hover:text-accent"
        >
          <Crest src={f.away.crest} name={f.away.name} />
          <span className="min-w-0 truncate text-[13.5px] font-semibold max-[640px]:text-[12.5px]">
            {f.away.name}
          </span>
        </Link>
      </div>
      {aside.length ? (
        <p className="m-0 mt-2 border-t border-border-soft pt-2 text-[11px] leading-[1.5] text-muted">
          {aside.join(' · ')}
        </p>
      ) : null}
    </li>
  );
}

/** A standings table: rank, team, played, W/D/L, goals, difference, points — and
 *  the band colour the feed files the row under (a league's promotion and
 *  relegation places), or the red rank a cup uses for the rows that advance. */
function StandingsTable({
  rows,
  qualified,
}: {
  rows: NowgoalStandingRow[];
  qualified: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border-soft">
            <th className={TH}>#</th>
            <th className={TH}>Team</th>
            <th className={`${TH} text-center`}>P</th>
            <th className={`${TH} text-center`}>W</th>
            <th className={`${TH} text-center`}>D</th>
            <th className={`${TH} text-center`}>L</th>
            <th className={`${TH} text-center`}>GF</th>
            <th className={`${TH} text-center`}>GA</th>
            <th className={`${TH} text-center`}>GD</th>
            <th className={`${TH} text-center`}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team.id} className="border-b border-border-soft last:border-b-0">
              <td className={`${TD} w-[42px]`}>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={row.band ? 'h-3.5 w-[3px] shrink-0 rounded-full' : 'hidden'}
                    style={row.band ? { background: row.band } : undefined}
                  />
                  <span
                    className={
                      qualified && row.qualified
                        ? 'font-bold text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]'
                        : 'text-muted'
                    }
                  >
                    {row.rank}
                  </span>
                </span>
              </td>
              <td className={`${TD} min-w-[180px]`}>
                <Link
                  href={`/teams/${row.team.id}`}
                  scroll={false}
                  className="flex items-center gap-2 no-underline text-text hover:text-accent"
                >
                  <Crest src={row.team.crest} name={row.team.name} />
                  <span className="min-w-0 truncate text-[13.5px] font-semibold">
                    {row.team.name}
                  </span>
                </Link>
              </td>
              <td className={`${TD} text-center`}>{row.played}</td>
              <td className={`${TD} text-center`}>{row.win}</td>
              <td className={`${TD} text-center`}>{row.draw}</td>
              <td className={`${TD} text-center`}>{row.lose}</td>
              <td className={`${TD} text-center`}>{row.goalsFor}</td>
              <td className={`${TD} text-center`}>{row.goalsAgainst}</td>
              <td className={`${TD} text-center`}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
              <td className={`${TD} text-center font-extrabold`}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SPECIAL_STATE: Record<number, string> = {
  [-10]: 'Cancelled',
  [-11]: 'Pending',
  [-12]: 'Abandoned',
  [-13]: 'Paused',
  [-14]: 'Postponed',
};

/** Badge/crest with the app's usual initial fallback (`components/Match.tsx`). */
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

/** Spinner for a navigation that is still in flight. Next's own `useLinkStatus`
 *  reports it, so this has to sit inside the link it belongs to — which is also
 *  where a visitor is looking after clicking it. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
  ) : null;
}

/** One dropdown of the toolbar: a button carrying the current label and a list of
 *  the other values, each a plain link to the same page with one query changed —
 *  so a dropdown value can be copied, shared and opened in a new tab like any
 *  other URL. Picking one closes the list and lets the link navigate. */
function Select({
  value,
  options,
  hrefOf,
  label,
}: {
  value: string;
  options: NowgoalViewOption[];
  hrefOf: (key: string) => string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const current = options.find((option) => option.key === value)?.label ?? value;

  // Close on an outside click or Escape — the same behaviour the directory's
  // federation panels have.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className={SELECT}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="text-muted">{label}</span>
        <span className="max-w-[180px] truncate">{current}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className={MENU} role="listbox" aria-label={label}>
          {options.map((option) => (
            <Link
              key={option.key}
              href={hrefOf(option.key)}
              scroll={false}
              role="option"
              aria-selected={option.key === value}
              className={option.key === value ? MENU_ITEM_ON : MENU_ITEM}
              onClick={() => setOpen(false)}
            >
              {option.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Value of one fact chip in the overview's fact grid. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2">
      <span className="block text-[11px] uppercase tracking-[0.04em] text-muted">{label}</span>
      <span className="mt-0.5 block text-[13px] font-semibold text-text">{value}</span>
    </li>
  );
}

/** Player photo, with the same initial fallback every other badge in the app
 *  uses — these come from the publisher's own CDN, so one can always be missing. */
function Avatar({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8eaed] text-[10px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft"
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
      className="h-6 w-6 shrink-0 rounded-full object-cover"
    />
  );
}

/** One page of a statistics plate. */
function StatList({
  stat,
  plate,
  metricLabel,
}: {
  stat: NowgoalStatTable;
  plate: 'player' | 'team';
  metricLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border-soft">
            <th className={TH}>#</th>
            <th className={TH}>{plate === 'player' ? 'Player' : 'Team'}</th>
            <th className={`${TH} text-center`}>{metricLabel}</th>
            {stat.secondLabel ? <th className={`${TH} text-center`}>{stat.secondLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {stat.rows.map((row) => (
            <tr key={`${row.rank}-${row.name}`} className="border-b border-border-soft last:border-b-0">
              <td className={`${TD} w-[42px] text-muted`}>{row.rank}</td>
              <td className={`${TD} min-w-[200px]`}>
                <span className="flex items-center gap-2">
                  <Avatar src={row.photo} name={row.name} />
                  {row.teamCrest ? (
                    <Crest src={row.teamCrest} name={row.teamName} size="h-5 w-5" />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{row.name}</span>
                    {row.teamName ? (
                      <span className="block truncate text-[11px] text-muted">{row.teamName}</span>
                    ) : null}
                  </span>
                </span>
              </td>
              <td className={`${TD} text-center font-bold`}>{row.value}</td>
              {stat.secondLabel ? <td className={`${TD} text-center`}>{row.second}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Prev/next of a statistics plate: a plate holds hundreds of rows, so one page
 *  is rendered — and only that page is ever sent to the client. */
function Pager({
  page,
  pageCount,
  hrefOf,
}: {
  page: number;
  pageCount: number;
  hrefOf: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const step = `inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2 text-[12px]`;
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-muted">
      {page > 1 ? (
        <Link href={hrefOf(page - 1)} scroll={false} className={`${step} bg-card text-text`}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Prev
          <Pending />
        </Link>
      ) : (
        <span className={`${step} cursor-not-allowed border-dashed opacity-50`} aria-disabled="true">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Prev
        </span>
      )}
      <span>
        Page <strong className="text-text">{page}</strong> of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefOf(page + 1)} scroll={false} className={`${step} bg-card text-text`}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Pending />
        </Link>
      ) : (
        <span className={`${step} cursor-not-allowed border-dashed opacity-50`} aria-disabled="true">
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

/** The `/competitions/[id]` page body: a hero with the competition, a toolbar of
 *  the controls the open tab needs, and the tab itself.
 *
 *  Every control is a link carrying the same query with one value changed, and
 *  the server renders only the rows that query asks for — so the URL always says
 *  what is on screen, any view can be shared or opened in a new tab, and no
 *  season file ever reaches the browser. */
export function CompetitionDetail({ view }: { view: NowgoalCompetitionView }) {
  /** The query of a view with `overrides` applied. Only the open tab's own
   *  values are written, so switching tabs never drops the season and switching a
   *  season never drops the tab. */
  const query = (
    overrides: Partial<
      Record<'tab' | 'season' | 'round' | 'table' | 'sround' | 'plate' | 'metric' | 'page', string | number>
    >,
  ): string => {
    const next = {
      tab: view.tab as string,
      season: view.season,
      round: view.round,
      table: view.table,
      sround: view.standingsRound,
      plate: view.plate as string,
      metric: view.metric,
      page: 1,
      ...overrides,
    };
    const params = new URLSearchParams();
    params.set('season', String(next.season));
    if (next.tab !== 'overview') params.set('tab', String(next.tab));
    if (next.tab === 'fixtures' && next.round) params.set('round', String(next.round));
    if (next.tab === 'standings') {
      if (next.table) params.set('table', String(next.table));
      if (view.kind === 'league') params.set('sround', String(next.sround));
    }
    if (next.tab === 'stats') {
      params.set('plate', String(next.plate));
      if (next.metric) params.set('metric', String(next.metric));
      if (Number(next.page) > 1) params.set('page', String(next.page));
    }
    return params.toString();
  };

  const href = (
    overrides: Partial<
      Record<'tab' | 'season' | 'round' | 'table' | 'sround' | 'plate' | 'metric' | 'page', string | number>
    >,
  ): string => `/competitions/${view.id}?${query(overrides)}`;

  const metricLabel = view.metricOptions.find((option) => option.key === view.metric)?.label ?? '';

  return (
    <>
      {/* Who is in view: the competition, the season it is being read for, and
       *  the sections it has data for. */}
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Crest src={view.crest} name={view.name} size="h-12 w-12" />
            <div className="min-w-0">
              <span className="font-mono text-xs text-muted">
                {view.kind === 'cup' ? 'Cup' : 'League'}
                {view.federation ? ` · ${view.federation}` : ''}
              </span>
              <h1 className="m-0 mt-1 flex items-center gap-2 text-[22px] font-extrabold leading-tight">
                <Trophy className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                {view.name}
              </h1>
              <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
                <span className={CHIP}>{view.season}</span>
                {view.teams ? <span>{view.teams} teams</span> : null}
                {view.rounds ? (
                  <span>
                    {view.rounds} {view.kind === 'cup' ? 'stages' : 'rounds'}
                  </span>
                ) : null}
                {view.updatedMs ? (
                  <span>
                    Updated <LocalTime ts={view.updatedMs} />
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/competitions" className={SELECT}>
              All competitions
            </Link>
          </div>
        </div>

        <div className={`mt-3 ${TAB_ROW}`} role="tablist" aria-label="Competition sections">
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

      {/* The controls the open tab needs. Every one of them is the same URL with
       *  one value changed, so the state of the page is always the URL a visitor
       *  can share. */}
      <section className={PANEL}>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Season"
            value={view.season}
            options={view.seasons}
            hrefOf={(season) => href({ season, page: 1 })}
          />
          {view.tab === 'fixtures' && view.roundOptions.length > 1 ? (
            <Select
              label={view.kind === 'cup' ? 'Stage' : 'Round'}
              value={view.round}
              options={view.roundOptions}
              hrefOf={(round) => href({ round })}
            />
          ) : null}
          {view.tab === 'standings' && view.tableOptions.length > 1 ? (
            <Select
              label={view.kind === 'league' ? 'View' : 'Group'}
              value={view.table}
              options={view.tableOptions}
              hrefOf={(table) => href({ table })}
            />
          ) : null}
          {view.tab === 'standings' && view.standingsRoundOptions.length > 1 ? (
            <Select
              label="Table at"
              value={String(view.standingsRound)}
              options={view.standingsRoundOptions}
              hrefOf={(sround) => href({ sround })}
            />
          ) : null}
          {view.tab === 'stats' && view.plates.length > 1 ? (
            <div className={TAB_ROW} role="tablist" aria-label="Statistics plate">
              {view.plates.map((plate) => (
                <Link
                  key={plate.key}
                  href={href({ plate: plate.key, metric: '', page: 1 })}
                  scroll={false}
                  role="tab"
                  aria-selected={plate.key === view.plate}
                  // A plate's metrics differ, so the metric resets to that
                  // plate's own first one.
                  className={`no-underline ${plate.key === view.plate ? TAB_ACTIVE : TAB_IDLE}`}
                >
                  {plate.label}
                  <Pending />
                </Link>
              ))}
            </div>
          ) : null}
          {view.tab === 'stats' && view.metricOptions.length > 1 ? (
            <Select
              label="Stat"
              value={view.metric}
              options={view.metricOptions}
              hrefOf={(metric) => href({ metric, page: 1 })}
            />
          ) : null}
        </div>
      </section>



      {/* The open tab. */}
      <section className={PANEL}>
        {view.tab === 'standings' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">
                {view.tableLabel}
                {view.standingsRound > 0 ? ` · after round ${view.standingsRound}` : ' table'}
              </h2>
              <span className="text-[12px] text-muted">{view.standings.length} teams</span>
            </div>
            {view.standings.length ? (
              <>
                <div className="mt-3">
                  <StandingsTable rows={view.standings} qualified={view.kind === 'cup'} />
                </div>
                {/* The feed's own colour bands: promotion, Europe, relegation. */}
                {view.bands.length ? (
                  <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1.5 border-t border-border-soft p-0 pt-3 text-[11.5px] text-muted">
                    {view.bands.map((band) => (
                      <li key={band.label || band.color} className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: band.color }}
                          aria-hidden="true"
                        />
                        {band.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="m-0 mt-3 rounded-[var(--radius-sm)] border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                This competition has no table for the season in view yet.
              </p>
            )}
          </>
        ) : null}

        {view.tab === 'fixtures' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">
                {view.roundLabel || (view.kind === 'cup' ? 'Stage' : 'Round')}
              </h2>
              <span className="text-[12px] text-muted">{view.fixtures.length} matches</span>
            </div>
            {view.fixtures.length ? (
              <ul className="m-0 mt-3 list-none p-0">
                {view.fixtures.map((fixture) => (
                  <FixtureRow key={fixture.id} fixture={fixture} />
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-3 rounded-[var(--radius-sm)] border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                No fixture is filed under this round yet.
              </p>
            )}
          </>
        ) : null}

        {view.tab === 'stats' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">
                {view.plate === 'player' ? 'Player' : 'Team'} statistics · {metricLabel}
              </h2>
              <span className="text-[12px] text-muted">
                {view.stat?.total ?? 0} {view.plate === 'player' ? 'players' : 'teams'}
              </span>
            </div>
            {view.stat && view.stat.rows.length ? (
              <>
                <div className="mt-3">
                  <StatList stat={view.stat} plate={view.plate} metricLabel={metricLabel} />
                </div>
                <Pager
                  page={view.stat.page}
                  pageCount={view.stat.pageCount}
                  hrefOf={(page) => href({ page })}
                />
              </>
            ) : (
              <p className="m-0 mt-3 rounded-[var(--radius-sm)] border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                No statistics are published for this competition yet.
              </p>
            )}
          </>
        ) : null}


        {view.tab === 'overview' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
                <Info className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                About this competition
              </h2>
              {view.shortName ? <span className="text-[12px] text-muted">{view.shortName}</span> : null}
            </div>
            <p className="m-0 mt-2.5 max-w-[820px] text-[13.5px] leading-[1.7] text-muted">
              {view.description ||
                'No description is published for this competition — the facts below are read from its own season file.'}
            </p>
            <ul className="m-0 mt-3.5 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
              <Fact label="Type" value={view.kind === 'cup' ? 'Cup competition' : 'League competition'} />
              {view.federation ? <Fact label="Country / region" value={view.federation} /> : null}
              <Fact label="Season" value={view.season} />
              {view.teams ? <Fact label="Teams" value={String(view.teams)} /> : null}
              {view.rounds ? (
                <Fact label={view.kind === 'cup' ? 'Stages' : 'Rounds'} value={String(view.rounds)} />
              ) : null}
              {view.updatedMs ? (
                <Fact label="Last updated" value={<LocalTime ts={view.updatedMs} />} />
              ) : null}
            </ul>
            {view.preview.length ? (
              <>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-border-soft pt-4">
                  <h3 className="m-0 text-[14px] font-bold">
                    {view.tableLabel} — the leading places
                  </h3>
                  <Link
                    href={href({ tab: 'standings' })}
                    scroll={false}
                    className={`no-underline ${SELECT}`}
                  >
                    Full table
                    <Pending />
                  </Link>
                </div>
                <div className="mt-3">
                  <StandingsTable rows={view.preview} qualified={view.kind === 'cup'} />
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </section>
    </>
  );
}


