import type { Metadata } from 'next';
import { getCompetitions } from '@/app/actions';
import { CompetitionsDirectory } from '@/components/CompetitionsDirectory';
import { sportByParam } from '@/lib/sports';

/** SEO copy — this page is the crawlable index of every competition, so the
 *  title/description name the content (fixtures, results, standings) instead of
 *  repeating the header copy. */
export const metadata: Metadata = {
  title: 'Competitions — Fixtures, Results & Standings',
  description:
    'Browse every competition across all sports: live scores, upcoming fixtures, results, standings and player stats.',
};

interface PageProps {
  /** `?sport=<slug>` pre-selects a sport chip and keeps the filtered view
   *  shareable/crawlable; the filtering itself happens client-side. */
  searchParams: Promise<{ sport?: string }>;
}

/** Competition directory.
 *
 *  Rendered on the server (unlike the match lists, which fetch in the browser)
 *  for two reasons: the whole point of this page is to be an entry point, so the
 *  competition links must be in the initial HTML for crawlers, and the fan-out
 *  that builds the rows (getCompetitions → one feed per sport) must happen where
 *  it can be cached process-wide instead of once per visitor. */
export default async function CompetitionsPage({ searchParams }: PageProps) {
  const { sport } = await searchParams;
  const result = await getCompetitions();
  return (
    <CompetitionsDirectory
      entries={result.ok ? result.data.entries : []}
      initialSport={sportByParam(sport)?.slug ?? ''}
      error={result.ok ? '' : result.error}
    />
  );
}
