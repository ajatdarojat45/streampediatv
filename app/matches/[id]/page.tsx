import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchDetail } from '@/components/MatchDetail';
import { getMatchView } from '@/lib/nowgoalMatch';
import type { NowgoalMatchQuery } from '@/lib/nowgoalMatch';

/* One match, one tab at a time, with the plates of that tab's own two-sided
 * lists as their own query:
 *   /matches/3003849
 *   /matches/3003849?tab=lineup
 *   /matches/3003849?tab=h2h&last=away&fix=home
 *
 * The page reads the publisher's own match pages (see lib/nowgoalMatch.ts): the
 * one behind `/detail/{id}` carries the timeline, the statistics, the team
 * sheets and the highlight, the one behind `/analysis/{id}` the strength
 * comparison, the poll, the head-to-head list, both sides' form, their next
 * fixtures and their absences. The analysis page is read only for the tab that
 * shows it, and only the rows of the open plates are handed to the client, so a
 * head-to-head list of twenty meetings never reaches a visitor reading the
 * timeline.
 *
 * Every tab and every plate is a query on this one route, so each view is a real
 * URL a visitor can link to, share or refresh. The route renders per request
 * (the search params decide what is read), while the upstream reads themselves
 * are cached through `next.revalidate`. */

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** One query value, first-wins when a key was repeated. */
function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
}

/** What the request asked the reader for. An unknown value is not rejected here
 *  — the reader falls back to the default the match itself has data for, so a
 *  stale link still lands on a real view. */
function queryOf(params: Record<string, string | string[] | undefined>): NowgoalMatchQuery {
  return { tab: single(params.tab), last: single(params.last), fix: single(params.fix) };
}

/** Title and description are built from the match the page actually resolved, so
 *  a shared link never promises another match's numbers. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { title: 'Match not found' };
  const read = await getMatchView(id, { tab: '', last: '', fix: '' });
  if (read.status !== 'ok') return { title: `Match ${id}` };
  const { header, tabs } = read.value;
  const where = [header.competition, header.round].filter(Boolean).join(' · ');
  const score =
    header.homeScore !== null && header.awayScore !== null
      ? ` ${header.homeScore}-${header.awayScore}`
      : '';
  return {
    title: `${header.home.name} vs ${header.away.name}${score} — Live Score, Line Up & H2H`,
    description: `${header.home.name} vs ${header.away.name}${where ? ` (${where})` : ''}: the
      timeline, the statistics, both team sheets, the strength comparison and the
      head-to-head record${tabs.length > 1 ? ', one tab at a time' : ''}.`,
  };
}

/** The retry link of the unavailable state (the toolbar button's own shape). */
const RETRY =
  'mt-3.5 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-[13px] font-semibold text-text no-underline transition-all hover:border-[#c7ccd2]';

/** The match pages could not be read at all — a host that did not answer, which
 *  says nothing about whether the match exists. It is deliberately not a 404:
 *  the visitor is asked back at the same URL instead of being told it is gone. */
function MatchUnavailable({ id }: { id: string }) {
  return (
    <section className="mb-4 rounded border border-border bg-panel px-5 py-5">
      <h1 className="m-0 text-[20px] font-extrabold">Match {id} is not answering</h1>
      <p className="m-0 mt-2 max-w-[640px] text-[13.5px] leading-[1.7] text-muted">
        The publisher&apos;s own match pages could not be read just now. That is a problem on their
        side rather than a match that does not exist, so this page is worth another try in a
        moment.
      </p>
      <Link href={`/matches/${id}`} className={RETRY}>
        Try again
      </Link>
    </section>
  );
}

export default async function MatchPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  // Schedule ids are the publisher's own: digits and nothing else, so a stray
  // path segment never turns into an upstream read.
  if (!/^\d+$/.test(id)) notFound();
  const loaded = await getMatchView(id, queryOf(await searchParams));
  if (loaded.status === 'missing') notFound();
  if (loaded.status !== 'ok') return <MatchUnavailable id={id} />;
  return <MatchDetail id={id} view={loaded.value} />;
}
