import type { Metadata } from 'next';
import { CompetitionsDirectory } from '@/components/CompetitionsDirectory';
import { competitionDirectory } from '@/lib/rblinkLeagues';

/** The Goaloo catalogue joined to the Rblink stream catalogue. Built once per
 *  server process — the Rblink file is ~540 KB and never leaves the server —
 *  and shared by the metadata and the body, so a search result can never quote
 *  numbers the page itself does not show. */
const directory = competitionDirectory();

/** Static SEO metadata, derived from the same totals the page renders. */
export const metadata: Metadata = {
  title: 'Competitions — live streams, fixtures & standings',
  description: `${directory.totals.competitions} football competitions from ${directory.totals.countries} federations across ${directory.areas.length} continents — ${directory.totals.streamed} of them with live streams. Browse by continent and federation, with every competition's fixtures, results and standings.`,
};

export default function CompetitionsPage() {
  return <CompetitionsDirectory directory={directory} />;
}
