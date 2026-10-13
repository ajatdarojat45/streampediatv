/**
 * Generates `data/rblink-leagues.json` — Rblink's own football competition table.
 *
 * Produced by scanning /api/league/detail across the numeric league id range
 * (ids are dense ~4.3k..7.9k; anything else answers empty). One row per live
 * competition, carrying the fields the join needs: id, slug (field 70 =
 * leagueLink), name, country/Crest, season, teams, players, avgGoals, hot and
 * the HasData flags. Every hit is appended to a JSONL cache, so the scan is
 * resumable and a later run only fetches what is missing.
 *
 *   node tools/gen-rblink-leagues.mjs                          # scan 1..8000
 *   node tools/gen-rblink-leagues.mjs --merge-only \
 *        --cache /tmp/rblink_leagues.jsonl                     # rebuild from cache
 *
 * Wire format (verified against the decompiled app):
 *   envelope: 4 = base64 marshalled envelope, 10 = protobuf payload; envelope
 *   field 2 → 10 = header byte length that prefixes the payload.
 *   PBLeagueDetailResp: 1 = PBDataLeague (1=id 3=name 4=logo 20=season
 *     80=country 90=hot), 50 = PBLeagueExtra → 1 = PBLeagueExtraFtb
 *     (20=teamCount 21=playerCount 31=avgGoals 60=HasData 70=leagueLink).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DATA_API = process.env.RBLINK_DATA_API || 'https://apis-data10.tcllu137fien.ru';
const HEADERS = {
  'user-agent':
    'rbapp/--dg-snd-android-323/3.0.323/android_34_14/Google_Pixel 8_arm64-v8a/Asia-Jakarta/en',
  origin: 'https://www.rbtv77.com',
};
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? def : process.argv[i + 1];
};
const flag = (name) => process.argv.includes('--' + name);
const FROM = Number(arg('from', 1));
const TO = Number(arg('to', 8000));
const CONC = Number(arg('concat', 3));
const GAP = Number(arg('gap', 150));
const CACHE = arg('cache', path.join(process.cwd(), 'data', '.rblink-leagues.scan.jsonl'));
const OUT = arg('out', path.join(process.cwd(), 'data', 'rblink-leagues.json'));

/* ---------- protobuf primitives (same reader shape as lib/proto.ts) ---------- */

function varint(b, p) {
  let r = 0n, s = 0n, i = p;
  for (;;) {
    const x = b[i++];
    r |= BigInt(x & 0x7f) << s;
    if (!(x & 0x80)) break;
    s += 7n;
  }
  return [Number(r), i];
}

function* fields(buf) {
  let p = 0;
  while (p < buf.length) {
    const [t, p1] = varint(buf, p);
    const f = t >> 3, w = t & 7;
    p = p1;
    if (w === 0) { const [v, p2] = varint(buf, p); p = p2; yield { f, w, v }; }
    else if (w === 2) { const [l, p2] = varint(buf, p); p = p2 + l; yield { f, w, v: buf.subarray(p2, p) }; }
    else if (w === 5) p += 4;
    else if (w === 1) p += 8;
    else return;
  }
}

const text = (v) => (typeof v === 'number' ? '' : Buffer.from(v).toString('utf8'));

/** The response envelope: return the (offset-trimmed) protobuf payload. */
function payload(body) {
  let meta = null, data = null;
  for (const f of fields(body)) {
    if (f.f === 4) meta = text(f.v);
    if (f.f === 10) data = f.v;
  }
  let off = 0;
  if (meta) {
    for (const f of fields(Buffer.from(meta, 'base64'))) {
      if (f.f === 2) for (const g of fields(f.v)) if (g.f === 10) off = g.v;
    }
  }
  return data ? data.subarray(off) : Buffer.alloc(0);
}

/** PBDataNameMap entry: 1 = langKey, 2 = value. */
function nameEntry(buf) {
  let k = 0, v = '';
  for (const f of fields(buf)) {
    if (f.f === 1) k = f.v;
    if (f.f === 2) v = text(f.v);
  }
  return [k, v];
}

/** First non-empty localised name in repeated field `nf` of `buf`. */
function nameAt(buf, nf = 3) {
  for (const f of fields(buf)) {
    if (f.f === nf && f.w === 2) {
      const [, v] = nameEntry(f.v);
      if (v) return v;
    }
  }
  return '';
}
/** PBLeagueDetailResp → the flat row we store. */
function decodeOne(pb) {
  const d = {
    id: 0, name: '', country: '', countryId: 0, flag: '', logo: '', slug: '',
    teams: 0, players: 0, season: null, avgGoals: 0, hot: false,
    matches: false, standings: false,
  };
  for (const f of fields(pb)) {
    if (f.f === 1) {
      for (const g of fields(f.v)) {
        if (g.f === 1) d.id = g.v;
        else if (g.f === 3) d.name = nameAt(f.v, 3);
        else if (g.f === 4) d.logo = text(g.v).replace(/!w\d+$/, '');
        else if (g.f === 20) {
          const s = { id: 0, name: '', start: 0, end: 0 };
          for (const h of fields(g.v)) {
            if (h.f === 1) s.id = h.v;
            else if (h.f === 3) s.name = nameAt(g.v, 3);
            else if (h.f === 10) s.start = h.v;
            else if (h.f === 11) s.end = h.v;
          }
          d.season = s;
        } else if (g.f === 80) {
          for (const h of fields(g.v)) {
            if (h.f === 1) d.countryId = h.v;
            else if (h.f === 3) d.country = nameAt(g.v, 3);
            else if (h.f === 4) d.flag = text(h.v);
          }
        } else if (g.f === 90) d.hot = !!g.v;
      }
    } else if (f.f === 50) {
      for (const g of fields(f.v)) {
        if (g.f !== 1) continue;
        for (const x of fields(g.v)) {
          if (x.f === 20) d.teams = x.v;
          else if (x.f === 21) d.players = x.v;
          else if (x.f === 31) d.avgGoals = Number(text(x.v)) || 0;
          else if (x.f === 70) d.slug = text(x.v);
          else if (x.f === 60) for (const h of fields(x.v)) {
            if (h.f === 2) d.standings = !!h.v;
            if (h.f === 3) d.matches = !!h.v;
          }
        }
      }
    }
  }
  return d;
}

/* ---------- transport (DT_LEAGUE signature, code 200) ---------- */

let SIG = null;

async function refreshSignature() {
  const url = `${DATA_API}/api/common/bs?code=100&code=200&sportType=1&stream=true`;
  const r = await fetch(url, { headers: HEADERS });
  for (const f of fields(payload(Buffer.from(await r.arrayBuffer())))) {
    if (f.f !== 1) continue;
    let k, v;
    for (const g of fields(f.v)) {
      if (g.f === 1) k = g.v;
      if (g.f === 2) v = text(g.v);
    }
    if (k === 200) SIG = v;
  }
  if (!SIG) throw new Error('could not resolve the DT_LEAGUE signature');
}

async function fetchLeague(id) {
  const qs = `leagueId=${id}&language=0&sportType=1&stream=true`;
  const md5 = createHash('md5').update(qs).digest('hex').slice(0, 6);
  const url = `${DATA_API}/sfver${md5}${SIG}/api/league/detail?${qs}`;
  const r = await fetch(url, { headers: HEADERS });
  if (r.status !== 200) throw new Error('http ' + r.status);
  const d = decodeOne(payload(Buffer.from(await r.arrayBuffer())));
  return d.slug && d.name ? d : null;
}

/* ---------- scan ---------- */

function loadCache() {
  const rows = [];
  const seen = new Set();
  if (existsSync(CACHE)) {
    for (const line of readFileSync(CACHE, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row && row.id && !seen.has(row.id)) { seen.add(row.id); rows.push(row); }
      } catch { /* skip a torn final line */ }
    }
  }
  return { rows, seen };
}

function write(rows) {
  rows.sort((a, b) => a.id - b.id);
  mkdirSync(path.dirname(OUT), { recursive: true });
  const body = {
    source: 'rblink /api/league/detail',
    generatedAt: new Date().toISOString(),
    count: rows.length,
    leagues: rows,
  };
  writeFileSync(OUT, JSON.stringify(body) + '\n');
  console.log(`wrote ${rows.length} leagues -> ${OUT}`);
}

const { rows, seen } = loadCache();
if (flag('merge-only')) {
  write(rows);
  process.exit(0);
}

await refreshSignature();
const ids = [];
for (let x = FROM; x < TO; x += 1) if (!seen.has(x)) ids.push(x);
// Dense band first, so the useful rows land during the first minutes.
const bandLo = Number(arg('band-from', 4300));
const bandHi = Number(arg('band-to', 5400));
ids.sort((a, b) => {
  const inA = a >= bandLo && a < bandHi ? 0 : 1;
  const inB = b >= bandLo && b < bandHi ? 0 : 1;
  return inA - inB || a - b;
});
console.log(`scanning ${ids.length} ids (${rows.length} cached), concurrency ${CONC}`);

let hits = 0, done = 0, i = 0, lastRefresh = Date.now(), conc = CONC;

async function worker() {
  while (i < ids.length) {
    const id = ids[i];
    i += 1;
    if (Date.now() - lastRefresh > 300000) {
      lastRefresh = Date.now();
      await refreshSignature();
    }
    try {
      const row = await fetchLeague(id);
      if (row) {
        rows.push(row);
        appendFileSync(CACHE, JSON.stringify(row) + '\n');
        hits += 1;
      }
    } catch {
      conc = 1; // throttle detected: back off once, then relax again
      await new Promise((x) => setTimeout(x, 4000));
      conc = CONC;
    }
    done += 1;
    if (done % 250 === 0) console.log(`progress ${done}/${ids.length} hits=${hits}`);
    await new Promise((x) => setTimeout(x, GAP / conc + Math.random() * 60));
  }
}

await Promise.all(Array.from({ length: CONC }, worker));
console.log(`scan complete: ${done} ids, ${hits} new rooms`);
write(rows);

