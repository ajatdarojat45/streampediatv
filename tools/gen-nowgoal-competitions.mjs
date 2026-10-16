#!/usr/bin/env node
/**
 * Snapshot the NowGoal competition feed into data/nowgoal-competitions.json.
 *
 *   node tools/gen-nowgoal-competitions.mjs
 *
 * `/competitions` reads the live feed first and falls back to this file, so
 * re-run it whenever a new season appears on the page (or when the feed host
 * changes) to keep the fallback current. It refuses to overwrite a good
 * snapshot with an empty parse.
 *
 * The parser is lib/nowgoal.ts itself, imported directly, so the snapshot and
 * the page can never drift apart. Node ≥ 22.18 strips the types on the fly —
 * no build step, no flags.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'data', 'nowgoal-competitions.json');
const { NOWGOAL_FOOTBALL_ORIGIN, NOWGOAL_FEED_PATH, parseCatalogue } = await import(
  pathToFileURL(path.join(root, 'lib', 'nowgoal.ts')).href
);

const url = `${NOWGOAL_FOOTBALL_ORIGIN}${NOWGOAL_FEED_PATH}`;
console.log(`reading ${url}`);

const res = await fetch(url, {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    accept: 'text/javascript,application/javascript,*/*;q=0.8',
    referer: `${NOWGOAL_FOOTBALL_ORIGIN}/`,
  },
});
if (!res.ok) {
  console.error(`feed answered ${res.status} ${res.statusText} — snapshot left as it is`);
  process.exit(1);
}

const file = parseCatalogue(await res.text(), url);
if (!file.federations.length) {
  console.error('feed parsed to no federations — snapshot left as it is');
  process.exit(1);
}

await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(file, null, 2)}\n`);

const competitions = file.federations.flatMap((f) => f.competitions);
const leagues = competitions.filter((c) => c.kind === 'league').length;
const cups = competitions.length - leagues;
console.log(
  `${file.federations.length} federations · ${competitions.length} competitions ` +
    `(${leagues} leagues, ${cups} cups) → ${path.relative(root, target)}`,
);
console.log(`wrote ${file.generatedAt}`);
