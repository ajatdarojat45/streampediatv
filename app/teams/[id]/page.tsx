import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TeamDetail } from '@/components/TeamDetail';
import { PLAYER_METRIC_OPTIONS, getSeason, getTeamPlayerStats } from '@/lib/nowgoalLeague';
import {
  getTeamDetail,
  getTeamSchedule,
  getTeamTransfers,
  teamSeasonStats,
  teamStanding,
} from '@/lib/nowgoalTeam';
import type {
  NowgoalTeamCompetition,
  NowgoalTeamTab,
  NowgoalTeamView,
  NowgoalViewOption,
} from '@/lib/types';

/* One club, one competition and one season at a time:
 *   /teams/558?tab=fixtures&comp=34&fpage=2
 *   /teams/558?tab=players&ptab=data&pcomp=34&pseason=2026-2027&metric=2
 *   /teams/558?tab=stats&scomp=34&sseason=2026-2027
 *   /teams/558?tab=standing&tcomp=34&tseason=2026-2027&tview=home
 *   /teams/558?tab=transfers&year=2026&tdir=out
 *
 * The page reads the publisher's own club file for the club itself, its squad
 * and the competitions it publishes (see lib/nowgoalTeam.ts), and then only the
 * one endpoint or season file the open tab needs — so the fixtures tab never
 * pays for a season file and the squad never pays for the transfer endpoint.
 * The client component is handed only the rows the open tab shows.
 *
 * Every tab, competition, season and page is a query on this one route, so each
 * view is a real URL a visitor can link to, share or refresh. The route renders
 * per request (the search params decide what it reads), while the upstream reads
 * themselves are cached through `next.revalidate`. */

/** The tab a club's page opens on. */
const DEFAULT_TAB: NowgoalTeamTab = 'fixtures';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** One query value, first-wins when a key was repeated. */
function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
}

/** `wanted` when the list carries it, the fallback otherwise — so a stale link
 *  still lands on something real. */
function pick(options: NowgoalViewOption[], wanted: string, fallback: string): string {
  return options.some((option) => option.key === wanted) ? wanted : fallback;
}

/** One season of one competition, as the two tabs that read one get it. */
type Season = Awaited<ReturnType<typeof getSeason>>;

/** What one request resolved to: the view, or why there is none. An id the
 *  publisher has no club for is `missing` (a real 404), while a club file that
 *  could not be read at all is `unavailable` — a host that did not answer says
 *  nothing about whether the club exists, so it must not be answered with a
 *  page-not-found. */
type Loaded = { status: 'ok'; view: NowgoalTeamView } | { status: 'missing' | 'unavailable' };

/** The competitions one of the club's own lists carries, as the page's
 *  dropdowns list them. */
function optionsOf(competitions: NowgoalTeamCompetition[]): NowgoalViewOption[] {
  return competitions.map((competition) => ({ key: competition.id, label: competition.name }));
}

/** The seasons of one competition, newest first. */
function seasonsOf(
  competitions: NowgoalTeamCompetition[],
  id: string,
): NowgoalViewOption[] {
  return competitions.find((competition) => competition.id === id)?.seasons ?? [];
}

/** The section of one competition's season file a season is filed under — a
 *  sub-league's section, a cup's group — or `''` when its file has one. */
function sectionOf(competitions: NowgoalTeamCompetition[], id: string, season: string): string {
  return competitions.find((competition) => competition.id === id)?.sections[season] ?? '';
}

/** The tabs a club has data for. A club whose file publishes no squad gets no
 *  players tab, one with no competitions behind it gets no stats or standing
 *  tab, and one with no transfers gets no transfers tab — rather than tabs that
 *  only open empty lists. */
function tabsOf(detail: {
  squad: unknown[];
  playerCompetitions: unknown[];
  seasonCompetitions: unknown[];
  transferYears: string[];
}): NowgoalViewOption[] {
  return [
    { key: 'fixtures', label: 'Fixtures' },
    ...(detail.squad.length || detail.playerCompetitions.length
      ? [{ key: 'players', label: 'Players' }]
      : []),
    ...(detail.seasonCompetitions.length
      ? [
          { key: 'stats', label: 'Stats' },
          { key: 'standing', label: 'Standing' },
        ]
      : []),
    { key: 'info', label: 'Info' },
    ...(detail.transferYears.length ? [{ key: 'transfers', label: 'Transfers' }] : []),
  ];
}

/** The view model of one request: the club, and the rows of the tab that is
 *  open. Everything the other tabs would need is left unread. */
async function loadView(
  id: string,
  query: Record<string, string | string[] | undefined>,
): Promise<Loaded> {
  const read = await getTeamDetail(id);
  if (read.status !== 'ok') return { status: read.status };
  const detail = read.detail;

  const tabs = tabsOf(detail);
  const tab = pick(tabs, single(query.tab), DEFAULT_TAB) as NowgoalTeamTab;

  // Fixtures tab: one page of the club's own schedule, which is also where the
  // competition list comes from. A competition the endpoint no longer files the
  // club under falls back to every competition, the way any stale link does.
  const requestedCompetition = single(query.comp) || '0';
  const requestedPage = Math.trunc(Number(single(query.fpage))) || null;
  let competition = requestedCompetition;
  let schedule =
    tab === 'fixtures' ? await getTeamSchedule(id, requestedCompetition, requestedPage) : null;
  if (schedule && requestedCompetition !== '0' && schedule.fixtures.length === 0) {
    const all = await getTeamSchedule(id, '0', null);
    if (all && all.fixtures.length) {
      schedule = all;
      competition = '0';
    }
  }
  const competitions = schedule?.competitions ?? [{ key: '0', label: 'All' }];

  // Players tab. The lineup is the club's own file; the player data plate is one
  // competition's `playerTech` file, filtered down to the club.
  const playerCompetitions = optionsOf(detail.playerCompetitions);
  const playerCompetition = pick(
    playerCompetitions,
    single(query.pcomp),
    playerCompetitions[0]?.key ?? '',
  );
  const playerSeasons = seasonsOf(detail.playerCompetitions, playerCompetition);
  const playerSeason = pick(playerSeasons, single(query.pseason), playerSeasons[0]?.key ?? '');
  const playerTab = single(query.ptab) === 'data' ? 'data' : 'lineup';
  const metricOptions: NowgoalViewOption[] = PLAYER_METRIC_OPTIONS.map(
    ({ id: metricId, label }) => ({ key: metricId, label }),
  );
  const metric = pick(metricOptions, single(query.metric), metricOptions[0]?.key ?? '');
  const page = Math.max(1, Math.trunc(Number(single(query.ppage))) || 1);
  const stat =
    tab === 'players' && playerTab === 'data' && playerCompetition && playerSeason
      ? await getTeamPlayerStats(playerCompetition, playerSeason, detail.info.id, metric, page)
      : null;

  // Stats and standing tabs: both read one competition's own season file, with
  // the section that season is filed under — a sub-league's section, a cup's
  // group — so the numbers and the table are the club's own.
  const seasonCompetitions = optionsOf(detail.seasonCompetitions);
  const statCompetition = pick(
    seasonCompetitions,
    single(query.scomp),
    seasonCompetitions[0]?.key ?? '',
  );
  const statSeasons = seasonsOf(detail.seasonCompetitions, statCompetition);
  const statSeason = pick(statSeasons, single(query.sseason), statSeasons[0]?.key ?? '');
  const standCompetition = pick(
    seasonCompetitions,
    single(query.tcomp),
    seasonCompetitions[0]?.key ?? '',
  );
  const standSeasons = seasonsOf(detail.seasonCompetitions, standCompetition);
  const standSeason = pick(standSeasons, single(query.tseason), standSeasons[0]?.key ?? '');
  const readSeason = async (competitionId: string, season: string): Promise<Season> => {
    const competition = detail.seasonCompetitions.find(
      (candidate) => candidate.id === competitionId,
    );
    return competitionId && season
      ? getSeason(competitionId, competition?.kind ?? 'league', season)
      : null;
  };
  const statsData = tab === 'stats' ? await readSeason(statCompetition, statSeason) : null;
  const standingData = tab === 'standing' ? await readSeason(standCompetition, standSeason) : null;

  // Transfers tab: one year of the club's own endpoint, narrowed to the
  // direction the tab has open (the other half never leaves the server).
  const transferYears: NowgoalViewOption[] = detail.transferYears.map((year) => ({
    key: year,
    label: year,
  }));
  const transferYear = pick(transferYears, single(query.year), transferYears[0]?.key ?? '');
  const transferDirection = single(query.tdir) === 'out' ? 'out' : 'in';
  const transfers =
    tab === 'transfers' && transferYear
      ? (await getTeamTransfers(id, transferYear)).filter(
          (transfer) => transfer.direction === transferDirection,
        )
      : [];

  return {
    status: 'ok',
    view: {
      info: detail.info,
      tabs,
      tab,
      competitions,
      competition: pick(competitions, competition, '0'),
      fixtures: schedule?.fixtures ?? [],
      fixturePage: schedule?.page ?? 1,
      fixturePageCount: schedule?.pageCount ?? 1,
      playerTab,
      squad: tab === 'players' ? detail.squad : [],
      squadSize: detail.squad.length,
      playerCompetitions,
      playerCompetition,
      playerSeasons,
      playerSeason,
      metricOptions,
      metric,
      stat,
      seasonCompetitions,
      statCompetition,
      statSeasons,
      statSeason,
      stats: statsData
        ? teamSeasonStats(
            statsData,
            detail.info.id,
            sectionOf(detail.seasonCompetitions, statCompetition, statSeason),
          )
        : null,
      standCompetition,
      standSeasons,
      standSeason,
      standing: standingData
        ? teamStanding(
            standingData,
            detail.info.id,
            sectionOf(detail.seasonCompetitions, standCompetition, standSeason),
            single(query.tview),
          )
        : null,
      transferYears,
      transferYear,
      transferDirection,
      transfers,
    },
  };
}

/** Title and description are built from the club the page actually resolved, so
 *  a shared link never promises another club's data. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const read = await getTeamDetail(id);
  if (read.status === 'missing') return { title: 'Club not found' };
  if (read.status !== 'ok') return { title: `Club ${id}` };
  const { info, squad, seasonCompetitions } = read.detail;
  const where = [info.city, info.leagueName].filter(Boolean).join(' · ');
  return {
    title: `${info.name} — Fixtures, Squad, Stats & Transfers`,
    description: `${info.name}${where ? ` (${where})` : ''}: ${
      squad.length ? `${squad.length} players, ` : ''
    }fixtures by competition, squad and player data, ${
      seasonCompetitions.length ? 'season statistics, standings and ' : ''
    }transfers.`,
  };
}

/** The club file could not be read at all — a host that did not answer, which
 *  says nothing about whether the club exists. It is deliberately not a 404:
 *  the visitor is asked back at the same URL instead of being told the club is
 *  gone. */
function TeamUnavailable({ id }: { id: string }) {
  return (
    <section className="mb-4 rounded border border-border bg-panel px-5 py-5">
      <h1 className="m-0 text-[20px] font-extrabold">Club {id} is not answering</h1>
      <p className="m-0 mt-2 max-w-[640px] text-[13.5px] leading-[1.7] text-muted">
        The publisher's own club file could not be read just now. That is a problem on their
        side rather than a club that does not exist, so this page is worth another try in a
        moment.
      </p>
      <Link href={`/teams/${id}`} className={RETRY}>
        Try again
      </Link>
    </section>
  );
}

/** The retry link of the unavailable state (the toolbar button's own shape). */
const RETRY =
  'mt-3.5 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-[13px] font-semibold text-text no-underline transition-all hover:border-[#c7ccd2]';

export default async function TeamPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  // Club ids are the publisher's own: digits and nothing else, so a stray path
  // segment never turns into an upstream read.
  if (!/^\d+$/.test(id)) notFound();
  const loaded = await loadView(id, await searchParams);
  if (loaded.status === 'missing') notFound();
  if (loaded.status !== 'ok') return <TeamUnavailable id={id} />;
  return <TeamDetail view={loaded.view} />;
}

