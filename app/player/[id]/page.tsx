import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlayerPageContent } from '@/components/PlayerPageContent';
import { getGoalooPlayer } from '@/lib/goalooPlayer';
import type { GoalooPlayer } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
  /** The panel selections the page owns: which tab, which page of the match log,
   *  and which competition × season the Tech Stats panel shows. */
  searchParams: Promise<{ tab?: string; page?: string; league?: string; season?: string }>;
}

/** The player feed publishes its own last-update stamp a few times a day, so the
 *  page is cached for the same five minutes its data is (lib/goalooPlayer.ts). */
export const revalidate = 300;

/** The page's shared sentence — the same numbers the body shows. */
function describe(player: GoalooPlayer): string {
  return [
    `${player.name}${player.teamName ? ` (${player.teamName})` : ''}${player.country ? `, ${player.country}` : ''}.`,
    player.matches.length ? `${player.matches.length} appearances on file` : '',
    player.seasons.length ? `across ${player.seasons.length} season${player.seasons.length > 1 ? 's' : ''}.` : '.',
    'Profile, attribute radar, season totals, match log, transfers and tech stats — each match links to its stream when one exists.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Dynamic SEO metadata, built from the very payload the page renders. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const player = await getGoalooPlayer(id);
  if (!player) return { title: 'Player', description: 'Profile, stats and transfers.' };
  const title = `${player.name}${player.teamName ? ` — ${player.teamName}` : ''} · profile, stats & transfers`;
  const description = describe(player);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: player.photo ? [{ url: player.photo, alt: player.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: player.photo ? [player.photo] : undefined,
    },
  };
}

/** `/player/{id}` — one player, straight off his own Goaloo feed. An id the
 *  feed does not answer for is a 404 rather than an empty shell. The tab, the
 *  match-log page and the Tech Stats pair ride in the query string, so the
 *  paneled view stays linkable; the content component clamps anything unknown. */
export default async function PlayerPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab, page, league, season } = await searchParams;
  const player = await getGoalooPlayer(id);
  if (!player) notFound();
  return (
    <PlayerPageContent
      player={player}
      tab={tab}
      page={page}
      league={league}
      season={season}
    />
  );
}
