import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompetitionDetail } from '@/components/CompetitionDetail';
import { getCompetitionCatalogue } from '@/lib/nowgoalCatalogue';
import {
  PLAYER_METRIC_OPTIONS,
  TEAM_METRIC_OPTIONS,
  getSeason,
  getSeasonList,
  playerStats,
  standingsFromFixtures,
  teamStats,
} from '@/lib/nowgoalLeague';
import type {
  NowgoalCompetitionEntry,
  NowgoalCompetitionView,
  NowgoalSeasonData,
  NowgoalViewOption,
  NowgoalViewTab,
} from '@/lib/types';

/* One competition, one season at a time:
 *   /competitions/36?season=2026-2027&tab=fixtures&round=R_7
 *
 * The page reads the publisher's own season file (see lib/nowgoalLeague.ts) and
 * hands the client component only the rows the open tab shows — a season file
 * never reaches the browser whole, and neither does the statistics plate. Every
 * tab is a query on this one route, so a tab, a season or a round is a real URL
 * a visitor can link to, share or refresh.
 *
 * The route renders per request (the search params decide what it reads), while
 * the upstream reads themselves are cached through `next.revalidate` — so
 * switching tabs re-renders from cache, and only the first visitor inside a
 * window waits for the network. */

/** How many rows the overview tab previews of the competition's first table. */
const PREVIEW_ROWS = 5;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** One query value, first-wins when a key was repeated. */
function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
}

/** Where the catalogue files this competition, and how it labels it. A
 *  competition the catalogue does not carry still gets a page — the season file
 *  names it — so the entry is optional. */
async function findCompetition(
  id: string,
): Promise<{ entry?: NowgoalCompetitionEntry; federation: string }> {
  const { federations } = await getCompetitionCatalogue();
  for (const federation of federations) {
    const entry = federation.competitions.find((c) => c.id === id);
    if (entry) return { entry, federation: federation.name };
  }
  return { federation: '' };
}

/** The season file of one competition. The catalogue knows which of the two file
 *  flavours a competition uses (`s{id}` a league, `c{id}` a cup); when it does
 *  not, the two are tried in turn — both reads are cached, so the guess costs at
 *  most one extra request. */
async function loadSeason(
  id: string,
  kind: 'league' | 'cup' | undefined,
  season: string,
): Promise<{ kind: 'league' | 'cup'; data: NowgoalSeasonData | null }> {
  if (kind) return { kind, data: await getSeason(id, kind, season) };
  const cup = await getSeason(id, 'cup', season);
  if (cup) return { kind: 'cup', data: cup };
  return { kind: 'league', data: await getSeason(id, 'league', season) };
}

/** The tabs a season has the data for: a competition whose source publishes no
 *  statistics plate gets no statistics tab, rather than an empty one. */
function tabsOf(data: NowgoalSeasonData | null): NowgoalViewOption[] {
  const tabs: NowgoalViewOption[] = [{ key: 'overview', label: 'Overview' }];
  if (!data) return tabs;
  if (data.tables.length) tabs.push({ key: 'standings', label: 'Standings' });
  if (data.rounds.some((round) => round.fixtures.length)) {
    tabs.push({ key: 'fixtures', label: 'Fixtures' });
  }
  if (data.players.length || data.teamRows.length) tabs.push({ key: 'stats', label: 'Stats' });
  return tabs;
}

/** Round / stage / group options of the fixtures tab — every one the file has
 *  fixtures for, since an empty stage would only open an empty list. */
function roundOptionsOf(data: NowgoalSeasonData | null): NowgoalViewOption[] {
  if (!data) return [];
  return data.rounds
    .filter((round) => round.fixtures.length)
    .map((round) => ({ key: round.key, label: round.label }));
}

/** The round the fixtures tab opens on: the one the publisher's own file flags
 *  as current (a league's round in progress, a cup's or a sub-league's current
 *  stage), and the most recent round with fixtures when it flags nothing. */
function defaultRound(data: NowgoalSeasonData, options: NowgoalViewOption[]): string {
  if (!options.length) return '';
  const wanted = data.rounds[data.currentRound - 1]?.key ?? '';
  return options.some((option) => option.key === wanted) ? wanted : options[options.length - 1].key;
}

/** `wanted` when the list carries it, the fallback otherwise. */
function pick(options: NowgoalViewOption[], wanted: string, fallback: string): string {
  return options.some((option) => option.key === wanted) ? wanted : fallback;
}

/** The view model of one request: the competition, its season, and the rows of
 *  the tab that is open. */
async function loadView(
  id: string,
  query: Record<string, string | string[] | undefined>,
): Promise<NowgoalCompetitionView> {
  const { entry, federation } = await findCompetition(id);
  const seasons = await getSeasonList(id);
  // The newest season the publisher lists wins, then the catalogue's — the same
  // season its own page opens on.
  const requestedSeason = single(query.season);
  const season = seasons.includes(requestedSeason)
    ? requestedSeason
    : seasons[0] || entry?.season || '';
  if (!season) notFound();

  const { kind, data } = await loadSeason(id, entry?.kind, season);
  const tabs = tabsOf(data);
  const tab = pick(tabs, single(query.tab), 'overview') as NowgoalViewTab;

  // Fixtures tab.
  const roundOptions = roundOptionsOf(data);
  const round = data ? pick(roundOptions, single(query.round), defaultRound(data, roundOptions)) : '';
  const roundLabel = roundOptions.find((option) => option.key === round)?.label ?? '';

  // Standings tab: a league's three views (total/home/away, one per table the
  // file precomputes), a competition filed in sub-leagues' one table per
  // section, or a cup's groups — plus, for a league, the round the table is cut
  // at, whose rows are rebuilt from the fixtures (as the source does).
  const tableOptions: NowgoalViewOption[] = (data?.tables ?? []).map((table) => ({
    key: table.key,
    label: table.label,
  }));
  const table = pick(tableOptions, single(query.table), tableOptions[0]?.key ?? '');
  const selected = data?.tables.find((candidate) => candidate.key === table);
  const tableRounds = selected?.roundsPlayed ?? 0;
  const wantedRound = Number(single(query.sround));
  const standingsRound = Number.isFinite(wantedRound)
    ? Math.min(Math.max(0, Math.trunc(wantedRound)), tableRounds)
    : 0;
  const standingsRoundOptions: NowgoalViewOption[] =
    tableRounds > 0
      ? [
          { key: '0', label: 'All rounds' },
          ...Array.from({ length: tableRounds }, (_, index) => ({
            key: String(index + 1),
            label: `Round ${index + 1}`,
          })),
        ]
      : [];
  // A league's views are keyed `all`/`home`/`away`, which is also how a table
  // filed under a section (`S87_all`) ends.
  const region: 'all' | 'home' | 'away' = table.endsWith('home')
    ? 'home'
    : table.endsWith('away')
      ? 'away'
      : 'all';
  const standings =
    !data || !selected
      ? []
      : standingsRound > 0
        ? standingsFromFixtures(data.rounds, region, standingsRound, selected.scope)
        : selected.rows;

  // Stats tab. A competition whose file publishes player rows opens on the
  // player plate; one that only publishes team rows opens on teams.
  const plate: 'player' | 'team' = data?.players.length
    ? single(query.plate) === 'team'
      ? 'team'
      : 'player'
    : 'team';
  const metrics = plate === 'player' ? PLAYER_METRIC_OPTIONS : TEAM_METRIC_OPTIONS;
  const metricOptions: NowgoalViewOption[] = metrics.map(({ id: metricId, label }) => ({
    key: metricId,
    label,
  }));
  const metric = pick(metricOptions, single(query.metric), metricOptions[0]?.key ?? '');
  const page = Math.max(1, Math.trunc(Number(single(query.page))) || 1);
  const stat = !data
    ? null
    : plate === 'player'
      ? playerStats(data, metric, page)
      : teamStats(data, metric, page);

  return {
    id,
    kind,
    name: data?.name || entry?.name || `Competition ${id}`,
    shortName: data?.shortName || entry?.name || '',
    season: data?.season || season,
    crest: data?.crest || entry?.crest || '',
    description: data?.description ?? '',
    federation,
    teams: data?.teams ?? 0,
    rounds: data?.rounds.length ?? 0,
    updatedMs: data?.updatedMs ?? null,
    tabs,
    tab,
    seasons: seasons.map((label) => ({ key: label, label })),
    roundOptions,
    round,
    roundLabel,
    fixtures: data?.rounds.find((candidate) => candidate.key === round)?.fixtures ?? [],
    tableOptions,
    table,
    tableLabel: tableOptions.find((option) => option.key === table)?.label ?? '',
    standings,
    bands: selected?.bands ?? [],
    standingsRoundOptions,
    standingsRound,
    preview: (data?.tables[0]?.rows ?? []).slice(0, PREVIEW_ROWS),
    plate,
    plates: [
      ...(data?.players.length ? [{ key: 'player', label: 'Player stats' }] : []),
      ...(data?.teamRows.length ? [{ key: 'team', label: 'Team stats' }] : []),
    ],
    metricOptions,
    metric,
    stat,
  };
}

/** Title and description are built from the season the page actually shows, so a
 *  shared link never promises another season's numbers. */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const view = await loadView(id, await searchParams);
  const stage = view.kind === 'cup' ? 'stages' : 'rounds';
  return {
    title: `${view.name} ${view.season} — Fixtures, Results & Standings`,
    description: `${view.name} (${view.season}): ${view.teams} teams, ${view.rounds} ${stage} — fixtures by round, the table, and player and team statistics.`,
  };
}

export default async function CompetitionPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  // Competition ids are the publisher's own: digits and nothing else, so a stray
  // path segment never turns into an upstream read.
  if (!/^\d+$/.test(id)) notFound();
  const view = await loadView(id, await searchParams);
  return <CompetitionDetail view={view} />;
}
