// The `/competitions` catalogue loader: the live NowGoal feed when it answers,
// the committed snapshot when it does not.
//
// The feed only moves when a season rolls over or a league is added, so the
// page's own read caches one fetch for half a day (`next.revalidate`) — the page
// and its `generateMetadata` share that single response. The refresh button goes
// the other way: `getCompetitionCatalogueLive` reads the same sources with
// `no-store`, so a visitor who asks for the list as it stands right now gets
// exactly that. Anything that goes wrong — no network, a 404, an HTML error page
// served with a 200, a reshape of the feed — falls through to
// `data/nowgoal-competitions.json`. The snapshot is imported rather than read
// from disk, so it is part of the build and cannot go missing at runtime;
// `tools/gen-nowgoal-competitions.mjs` refreshes it.

import snapshot from '@/data/nowgoal-competitions.json';
import {
  NOWGOAL_FOOTBALL_ORIGIN,
  NOWGOAL_FEED_PATH,
  buildCatalogue,
  parseCatalogue,
} from './nowgoal';
import type { NowgoalCatalogue, NowgoalCatalogueFile } from './types';

/** Half a day — see the note above. */
const REVALIDATE_SECONDS = 6 * 60 * 60;
/** A feed that has not answered by then is a bad day; the snapshot is better. */
const FETCH_TIMEOUT_MS = 8_000;
/** The feed host answers its own pages, not bare clients. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** The committed snapshot. A JSON import widens the feed's own vocabulary
 *  (`kind`, `topTier`, …) to primitives, hence the cast back onto the shape
 *  `parseCatalogue` produces. */
const SNAPSHOT = snapshot as unknown as NowgoalCatalogueFile;

/** The live feed, or `null` when it is unreachable or no longer parses.
 *
 *  The page's own read reuses the half-day cache entry; `fresh` (the refresh
 *  button) reads the feed uncached, so it answers with the list as it stands
 *  right now. */
async function fetchFeed(fresh = false): Promise<NowgoalCatalogueFile | null> {
  try {
    const init: RequestInit = {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/javascript,application/javascript,*/*;q=0.8',
        referer: `${NOWGOAL_FOOTBALL_ORIGIN}/`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };
    if (fresh) init.cache = 'no-store';
    else init.next = { revalidate: REVALIDATE_SECONDS };

    const res = await fetch(`${NOWGOAL_FOOTBALL_ORIGIN}${NOWGOAL_FEED_PATH}`, init);
    if (!res.ok) return null;
    const file = parseCatalogue(await res.text());
    // An error page is served with a 200 often enough that the parse is the
    // real health check: no federations means no feed.
    return file.federations.length ? file : null;
  } catch {
    return null;
  }
}

/** The whole directory: the live feed when it answers, the committed snapshot
 *  otherwise, and an empty — but still renderable — catalogue if even that is
 *  missing (a checkout without the snapshot, e.g. a scratch build). */
async function load(fresh: boolean): Promise<NowgoalCatalogue> {
  const live = await fetchFeed(fresh);
  if (live) return buildCatalogue(live, 'nowgoal');
  if (SNAPSHOT.federations?.length) return buildCatalogue(SNAPSHOT, 'snapshot');
  return buildCatalogue(
    { generatedAt: '', origin: NOWGOAL_FOOTBALL_ORIGIN, federations: [] },
    'snapshot',
  );
}

/** The page's read (`app/competitions/page.tsx`): cached for `REVALIDATE_SECONDS`,
 *  so the render and its metadata share one upstream fetch. */
export function getCompetitionCatalogue(): Promise<NowgoalCatalogue> {
  return load(false);
}

/** The refresh button's read: the same sources, uncached, so the caller sees the
 *  feed as it stands right now. Concurrent clicks share a single upstream fetch. */
let inflight: Promise<NowgoalCatalogue> | null = null;
export function getCompetitionCatalogueLive(): Promise<NowgoalCatalogue> {
  inflight ??= load(true).finally(() => {
    inflight = null;
  });
  return inflight;
}
