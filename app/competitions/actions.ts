'use server';

import { getCompetitionCatalogueLive } from '@/lib/nowgoalCatalogue';
import type { Result } from '@/app/actions';
import type { NowgoalCatalogue } from '@/lib/types';

/** Re-read the directory on demand — what the refresh button on `/competitions`
 *  calls.
 *
 *  The page itself is served from the half-day cache (see lib/nowgoalCatalogue.ts),
 *  so this is the one way a visitor can ask for the feed as it stands right now:
 *  an uncached read, with the committed snapshot still behind it, so a bad fetch
 *  can never empty the grid the visitor is already looking at. */
export async function refreshCompetitionCatalogue(): Promise<Result<NowgoalCatalogue>> {
  try {
    return { ok: true, data: await getCompetitionCatalogueLive() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
