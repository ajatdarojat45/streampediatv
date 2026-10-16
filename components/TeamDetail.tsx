'use client';

import { useState, type ReactNode } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { ChevronLeft, ChevronRight, Info, Loader2, Shirt, Trophy, UserRound } from 'lucide-react';
import { LocalTime } from '@/components/LocalTime';
import { Select } from '@/components/Select';
import type {
  NowgoalSquadPlayer,
  NowgoalStandingRow,
  NowgoalStatTable,
  NowgoalTeamFixture,
  NowgoalTeamForm,
  NowgoalTeamTransfer,
  NowgoalTeamView,
} from '@/lib/types';
import {
  BADGE,
  GROUP_HEAD,
  LABEL,
  PANEL,
  PANEL_TITLE,
  PILL_ROW,
  SELECT,
  TAB,
  TAB_ACTIVE,
  TAB_IDLE,
  TD,
  TH,
} from '@/components/ui';


/** How a result of a finished fixture reads, from the club's own side. */
const RESULT: Record<string, { label: string; className: string }> = {
  W: { label: 'W', className: 'bg-success-soft text-success-ink' },
  D: { label: 'D', className: 'bg-surface-3 text-muted' },
  L: { label: 'L', className: 'bg-danger-soft text-danger-ink' },
};

/** The states the feed publishes for a fixture that will not be played, from
 *  the page's own `getSpecialState`. */
const SPECIAL_STATE: Record<number, string> = {
  [-10]: 'Cancel',
  [-11]: 'Pend.',
  [-12]: 'Abd',
  [-13]: 'Pause',
  [-14]: 'Postp.',
};

/** Badge/crest with the app's usual initial fallback (`components/Match.tsx`). */
function Crest({ src, name, size = 'h-6 w-6' }: { src: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold text-muted`}
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

/** A player's photo, with the same initial fallback every other badge in the
 *  app uses — these come off the publisher's own CDN. */
function Avatar({ src, name, size = 'h-8 w-8' }: { src: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted`}
        aria-hidden="true"
      >
        <UserRound className="h-1/2 w-1/2" />
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
      className={`${size} shrink-0 rounded-full bg-surface-3 object-cover`}
    />
  );
}

/** Spinner for a navigation that is still in flight — Next's own `useLinkStatus`
 *  reports it, so this sits inside the link it belongs to. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null;
}

/** Prev/next of the fixture list: the club's calendar runs to a hundred pages,
 *  so one page is rendered — and only that page is ever sent to the client. */
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
  const step = `inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-[12px]`;
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

/** Value of one fact chip in a fact grid. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="rounded-sm border border-border bg-card px-3 py-2">
      <span className="block text-[11px] uppercase tracking-[0.04em] text-muted">{label}</span>
      <span className="mt-0.5 block text-[13px] font-semibold text-text">{value}</span>
    </li>
  );
}

/** The empty state every plate shares — the same dashed box the competition
 *  page renders when a file has nothing for the view. */
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mt-3 rounded-sm border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
      {children}
    </p>
  );
}

/** The club's recent results as badges — the run every club page is read for. */
function Form({ form }: { form: NowgoalTeamForm }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1">
        {form.results.length ? (
          form.results.map((result, index) => (
            <span
              key={`${result}-${index}`}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-sm text-[11px] font-extrabold ${
                (RESULT[result] ?? RESULT.D).className
              }`}
            >
              {result}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-muted">—</span>
        )}
      </span>
      <span className="text-[12px] text-muted">{form.note}</span>
    </div>
  );
}

/** A competition table, with the club's own row marked and, when the file marks
 *  bands (promotion, Europe, relegation), the legend under it. */
function StandingTable({
  rows,
  teamId,
  qualified = false,
}: {
  rows: NowgoalStandingRow[];
  teamId: string;
  qualified?: boolean;
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
          {rows.map((row) => {
            const own = row.team.id === teamId;
            return (
              <tr
                key={row.team.id}
                className={
                  own
                    ? 'border-b border-border-soft bg-accent-soft last:border-b-0'
                    : 'border-b border-border-soft last:border-b-0'
                }
              >
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
                          ? 'font-bold text-live-ink'
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
                    className={`flex items-center gap-2 no-underline ${
                      own ? 'font-extrabold text-accent' : 'text-text'
                    }`}
                  >
                    <Crest src={row.team.crest} name={row.team.name} />
                    <span className="min-w-0 truncate text-[13.5px] font-semibold">{row.team.name}</span>
                  </Link>
                </td>
                <td className={`${TD} text-center`}>{row.played}</td>
                <td className={`${TD} text-center`}>{row.win}</td>
                <td className={`${TD} text-center`}>{row.draw}</td>
                <td className={`${TD} text-center`}>{row.lose}</td>
                <td className={`${TD} text-center`}>{row.goalsFor}</td>
                <td className={`${TD} text-center`}>{row.goalsAgainst}</td>
                <td className={`${TD} text-center`}>
                  {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                </td>
                <td className={`${TD} text-center font-extrabold`}>{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One statistics plate, already ranked and paged by the server. */
function StatList({ stat, metricLabel }: { stat: NowgoalStatTable; metricLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border-soft">
            <th className={TH}>#</th>
            <th className={TH}>Player</th>
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
                  <span className="min-w-0 truncate text-[13.5px] font-semibold">{row.name}</span>
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

/** Millions of pounds, trimmed — the club's own file publishes values that way
 *  (`£15M`, `£0.5M`). */
function money(millions: number | null): string {
  if (millions === null) return '—';
  return `£${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2).replace(/0$/, '')}M`;
}

/** The club's squad, in the order the publisher's own lineup lists it: one block
 *  per position group, each player with the shirt number, role and country the
 *  club's own file carries. */
function SquadList({ squad }: { squad: NowgoalSquadPlayer[] }) {
  const groups: { name: string; players: NowgoalSquadPlayer[] }[] = [];
  for (const player of squad) {
    const name = player.group || 'Other';
    const group = groups[groups.length - 1];
    if (group && group.name === name) group.players.push(player);
    else groups.push({ name, players: [player] });
  }
  return (
    <ul className="m-0 list-none p-0">
      {groups.map((group) => (
        <li key={group.name}>
          <h3 className={`${GROUP_HEAD} ${groups[0] === group ? 'mt-0' : ''}`}>
            {group.name}
            <span className="font-normal normal-case tracking-normal">· {group.players.length}</span>
          </h3>
          <ul className="m-0 list-none p-0">
            {group.players.map((player) => (
              <li
                key={player.id}
                className="mb-2 grid grid-cols-[1fr_100px_50px_100px_110px] items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 max-[720px]:grid-cols-[1fr_auto] max-[720px]:gap-x-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Link
                    href={`/players/${player.id}`}
                    scroll={false}
                    className="flex min-w-0 items-center gap-2.5 no-underline text-text hover:text-accent"
                  >
                    <Avatar src={player.photo} name={player.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold">
                        {player.number ? (
                          <span className="mr-1.5 text-muted">#{player.number}</span>
                        ) : null}
                        {player.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {[player.role, player.country].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                  </Link>
                </span>
                {[
                  { key: 'position', value: player.group || '—', muted: true },
                  { key: 'age', value: player.age === null ? '—' : String(player.age), muted: false },
                  { key: 'value', value: money(player.valueMillions), muted: false },
                  { key: 'contract', value: player.contractExpiry || '—', muted: true },
                ].map((cell) => (
                  <span
                    key={cell.key}
                    className={`text-[12.5px] tabular-nums max-[720px]:col-start-2 max-[720px]:text-right ${
                      cell.muted ? 'text-muted' : ''
                    }`}
                  >
                    {cell.value}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** One fixture of the club's schedule: kick-off, both sides with their crests and
 *  the rank the endpoint publishes for each, the score (or the state that
 *  stopped it), the club's own rating, how the club fared and the `Match` link
 *  into the tie's own page (`/matches/{id}` — the same id the season files carry,
 *  so a competition page links a fixture to the same page). */
function FixtureRow({ fixture: f, teamId }: { fixture: NowgoalTeamFixture; teamId: string }) {
  const special = f.state < -1 ? (SPECIAL_STATE[f.state] ?? 'Off') : '';
  const score = f.score ? f.score.replace('-', ' - ') : '';
  const result = f.result ? RESULT[f.result] : null;
  const red = f.homeRed + f.awayRed;
  return (
    <li className="mb-2 grid grid-cols-[110px_1fr_auto_1fr_78px] items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 max-[720px]:grid-cols-[74px_1fr_auto_1fr] max-[720px]:gap-1.5">
      <span className="text-[11px] leading-[1.35] text-muted">
        {f.kickoffMs ? <LocalTime ts={f.kickoffMs} /> : '—'}
      </span>
      {[f.home, f.away].map((side, index) => (
        <span key={`${side.id}-${index}`} className="contents">
          {index === 1 ? (
            <span className="min-w-[52px] text-center text-[13px] font-extrabold tabular-nums">
              {special ? (
                <span className="text-[11px] font-semibold uppercase text-muted">{special}</span>
              ) : (
                score || <span className="font-semibold text-muted">vs</span>
              )}
            </span>
          ) : null}
          <span
            className={`flex min-w-0 items-center gap-2 ${index === 0 ? 'justify-end text-right' : ''} ${
              side.id === teamId ? 'font-extrabold' : ''
            }`}
          >
            {index === 1 ? <Crest src={side.crest} name={side.name} size="h-5 w-5" /> : null}
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold max-[720px]:text-[12.5px]">
                {side.name}
              </span>
              {f.rank[index === 0 ? 'home' : 'away'] ? (
                <span className="block text-[10.5px] font-normal text-muted">
                  [{f.rank[index === 0 ? 'home' : 'away']}]
                </span>
              ) : null}
            </span>
            {index === 0 ? <Crest src={side.crest} name={side.name} size="h-5 w-5" /> : null}
          </span>
        </span>
      ))}
      <span className="flex items-center justify-end gap-1.5 max-[720px]:col-span-4 max-[720px]:justify-start">
        {red ? (
          <span className="rounded border border-border px-1 text-[10.5px] font-bold text-danger-ink">
            {red} red
          </span>
        ) : null}
        {f.rating !== null ? (
          <span className="rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted">
            {f.rating.toFixed(2)}
          </span>
        ) : null}
        {result ? (
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-extrabold ${result.className}`}
          >
            {result.label}
          </span>
        ) : null}
        {f.note ? <span className="text-[11px] text-muted">{f.note}</span> : null}
        {f.id ? (
          <Link
            href={`/matches/${f.id}`}
            scroll={false}
            className="text-[11px] font-semibold text-accent no-underline hover:underline"
          >
            Match
          </Link>
        ) : null}
      </span>
    </li>
  );
}

/** The club's fixtures of one page, grouped by the competition each is filed
 *  under — the same grouping the publisher's own page prints, flag and all.
 *  The competition and both clubs link to their own pages. */
function FixtureList({ fixtures, teamId }: { fixtures: NowgoalTeamFixture[]; teamId: string }) {
  const groups: { fixture: NowgoalTeamFixture; rows: NowgoalTeamFixture[] }[] = [];
  for (const fixture of fixtures) {
    const last = groups[groups.length - 1];
    if (last && last.fixture.competitionId === fixture.competitionId) last.rows.push(fixture);
    else groups.push({ fixture, rows: [fixture] });
  }
  return (
    <>
      {groups.map((group) => (
        <div key={`${group.fixture.competitionId}-${group.fixture.id}`} className="mt-4 mb-2 first:mt-0">
          <h3 className={LABEL}>
            {group.fixture.countryFlag ? (
              <img
                src={group.fixture.countryFlag}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-3 w-4 object-cover"
              />
            ) : null}
            <Link
              href={`/competitions/${group.fixture.competitionId}`}
              scroll={false}
              className="no-underline hover:text-accent"
            >
              {group.fixture.competition}
            </Link>
          </h3>
          <ul className="m-0 list-none p-0">
            {group.rows.map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} teamId={teamId} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** One move of the club's transfer list: the player, when it happened, what kind
 *  of move it was, the fee, and the club on the other end of it. The endpoint
 *  publishes no name for that club, so its crest links to its own page rather
 *  than a name that would have to be invented. */
function TransferList({
  transfers,
  direction,
}: {
  transfers: NowgoalTeamTransfer[];
  direction: 'in' | 'out';
}) {
  return (
    <ul className="m-0 list-none p-0">
      {transfers.map((transfer, index) => (
        <li
          key={`${transfer.playerId}-${transfer.date}-${index}`}
          className="mb-2 grid grid-cols-[1fr_150px_130px_120px] items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 max-[720px]:grid-cols-[1fr_auto]"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar src={transfer.photo} name={transfer.name} />
            <Link
              href={`/players/${transfer.playerId}`}
              scroll={false}
              className="min-w-0 truncate text-[13.5px] font-semibold no-underline text-text hover:text-accent"
            >
              {transfer.name}
            </Link>
          </span>
          <span className="flex items-center gap-2 text-[12px] text-muted max-[720px]:col-start-2 max-[720px]:justify-end">
            {direction === 'in' ? 'from' : 'to'}
            <Link href={`/teams/${transfer.teamId}`} scroll={false} title={`Club ${transfer.teamId}`}>
              <Crest src={transfer.teamCrest} name={transfer.teamId} size="h-5 w-5" />
            </Link>
          </span>
          <span className="text-[12.5px] text-muted max-[720px]:col-start-2 max-[720px]:text-right">
            {transfer.date || '—'}
          </span>
          <span className="text-right text-[12.5px] max-[720px]:col-start-2 max-[720px]:text-right">
            <span className="block font-semibold tabular-nums">{transfer.fee || '—'}</span>
            <span className="block text-[11px] text-muted">{transfer.type || 'Transfer'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The `/teams/[id]` page body: a hero with the club, a toolbar of the controls
 *  the open tab needs, and the tab itself.
 *
 *  Every control is a link carrying the same query with one value changed, and
 *  the server renders only rows that query asks for — so the URL always says
 *  what is on screen, any view can be shared or opened in a new tab, and neither
 *  the squad plate nor a season file reaches the browser whole. */
export function TeamDetail({ view }: { view: NowgoalTeamView }) {
  const { info } = view;
  /** The query of a view with `overrides` applied. Only the open tab's own
   *  values are written, so switching tabs never drops the season and switching
   *  a competition never drops the tab. A key sent as `''` is left out, which is
   *  how a control resets another one to that tab's own default. */
  const query = (
    overrides: Partial<
      Record<
        | 'tab'
        | 'comp'
        | 'fpage'
        | 'ptab'
        | 'pcomp'
        | 'pseason'
        | 'metric'
        | 'ppage'
        | 'scomp'
        | 'sseason'
        | 'tcomp'
        | 'tseason'
        | 'tview'
        | 'year'
        | 'tdir',
        string | number
      >
    >,
  ): string => {
    const next = {
      tab: view.tab as string,
      comp: view.competition,
      fpage: view.fixturePage,
      ptab: view.playerTab as string,
      pcomp: view.playerCompetition,
      pseason: view.playerSeason,
      metric: view.metric,
      ppage: view.stat?.page ?? 1,
      scomp: view.statCompetition,
      sseason: view.statSeason,
      tcomp: view.standCompetition,
      tseason: view.standSeason,
      tview: view.standing?.table ?? '',
      year: view.transferYear,
      tdir: view.transferDirection as string,
      ...overrides,
    };
    const params = new URLSearchParams();
    if (next.tab !== 'fixtures') params.set('tab', String(next.tab));
    if (next.tab === 'fixtures') {
      if (next.comp !== '0') params.set('comp', String(next.comp));
      if (Number(next.fpage) > 1) params.set('fpage', String(next.fpage));
    }
    if (next.tab === 'players') {
      if (next.ptab === 'data') params.set('ptab', 'data');
      if (next.pcomp) params.set('pcomp', String(next.pcomp));
      if (next.pseason) params.set('pseason', String(next.pseason));
      if (next.ptab === 'data') {
        if (next.metric) params.set('metric', String(next.metric));
        if (Number(next.ppage) > 1) params.set('ppage', String(next.ppage));
      }
    }
    if (next.tab === 'stats') {
      if (next.scomp) params.set('scomp', String(next.scomp));
      if (next.sseason) params.set('sseason', String(next.sseason));
    }
    if (next.tab === 'standing') {
      if (next.tcomp) params.set('tcomp', String(next.tcomp));
      if (next.tseason) params.set('tseason', String(next.tseason));
      if (next.tview) params.set('tview', String(next.tview));
    }
    if (next.tab === 'transfers') {
      if (next.year) params.set('year', String(next.year));
      if (next.tdir === 'out') params.set('tdir', 'out');
    }
    return params.toString();
  };

  const href = (
    overrides: Partial<Record<string, string | number>>,
  ): string => `/teams/${info.id}?${query(overrides)}`;

  const metricLabel = view.metricOptions.find((option) => option.key === view.metric)?.label ?? '';
  /** Players the club's own file lists: the hero and the info tab read the
   *  count, the players tab the list itself. */
  const squadSize = view.squadSize;
  /** The label a competition of the club's own list is shown under. */
  const competitionLabel = (id: string) =>
    view.seasonCompetitions.find((option) => option.key === id)?.label ?? '';

  return (
    <>
      {/* Who is in view: the club, where it plays, and the facts its own file
       *  publishes about it. */}
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Crest src={info.crest} name={info.name} size="h-12 w-12" />
            <div className="min-w-0">
              <span className="font-mono text-xs text-muted">
                Club
                {info.city ? ` · ${info.city}` : ''}
              </span>
              <h1 className="m-0 mt-1 flex items-center gap-2 text-[22px] font-extrabold leading-tight">
                <Shirt className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                {info.name}
              </h1>
              <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
                {info.leagueName ? (
                  <span className={BADGE}>
                    <Crest src={info.leagueCrest} name={info.leagueName} size="h-3.5 w-3.5" />
                    {info.leagueId ? (
                      <Link href={`/competitions/${info.leagueId}`} className="no-underline text-muted">
                        {info.leagueName}
                      </Link>
                    ) : (
                      info.leagueName
                    )}
                  </span>
                ) : null}
                {squadSize ? <span>{squadSize} players</span> : null}
                {info.avgAge ? <span>Avg age {info.avgAge}</span> : null}
                {info.valueMillions !== null ? <span>Squad value {money(info.valueMillions)}</span> : null}
                {info.updatedMs ? (
                  <span>
                    Updated <LocalTime ts={info.updatedMs} />
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className={`mt-3 ${PILL_ROW}`} role="tablist" aria-label="Club sections">
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
          {view.tab === 'fixtures' && view.competitions.length > 1 ? (
            <Select
              label="Competition"
              value={view.competition}
              options={view.competitions}
              hrefOf={(comp) => href({ comp, fpage: 1 })}
            />
          ) : null}

          {view.tab === 'players' ? (
            <div className={PILL_ROW} role="tablist" aria-label="Squad plate">
              {[
                { key: 'lineup', label: 'Line-up' },
                { key: 'data', label: 'Player data' },
              ].map((plate) => (
                <Link
                  key={plate.key}
                  href={href({ ptab: plate.key, ppage: 1 })}
                  scroll={false}
                  role="tab"
                  aria-selected={plate.key === view.playerTab}
                  className={`no-underline ${plate.key === view.playerTab ? TAB_ACTIVE : TAB_IDLE}`}
                >
                  {plate.label}
                  <Pending />
                </Link>
              ))}
            </div>
          ) : null}
          {view.tab === 'players' && view.playerTab === 'data' && view.playerCompetitions.length ? (
            <Select
              label="Competition"
              value={view.playerCompetition}
              options={view.playerCompetitions}
              // A plate's seasons are its own, so switching the competition
              // resets the season and the page to that competition's defaults.
              hrefOf={(pcomp) => href({ pcomp, pseason: '', ppage: 1 })}
            />
          ) : null}
          {view.tab === 'players' && view.playerTab === 'data' && view.playerSeasons.length > 1 ? (
            <Select
              label="Season"
              value={view.playerSeason}
              options={view.playerSeasons}
              hrefOf={(pseason) => href({ pseason, ppage: 1 })}
            />
          ) : null}
          {view.tab === 'players' && view.playerTab === 'data' && view.metricOptions.length > 1 ? (
            <Select
              label="Stat"
              value={view.metric}
              options={view.metricOptions}
              hrefOf={(metric) => href({ metric, ppage: 1 })}
            />
          ) : null}

          {view.tab === 'stats' && view.seasonCompetitions.length ? (
            <Select
              label="Competition"
              value={view.statCompetition}
              options={view.seasonCompetitions}
              hrefOf={(scomp) => href({ scomp, sseason: '' })}
            />
          ) : null}
          {view.tab === 'stats' && view.statSeasons.length > 1 ? (
            <Select
              label="Season"
              value={view.statSeason}
              options={view.statSeasons}
              hrefOf={(sseason) => href({ sseason })}
            />
          ) : null}

          {view.tab === 'standing' && view.seasonCompetitions.length ? (
            <Select
              label="Competition"
              value={view.standCompetition}
              options={view.seasonCompetitions}
              hrefOf={(tcomp) => href({ tcomp, tseason: '', tview: '' })}
            />
          ) : null}
          {view.tab === 'standing' && view.standSeasons.length > 1 ? (
            <Select
              label="Season"
              value={view.standSeason}
              options={view.standSeasons}
              hrefOf={(tseason) => href({ tseason, tview: '' })}
            />
          ) : null}
          {view.tab === 'standing' && view.standing && view.standing.viewOptions.length > 1 ? (
            <div className={PILL_ROW} role="tablist" aria-label="Table view">
              {view.standing.viewOptions.map((option) => (
                <Link
                  key={option.key}
                  href={href({ tview: option.key })}
                  scroll={false}
                  role="tab"
                  aria-selected={option.key === view.standing?.table}
                  className={`no-underline ${
                    option.key === view.standing?.table ? TAB_ACTIVE : TAB_IDLE
                  }`}
                >
                  {option.label}
                  <Pending />
                </Link>
              ))}
            </div>
          ) : null}
          {view.tab === 'standing' &&
          view.standing &&
          !view.standing.viewOptions.length &&
          view.standing.tableOptions.length > 1 ? (
            <Select
              label="Group"
              value={view.standing.table}
              options={view.standing.tableOptions}
              hrefOf={(tview) => href({ tview })}
            />
          ) : null}

          {view.tab === 'transfers' ? (
            <div className={PILL_ROW} role="tablist" aria-label="Direction">
              {[
                { key: 'in', label: 'Transfer in' },
                { key: 'out', label: 'Transfer out' },
              ].map((option) => (
                <Link
                  key={option.key}
                  href={href({ tdir: option.key })}
                  scroll={false}
                  role="tab"
                  aria-selected={option.key === view.transferDirection}
                  className={`no-underline ${
                    option.key === view.transferDirection ? TAB_ACTIVE : TAB_IDLE
                  }`}
                >
                  {option.label}
                  <Pending />
                </Link>
              ))}
            </div>
          ) : null}
          {view.tab === 'transfers' && view.transferYears.length > 1 ? (
            <Select
              label="Year"
              value={view.transferYear}
              options={view.transferYears}
              hrefOf={(year) => href({ year })}
            />
          ) : null}
        </div>
      </section>

      {/* The open tab. */}
      <section className={PANEL}>
        {view.tab === 'fixtures' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">
                {view.competitions.find((option) => option.key === view.competition)?.label ??
                  'All competitions'}
              </h2>
              <span className="text-[12px] text-muted">{view.fixtures.length} matches</span>
            </div>
            {view.fixtures.length ? (
              <div className="mt-3">
                <FixtureList fixtures={view.fixtures} teamId={info.id} />
              </div>
            ) : (
              <Empty>No fixture of this club is published for the competition in view.</Empty>
            )}
            <Pager
              page={view.fixturePage}
              pageCount={view.fixturePageCount}
              hrefOf={(fpage) => href({ fpage })}
            />
          </>
        ) : null}

        {view.tab === 'players' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">
                {view.playerTab === 'lineup' ? 'Squad' : `Player data · ${metricLabel}`}
              </h2>
              <span className="text-[12px] text-muted">
                {view.playerTab === 'lineup'
                  ? `${squadSize} players`
                  : `${view.stat?.total ?? 0} players`}
              </span>
            </div>
            {view.playerTab === 'lineup' ? (
              squadSize ? (
                <div className="mt-3">
                  <SquadList squad={view.squad} />
                </div>
              ) : (
                <Empty>This club's own file publishes no squad list.</Empty>
              )
            ) : view.stat && view.stat.rows.length ? (
              <>
                <div className="mt-3">
                  <StatList stat={view.stat} metricLabel={metricLabel} />
                </div>
                <Pager
                  page={view.stat.page}
                  pageCount={view.stat.pageCount}
                  hrefOf={(ppage) => href({ ppage })}
                />
              </>
            ) : (
              <Empty>
                No player data is published for this competition and season — the club's own
                competition list names the seasons it has numbers for.
              </Empty>
            )}
          </>
        ) : null}


        {view.tab === 'stats' ? (
          view.stats ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="m-0 text-[15px] font-bold">
                  {competitionLabel(view.statCompetition) || 'Competition'} · {view.statSeason}
                </h2>
                <span className="text-[12px] text-muted">
                  {view.stats.played} played fixtures read
                </span>
              </div>
              {view.stats.records.length ? (
                <ul className="m-0 mt-3 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                  {view.stats.records.map((record) => (
                    <li
                      key={record.label}
                      className="rounded-sm border border-border bg-card px-3 py-2.5"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
                          {record.label}
                        </span>
                        <span className="text-[11px] text-muted">
                          {record.row.rank}
                          {record.row.points ? ` · ${record.row.points} pts` : ''}
                        </span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px] tabular-nums">
                        <span>
                          <span className="text-muted">P</span> {record.row.played}
                        </span>
                        <span>
                          <span className="text-muted">W</span> {record.row.win}
                        </span>
                        <span>
                          <span className="text-muted">D</span> {record.row.draw}
                        </span>
                        <span>
                          <span className="text-muted">L</span> {record.row.lose}
                        </span>
                        <span>
                          <span className="text-muted">GF:GA</span> {record.row.goalsFor}:
                          {record.row.goalsAgainst}
                        </span>
                        <span>
                          <span className="text-muted">GD</span>{' '}
                          {record.row.goalDiff > 0 ? `+${record.row.goalDiff}` : record.row.goalDiff}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 border-t border-border-soft pt-3">
                <h3 className="m-0 mb-2 text-[14px] font-bold">Form</h3>
                <Form form={view.stats.form} />
              </div>
              {view.stats.facts.length ? (
                <>
                  <h3 className="m-0 mb-2 mt-4 border-t border-border-soft pt-3 text-[14px] font-bold">
                    From this club's own fixtures
                  </h3>
                  <ul className="m-0 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
                    {view.stats.facts.map((fact) => (
                      <Fact key={fact.label} label={fact.label} value={fact.value} />
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : (
            <Empty>
              This competition and season is not in the club's own file any more — the
              competition list above names the ones it still has.
            </Empty>
          )
        ) : null}

        {view.tab === 'standing' ? (
          view.standing && view.standing.rows.length ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="m-0 text-[15px] font-bold">
                  {view.standing.label} · {view.standSeason}
                </h2>
                <span className="text-[12px] text-muted">{view.standing.rows.length} teams</span>
              </div>
              <div className="mt-3">
                <StandingTable rows={view.standing.rows} teamId={info.id} />
              </div>
              {view.standing.bands.length ? (
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1.5 border-t border-border-soft p-0 pt-3 text-[11.5px] text-muted">
                  {view.standing.bands.map((band) => (
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
            <Empty>This competition publishes no table for the club's section of it, this season.</Empty>
          )
        ) : null}


        {view.tab === 'info' ? (
          <>
            <h2 className={PANEL_TITLE}>
              <Info className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              About {info.name}
            </h2>
            <ul className="m-0 mt-3 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
              <Fact label="City" value={info.city || '—'} />
              <Fact label="Home stadium" value={info.stadium || '—'} />
              <Fact
                label="Capacity"
                value={info.capacity ? info.capacity.toLocaleString('en-US') : '—'}
              />
              <Fact label="Founded" value={info.founded || '—'} />
              <Fact label="Squad value" value={money(info.valueMillions)} />
              <Fact label="Average age" value={info.avgAge || '—'} />
              <Fact label="Squad size" value={`${squadSize} players`} />
              {info.leagueName ? (
                <Fact
                  label="Competition"
                  value={
                    info.leagueId ? (
                      <Link
                        href={`/competitions/${info.leagueId}`}
                        scroll={false}
                        className="flex items-center gap-1.5 no-underline text-text"
                      >
                        <Crest src={info.leagueCrest} name={info.leagueName} size="h-4 w-4" />
                        {info.leagueName}
                      </Link>
                    ) : (
                      info.leagueName
                    )
                  }
                />
              ) : null}
              {info.coach ? (
                <Fact
                  label="Coach"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Avatar src={info.coach.photo} name={info.coach.name} size="h-5 w-5" />
                      {info.coach.name || '—'}
                    </span>
                  }
                />
              ) : null}
              {info.updatedMs ? (
                <Fact label="Last updated" value={<LocalTime ts={info.updatedMs} />} />
              ) : null}
            </ul>

            {info.honours.length ? (
              <>
                <h3 className="m-0 mb-2 mt-4 flex items-center gap-2 border-t border-border-soft pt-3 text-[14px] font-bold">
                  <Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  Honours
                </h3>
                <ul className="m-0 list-none p-0">
                  {info.honours.map((honour) => (
                    <li
                      key={honour.title}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border-soft py-1.5 last:border-b-0"
                    >
                      <span className="text-[13.5px] font-semibold">
                        {honour.title}
                        <span className="ml-1.5 text-[11px] font-normal text-muted">
                          {honour.seasons.length ? `×${honour.seasons.length}` : ''}
                        </span>
                      </span>
                      <span className="text-[11.5px] text-muted">{honour.seasons.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {info.traits.length ? (
              <>
                <h3 className="m-0 mb-2 mt-4 border-t border-border-soft pt-3 text-[14px] font-bold">
                  Style notes
                </h3>
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {info.traits.map((trait) => (
                    <li key={trait} className={BADGE}>
                      {trait}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}

        {view.tab === 'transfers' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">
                {view.transferDirection === 'in' ? 'Transfers in' : 'Transfers out'}
                {view.transferYear ? ` · ${view.transferYear}` : ''}
              </h2>
              <span className="text-[12px] text-muted">{view.transfers.length} players</span>
            </div>
            {view.transfers.length ? (
              <div className="mt-3">
                <TransferList transfers={view.transfers} direction={view.transferDirection} />
              </div>
            ) : (
              <Empty>
                The publisher files no {view.transferDirection === 'in' ? 'arrival' : 'departure'} for
                this club{view.transferYear ? ` in ${view.transferYear}` : ''}.
              </Empty>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}

