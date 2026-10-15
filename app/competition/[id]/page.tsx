import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeagueDetail, getLeagueSeasons, getLeagueStandings } from '@/app/actions';
import { CompetitionPageContent } from '@/components/CompetitionPageContent';
import { GoalooCompetitionPage, type CataloguePanel } from '@/components/GoalooCompetitionPage';
import { leagueSeasonLabel } from '@/lib/clubLeagues';
import { goalooCompetitionLogoUrl } from '@/lib/goaloo';
import { getGoalooCompetition } from '@/lib/goalooCompetition';
import { joinStreamIds, type GoalooFixtureRef } from '@/lib/goalooJoin';
import { rblinkLeagueFor } from '@/lib/rblinkLeagues';
import { sportTypeFromParam } from '@/lib/sports';
import type { CatalogueTab, LeagueStandings } from '@/lib/types';

/** The Goaloo catalogue is a football catalogue, and so is every page built from
 *  it — including the stream join and the table its Standings panel falls back to. */
const FOOTBALL = 1;

/** The catalogue's own keys — `s<id>` for a league, `c<id>` for a cup (lib/sports).
 *  Every other id is an Rblink leagueId, which is what `/competition/{id}` has
 *  always been addressed by, so the two can never collide: an Rblink id is a bare
 *  number. */
const CATALOGUE_KEY = /^[sc]\d+$/;

/** The panels a catalogue competition page may open, in the order its tab strip
 *  draws them. */
const TABS: CatalogueTab[] = ['overview', 'fixtures', 'standings', 'teams'];

interface PageProps {
  params: Promise<{ id: string }>;
  /** `?sport=` and `?season=` address an Rblink league; `?tab=` and `?stage=` the
   *  panel a Goaloo catalogue competition opens (see {@link CataloguePanel}). */
  searchParams: Promise<{
    sport?: string;
    season?: string;
    tab?: string;
    stage?: string;
  }>;
}

type PageQuery = Awaited<PageProps['searchParams']>;

/** The tab a URL asks for; anything unknown opens the overview. */
function tabOf(value?: string): CatalogueTab {
  return TABS.find((tab) => tab === value) ?? 'overview';
}

/** Dynamic SEO metadata — competition name/crest/season fetched server-side
 *  from the league detail. Built with the same numbers the page body shows, so
 *  a search result never disagrees with the page it opens. */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  // The catalogue's own page describes the competition its feed filed — built
  // from the very read the body renders, so a search result can never quote a
  // competition the page does not show.
  if (CATALOGUE_KEY.test(id)) return catalogueMetadata(id);
  const { sport, season } = await searchParams;
  /** `?sport=` carries the category slug (legacy numeric values still resolve). */
  const sportType = sportTypeFromParam(sport, 1);
  try {
    const res = await getLeagueDetail({ leagueId: id, sportType, language: 0, seasonId: season });
    if (!res.ok) throw new Error(res.error);
    const { league, extra } = res.data;
    const name = league?.name || 'Competition';
    const country = league?.country;
    const seasonName = league?.season?.name || season || '';
    const title = `${name}${seasonName ? ` ${seasonName}` : ''} — fixtures, results & standings`;
    const description = [
      `${name}${country ? ` (${country})` : ''}${seasonName ? ` · ${seasonName} season` : ''}.`,
      extra?.teamCount ? `${extra.teamCount} teams` : '',
      extra?.avgGoals ? `${extra.avgGoals} goals per match on average` : '',
      'Fixtures, results and the live standings table.',
    ]
      .filter(Boolean)
      .join('. ')
      .replace(/\.\./g, '.');
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: league?.logo ? [{ url: league.logo, alt: name }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: league?.logo ? [league.logo] : undefined,
      },
    };
  } catch {
    return {
      title: 'Competition',
      description: 'Fixtures, results and standings for this competition.',
    };
  }
}

export default async function CompetitionPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  // The catalogue's own key (`s1122`, `c29090`): the page the directory's rows
  // open for every competition the stream scan did NOT pair, drawn from the
  // Goaloo competition-season feed.
  if (CATALOGUE_KEY.test(id)) return <CatalogueCompetitionPage path={id} query={query} />;
  // The endpoint keys on a numeric leagueId — anything else is not a page.
  if (!/^\d+$/.test(id)) notFound();
  const sportType = sportTypeFromParam(query.sport, 1);
  return <CompetitionPageContent leagueId={id} sportType={sportType} seasonId={query.season} />;
}

/** SEO for the catalogue's page, off the same feed read the body performs. */
async function catalogueMetadata(path: string): Promise<Metadata> {
  const detail = await getGoalooCompetition(path);
  if (!detail) {
    return {
      title: 'Competition',
      description: 'Fixtures, results, tables and clubs for this competition.',
    };
  }
  const { comp, teams, stages } = detail;
  const fixtures = stages.reduce((total, stage) => total + stage.items.length, 0);
  const name = comp.name || 'Competition';
  const seasonName = comp.season || '';
  const crest = goalooCompetitionLogoUrl(comp.logo);
  const title = `${name}${seasonName ? ` ${seasonName}` : ''} — fixtures, results & clubs`;
  const description = [
    `${name}${comp.country ? ` (${comp.country})` : ''}${seasonName ? ` · ${seasonName} season` : ''}.`,
    teams.length > 0 ? `${teams.length} clubs` : '',
    fixtures > 0 ? `${fixtures} fixtures on file` : '',
    'Fixtures round by round, every club and the published tables.',
  ]
    .filter(Boolean)
    .join('. ')
    .replace(/\.\./g, '.');
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: crest ? [{ url: crest, alt: name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: crest ? [crest] : undefined,
    },
  };
}

/**
 * The Goaloo catalogue's own competition page — one feed read for the panel the
 * URL asked for, plus the two things that feed cannot answer:
 *
 *   1. which of its fixtures the STREAM catalogue carries (the shared join in
 *      lib/goalooJoin, so a row's stream is paired by the same kick-off + club
 *      rules the club page uses), and
 *   2. for a league's Standings panel, the stream catalogue's own table — the
 *      Goaloo feed publishes tables for cups only.
 *
 * Both are read only when the open panel needs them, exactly as the club page
 * reads only its open panel; the join reads all of the season's fixtures at once
 * because they all belong to the one competition (so it costs a single cached
 * upstream call either way).
 */
async function CatalogueCompetitionPage({ path, query }: { path: string; query: PageQuery }) {
  const detail = await getGoalooCompetition(path);
  if (!detail) notFound();
  const { comp, stages } = detail;
  const tab = tabOf(query.tab);
  /** The stage the Fixtures panel shows — the URL's only when the feed filed a
   *  round under that key, no key otherwise (the panel then opens on the next
   *  round with a fixture to play). */
  const stage = stages.some((entry) => entry.key === query.stage) ? query.stage ?? '' : '';

  /** The Rblink league behind this competition, and the stream id it streams
   *  under. `0` whenever the catalogue does not pair the two: every stream row
   *  is then simply absent, never guessed at. */
  const league = rblinkLeagueFor(comp)?.league ?? null;
  const streamLeagueId = league?.id ?? 0;

  let streams = new Map<number, number>();
  if (streamLeagueId > 0 && (tab === 'overview' || tab === 'fixtures')) {
    const rows: GoalooFixtureRef[] = stages.flatMap((entry) =>
      entry.items.map((fixture) => ({
        matchId: fixture.matchId,
        // The join resolves the Rblink league from the Goaloo competition id —
        // the same key this page was reached by.
        leagueId: comp.id,
        kickoff: fixture.kickoff,
        home: fixture.home.name,
        away: fixture.away.name,
      }))
    );
    streams = await joinStreamIds(rows);
  }

  let leagueStandings: LeagueStandings | null = null;
  let leagueSeason = '';
  let error = '';

  if (tab === 'standings' && streamLeagueId > 0) {
    /** BOTH table calls are answered only WITH a season (see lib/api.ts), so the
     *  scan's own published window is used, and the newest season the feed
     *  publishes otherwise — which is the league's current one. */
    let seasonId = league?.season?.id ? String(league.season.id) : '';
    leagueSeason = league?.season?.name ?? '';
    if (!seasonId) {
      const listed = await getLeagueSeasons({ leagueId: streamLeagueId, sportType: FOOTBALL });
      if (listed.ok) {
        const first = listed.data.find((entry) => entry.seasonId !== undefined);
        if (first) {
          seasonId = String(first.seasonId);
          leagueSeason = leagueSeasonLabel(first);
        }
      } else {
        error = listed.error;
      }
    }
    if (!seasonId) {
      error = error || 'The stream catalogue publishes no season to read a table for.';
    } else {
      const res = await getLeagueStandings({
        leagueId: streamLeagueId,
        sportType: FOOTBALL,
        language: 0,
        seasonId,
      });
      if (res.ok) leagueStandings = res.data;
      else error = res.error;
    }
  }

  const panel: CataloguePanel = {
    tab,
    stage,
    streams,
    streamLeagueId,
    leagueStandings,
    leagueSeason,
    error,
  };
  return <GoalooCompetitionPage detail={detail} panel={panel} />;
}

