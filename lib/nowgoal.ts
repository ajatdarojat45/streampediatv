// NowGoal competition catalogue — the federation/competition feed the
// publisher's own football site builds its competition picker from:
//
//   https://football.nowgoal50.com/jsData/infoHeaderEn.js
//
// The feed is a plain script, one `arr[n]` line per federation:
//
//   var arr=new Array();
//   arr[0] = ["InfoID_1","England","images/164326923816.png","1",["36,ENG PR,1,0,2026-2027,...", ...]];
//
// i.e. [feedKey, name, flagPath, areaId, [competition, ...]], and every
// competition a comma-joined row
//
//   id,label,kind,topTier,season,season,...
//
// `kind` is the publisher's own split (1 = league, 2 = cup); `topTier` is `0`
// for a top-flight league, and a cup carries `0` there too, so it is only read
// for leagues. The rest are season labels, newest first — only the first is
// kept as the current season.
//
// Both images the page draws come from the image CDN the site itself points at
// (`_cdnWebDomain` of its pages), checked live against this feed:
//
//   flag  → https://imgcms.thscore.fun/football/Image/info/images/164326923816.png
//   crest → https://imgcms.thscore.fun/mini/fbleague/36.png        (36 = ENG PR)
//
// so nothing here guesses a path. If a badge ever stops resolving, the client
// falls back to the federation's or competition's initial, exactly like every
// other logo in the app (see components/Match.tsx).
//
// The catalogue the page itself reads is assembled in lib/nowgoalCatalogue.ts:
// the live feed above, falling back to the committed snapshot
// `data/nowgoal-competitions.json` that `tools/gen-nowgoal-competitions.mjs`
// writes. This module stays pure — no `fetch`, no `fs` — so that same parser
// can run under plain Node from that tool.

import type {
  NowgoalCatalogue,
  NowgoalCatalogueFile,
  NowgoalCompetition,
  NowgoalCompetitionEntry,
  NowgoalContinent,
  NowgoalFederation,
  NowgoalFederationEntry,
} from './types';

/** Origin of the football site this catalogue belongs to — its own competition
 *  pages live under `/league/{id}` there, and its season files (which the
 *  competition page reads, see lib/nowgoalLeague.ts) under `/jsData/`. */
export const NOWGOAL_FOOTBALL_ORIGIN =
  process.env.RB_NOWGOAL_FOOTBALL_ORIGIN || 'https://football.nowgoal50.com';

/** Image CDN the site's own pages read their badges from (`_cdnWebDomain`). */
export const NOWGOAL_IMAGE_ORIGIN =
  process.env.RB_NOWGOAL_IMAGE_ORIGIN || 'https://imgcms.thscore.fun';

/** The feed on that origin: one `arr[n]` line per federation. */
export const NOWGOAL_FEED_PATH = '/jsData/infoHeaderEn.js';
/** Country flags, under the `flag` path the feed publishes (`images/*.png`). */
const FLAG_PATH = '/football/Image/info/';
/** Competition crests, addressed by the same competition ids the feed uses. */
const CREST_PATH = '/mini/fbleague/';
/** Competition pages: this app's own detail route for one competition
 *  (`app/competitions/[id]/page.tsx`), which is also where every entry of the
 *  directory opens. */
const COMPETITION_PATH = '/competitions/';

/** The feed's six area buckets, in the publisher's own order and wording
 *  (`_locModel.T` of its pages: T_Area_Intercontinental … T_Area_Africa). */
export const NOWGOAL_CONTINENTS: readonly NowgoalContinent[] = [
  { key: '1', label: 'European', federations: 0, competitions: 0 },
  { key: '2', label: 'American', federations: 0, competitions: 0 },
  { key: '3', label: 'Asian', federations: 0, competitions: 0 },
  { key: '5', label: 'African', federations: 0, competitions: 0 },
  { key: '4', label: 'Oceanian', federations: 0, competitions: 0 },
  { key: '0', label: 'Intercontinental', federations: 0, competitions: 0 },
];

/** `arr[n] = [...]` — the array literal is plain JSON, so a parse is all a line
 *  needs; a line that stops parsing is skipped rather than fatal, so a new
 *  field on the publisher's side can never blank the page. */
const FEED_LINE = /^arr\[\d+\]\s*=\s*(.+?);?$/;

/** Country/region badge of a federation — the feed's own flag path, stitched
 *  onto the image CDN. An absolute path is passed through as it is. */
export function federationBadge(flag: string): string {
  const raw = (flag || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${NOWGOAL_IMAGE_ORIGIN}${FLAG_PATH}${raw.replace(/^\/+/, '')}`;
}

/** Competition crest — `/mini/fbleague/{id}.png`, the site's own template. */
export function competitionCrest(id: string): string {
  return id ? `${NOWGOAL_IMAGE_ORIGIN}${CREST_PATH}${id}.png` : '';
}

/** This app's own page for one competition (`/competitions/{id}` — the id is the
 *  publisher's own, so the two always agree). */
export function competitionHref(id: string): string {
  return `${COMPETITION_PATH}${id}`;
}

/** Continent label of a feed area id (`'Other'` for an id added later). */
export function continentLabel(area: string): string {
  return NOWGOAL_CONTINENTS.find((c) => c.key === area)?.label ?? 'Other';
}

/** One competition row of the feed, or `null` for a row without an id/label. */
export function parseCompetition(row: string): NowgoalCompetition | null {
  const fields = row.split(',');
  const [id, name, kind, top] = fields;
  if (!id || !name) return null;
  return {
    id,
    name,
    kind: kind === '2' ? 'cup' : 'league',
    // A cup carries `0` in the same field, so only a league can be top-flight.
    topTier: kind !== '2' && top === '0',
    // Everything after the fourth field is a season label, newest first; only
    // the current one is kept.
    season: fields[4] ?? '',
  };
}

/** Parse the whole feed into its snapshot shape. `origin` is only recorded, so
 *  a snapshot always says which host it was read from. */
export function parseCatalogue(
  feed: string,
  origin: string = NOWGOAL_FOOTBALL_ORIGIN,
): NowgoalCatalogueFile {
  const federations: NowgoalFederation[] = [];
  for (const line of feed.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.trim().match(FEED_LINE);
    if (!match) continue;
    let row: unknown;
    try {
      row = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (!Array.isArray(row)) continue;
    const [id, name, flag, area, rows] = row as unknown[];
    if (typeof id !== 'string' || typeof name !== 'string' || !Array.isArray(rows)) continue;
    const competitions = (rows as unknown[])
      .filter((r): r is string => typeof r === 'string')
      .map(parseCompetition)
      .filter((c): c is NowgoalCompetition => c !== null);
    if (!competitions.length) continue;
    federations.push({
      id,
      name,
      flag: typeof flag === 'string' ? flag : '',
      area: String(area ?? ''),
      competitions,
    });
  }
  return { generatedAt: new Date().toISOString(), origin, federations };
}

/** Turn the snapshot shape into what the page renders: absolute badge/crest
 *  URLs, continent labels, and the totals the header and the meta description
 *  quote. The feed's own ordering is kept — it already leads with the
 *  competitions a visitor is looking for. */
export function buildCatalogue(
  file: NowgoalCatalogueFile,
  source: NowgoalCatalogue['source'],
): NowgoalCatalogue {
  const federations: NowgoalFederationEntry[] = file.federations.map((f) => ({
    id: f.id,
    name: f.name,
    badge: federationBadge(f.flag),
    area: f.area,
    continent: continentLabel(f.area),
    competitions: f.competitions.map(
      (c): NowgoalCompetitionEntry => ({
        ...c,
        crest: competitionCrest(c.id),
        href: competitionHref(c.id),
      }),
    ),
  }));

  const continents = NOWGOAL_CONTINENTS.map((c) => ({ ...c }));
  const byKey = new Map(continents.map((c) => [c.key, c]));
  let competitions = 0;
  let leagues = 0;
  let cups = 0;
  for (const f of federations) {
    const continent = byKey.get(f.area);
    if (continent) {
      continent.federations += 1;
      continent.competitions += f.competitions.length;
    }
    competitions += f.competitions.length;
    for (const c of f.competitions) {
      if (c.kind === 'cup') cups += 1;
      else leagues += 1;
    }
  }

  return {
    federations,
    // Only the continents this catalogue actually has federations in.
    continents: continents.filter((c) => c.federations > 0),
    totals: { federations: federations.length, competitions, leagues, cups },
    source,
    generatedAt: file.generatedAt || '',
  };
}

