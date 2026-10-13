/**
 * Generates `data/competitions.json` — the worldwide competition catalogue that
 * powers /competitions. Upstream is the Goaloo28 public "league" JSON feed:
 *
 *   index  : /jsData/league/pc/infoHeaderEn.js
 *            -> { countries: [{ name, area, leagues: [...] }], ... }
 *   detail : /jsData/matchResult/json/{season}/[cs]{id}_en.json
 *            -> LeagueInfo / TeamList|TeamInfo / ScheduleList / Standings
 *
 * The detail fetch exists only to resolve the long English name, crest and
 * current season (the index carries a short code like "ENG PR"); anything that
 * a page needs at render time is fetched live by lib/goaloo.ts instead.
 *
 * Leagues are `s<id>` (round-robin), cups are `c<id>` — that prefix is stored
 * as `path` so the runtime never has to guess.
 *
 *   node tools/gen-competitions.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.GOALOO_BASE || 'https://football2.goaloo28.com';
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  referer: BASE + '/',
  'accept-language': 'en-US,en;q=0.9',
};
const OUT = path.join(process.cwd(), 'data', 'competitions.json');

async function getJson(url) {
  for (let i = 0; i < 3; i += 1) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      const ct = r.headers.get('content-type') || '';
      // The host answers unknown paths with a 200 HTML soft-404, so the
      // content-type — not the status — is what proves the payload is real.
      if (r.status === 200 && ct.includes('json')) return JSON.parse(await r.text());
      if (r.status === 404) return null;
    } catch {
      /* retry */
    }
    await new Promise((x) => setTimeout(x, 400 + i * 600));
  }
  return null;
}

/** LeagueInfo mixes cup and league layouts; the string shapes disambiguate. */
function parseLeagueInfo(li) {
  if (!Array.isArray(li)) return null;
  const name = typeof li[1] === 'string' ? li[1].trim() : '';
  if (!name) return null;
  return {
    name,
    logo: li.find((x) => typeof x === 'string' && /league_match\/images\//i.test(x)) || '',
    color: li.find((x) => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x)) || '',
    season: li.find((x) => typeof x === 'string' && /^\d{4}(-\d{4})?$/.test(x)) || '',
    desc: (
      li.find((x) => typeof x === 'string' && x.length > 120) || ''
    )
      .replace(/&nbsp;/g, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .trim(),
  };
}

async function detail(l, fallbackSeason) {
  const seasons = Array.isArray(l.seasons) && l.seasons.length ? l.seasons : [fallbackSeason];
  const prefixes = l.type === 1 ? ['s', 'c'] : ['c', 's'];
  for (const season of seasons.slice(0, 2)) {
    for (const p of prefixes) {
      const j = await getJson(`${BASE}/jsData/matchResult/json/${season}/${p}${l.id}_en.json`);
      if (j && j.LeagueInfo) {
        const info = parseLeagueInfo(j.LeagueInfo);
        if (info) return { ...info, path: `${p}${l.id}`, seasonDir: season };
      }
    }
  }
  return null;
}

const index = JSON.parse(
  (await fetch(`${BASE}/jsData/league/pc/infoHeaderEn.js`, { headers: HEADERS }).then((r) => r.text()))
    .replace(/^[^{]*/, '')
    .replace(/;\s*$/, '')
);

const jobs = [];
for (const c of index.countries) for (const l of c.leagues) jobs.push({ country: c, league: l });

const rows = [];
let cursor = 0;
let failed = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < jobs.length) {
      const { country, league } = jobs[cursor++];
      const info = await detail(league, index.seasons[0]);
      if (info) {
        rows.push({
          id: league.id,
          name: info.name,
          short: league.short || '',
          country: country.name,
          area: country.area,
          type: league.type,
          hot: league.hot ? 1 : 0,
          logo: info.logo,
          color: info.color,
          season: info.season || info.seasonDir,
          seasonDir: info.seasonDir,
          path: info.path,
          desc: info.desc,
        });
      } else failed += 1;
      process.stdout.write(`\r${cursor}/${jobs.length} ok=${rows.length} miss=${failed}`);
      await new Promise((x) => setTimeout(x, 120));
    }
  })
);

rows.sort((a, b) => a.area - b.area || a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ source: 'goaloo28', generatedAt: new Date().toISOString(), count: rows.length, competitions: rows }));
console.log(`\nwrote ${OUT} (${rows.length} competitions, ${failed} misses)`);
