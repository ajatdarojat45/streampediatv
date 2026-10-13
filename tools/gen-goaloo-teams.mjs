/**
 * Generates `data/goaloo-teams.json` — the club-name → Goaloo club id index
 * behind the `/club/{id}` deep links on every Rblink-driven page.
 *
 * The two publishers share no club identifier: Rblink keys a team by its own
 * `teamId` (an id only `/competition` and `/watch` understand), while a club
 * page needs the Goaloo id its own feed is addressed by
 * (`/jsdata/teamInfo/teamdetail/json/tdl<id>_en.json`). Both sides do publish
 * the club's name, so the bridge is name matching — the same bridge, and the
 * same rules, lib/goalooJoin.ts already uses to pair a Goaloo fixture with its
 * Rblink stream.
 *
 * Fetching that club list per Rblink page would cost one Goaloo call per
 * competition on the page (a live feed carries a dozen of them), so the club
 * lists of the whole catalogue are collected here instead, offline, and
 * imported statically by lib/goalooTeams.ts — exactly how `competitions.json`
 * and `rblink-leagues.json` are produced. The runtime then resolves a name
 * with no network at all.
 *
 * Upstream is the per-competition feed already used by lib/goaloo.ts:
 *
 *   /jsData/matchResult/json/{seasonDir}/{path}_en.json
 *     -> TeamInfo  (a league: the whole division)
 *        TeamList  (a cup: the clubs of the current stage)
 *     rows are positional: [id, name, "", logoPath, ...]
 *
 *   node tools/gen-goaloo-teams.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.GOALOO_BASE || 'https://football2.goaloo28.com';
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  referer: BASE + '/',
  'accept-language': 'en-US,en;q=0.9',
};
const CATALOGUE = path.join(process.cwd(), 'data', 'competitions.json');
const OUT = path.join(process.cwd(), 'data', 'goaloo-teams.json');

/** The feed answers unknown paths with a 200 HTML soft-404, so the
 *  content-type — not the status — is what proves the payload is real. */
async function getJson(url) {
  for (let i = 0; i < 3; i += 1) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      const ct = r.headers.get('content-type') || '';
      if (r.status === 200 && ct.includes('json')) return JSON.parse(await r.text());
      if (r.status === 404) return null;
    } catch {
      /* retry */
    }
    await new Promise((x) => setTimeout(x, 400 + i * 600));
  }
  return null;
}

/** Every `[id, name]` pair a competition publishes — `TeamInfo` for a league,
 *  `TeamList` for a cup, and in a few feeds both. Positional rows are guarded
 *  at every index, so an unexpected shape is skipped instead of throwing. */
function collectTeams(json) {
  const out = [];
  for (const key of ['TeamInfo', 'TeamList']) {
    const rows = json?.[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const id = row[0];
      const name = row[1];
      if (typeof id !== 'number' || id <= 0) continue;
      if (typeof name !== 'string' || !name.trim()) continue;
      out.push([name.trim(), id]);
    }
  }
  return out;
}

const catalogue = JSON.parse(await readFile(CATALOGUE, 'utf8'));
const jobs = catalogue.competitions.filter((c) => c.path && c.seasonDir);

/** name + id — deduplicated, because the same club is published by the
 *  competition it plays in, its cup and every cup it enters. */
const pairs = new Map();
let cursor = 0;
let misses = 0;
let done = 0;

async function worker() {
  while (cursor < jobs.length) {
    const comp = jobs[cursor++];
    const json = await getJson(`${BASE}/jsData/matchResult/json/${comp.seasonDir}/${comp.path}_en.json`);
    const teams = json ? collectTeams(json) : [];
    if (!teams.length) misses += 1;
    for (const [name, id] of teams) pairs.set(`${name}\u0000${id}`, [name, id]);
    done += 1;
    process.stdout.write(`\r${done}/${jobs.length} competitions, ${pairs.size} clubs, ${misses} without a club list`);
    await new Promise((x) => setTimeout(x, 80));
  }
}

await Promise.all(Array.from({ length: 5 }, worker));

const teams = [...pairs.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    source: catalogue.source || 'goaloo28',
    generatedAt: new Date().toISOString(),
    competitions: jobs.length,
    count: teams.length,
    teams,
  })
);

/** Names the index cannot speak for — one spelling pointing at two different
 *  clubs — resolved to nothing by lib/goalooTeams.ts. Printed so the number is
 *  visible when the catalogue is regenerated. */
const perName = new Map();
for (const [name, id] of teams) {
  const ids = perName.get(name) ?? new Set();
  ids.add(id);
  perName.set(name, ids);
}
const shared = [...perName.values()].filter((ids) => ids.size > 1).length;
console.log(
  `\nwrote ${OUT} (${teams.length} clubs, ${perName.size} distinct names, ${shared} shared by two ids, ${misses} competitions without a club list)`
);
