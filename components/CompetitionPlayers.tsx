'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, X } from 'lucide-react';
import { TeamLogo } from '@/components/Match';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ClubLink } from '@/components/ClubLink';
import { PlayerLink } from '@/components/PlayerLink';
import { totalPlayer, totalTeam } from '@/lib/leagueProto';
import type { LeaguePlayerTotals, PlayerTotal, Team } from '@/lib/types';

/** Table chrome — the same metrics the standings table above this tab uses. */
const HEAD = 'px-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
const CELL = 'px-1.5 py-1.5 text-center tabular-nums';
const ROW = 'border-b border-border-soft last:border-0 hover:bg-border-soft/40';
/** Sortable column header — the whole `<th>` is the hit area. */
const SORT =
  'inline-flex w-full cursor-pointer items-center gap-0.5 whitespace-nowrap transition-colors hover:text-text';
/** Search box (the home page's input) and the team drop-down (the season picker). */
const INPUT =
  'min-w-[170px] flex-1 rounded-xl border border-border bg-panel px-4 py-[11px] text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none';
const SELECT =
  'cursor-pointer appearance-none rounded-full border border-border bg-panel py-2 pl-3.5 pr-9 text-[13px] font-semibold text-text outline-none transition-colors hover:border-[#c7ccd2] focus:border-accent';
const PILL = 'cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors';
const PILL_IDLE = `${PILL} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const EMPTY =
  'rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted';
/** Coloured card mark for the YC/RC headers (the leaderboards' glyph). */
const CARD_GLYPH = 'h-3 w-2 shrink-0 rounded-[2px]';
/** Summary chip next to the controls (the header's META_CHIP shape). */
const COUNT_CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-bold [&_strong]:text-text';

/** Rows revealed per "Show more" — the payload can hold 1k+ players. */
const PAGE = 25;

/** Sortable columns. Text sorts A→Z, counters largest-first. */
type SortKey = 'name' | 'goals' | 'assists' | 'ga' | 'yellow' | 'red' | 'minutes' | 'shots';

/** One table row: the raw totals plus the resolved player/team and the few
 *  derived numbers the columns and the sort need. */
interface PlayerRow {
  row: PlayerTotal;
  player?: Team;
  team?: Team;
  name: string;
  teamName: string;
  goals: number;
  assists: number;
  /** Goals + assists — the "involved in" column. */
  ga: number;
  yellow: number;
  red: number;
  minutes: number;
  shots: number;
}

/** The feed sends per-game numbers as strings ("2.0"); a missing one is 0. */
const num = (v?: string): number => {
  const n = Number.parseFloat(v ?? '');
  return Number.isFinite(n) ? n : 0;
};

/** Diacritic-insensitive key — "mbappe" has to find "Mbappé". */
const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** A sortable column header (`aria-sort` rides on the `<th>`, the button is the
 *  control, exactly how the standings-style tables are expected to behave). */
function SortHead({
  label,
  glyph,
  sortKey,
  sort,
  desc,
  onSort,
  width = '',
  align = 'center',
}: {
  label: string;
  glyph?: ReactNode;
  sortKey: SortKey;
  sort: SortKey;
  desc: boolean;
  onSort: (key: SortKey) => void;
  width?: string;
  align?: 'left' | 'center';
}) {
  const active = sort === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
      className={[HEAD, width].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={[
          SORT,
          align === 'left' ? 'justify-start' : 'justify-center',
          active ? 'text-accent' : 'text-muted',
        ].join(' ')}
        title={`Sort by ${label}`}
      >
        {glyph}
        {label}
        {active &&
          (desc ? (
            <ArrowDown size={12} className="shrink-0" aria-hidden="true" />
          ) : (
            <ArrowUp size={12} className="shrink-0" aria-hidden="true" />
          ))}
      </button>
    </th>
  );
}

/** Competition squad browser: every player the feed ranks for the selected
 *  season as a searchable, sortable table. Reads the same totals payload the
 *  Statistics tab's leaderboards do, so the page only gates the request. */
export function CompetitionPlayers({
  totals,
  sportType,
  seasonLabel = '',
}: {
  totals: LeaguePlayerTotals;
  sportType: number;
  /** e.g. "25-26" — carried into the summary line for context. */
  seasonLabel?: string;
}) {
  const [query, setQuery] = useState('');
  /** teamId filter, 0 = every club. */
  const [teamId, setTeamId] = useState(0);
  const [sort, setSort] = useState<SortKey>('goals');
  /** Counters open largest-first, the name column A→Z. */
  const [desc, setDesc] = useState(true);
  const [visible, setVisible] = useState(PAGE);

  const all = useMemo<PlayerRow[]>(
    () =>
      totals.rows.map((row) => {
        const player = totalPlayer(totals, row);
        const team = totalTeam(totals, row);
        const goals = row.goals ?? 0;
        const assists = row.assists ?? 0;
        return {
          row,
          player,
          team,
          name: player?.name ?? (row.playerId !== undefined ? `#${row.playerId}` : 'Unknown player'),
          teamName: team?.name ?? (row.teamId !== undefined ? `#${row.teamId}` : '—'),
          goals,
          assists,
          ga: goals + assists,
          yellow: row.yellowCards ?? 0,
          red: row.redCards ?? 0,
          minutes: num(row.minutesPerGame),
          shots: num(row.shotsPerGame),
        };
      }),
    [totals]
  );

  /** Drop-down options: only clubs that actually field a ranked player. */
  const teams = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of totals.rows) {
      if (r.teamId === undefined) continue;
      counts.set(r.teamId, (counts.get(r.teamId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, name: totals.teams[id]?.name ?? `#${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [totals]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return all.filter((r) => {
      if (teamId !== 0 && r.row.teamId !== teamId) return false;
      if (!q) return true;
      return fold(r.name).includes(q) || fold(r.teamName).includes(q);
    });
  }, [all, query, teamId]);

  const sorted = useMemo(() => {
    const dir = desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return dir * a.name.localeCompare(b.name);
      const d = a[sort] - b[sort];
      // Ties fall back to the alphabet so equal counters keep a stable order.
      return d !== 0 ? dir * d : a.name.localeCompare(b.name);
    });
  }, [filtered, sort, desc]);

  // A new keyword/filter/sort starts the list over at its first page.
  useEffect(() => setVisible(PAGE), [query, teamId, sort, desc]);

  const toggleSort = (key: SortKey): void => {
    if (key === sort) {
      setDesc((d) => !d);
      return;
    }
    setSort(key);
    setDesc(key !== 'name');
  };

  const clearFilters = (): void => {
    setQuery('');
    setTeamId(0);
  };

  if (all.length === 0) {
    return <p className={EMPTY}>No players for this competition yet.</p>;
  }

  const rows = sorted.slice(0, visible);
  const filtersOn = query.trim() !== '' || teamId !== 0;

  return (
    <div>
      {/* Controls — search box, club drop-down and the summary chips. */}
      <section className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <span className="relative flex min-w-[190px] flex-1 items-center">
          <input
            className={INPUT}
            type="search"
            placeholder="Search players or teams…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search players or teams"
          />
          {query !== '' && (
            <button
              type="button"
              onClick={() => setQuery('')}
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-3 inline-flex cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-text"
            >
              <X size={15} />
            </button>
          )}
        </span>

        <span className="relative inline-flex">
          <select
            id="competition-player-team"
            value={teamId}
            onChange={(e) => setTeamId(Number(e.target.value))}
            aria-label="Filter by team"
            className={SELECT}
          >
            <option value={0}>All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.count})
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        </span>

        {filtersOn && (
          <button type="button" className={PILL_IDLE} onClick={clearFilters}>
            Clear filters
          </button>
        )}

        <span className="flex shrink-0 flex-wrap items-center gap-2.5">
          <span className={COUNT_CHIP}>
            <strong>{sorted.length.toLocaleString('en-US')}</strong>{' '}
            {filtersOn ? `of ${all.length.toLocaleString('en-US')} players` : 'players'}
          </span>
          <span className={COUNT_CHIP}>
            <strong>{teams.length}</strong> teams
          </span>
          {seasonLabel && (
            <span className={COUNT_CHIP}>
              Season <strong>{seasonLabel}</strong>
            </span>
          )}
        </span>
      </section>

      {sorted.length === 0 ? (
        <p className={EMPTY}>No players match the current search or team filter.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={`${HEAD} w-9 text-left`}>
                    #
                  </th>
                  <SortHead
                    label="Player"
                    sortKey="name"
                    sort={sort}
                    desc={desc}
                    onSort={toggleSort}
                    align="left"
                  />
                  <th scope="col" className={`${HEAD} text-left`}>
                    Team
                  </th>
                  <SortHead label="G" sortKey="goals" sort={sort} desc={desc} onSort={toggleSort} width="w-11" />
                  <SortHead label="A" sortKey="assists" sort={sort} desc={desc} onSort={toggleSort} width="w-11" />
                  <SortHead
                    label="G+A"
                    sortKey="ga"
                    sort={sort}
                    desc={desc}
                    onSort={toggleSort}
                    width="w-12 max-[640px]:hidden"
                  />
                  <SortHead
                    label="YC"
                    glyph={
                      <span
                        className={CARD_GLYPH}
                        style={{ backgroundColor: '#eab308' }}
                        role="img"
                        aria-label="Yellow cards"
                      />
                    }
                    sortKey="yellow"
                    sort={sort}
                    desc={desc}
                    onSort={toggleSort}
                    width="w-16"
                  />
                  <SortHead
                    label="RC"
                    glyph={
                      <span
                        className={CARD_GLYPH}
                        style={{ backgroundColor: '#ef4444' }}
                        role="img"
                        aria-label="Red cards"
                      />
                    }
                    sortKey="red"
                    sort={sort}
                    desc={desc}
                    onSort={toggleSort}
                    width="w-16"
                  />
                  <SortHead
                    label="Mins/g"
                    sortKey="minutes"
                    sort={sort}
                    desc={desc}
                    onSort={toggleSort}
                    width="w-20 max-[640px]:hidden"
                  />
                  <SortHead
                    label="Shots/g"
                    sortKey="shots"
                    sort={sort}
                    desc={desc}
                    onSort={toggleSort}
                    width="w-20 max-[640px]:hidden"
                  />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.row.playerId ?? 'x'}-${i}`} className={ROW}>
                    <td className={`${CELL} text-left font-bold text-muted`}>{i + 1}</td>
                    <td className="max-w-[240px] px-1.5 py-1.5">
                      {/* Photo and name travel together into the player's own
                          page — plain text for a name the squad could not
                          resolve, or a competition in another sport. */}
                      <PlayerLink
                        id={r.player?.playerPageId}
                        name={r.name}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <PlayerAvatar path={r.player?.logo} name={r.name} sportType={sportType} />
                        <span className="min-w-0 truncate font-semibold" title={r.name}>
                          {r.name}
                        </span>
                      </PlayerLink>
                    </td>
                    <td className="max-w-[200px] px-1.5 py-1.5">
                      {/* The club's crest + name link into its own page. */}
                      <ClubLink
                        id={r.team?.clubId}
                        name={r.team?.name ?? r.teamName}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <TeamLogo
                          path={r.team?.logo}
                          name={r.team?.name}
                          sportType={sportType}
                          size="league"
                        />
                        <span className="min-w-0 truncate text-[12px] text-muted" title={r.teamName}>
                          {r.teamName}
                        </span>
                      </ClubLink>
                    </td>
                    <td className={`${CELL} font-bold`}>{r.goals}</td>
                    <td className={CELL}>{r.assists}</td>
                    <td className={`${CELL} max-[640px]:hidden`}>{r.ga}</td>
                    <td className={CELL}>{r.yellow}</td>
                    <td className={CELL}>{r.red}</td>
                    <td className={`${CELL} text-muted max-[640px]:hidden`}>
                      {r.minutes > 0 ? r.minutes.toFixed(1) : '—'}
                    </td>
                    <td className={`${CELL} text-muted max-[640px]:hidden`}>
                      {r.shots > 0 ? r.shots.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* The counters describe the whole filtered list; paging only decides
              how much of it is painted. */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-[12px] text-muted">
              Showing <strong className="text-text">{rows.length.toLocaleString('en-US')}</strong> of{' '}
              <strong className="text-text">{sorted.length.toLocaleString('en-US')}</strong> players
            </span>
            {rows.length < sorted.length && (
              <span className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={PILL_IDLE}
                  onClick={() => setVisible((v) => v + PAGE)}
                >
                  Show {Math.min(PAGE, sorted.length - rows.length)} more
                </button>
                <button
                  type="button"
                  className={PILL_IDLE}
                  onClick={() => setVisible(sorted.length)}
                >
                  Show all
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
