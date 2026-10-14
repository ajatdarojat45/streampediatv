import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeaguePlayerTotals, getLeagueSeasons, getLeagueStandings } from '@/app/actions';
import { ClubPageContent, type ClubPanel } from '@/components/ClubPageContent';
import { clubCompetitionList, clubLeagueOptions, leagueSeasonLabel } from '@/lib/clubLeagues';
import { getGoalooClub, getGoalooClubSchedule, getGoalooClubTransfers } from '@/lib/goalooClub';
import type { ClubPlayerView, ClubTab, GoalooClub, TransferDirection } from '@/lib/types';

/** The club feed is a football feed — every panel on the page is football. */
const FOOTBALL = 1;

/** The panels the URL may ask for, in the order the tab strip draws them. */
const TABS: ClubTab[] = ['overview', 'schedule', 'players', 'transfers', 'standing'];

interface PageProps {
  params: Promise<{ id: string }>;
  /** The panel the URL asks for: the tab, the page of the schedule, its
   *  competition filter, the players sub-panel (and the competition × season its
   *  table reads), the transfer year and direction, and the competition × season
   *  the standing table reads. */
  searchParams: Promise<{
    tab?: string;
    page?: string;
    comp?: string;
    view?: string;
    dir?: string;
    year?: string;
    league?: string;
    season?: string;
  }>;
}

/** Every club fetch carries the feed's own five-minute window (lib/goalooClub.ts).
 *  The page itself is rendered per request, because its panels are chosen by the
 *  query string — but only the open panel fetches anything, and what it fetches
 *  is cached. */
export const revalidate = 300;

/** The tab a URL asks for; anything unknown opens the overview. */
function tabOf(value?: string): ClubTab {
  return TABS.find((tab) => tab === value) ?? 'overview';
}

/** A positive whole number in a query param, or the fallback. */
function pageOf(value: string | undefined, fallback: number): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** The page's shared sentence — the same numbers the body shows. */
function describe(club: GoalooClub): string {
  const home = [club.stadium, club.city].filter(Boolean).join(', ');
  return [
    `${club.name}${club.leagueName ? ` (${club.leagueName})` : ''}.`,
    home ? `Home: ${home}.` : '',
    `${club.squad.length} players, ${club.results.length} results and ${club.fixtures.length} fixtures on file.`,
    'Squad, the full schedule, transfer windows, a standing table and every match that is streaming.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Dynamic SEO metadata, built from the very club payload the page renders, so
 *  a search result can never quote a club the page does not show. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const club = await getGoalooClub(id);
  if (!club) return { title: 'Club', description: 'Squad, fixtures and results.' };
  const title = `${club.name} — squad, fixtures & results${club.leagueName ? ` · ${club.leagueName}` : ''}`;
  const description = describe(club);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: club.logo ? [{ url: club.logo, alt: club.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: club.logo ? [club.logo] : undefined,
    },
  };
}

/** `/club/{id}` — one club, straight off its own Goaloo feed, opening on the
 *  panel the URL asks for. Anything the feed does not answer for (a malformed
 *  id, an id it has no club for) is a 404 rather than an empty shell. */
export default async function ClubPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const club = await getGoalooClub(id);
  if (!club) notFound();

  const tab = tabOf(query.tab);

  /** The filters are read back from the URL only when they name something the
   *  club feed itself knows: an unknown competition, year or season is not a
   *  filter, it is a typo. */
  const competitions = clubCompetitionList(club);
  const comp = competitions.some((c) => String(c.id) === query.comp) ? query.comp ?? '' : '';
  const year = club.transferYears.includes(query.year ?? '')
    ? query.year ?? ''
    : club.transferYears[0] ?? '';
  const view: ClubPlayerView = query.view === 'data' ? 'data' : 'lineup';
  const dir: TransferDirection = query.dir === 'out' ? 'out' : 'in';
  const season = /^\d+$/.test(query.season ?? '') ? query.season ?? '' : '';

  /** The competition the two league-backed panels read: the one the URL names,
   *  otherwise the first the club offers — its own competition, when the
   *  catalogue pairs it with a stream. */
  const leagues = clubLeagueOptions(club);
  const league =
    leagues.find((option) => String(option.streamId) === query.league) ?? leagues[0] ?? null;

  /** The open panel's payload — and only the open panel's. */
  let schedule: ClubPanel['schedule'] = null;
  let transfers: ClubPanel['transfers'] = null;
  let standings: ClubPanel['standings'] = null;
  let totals: ClubPanel['totals'] = null;
  let seasons: ClubPanel['seasons'] = [];
  let seasonId = '';
  let error = '';

  if (tab === 'schedule') {
    schedule = await getGoalooClubSchedule(club.id, pageOf(query.page, 1), comp);
    if (!schedule) error = 'The club feed did not answer for this page of the schedule.';
  }

  if (tab === 'transfers' && year) {
    transfers = await getGoalooClubTransfers(club.id, year);
  }

  if (league && (tab === 'standing' || (tab === 'players' && view === 'data'))) {
    /** The season picker's options, newest first, exactly as the league feed
     *  publishes them. */
    const listed = await getLeagueSeasons({ leagueId: league.streamId, sportType: FOOTBALL });
    if (listed.ok) {
      seasons = listed.data
        .filter((entry) => entry.seasonId !== undefined)
        .map((entry) => ({ id: String(entry.seasonId), label: leagueSeasonLabel(entry) }));
    } else {
      error = listed.error;
    }

    /** BOTH tables below are answered only WITH a season: a season-less call is
     *  rejected with HTTP 499 (see lib/api.ts). So the season the URL names is
     *  used when the competition publishes it, and the newest published season
     *  otherwise — which is the competition's current one. */
    seasonId = seasons.find((entry) => entry.id === season)?.id ?? seasons[0]?.id ?? '';

    if (!seasonId) {
      error = error || 'The competition publishes no season to read a table for.';
    } else if (tab === 'standing') {
      const res = await getLeagueStandings({
        leagueId: league.streamId,
        sportType: FOOTBALL,
        language: 0,
        seasonId,
      });
      if (res.ok) standings = res.data;
      else error = res.error;
    } else {
      const res = await getLeaguePlayerTotals({
        leagueId: league.streamId,
        sportType: FOOTBALL,
        language: 0,
        seasonId,
      });
      if (res.ok) totals = res.data;
      else error = res.error;
    }
  }

  return (
    <ClubPageContent
      club={club}
      panel={{
        tab,
        schedule,
        comp,
        view,
        totals,
        year,
        dir,
        transfers,
        standings,
        leagues,
        league,
        seasons,
        season: seasonId,
        error,
      }}
    />
  );
}
