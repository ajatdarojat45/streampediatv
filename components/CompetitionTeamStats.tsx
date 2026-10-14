'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { TeamLogo } from '@/components/Match';
import { ClubLink } from '@/components/ClubLink';
import { teamTotalTeam } from '@/lib/leagueProto';
import type { LeagueTeamTotals, Team, TeamTotal } from '@/lib/types';

/* Tech Stat → Team — the club-by-club competition averages.
 *
 * Source: /api/league/team/total/list (PBLeagueTeamTotalListResp, endpoint code
 * 200), the same signed call the player totals use. The payload ships its own
 * club list, so a row draws its crest without a second request, and it is
 * SEASON-scoped: a call without a seasonId is answered with HTTP 499, which is
 * why the host page only enables it once the season is resolved.
 *
 * Two shapes share this table: whole-season counts (goals, cards) stay
 * integers, while the per-game figures arrive as strings ("1.4") and keep one
 * decimal. A counter the team never recorded is omitted from the payload and
 * paints as an em dash rather than a false zero. */

/** Table chrome — the same metrics the squad browser uses. */
const HEAD = 'px-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
const CELL = 'px-1.5 py-1.5 text-center tabular-nums whitespace-nowrap';
const ROW = 'border-b border-border-soft last:border-0 hover:bg-border-soft/40';
/** Sortable column header — the whole `<th>` is the hit area. */
const SORT =
  'inline-flex w-full cursor-pointer items-center justify-center gap-0.5 whitespace-nowrap transition-colors hover:text-text';
/** The club-name header — the same control, left-aligned, so it needs its own
 *  string (a `justify-start` next to `justify-center` would be a coin flip). */
const SORT_LEFT =
  'inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap transition-colors hover:text-text';
/** Search box (the home page's input). */
const INPUT =
  'min-w-[170px] flex-1 rounded-xl border border-border bg-panel px-4 py-[11px] text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none';
const EMPTY =
  'rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted';
/** Summary chip next to the controls (the squad browser's shape). */
const COUNT_CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-bold [&_strong]:text-text';

/** Sortable columns. Text sorts A→Z, counters largest-first. */
type SortKey =
  | 'name'
  | 'goals'
  | 'conceded'
  | 'diff'
  | 'possession'
  | 'shots'
  | 'passes'
  | 'keyPasses'
  | 'longBalls'
  | 'crosses'
  | 'interceptions'
  | 'clearances'
  | 'blocked'
  | 'turnovers'
  | 'fouls'
  | 'penalties'
  | 'yellow'
  | 'red';

/** Every numeric column, in paint order. One array drives the `<th>` row and
 *  the `<td>` row, so a header can never drift away from its cell. */
interface Column {
  key: Exclude<SortKey, 'name'>;
  label: string;
  /** Tooltip — the feed's own metric, spelled out. */
  title: string;
  /** Per-game average → one decimal. */
  average?: boolean;
  /** Dropped under 640px: the table would otherwise need a lot of sideways. */
  narrow?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'goals', label: 'G', title: 'Goals scored' },
  { key: 'conceded', label: 'GA', title: 'Goals conceded' },
  { key: 'diff', label: 'GD', title: 'Goal difference' },
  { key: 'possession', label: 'Poss %', title: 'Average share of the ball', average: true },
  { key: 'shots', label: 'Shots/g', title: 'Shots per game', average: true },
  {
    key: 'passes',
    label: 'Passes/g',
    title: 'Accurate passes per game',
    average: true,
    narrow: true,
  },
  {
    key: 'keyPasses',
    label: 'Key/g',
    title: 'Key passes per game',
    average: true,
    narrow: true,
  },
  {
    key: 'longBalls',
    label: 'Long/g',
    title: 'Accurate long balls per game',
    average: true,
    narrow: true,
  },
  {
    key: 'crosses',
    label: 'Cross/g',
    title: 'Accurate crosses per game',
    average: true,
    narrow: true,
  },
  {
    key: 'interceptions',
    label: 'Int/g',
    title: 'Interceptions per game',
    average: true,
    narrow: true,
  },
  {
    key: 'clearances',
    label: 'Clear/g',
    title: 'Clearances per game',
    average: true,
    narrow: true,
  },
  {
    key: 'blocked',
    label: 'Block/g',
    title: 'Blocked shots per game',
    average: true,
    narrow: true,
  },
  {
    key: 'turnovers',
    label: 'Turns/g',
    title: 'Turnovers per game',
    average: true,
    narrow: true,
  },
  {
    key: 'fouls',
    label: 'Fouls/g',
    title: 'Fouls committed per game',
    average: true,
    narrow: true,
  },
  { key: 'penalties', label: 'Pen', title: 'Penalties won', narrow: true },
  { key: 'yellow', label: 'YC', title: 'Yellow cards' },
  { key: 'red', label: 'RC', title: 'Red cards' },
];

/** The feed sends per-game numbers as strings ("2.0"); a missing one is 0. */
const num = (v?: string | number): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

/** Diacritic-insensitive key — "persib" has to find "PERSIB Bandung". */
const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** One table row: the raw totals plus the resolved club and every number the
 *  columns and the sort read. */
interface TeamRow {
  row: TeamTotal;
  team?: Team;
  name: string;
  goals: number;
  conceded: number;
  /** Goals minus goals conceded. */
  diff: number;
  possession: number;
  shots: number;
  passes: number;
  keyPasses: number;
  longBalls: number;
  crosses: number;
  interceptions: number;
  clearances: number;
  blocked: number;
  turnovers: number;
  fouls: number;
  penalties: number;
  yellow: number;
  red: number;
}

/** A sortable column header — `aria-sort` rides on the `<th>`, the button is
 *  the control, exactly how the squad browser behaves. */
function SortHead({
  column,
  sort,
  desc,
  onSort,
}: {
  column: Column;
  sort: SortKey;
  desc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const active = sort === column.key;
  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
      className={`${HEAD} whitespace-nowrap ${column.narrow ? 'max-[640px]:hidden' : ''}`}
    >
      <button
        type="button"
        className={`${SORT} ${active ? 'text-text' : ''}`}
        onClick={() => onSort(column.key)}
        title={`Sort by ${column.title}`}
      >
        {column.label}
        {active && (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );
}

export function CompetitionTeamStats({
  totals,
  sportType,
  seasonLabel,
}: {
  totals: LeagueTeamTotals;
  sportType: number;
  /** The season being shown — spelled out in the footer note. */
  seasonLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('goals');
  const [desc, setDesc] = useState(true);

  /** The payload's row for every club, decorated with the club itself (name and
   *  crest travel in the same response) and the numbers the columns and the
   *  sort read. */
  const all = useMemo<TeamRow[]>(
    () =>
      totals.rows.map((row) => {
        const team = teamTotalTeam(totals, row);
        const goals = row.goals ?? 0;
        const conceded = row.goalsConceded ?? 0;
        return {
          row,
          team,
          name: team?.name ?? (row.teamId !== undefined ? `#${row.teamId}` : 'Unknown team'),
          goals,
          conceded,
          diff: goals - conceded,
          possession: num(row.ballPossession),
          shots: num(row.shotsPerGame),
          passes: num(row.accuratePassesPerGame),
          keyPasses: num(row.keyPassesPerGame),
          longBalls: num(row.accurateLongBallsPerGame),
          crosses: num(row.accurateCrossesPerGame),
          interceptions: num(row.interceptionsPerGame),
          clearances: num(row.clearancesPerGame),
          blocked: num(row.blockedShotsPerGame),
          turnovers: num(row.turnoversPerGame),
          fouls: num(row.foulsPerGame),
          penalties: num(row.penaltiesWon),
          yellow: row.yellowCards ?? 0,
          red: row.redCards ?? 0,
        };
      }),
    [totals]
  );

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? all.filter((r) => fold(r.name).includes(q)) : all;
  }, [all, query]);

  const sorted = useMemo(() => {
    const dir = desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return dir * a.name.localeCompare(b.name);
      const d = a[sort] - b[sort];
      // Ties fall back to the alphabet so equal counters keep a stable order.
      return d !== 0 ? dir * d : a.name.localeCompare(b.name);
    });
  }, [filtered, sort, desc]);

  const toggleSort = (key: SortKey): void => {
    if (key === sort) {
      setDesc((d) => !d);
      return;
    }
    setSort(key);
    setDesc(key !== 'name');
  };

  if (all.length === 0) {
    return <p className={EMPTY}>No team statistics for this competition yet.</p>;
  }

  /** Goals and goal difference are the headline pair — the same emphasis the
   *  standings table gives its "Pts" column. */
  const strong = (key: SortKey): string => (key === 'goals' || key === 'diff' ? ' font-bold' : '');

  return (
    <div>
      {/* Controls — club filter plus the counters. The season note spells out
          what the per-game numbers are averages OF. */}
      <section className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <input
          className={INPUT}
          type="search"
          placeholder="Search teams…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search teams"
        />
        <span className={COUNT_CHIP}>
          <strong>{sorted.length.toLocaleString('en-US')}</strong> of {all.length}{' '}
          {all.length === 1 ? 'team' : 'teams'}
        </span>
        {seasonLabel && (
          <span className={COUNT_CHIP}>
            Season <strong>{seasonLabel}</strong>
          </span>
        )}
      </section>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={`${HEAD} w-9 text-left`}>
                #
              </th>
              <th
                scope="col"
                aria-sort={sort === 'name' ? (desc ? 'descending' : 'ascending') : 'none'}
                className={`${HEAD} text-left`}
              >
                <button
                  type="button"
                  className={`${SORT_LEFT} ${sort === 'name' ? 'text-text' : ''}`}
                  onClick={() => toggleSort('name')}
                  title="Sort by club name"
                >
                  Team
                  {sort === 'name' && (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </button>
              </th>
              {/* One header per COLUMNS entry — see the array's own doc. */}
              {COLUMNS.map((c) => (
                <SortHead key={c.key} column={c} sort={sort} desc={desc} onSort={toggleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.row.teamId ?? i} className={ROW}>
                <td className={`${CELL} text-left font-bold text-muted`}>{i + 1}</td>
                <td className="max-w-[220px] px-1.5 py-1.5">
                  {/* The club's crest + name link into its own page. */}
                  <ClubLink
                    id={r.team?.clubId}
                    name={r.name}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <TeamLogo
                      path={r.team?.logo}
                      name={r.name}
                      sportType={sportType}
                      size="league"
                    />
                    <span className="min-w-0 truncate font-semibold" title={r.name}>
                      {r.name}
                    </span>
                  </ClubLink>
                </td>
                {COLUMNS.map((c) => {
                  const value = r[c.key];
                  return (
                    <td
                      key={c.key}
                      className={`${CELL}${strong(c.key)}${c.average ? ' text-muted' : ''}${
                        c.narrow ? ' max-[640px]:hidden' : ''
                      }`}
                    >
                      {/* A per-game average the feed never recorded paints as an
                          em dash; a count is always a real number. */}
                      {c.average ? (value > 0 ? value.toFixed(1) : '—') : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p className={`${EMPTY} mt-3`}>No team matches that search.</p>
      )}

      <p className="mt-3 text-[12px] text-muted">
        Goals and cards are season totals; the per-game columns are averages over the fixtures
        played{seasonLabel ? ` in ${seasonLabel}` : ''}. Possession is the team&apos;s average share
        of the ball.
      </p>
    </div>
  );
}


