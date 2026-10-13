'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronDown, Flame, Goal, Loader2, RefreshCw, Star, Trophy, Users, Wallet } from 'lucide-react';
import { MatchRow, MatchRowSkeleton, TeamLogo } from '@/components/Match';
import { CompetitionOverview } from '@/components/CompetitionOverview';
import { CompetitionPlayers } from '@/components/CompetitionPlayers';
import { CompetitionStats } from '@/components/CompetitionStats';
import { EmptyMatches } from '@/components/EmptyMatches';
import {
  useLeagueDetail,
  useLeagueMatches,
  useLeaguePlayerTotals,
  useLeagueSeasons,
  useLeagueStandings,
} from '@/lib/queries';
import { standingTeam, groupFixtures, type StageGroup } from '@/lib/leagueProto';
import { matchDateMs } from '@/lib/datetime';
import { isStarted } from '@/lib/matchProto';
import { sportLabel, sportSlug, watchHref } from '@/lib/sports';
import type { LeagueSeason, LeagueStandings, Match, TeamStanding } from '@/lib/types';

/** Surface panel (`.panel`) — the same card the watch page uses. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
const ERROR_BANNER =
  'mb-4 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] whitespace-pre-wrap break-words text-[#c5221f] [[data-theme=dark]_&]:border-[#ef4444] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#fca5a5]';
/** Fact chip for the header stat row (mirrors the watch page's `META_CHIP`). */
const META_CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-bold [&_strong]:text-text';
/** Filter-tab pills (same active/idle pair as the category page). */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
const TAB_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const TAB_COUNT_IDLE = `${TAB_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const TAB_COUNT_ACTIVE = `${TAB_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;

/** Tab body switch keys: the tab the page opens on, the full fixture list, the
 *  table, the squad browser and the per-player leaderboards. */
type TabKey = 'overview' | 'matches' | 'standings' | 'players' | 'stats';

/** DOM id of a fixture bucket — the auto-focus scroll target. Index-based so a
 *  label with spaces/pipes (\"|Round 1|\") can never produce a bad selector. */
const stageId = (index: number): string => `competition-stage-${index}`;

/** Fixtures are bucketed by stage/group/round by `groupFixtures` (see
 *  lib/leagueProto) — the labels are made unique there, because the feed repeats
 *  one stage across a whole season. */

/** A season's display name — the API localises `name` for language 0 and also
 *  ships the plain slug ("26-27") at field 50.1 as a fallback. */
const seasonName = (s: LeagueSeason): string =>
  s.name || s.extraName || String(s.seasonId ?? '');

/** Compact aggregate chip for the header row. */
function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Trophy;
  label: string;
  value: string | number;
}) {
  return (
    <span className={META_CHIP}>
      {Icon && <Icon size={13} className="shrink-0" aria-hidden="true" />}
      {label} <strong>{value}</strong>
    </span>
  );
}

/** One stage/round bucket of fixtures — the header is a toggle, exactly like a
 *  league group on the feed, so a long competition collapses cleanly. The
 *  bucket that holds the next kick-off is opened by the page and carries the
 *  “Next up” chip; the fixture row itself keeps the normal card chrome, so the
 *  list has one uniform treatment. */
function StageSection({
  id,
  group,
  open,
  onToggle,
  onMatchClick,
  nextUp,
}: {
  id: string;
  group: StageGroup;
  open: boolean;
  onToggle: () => void;
  onMatchClick: (m: Match) => void;
  /** This bucket holds the nearest upcoming fixture. */
  nextUp: boolean;
}) {
  return (
    <section id={id} className="mb-4 scroll-mt-24 last:mb-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="mb-2 flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-border-soft/60"
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-text">{group.label}</span>
        {nextUp && (
          <span className="shrink-0 rounded-full border border-accent bg-accent-soft px-2 py-px text-[11px] font-bold text-accent">
            Next up
          </span>
        )}
        <span className="rounded-full border border-border bg-panel px-2 py-px text-[11px] font-bold text-muted">
          {group.items.length}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          {group.items.map((m, i) => (
            <MatchRow key={`${m.matchId}-${i}`} match={m} onClick={() => onMatchClick(m)} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Filter-tab pill (icon-free, matching the category page's tabs). */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? TAB_ACTIVE : TAB_IDLE}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Count bubble inside a tab pill. */
function TabCount({ active, value }: { active: boolean; value: number }) {
  return <span className={active ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>{value}</span>;
}

/** Tab body: spinner → error → empty → content, in that order of precedence. */
function TabState({ loading, error, empty, children }: {
  loading: boolean;
  error: string;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <MatchRowSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (error) return <div className={ERROR_BANNER}>{error}</div>;
  if (empty) return <EmptyMatches kind="filter" />;
  return <>{children}</>;
}

function StandingsTable({
  standings,
  sportType,
}: {
  standings: LeagueStandings;
  sportType: number;
}) {
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, TeamStanding[]>();
    for (const row of standings.rows) {
      const key = row.groupName || '';
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
        order.push(key);
      }
      list.push(row);
    }
    return order.map((key) => ({ key, label: key, rows: map.get(key) ?? [] }));
  }, [standings.rows]);

  const head = 'px-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
  const cell = 'px-1.5 py-1.5 text-center tabular-nums';

  return (
    <div className="overflow-x-auto">
      {groups.map((group) => (
        <div key={group.key || 'all'} className="mb-4 last:mb-0">
          {group.label && (
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">
              {group.label}
            </h3>
          )}
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className={`${head} w-9 text-left`} scope="col">#</th>
                <th className={`${head} text-left`} scope="col">Team</th>
                <th className={`${head} w-9 text-center`} scope="col">P</th>
                <th className={`${head} w-9 text-center`} scope="col">W</th>
                <th className={`${head} w-9 text-center`} scope="col">D</th>
                <th className={`${head} w-9 text-center`} scope="col">L</th>
                <th className={`${head} w-10 text-center`} scope="col">GF</th>
                <th className={`${head} w-10 text-center`} scope="col">GA</th>
                <th className={`${head} w-10 text-center`} scope="col">GD</th>
                <th className={`${head} w-11 text-center`} scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, i) => {
                const team = standingTeam(standings, row);
                const promo =
                  row.promotionId !== undefined ? standings.promotions[row.promotionId] : undefined;
                const goals = row.goals ?? 0;
                const against = row.goalsAgainst ?? 0;
                const diff = goals - against;
                return (
                  <tr
                    key={`${row.teamId}-${i}`}
                    className="border-b border-border-soft last:border-0 hover:bg-border-soft/40"
                  >
                    <td
                      className={`${cell} border-l-[3px] text-left font-bold text-muted`}
                      style={{ borderLeftColor: promo?.color || 'transparent' }}
                      title={promo?.name}
                    >
                      {i + 1}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <TeamLogo
                          path={team?.logo}
                          name={team?.name}
                          sportType={sportType}
                          size="league"
                        />
                        <span className="min-w-0 truncate font-semibold">
                          {team?.name ?? (row.teamId !== undefined ? `#${row.teamId}` : '—')}
                        </span>
                      </span>
                    </td>
                    <td className={cell}>{row.total ?? 0}</td>
                    <td className={cell}>{row.won ?? 0}</td>
                    <td className={cell}>{row.draw ?? 0}</td>
                    <td className={cell}>{row.loss ?? 0}</td>
                    <td className={cell}>{goals}</td>
                    <td className={cell}>{against}</td>
                    <td className={cell}>{diff > 0 ? `+${diff}` : diff}</td>
                    <td className={`${cell} font-bold`}>{row.points ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {Object.values(standings.promotions).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
          {Object.values(standings.promotions).map((p) => (
            <span key={p.promotionId} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: p.color }}
                aria-hidden="true"
              />
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
/** Competition (league) detail page body.
 *
 * Opens four /api/league/* endpoints (all signed with code 200 / DT_LEAGUE):
 * the header detail, the season list, the fixtures and the standings table.
 * Only the visible tab actually fetches — switching to Standings fires the
 * standings request then, not on mount — so opening the page costs three
 * upstream calls and a tab switch adds one. The Players and Statistics tabs
 * share the player-totals endpoint (one browser, one set of leaderboards), so
 * whichever is opened first pays for it and the other reuses the cache. */
export function CompetitionPageContent({
  leagueId,
  sportType,
  seasonId,
}: {
  leagueId: string;
  sportType: number;
  /** `?season=` — a seasonId; empty means "current season". */
  seasonId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('overview');
  const [season, setSeason] = useState(seasonId ?? '');

  // The detail call also answers without a seasonId (it falls back to the
  // competition's current season), so it resolves the season the other two
  // endpoints then need.
  const detailQuery = useLeagueDetail({ leagueId, sportType, seasonId: season });
  const seasonsQuery = useLeagueSeasons({ leagueId, sportType });

  const detail = detailQuery.data;
  const league = detail?.league;
  const seasons = seasonsQuery.data ?? [];

  /** Fixtures/standings REQUIRE a seasonId: a season-less call is answered with
   *  HTTP 499 by the upstream. So the season the detail payload resolved (or the
   *  newest from the season list) stands in until the visitor picks one. */
  const resolvedSeason =
    season || String(league?.season?.seasonId ?? seasons[0]?.seasonId ?? '');

  /* The overview renders the next/latest fixtures and a table snapshot, so it
     shares those two requests with their own tabs instead of duplicating them.
     Only the visible view actually fetches. */
  const matchesQuery = useLeagueMatches({
    leagueId,
    sportType,
    seasonId: resolvedSeason,
    enabled: (tab === 'overview' || tab === 'matches') && Boolean(resolvedSeason),
  });
  const standingsQuery = useLeagueStandings({
    leagueId,
    sportType,
    seasonId: resolvedSeason,
    enabled: (tab === 'overview' || tab === 'standings') && Boolean(resolvedSeason),
  });
  /** Player totals are the heaviest payload of the family (1k+ rows), so they
   *  are fetched the first time one of the player tabs (Players/Statistics) is
   *  opened — both read this single payload. */
  const totalsQuery = useLeaguePlayerTotals({
    leagueId,
    sportType,
    seasonId: resolvedSeason,
    enabled: (tab === 'players' || tab === 'stats') && Boolean(resolvedSeason),
  });

  const extra = detail?.extra;
  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const standings = standingsQuery.data;
  const totals = totalsQuery.data;
  /** Roster size for the Players tab bubble — the payload's own player list when
   *  it ships one, otherwise the row count. */
  const playerCount = useMemo(() => {
    if (!totals) return 0;
    const known = Object.keys(totals.players).length;
    return known > 0 ? known : totals.rows.length;
  }, [totals]);
  const fixtureGroups = useMemo(() => groupFixtures(matches), [matches]);

  /* ---------- fixtures: land straight on the nearest kick-off ----------
   * `now` is filled in AFTER mount: a clock read during render would let the
   * server and the client disagree about which bucket counts as upcoming. */
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  /** Bucket to open. When the season is complete (no un-played match left) the
   *  most recent round is the useful landing spot. */
  const focus = useMemo(() => {
    if (fixtureGroups.length === 0) return { index: -1, upcoming: false };
    for (let i = 0; i < fixtureGroups.length; i += 1) {
      const next = fixtureGroups[i].items.find(
        (m) => !isStarted(m.status) && (now === null || (matchDateMs(m.matchDate) ?? 0) >= now)
      );
      if (next) return { index: i, upcoming: true };
    }
    return { index: fixtureGroups.length - 1, upcoming: false };
  }, [fixtureGroups, now]);

  const focusKey = fixtureGroups[focus.index]?.key ?? '';
  /** Open buckets — only the focus bucket starts open; a manual toggle takes
   *  over from there (the effect below re-homes on a season/new-focus change). */
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  useEffect(() => {
    setOpenKeys(focusKey ? [focusKey] : []);
  }, [focusKey]);

  /** Scroll the focus bucket in once per target. The page header is sticky,
   *  which `scroll-mt-24` on the section compensates for. */
  const focusedRef = useRef('');
  useEffect(() => {
    if (tab !== 'matches' || !focusKey || focusedRef.current === focusKey) return;
    if (!openKeys.includes(focusKey)) return;
    const el = document.getElementById(stageId(focus.index));
    if (!el) return;
    focusedRef.current = focusKey;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [tab, focusKey, focus.index, openKeys]);

  const name = league?.name || 'Competition';
  const slug = sportSlug(sportType);
  const backHref = slug ? `/sports/${slug}` : '/';
  const country = league?.country && league.country !== name ? league.country : '';
  const hot = Boolean(league?.hot);
  /** Season being shown: the picked one, else whatever the API resolved. */
  const activeSeason =
    seasons.find((s) => String(s.seasonId) === resolvedSeason) ||
    (!season ? league?.season : undefined);

  const message = (error: unknown): string =>
    error instanceof Error ? error.message : error ? String(error) : '';

  const busy =
    detailQuery.isFetching ||
    seasonsQuery.isFetching ||
    matchesQuery.isFetching ||
    standingsQuery.isFetching ||
    totalsQuery.isFetching;

  const refresh = (): void => {
    void detailQuery.refetch();
    void seasonsQuery.refetch();
    void matchesQuery.refetch();
    void standingsQuery.refetch();
    void totalsQuery.refetch();
  };

  /** Open a fixture — the row and the overview both land on the watch page. */
  const openMatch = (m: Match): void => {
    router.push(watchHref(m.matchId, m.sportType ?? sportType));
  };

  /** Season switch: local state drives the queries immediately and the URL is
   *  rewritten (no scroll jump) so the view stays shareable and reloadable. */
  const pickSeason = (next: string): void => {
    setSeason(next);
    const q = new URLSearchParams();
    if (slug) q.set('sport', slug);
    if (next) q.set('season', next);
    const qs = q.toString();
    router.replace(`/competition/${leagueId}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  /* Stat chips — every value comes straight from the payload's aggregate block,
     so a field the feed omits simply drops its chip. */
  const chips: Array<{ key: string; icon?: typeof Trophy; label: string; value: string | number }> = [];
  if (extra?.teamCount) chips.push({ key: 'teams', icon: Users, label: 'Teams', value: extra.teamCount });
  if (matchesQuery.data) chips.push({ key: 'fixtures', icon: CalendarDays, label: 'Fixtures', value: matches.length });
  if (extra?.avgGoals) chips.push({ key: 'goals', icon: Goal, label: 'Goals/match', value: extra.avgGoals });
  if (extra?.avgAge) chips.push({ key: 'age', label: 'Avg age', value: extra.avgAge });
  if (extra?.teamMarketValue) chips.push({ key: 'value', icon: Wallet, label: 'Squad value', value: extra.teamMarketValue });
  if (extra?.win || extra?.draw || extra?.loss)
    chips.push({
      key: 'wdl',
      label: 'Home W/D/A',
      value: `${extra.win ?? '0'}% / ${extra.draw ?? '0'}% / ${extra.loss ?? '0'}%`,
    });
  if (extra?.redCards || extra?.yellowCards)
    chips.push({
      key: 'cards',
      label: 'Cards',
      value: `${extra.yellowCards ?? '0'}Y · ${extra.redCards ?? '0'}R`,
    });


  return (
    <>
      {/* Breadcrumb — directory → the category the competition was opened from →
       *  competition. The middle crumb keeps its original target (so "back" still
       *  returns to the sport), while the leading crumb puts the competition
       *  directory within reach of a competition page too. */}
      <p className="mb-3 flex items-center gap-1.5 text-[13px] text-muted">
        <Link href="/competitions" className="no-underline transition-colors hover:text-accent">
          Competitions
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={backHref} className="no-underline transition-colors hover:text-accent">
          {slug ? sportLabel(sportType) : 'Live'}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="min-w-0 truncate text-text">{name}</span>
      </p>

      {/* 1. Header — crest, name, country, season and the aggregate chips. */}
      {detailQuery.isLoading && (
        <section className={PANEL}>
          <div className="flex items-center gap-4">
            <span className="h-10 w-10 shrink-0 rounded-lg bg-[#e8eaed] max-[640px]:h-8 max-[640px]:w-8 [[data-theme=dark]_&]:bg-border-soft" />
            <span className="h-5 w-40 rounded bg-[#e8eaed] [[data-theme=dark]_&]:bg-border-soft" />
          </div>
        </section>
      )}

      {!detailQuery.isLoading && detailQuery.isError && (
        <div className={ERROR_BANNER}>{message(detailQuery.error) || 'Competition not found.'}</div>
      )}

      {detail && (
        <section className={PANEL}>
          <div className="flex flex-wrap items-center gap-4">
            <TeamLogo path={league?.logo} name={name} kind="league" size="detailTeam" />
            <div className="min-w-0 flex-1">
              <h1 className="m-0 flex items-center gap-2 text-[20px] font-extrabold leading-tight">
                <span className="min-w-0 truncate">{name}</span>
                {hot && (
                  <Flame
                    className="h-4 w-4 shrink-0 text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]"
                    aria-label="Trending competition"
                  />
                )}
              </h1>
              <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Trophy size={13} className="shrink-0" aria-hidden="true" />
                  {sportLabel(league?.sportType ?? sportType)}
                </span>
                {country && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{country}</span>
                  </>
                )}
                {activeSeason && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-text">{seasonName(activeSeason)}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {chips.map((c) => (
                <StatChip key={c.key} icon={c.icon} label={c.label} value={c.value} />
              ))}
              {extra?.mvpPlayer?.name && (
                <span className={META_CHIP}>
                  <Star size={13} className="shrink-0" aria-hidden="true" />
                  MVP
                  <TeamLogo
                    path={extra.mvpPlayer.logo}
                    name={extra.mvpPlayer.name}
                    sportType={sportType}
                    size="league"
                  />
                  <strong>{extra.mvpPlayer.name}</strong>
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* 2. Season picker — a dropdown (a cup can carry 20+ seasons, and the
          pill row pushed the tabs off screen). Hidden when the feed knows a
          single season only. */}
      {seasons.length > 1 && (
        <section className="mb-4 flex flex-wrap items-center gap-2.5">
          <label htmlFor="competition-season" className="text-[13px] font-semibold text-muted">
            Season
          </label>
          <span className="relative inline-flex">
            <select
              id="competition-season"
              value={season}
              onChange={(e) => pickSeason(e.target.value)}
              className="cursor-pointer appearance-none rounded-full border border-border bg-panel py-2 pl-3.5 pr-9 text-[13px] font-semibold text-text outline-none transition-colors hover:border-[#c7ccd2] focus:border-accent"
            >
              <option value="">Current season</option>
              {seasons.map((s) => {
                const id = String(s.seasonId ?? '');
                if (!id) return null;
                return (
                  <option key={id} value={id}>
                    {seasonName(s)}
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
          {activeSeason && (
            <span className="text-[12px] text-muted">
              Showing <strong className="text-text">{seasonName(activeSeason)}</strong>
            </span>
          )}
        </section>
      )}

      {/* 3. Tabs — the overview, the fixtures, the table, the squads and the
          player leaderboards. */}
      <section
        className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={tab === 'matches'} onClick={() => setTab('matches')}>
          Matches
          {matchesQuery.data && <TabCount active={tab === 'matches'} value={matches.length} />}
        </TabButton>
        <TabButton active={tab === 'standings'} onClick={() => setTab('standings')}>
          Standings
          {standings && standings.rows.length > 0 && (
            <TabCount active={tab === 'standings'} value={standings.rows.length} />
          )}
        </TabButton>
        <TabButton active={tab === 'players'} onClick={() => setTab('players')}>
          Players
          {playerCount > 0 && <TabCount active={tab === 'players'} value={playerCount} />}
        </TabButton>
        <TabButton active={tab === 'stats'} onClick={() => setTab('stats')}>
          Statistics
          {totals && totals.rows.length > 0 && (
            <TabCount active={tab === 'stats'} value={totals.rows.length} />
          )}
        </TabButton>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-panel px-3.5 py-2 text-[13px] font-semibold text-muted transition-all hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
          title="Refresh"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </section>

      {/* 4. Tab body. */}
      <section className={PANEL}>
        {tab === 'overview' && (
          <CompetitionOverview
            extra={extra}
            sportType={sportType}
            seasonLabel={activeSeason ? seasonName(activeSeason) : ''}
            matches={matches}
            standings={standings}
            // `!resolvedSeason` = the season gate is still shut (the detail call
            // has not answered yet) — a skeleton is honest there, whereas a
            // disabled query reports `isLoading === false`.
            matchesLoading={!resolvedSeason || matchesQuery.isLoading}
            standingsLoading={!resolvedSeason || standingsQuery.isLoading}
            onOpenTab={setTab}
            onOpenMatch={openMatch}
          />
        )}

        {tab === 'matches' && (
          <TabState
            loading={!resolvedSeason || matchesQuery.isLoading}
            error={message(matchesQuery.error)}
            empty={fixtureGroups.length === 0}
          >
            <div>
              {fixtureGroups.map((g, i) => (
                <StageSection
                  key={g.key}
                  id={stageId(i)}
                  group={g}
                  open={openKeys.includes(g.key)}
                  onToggle={() =>
                    setOpenKeys((prev) =>
                      prev.includes(g.key) ? prev.filter((k) => k !== g.key) : [...prev, g.key]
                    )
                  }
                  onMatchClick={openMatch}
                  // The bucket holding the nearest kick-off opens (and scrolls
                  // in) on arrival; a finished season lands on its last round.
                  nextUp={focus.upcoming && i === focus.index}
                />
              ))}
            </div>
          </TabState>
        )}

        {tab === 'standings' && (
          <TabState
            loading={!resolvedSeason || standingsQuery.isLoading}
            error={message(standingsQuery.error)}
            empty={!standings || standings.rows.length === 0}
          >
            {standings && (
              <>
                {standings.stage?.name && (
                  <h2 className="mb-3 text-[15px] font-bold">{standings.stage.name}</h2>
                )}
                <StandingsTable standings={standings} sportType={sportType} />
              </>
            )}
          </TabState>
        )}

        {tab === 'players' && (
          <TabState
            loading={!resolvedSeason || totalsQuery.isLoading}
            error={message(totalsQuery.error)}
            // An empty roster renders CompetitionPlayers' own message.
            empty={false}
          >
            {totals && (
              <CompetitionPlayers
                totals={totals}
                sportType={sportType}
                seasonLabel={activeSeason ? seasonName(activeSeason) : ''}
              />
            )}
          </TabState>
        )}

        {tab === 'stats' && (
          <TabState
            loading={!resolvedSeason || totalsQuery.isLoading}
            error={message(totalsQuery.error)}
            // An empty row set renders CompetitionStats' own message.
            empty={false}
          >
            {totals && <CompetitionStats totals={totals} sportType={sportType} />}
          </TabState>
        )}
      </section>
    </>
  );
}

