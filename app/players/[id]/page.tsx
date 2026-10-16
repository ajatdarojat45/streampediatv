import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlayerDetail } from '@/components/PlayerDetail';
import { MATCHES_PER_PAGE, getPlayerDetail, playerSeasonStats } from '@/lib/nowgoalPlayer';
import type { NowgoalPlayerDetail } from '@/lib/nowgoalPlayer';
import type {
  NowgoalPlayerMatch,
  NowgoalPlayerTab,
  NowgoalPlayerView,
  NowgoalViewOption,
} from '@/lib/types';

/* One player, one competition and one season at a time:
 *   /players/167233?tab=info
 *   /players/167233?tab=stats&scomp=34&sseason=2026-2027
 *   /players/167233?tab=matches&mpage=2
 *   /players/167233?tab=transfer
 *
 * The page reads the publisher's own player file once — it is the single file
 * that page opens on, and it carries the player, his attributes, his whole match
 * log and his whole career of moves (see lib/nowgoalPlayer.ts) — and then hands
 * the client only the rows the open tab shows: one competition and season of the
 * log for the statistics plate, one page of ten matches for the log itself.
 *
 * Every tab, competition, season and page is a query on this one route, so each
 * view is a real URL a visitor can link to, share or refresh. The route renders
 * per request (the search params decide what it reads), while the upstream read
 * itself is cached through `next.revalidate`. */

/** The tab a player's page opens on. The publisher's own page leads with the
 *  schedule, but this one leads with the player himself — the file's own header
 *  facts and his attributes are what the rest of the page is read from. */
const DEFAULT_TAB: NowgoalPlayerTab = 'info';

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

/** What one request resolved to: the view, or why there is none. An id the
 *  publisher has no player for is `missing` (a real 404), while a file that
 *  could not be read at all is `unavailable` — a host that did not answer says
 *  nothing about whether the player exists, so it must not be answered with a
 *  page-not-found. */
type Loaded = { status: 'ok'; view: NowgoalPlayerView } | { status: 'missing' | 'unavailable' };

/** The tabs a player has data for. A player whose log is empty gets no
 *  statistics and no matches tab, and one with no move published gets no
 *  transfer tab — rather than tabs that only open empty plates. */
function tabsOf(detail: NowgoalPlayerDetail): NowgoalViewOption[] {
  return [
    { key: 'info', label: 'Info' },
    ...(detail.matches.length
      ? [
          { key: 'stats', label: 'Stats' },
          { key: 'matches', label: 'Matches' },
        ]
      : []),
    ...(detail.transfers.length ? [{ key: 'transfer', label: 'Transfer' }] : []),
  ];
}

/** The competitions the player's own log files him in, in the order the log
 *  reaches them — newest match first — so the competition he plays in now leads
 *  the list. */
function competitionsOf(matches: NowgoalPlayerMatch[]): NowgoalViewOption[] {
  const options: NowgoalViewOption[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    if (!match.competitionId || seen.has(match.competitionId)) continue;
    seen.add(match.competitionId);
    options.push({ key: match.competitionId, label: match.competition });
  }
  return options;
}

/** The seasons one competition is filed under in the log, newest first — which
 *  is the order the log itself is written in. */
function seasonsOf(matches: NowgoalPlayerMatch[], competitionId: string): NowgoalViewOption[] {
  const options: NowgoalViewOption[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    if (match.competitionId !== competitionId || !match.season || seen.has(match.season)) continue;
    seen.add(match.season);
    options.push({ key: match.season, label: match.season });
  }
  return options;
}


/** The view model of one request: the player, and the rows of the tab that is
 *  open. Everything the other tabs would need is left unread — the log is cut to
 *  one page and the plate to one competition and season before it is handed on. */
async function loadView(
  id: string,
  query: Record<string, string | string[] | undefined>,
): Promise<Loaded> {
  const read = await getPlayerDetail(id);
  if (read.status !== 'ok') return { status: read.status };
  const { info, matches, transfers } = read.detail;

  const tabs = tabsOf(read.detail);
  const tab = pick(tabs, single(query.tab), DEFAULT_TAB) as NowgoalPlayerTab;

  // Statistics tab: one competition and one season of the player's own log. The
  // competition he plays in now (the one his own file names) is what the tab
  // opens on, and every other one he has played in is a click away.
  const statCompetitions = competitionsOf(matches);
  const statCompetition = pick(
    statCompetitions,
    single(query.scomp),
    pick(statCompetitions, info.competitionId, statCompetitions[0]?.key ?? ''),
  );
  const statSeasons = seasonsOf(matches, statCompetition);
  const statSeason = pick(statSeasons, single(query.sseason), statSeasons[0]?.key ?? '');
  const stats =
    tab === 'stats' && statCompetition && statSeason
      ? playerSeasonStats(matches, statCompetition, statSeason)
      : null;

  // Matches tab: one page of the log, ten to a page, the way the publisher's own
  // pager reads it.
  const matchCount = matches.length;
  const matchPageCount = Math.max(1, Math.ceil(matchCount / MATCHES_PER_PAGE));
  const matchPage = Math.min(
    Math.max(1, Math.trunc(Number(single(query.mpage))) || 1),
    matchPageCount,
  );
  const page =
    tab === 'matches'
      ? matches.slice((matchPage - 1) * MATCHES_PER_PAGE, matchPage * MATCHES_PER_PAGE)
      : [];

  return {
    status: 'ok',
    view: {
      info,
      tabs,
      tab,
      statCompetitions,
      statCompetition,
      statSeasons,
      statSeason,
      stats,
      matches: page,
      matchPage,
      matchPageCount,
      matchCount,
      // The career list is short — a dozen moves at the outside — so the whole of
      // it is what the tab shows.
      transfers,
    },
  };
}

/** Title and description are built from the player the page actually resolved,
 *  so a shared link never promises another player's numbers. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const read = await getPlayerDetail(id);
  if (read.status === 'missing') return { title: 'Player not found' };
  if (read.status !== 'ok') return { title: `Player ${id}` };
  const { info, matches, transfers } = read.detail;
  const where = [info.number ? `#${info.number}` : '', info.teamName, info.country]
    .filter(Boolean)
    .join(' · ');
  return {
    title: `${info.name} — Stats, Matches, Attributes & Transfers`,
    description: `${info.name}${where ? ` (${where})` : ''}: ${
      matches.length ? `${matches.length} matches, ` : ''
    }statistics by competition and season, ${info.attributes.length ? 'his attributes, ' : ''}${
      transfers.length ? 'every move of his career and ' : ''
    }his own match log.`,
  };
}

/** The player file could not be read at all — a host that did not answer, which
 *  says nothing about whether the player exists. It is deliberately not a 404:
 *  the visitor is asked back at the same URL instead of being told he is gone. */
function PlayerUnavailable({ id }: { id: string }) {
  return (
    <section className="mb-4 rounded border border-border bg-panel px-5 py-5">
      <h1 className="m-0 text-[20px] font-extrabold">Player {id} is not answering</h1>
      <p className="m-0 mt-2 max-w-[640px] text-[13.5px] leading-[1.7] text-muted">
        The publisher's own player file could not be read just now. That is a problem on their
        side rather than a player that does not exist, so this page is worth another try in a
        moment.
      </p>
      <Link href={`/players/${id}`} className={RETRY}>
        Try again
      </Link>
    </section>
  );
}

/** The retry link of the unavailable state (the toolbar button's own shape). */
const RETRY =
  'mt-3.5 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-[13px] font-semibold text-text no-underline transition-all hover:border-[#c7ccd2]';

export default async function PlayerPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  // Player ids are the publisher's own: digits and nothing else, so a stray path
  // segment never turns into an upstream read.
  if (!/^\d+$/.test(id)) notFound();
  const loaded = await loadView(id, await searchParams);
  if (loaded.status === 'missing') notFound();
  if (loaded.status !== 'ok') return <PlayerUnavailable id={id} />;
  return <PlayerDetail view={loaded.view} />;
}
