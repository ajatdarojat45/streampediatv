import type { Metadata } from 'next';
import { CompetitionsDirectory } from '@/components/CompetitionsDirectory';
import { getCompetitionCatalogue } from '@/lib/nowgoalCatalogue';

/** The feed only moves when a season rolls over or a league is added, and the
 *  snapshot only moves when the generator is re-run, so the page is rebuilt a
 *  few times a day and served from the cache in between. The feed request in
 *  lib/nowgoalCatalogue.ts carries the same window, so the page and its
 *  metadata share one fetch. */
export const revalidate = 21600;

/** Metadata is derived from the catalogue itself, so the counts in the
 *  description can never disagree with the page. */
export async function generateMetadata(): Promise<Metadata> {
  const { totals } = await getCompetitionCatalogue();
  return {
    title: 'Competitions — Leagues & Cups by Country',
    description: `Browse ${totals.competitions} football competitions by country: ${totals.leagues} leagues and ${totals.cups} cups from ${totals.federations} federations, each with its own page of fixtures, results and standings.`,
  };
}

export default async function CompetitionsPage() {
  const catalogue = await getCompetitionCatalogue();
  return <CompetitionsDirectory catalogue={catalogue} />;
}
