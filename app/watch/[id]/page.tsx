import type { Metadata } from 'next';
import { getMatchDetail } from '@/app/actions';
import { WatchPageContent } from '@/components/WatchPageContent';
import { matchHeading } from '@/lib/matchProto';
import { UTC, formatKickoffLong } from '@/lib/datetime';
import { sportTypeFromParam } from '@/lib/sports';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sport?: string }>;
}

/** Dynamic SEO metadata — OpenGraph title/description/thumbnail fetched
 *  server-side from the match detail. The heading + description are built with
 *  the same helpers the page body uses, so the card never disagrees with the
 *  page: teams first (what people search for), then competition and kick-off. */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { sport } = await searchParams;
  /** `?sport=` carries the category slug (legacy numeric values still resolve). */
  const sportType = sportTypeFromParam(sport, 1);
  try {
    const res = await getMatchDetail({ matchId: id, sportType, language: 0, source: 'data' });
    if (!res.ok) throw new Error(res.error);
    const m = res.data.match;
    const heading = matchHeading(m);
    const league = m?.league?.name;
    const country = m?.league?.country;
    /** Crawlers and social cards render once, with no viewer zone to read —
     *  a deterministic, explicitly-labelled UTC stamp keeps the card
     *  unambiguous (the page body shows the viewer's own zone instead). */
    const kickoff = formatKickoffLong(m?.matchDate, UTC);
    /** Skip the competition when `heading` already fell back to its name. */
    const withLeague = Boolean(league) && !heading.includes(league as string);
    const title = withLeague ? `${heading} — ${league} live stream` : `${heading} live stream`;
    const description = [
      `${heading}${withLeague ? ` in ${league}` : ''}${country ? ` (${country})` : ''}.`,
      kickoff ? `Kick-off ${kickoff}.` : '',
      'Live stream with lineups, head-to-head, stats and timeline.',
    ]
      .filter(Boolean)
      .join(' ');
    // A team crest reads better as a card image than the league's country badge.
    const image = m?.home?.logo || m?.league?.logo || undefined;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'video.other',
        images: image ? [{ url: image, alt: title }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return { title: 'Live Stream', description: 'Watch live sports streaming.' };
  }
}

export default async function WatchPage({ params }: PageProps) {
  const { id } = await params;
  return <WatchPageContent id={id} />;
}


