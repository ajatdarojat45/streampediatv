/**
 * The competition-season feed behind `/competition/{s|c<id>}` — the Goaloo
 * catalogue's own competition page, and the fixture rows the watch page's
 * reverse join reads (lib/goalooLiveJoin.ts).
 *
 * The catalogue (data/competitions.json) names 989 competitions and the stream
 * join pairs 454 of them; the rest have no Rblink league to read at all, so
 * their page has to come from the feed that describes them: one JSON per
 * competition-season holding the clubs taking part, every fixture by stage and
 * (for cups) the published tables — parsed in exactly one place, lib/goaloo.ts.
 *
 * Read once per process and revalidated on the feed's own five-minute window
 * (the window lib/goalooClub.ts uses), so a page view costs at most one upstream
 * request, and the two consumers of the same rows — the competition page and the
 * watch page's join — share that one read instead of fetching twice.
 *
 * Server-only: it resolves the catalogue key through lib/competitions, which
 * carries the ~1 MB catalogue.
 */
import { findCompetition } from './competitions';
import { goalooCompetitionUrl, parseGoalooCompetition } from './goaloo';
import type { GoalooCompetitionDetail, GoalooFixture } from './types';

/** The feed republishes a competition's season a few times a day. */
const REVALIDATE = 300;

/** One parsed competition-season per `seasonDir/path`. */
const cache = new Map<string, Promise<GoalooCompetitionDetail | null>>();

/**
 * The competition-season of a catalogue key (`s<id>` league / `c<id>` cup), or
 * `null` when the catalogue does not hold that key or the feed did not answer.
 *
 * `seasonDir` overrides the season the URL is built from — the catalogue's own
 * when omitted, which is what a page wants; the watch page's join passes the
 * season of the competition it is reading, so its key matches the read the page
 * itself made.
 */
export function getGoalooCompetition(
  path: string,
  seasonDir?: string
): Promise<GoalooCompetitionDetail | null> {
  const comp = findCompetition(path);
  if (!comp) return Promise.resolve(null);
  const dir = seasonDir || comp.seasonDir;
  const key = `${dir}/${path}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const task = (async (): Promise<GoalooCompetitionDetail | null> => {
    try {
      const res = await fetch(goalooCompetitionUrl({ path, seasonDir: dir }), {
        headers: { accept: 'application/json' },
        next: { revalidate: REVALIDATE },
      });
      if (!res.ok) return null;
      const raw = (await res.json()) as unknown;
      // The feed's own parser, so the positional rows are read in exactly one
      // place (lib/goaloo.ts): every left-over leg, tie and stage label comes
      // along with the fixtures it belongs to.
      return parseGoalooCompetition(raw, comp);
    } catch {
      return null;
    }
  })();
  cache.set(key, task);
  void task.then((detail) => {
    // A read with no fixtures at all (the feed is down, or the publisher has not
    // drawn the season yet) is evicted, so the next viewer retries instead of
    // being served a permanent blank for the life of the process.
    if (!detail || !detail.stages.length) cache.delete(key);
  });
  return task;
}

/** Every fixture of one competition-season, stages flattened in the feed's own
 *  order — or `null` when the season could not be read at all (an unknown key,
 *  an upstream failure), which the callers tell apart from an empty schedule. */
export async function goalooCompetitionFixtures(
  path: string,
  seasonDir?: string
): Promise<GoalooFixture[] | null> {
  const detail = await getGoalooCompetition(path, seasonDir);
  return detail ? detail.stages.flatMap((stage) => stage.items) : null;
}
