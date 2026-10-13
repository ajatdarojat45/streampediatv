import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClubPageContent } from '@/components/ClubPageContent';
import { getGoalooClub } from '@/lib/goalooClub';
import type { GoalooClub } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** The club feed moves a few times a day, so the whole page is cached for the
 *  same five minutes its data is (lib/goalooClub.ts) instead of re-rendering on
 *  every hit. */
export const revalidate = 300;

/** The page's shared sentence — the same numbers the body shows. */
function describe(club: GoalooClub): string {
  const home = [club.stadium, club.city].filter(Boolean).join(', ');
  return [
    `${club.name}${club.leagueName ? ` (${club.leagueName})` : ''}.`,
    home ? `Home: ${home}.` : '',
    `${club.squad.length} players, ${club.results.length} results and ${club.fixtures.length} fixtures on file.`,
    'Squad, fixtures, results and transfers — with a live stream when the club plays.',
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

/** `/club/{id}` — one club, straight off its own Goaloo feed. Anything the feed
 *  does not answer for (a malformed id, an id it has no club for) is a 404
 *  rather than an empty shell. */
export default async function ClubPage({ params }: PageProps) {
  const { id } = await params;
  const club = await getGoalooClub(id);
  if (!club) notFound();
  return <ClubPageContent club={club} />;
}
