import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeagueDetail } from '@/app/actions';
import { CompetitionPageContent } from '@/components/CompetitionPageContent';
import { sportTypeFromParam } from '@/lib/sports';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sport?: string; season?: string }>;
}

/** Dynamic SEO metadata — competition name/crest/season fetched server-side
 *  from the league detail. Built with the same numbers the page body shows, so
 *  a search result never disagrees with the page it opens. */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
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
  const { sport, season } = await searchParams;
  // The endpoint keys on a numeric leagueId — anything else is not a page.
  if (!/^\d+$/.test(id)) notFound();
  const sportType = sportTypeFromParam(sport, 1);
  return <CompetitionPageContent leagueId={id} sportType={sportType} seasonId={season} />;
}
