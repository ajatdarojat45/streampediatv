// Protobuf decoders for match list & match detail.
// Field mapping from the decompiled sources:
//
// data.proto:
//   PBMatchLiveResp:    1 = repeated PBDataMatch, 2 = stream, 3 = odds
//   PBMatchDetailResp:  1 = PBDataMatch, 2 = stream
//   PBDataMatch:  1=matchId, 2=sportType, 3=matchDate, 4=status, 10=league,
//                 11=season, 12=stage, 19=name, 20=home, 21=away,
//                 22=homeScore, 23=awayScore, 30=contender, 40=group, 41=round, 80=hot
//   PBDataLeague: 1=leagueId, 3=name, 4=logo, 80=country, 90=hot
//   PBDataTeam:   1=teamId, 3=name, 4=logo, 80=country, 90=hot
//   PBDataContender (field 30, REPEATED, one entry per competitor —
//                 verified against live API data):
//                 [title entry] 2=name(slug, e.g. "Santos FC - SP vs Flamengo - RJ")
//                 [competitor]  1=side?, 10=team(PBDataTeam)            (football)
//                               2=name(slug) only                        (tenis #1)
//                               20=team(PBDataTeam)                      (tenis #2)
//                               21=team(PBDataTeam)                      (tenis #3)
//                 Entry order = home first, away second.
//
// live.proto:
//   PBLiveMatchList: 1 = repeated PBLiveMatch
//   PBLiveMatch:     1 = PBMatch, 2 = channel
//   PBMatch:  1=matchId, 2=matchDate, 3=showStatus, 4=status, 5=name,
//             10=sportType, 11=scoringMatch, 20=leagueName, 21=vs(PBMatchVS)
//   PBMatchVS: 1=home(PBTeam), 2=away(PBTeam), 10=name
//   PBTeam:    2=name, 3=logo, 4=score

import { iterFields } from './proto';
import { countryLogoUrl, teamLogoUrl } from './logos';
import type { Team, League, Contender, Match, Stream, MatchDetail, MatchAnalysis, H2HSummary, MatchOutcome, LineupPlayer, MatchLineup, MatchEvent, MatchEvents, MatchStat, MatchStats } from './types';

const dec = new TextDecoder('utf-8', { fatal: false });
/** Decode a length-delimited field. Never throws on varint input (returns ''). */
const str = (b: number | Uint8Array): string =>
  typeof b === 'number' ? '' : dec.decode(b as Uint8Array);

export const MATCH_STATUS: Record<number, string> = {
  0: 'Upcoming',
  10: 'LIVE',
  100: 'LIVE',
  101: '1st Half',
  102: 'Half Time',
  103: '2nd Half',
  104: 'Overtime',
  105: 'Penalties',
  200: 'LIVE',
  201: 'Q1',
  202: 'Q2',
  203: 'Q3',
  204: 'Q4',
  211: 'OT1',
  212: 'OT2',
  213: 'OT3',
  214: 'OT4',
  300: 'LIVE (Tennis)',
  400: 'LIVE (Baseball)',
  600: 'LIVE (Cricket)',
  10000: 'Finished',
  10001: 'Cancelled',
  10002: 'Cut',
};

export const statusLabel = (code?: number): string => MATCH_STATUS[code ?? 0] ?? `#${code}`;

export const isLiveStatus = (code?: number): boolean =>
  code === 10 || (code !== undefined && code >= 100 && code < 1000);

/** Match already started (live now, or finished/cancelled/cut)? */
export const isStarted = (code?: number): boolean =>
  isLiveStatus(code) || (code ?? 0) >= 10000;

/** name in data.proto = map<languageCode, string>; each entry is {1: key, 2: value}. */
function decodeNameEntry(buf: Uint8Array): [number, string] | null {
  let key: number | undefined;
  let val: string | undefined;
  for (const e of iterFields(buf)) {
    if (e.field === 1) key = e.value as number;
    else if (e.field === 2 && e.wire === 2) val = str(e.value);
  }
  return key !== undefined && val !== undefined ? [key, val] : null;
}

export function pickLocalName(map: Record<number, string> | string | undefined, lang: number): string {
  if (!map) return '';
  if (typeof map === 'string') return map;
  return map[lang] ?? map[0] ?? Object.values(map)[0] ?? '';
}

/** Expand raw `logo` filenames into full URLs (mirrors LogoConstant).
 * Team logos use the sport-specific path; the league badge uses the
 * country-logo path with the league's nested `countryLogo` value. */
export function resolveMatchLogos(m: Match): Match {
  if (m.home?.logo) m.home.logo = teamLogoUrl(m.sportType, m.home.logo);
  if (m.away?.logo) m.away.logo = teamLogoUrl(m.sportType, m.away.logo);
  // Doubles (tenis/bulutangkis ganda): expand every player/team logo.
  for (const t of m.homeTeams ?? []) if (t.logo) t.logo = teamLogoUrl(m.sportType, t.logo);
  for (const t of m.awayTeams ?? []) if (t.logo) t.logo = teamLogoUrl(m.sportType, t.logo);
  for (const c of m.contenders ?? []) {
    if (c.team?.logo) c.team.logo = teamLogoUrl(m.sportType, c.team.logo);
  }
  if (m.league) {
    // HomeViewModel.setMatchLogo(getCountryLogo(league.country.logo)) —
    // the row badge is the *country* logo, not PBDataLeague.logo.
    const badge = m.league.countryLogo || m.league.logo;
    if (badge) m.league.logo = countryLogoUrl(badge);
  }
  return m;
}

/* ---------- data.proto (DataAPI) ---------- */
/** PBDataCountry (field 80): 1=countryId, 3=name map, 4=logo. */
function decodeDataCountry(buf: Uint8Array, lang: number): { name: string; logo: string } {
  let logo = '';
  const nameMap: Record<number, string> = {};
  for (const f of iterFields(buf)) {
    if (f.field === 3 && f.wire === 2) {
      const e = decodeNameEntry(f.value as Uint8Array);
      if (e) nameMap[e[0]] = e[1];
    } else if (f.field === 4 && f.wire === 2) logo = str(f.value);
  }
  return { name: pickLocalName(nameMap, lang), logo };
}

function decodeDataTeam(buf: Uint8Array, lang: number): Team {
  const t: Team = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1) t.teamId = f.value as number;
    else if (f.field === 3 && f.wire === 2) {
      const e = decodeNameEntry(f.value as Uint8Array);
      if (e) (t.nameMap ??= {})[e[0]] = e[1];
    } else if (f.field === 4 && f.wire === 2) t.logo = str(f.value);
    else if (f.field === 80 && f.wire === 2) {
      // PBDataCountry is a nested message (not a plain string).
      const c = decodeDataCountry(f.value as Uint8Array, lang);
      if (c.name) t.country = c.name;
      if (c.logo) t.countryLogo = c.logo;
    } else if (f.field === 90) t.hot = !!f.value;
  }
  t.name = pickLocalName(t.nameMap, lang);
  return t;
}

/** PBDataPlayer: 1=playerId, 3=name map, 4=avatar, 80=country, 90=hot. */
function decodeDataPlayer(buf: Uint8Array, lang: number): Team {
  const t: Team = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1) t.playerId = f.value as number;
    else if (f.field === 3 && f.wire === 2) {
      const e = decodeNameEntry(f.value as Uint8Array);
      if (e) (t.nameMap ??= {})[e[0]] = e[1];
    } else if (f.field === 4 && f.wire === 2) t.logo = str(f.value);
    else if (f.field === 80 && f.wire === 2) {
      const c = decodeDataCountry(f.value as Uint8Array, lang);
      if (c.name) t.country = c.name;
      if (c.logo) t.countryLogo = c.logo;
    } else if (f.field === 90) t.hot = !!f.value;
  }
  t.name = pickLocalName(t.nameMap, lang);
  return t;
}

/** PBDataContender: 1=sportType, 2=name(slug), 10=team, 20=player.
 * Tennis/badminton singles carry the player in field 20; team sports use
 * field 10. Returns null for title-only entries (field 2 alone). */
function decodeDataContender(buf: Uint8Array, lang: number): Contender | null {
  const c: Contender = {};
  let slug = '';
  for (const f of iterFields(buf)) {
    if (f.field === 1) c.sportType = f.value as number;
    else if (f.field === 2 && f.wire === 2) slug = str(f.value);
    else if (f.field === 10 && f.wire === 2) c.team = decodeDataTeam(f.value as Uint8Array, lang);
    else if (f.field === 20 && f.wire === 2) c.team = decodeDataPlayer(f.value as Uint8Array, lang);
  }
  if (!c.team) {
    // Title-only entry ("A vs B") — caller keeps the slug for m.title.
    return slug ? { name: slug } : null;
  }
  // Player entries in tennis/badminton have no name map on some payloads —
  // fall back to the entry slug so the row never shows "?".
  if (!c.team.name && slug) c.team.name = slug;
  if (!c.name) c.name = slug || c.team.name;
  return c;
}

function decodeDataLeague(buf: Uint8Array, lang: number): League {
  const l: League = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1) l.leagueId = f.value as number;
    else if (f.field === 3 && f.wire === 2) {
      const e = decodeNameEntry(f.value as Uint8Array);
      if (e) (l.nameMap ??= {})[e[0]] = e[1];
    } else if (f.field === 4) l.logo = str(f.value);
    else if (f.field === 80 && f.wire === 2) {
      // PBDataCountry is a nested message (not a plain string).
      const c = decodeDataCountry(f.value as Uint8Array, lang);
      if (c.name) l.country = c.name;
      if (c.logo) l.countryLogo = c.logo;
    } else if (f.field === 90) l.hot = !!f.value;
  }
  l.name = pickLocalName(l.nameMap, lang);
  return l;
}

export function decodeDataMatch(buf: Uint8Array, lang: number): Match {
  const m: Match = { source: 'data' };
  // field 30 is `repeated PBDataContender` — each top-level occurrence is ONE
  // contender. Index 0 is the title-only entry ("A vs B"); the rest carry a
  // team (field 10) or a player (field 20).
  const rawContenders: Contender[] = [];
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: m.matchId = f.value as number; break;
      case 2: m.sportType = f.value as number; break;
      case 3: m.matchDate = f.value as number; break;
      case 4: m.status = f.value as number; break;
      case 10: m.league = decodeDataLeague(f.value as Uint8Array, lang); break;
      case 11:
        if (f.wire === 2) {
          const nameMap: Record<number, string> = {};
          for (const s of iterFields(f.value as Uint8Array)) {
            if (s.field === 3 && s.wire === 2) {
              const e = decodeNameEntry(s.value as Uint8Array);
              if (e) nameMap[e[0]] = e[1];
            } else if (s.field === 50 && s.wire === 2) {
              for (const y of iterFields(s.value as Uint8Array)) {
                if (y.field === 1 && y.wire === 2) m.season = str(y.value);
              }
            }
          }
          m.season = pickLocalName(nameMap, lang) || m.season;
        }
        break;
      case 12: m.stage = str(f.value); break;
      case 19: m.name = str(f.value); break;
      case 20: if (f.wire === 2) m.home = decodeDataTeam(f.value as Uint8Array, lang); break;
      case 21: if (f.wire === 2) m.away = decodeDataTeam(f.value as Uint8Array, lang); break;
      case 22: m.homeScore = f.value as number; break;
      case 23: m.awayScore = f.value as number; break;
      case 30: {
        // field 30 is `repeated PBDataContender` — every top-level occurrence
        // is one contender (do NOT re-iterate inside; the value IS the
        // PBDataContender). decodeDataContender returns null for title-only
        // entries (field 2 alone, "A vs B"); those are collected too so the
        // pairing below can skip raw index 0 exactly like the app.
        const c = decodeDataContender(f.value as Uint8Array, lang);
        if (c) rawContenders.push(c);
        break;
      }
      case 40: m.group = str(f.value); break;
      case 41: m.round = str(f.value); break;
      case 80: m.hot = !!f.value; break;
      default: break;
    }
  }
  // field 30 pairing mirrors HomeContenderState.convertContender + ta/d.java:
  // raw index 0 is the title-only entry ("A vs B"); the app starts at index 1
  // and pairs the rest — even indices = home, odd = away. For doubles this
  // gives home = [0]+[2], away = [1]+[3]; for singles home = [0], away = [1].
  const [head, ...tail] = rawContenders;
  // Title fallback from the head entry when field 19 (name) is absent.
  if (!m.name && head && !head.team && head.name) m.title = head.name;
  // Skip the head entry only when it is genuinely title-only (no team/player);
  // if it carries a competitor, keep the full list to avoid dropping data.
  const competitors = head && !head.team ? tail : rawContenders;
  if (competitors.length) {
    m.contenders = competitors;
    const homeTeams = competitors.filter((_, i) => i % 2 === 0).map((c) => c.team).filter((t): t is Team => !!t);
    const awayTeams = competitors.filter((_, i) => i % 2 === 1).map((c) => c.team).filter((t): t is Team => !!t);
    if (homeTeams.length) m.homeTeams = homeTeams;
    if (awayTeams.length) m.awayTeams = awayTeams;
    // Field 20/21 (team sports) wins when present; contender sports rely on
    // the first player/team of each side so the row never shows "?".
    if (!m.home && homeTeams[0]) m.home = homeTeams[0];
    if (!m.away && awayTeams[0]) m.away = awayTeams[0];
  }
  resolveMatchLogos(m);
  return m;
}
export function decodeMatchLiveResp(payload: Uint8Array, lang: number): Match[] {
  const matches: Match[] = [];
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) matches.push(decodeDataMatch(f.value as Uint8Array, lang));
  }
  return matches;
}

/** entry map<string,string>: {1: key, 2: value} */
function decodeStrMapEntry(buf: Uint8Array): [string, string] | null {
  let k: string | undefined;
  let v: string | undefined;
  for (const e of iterFields(buf)) {
    if (e.field === 1) k = str(e.value);
    else if (e.field === 2) v = str(e.value);
  }
  return k !== undefined ? [k, v ?? ''] : null;
}

// PBDataStream (data/proto/stream/PBDataStream.java)
export function decodeDataStream(buf: Uint8Array): Stream {
  const s: Stream = { headers: {}, extra: {} };
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: s.streamId = f.value as number; break;
      case 3: s.name = str(f.value); break;
      case 4: s.url = str(f.value); break;
      case 5: s.streamStatus = f.value as number; break; // 1 = PLAYABLE
      case 6: s.availableType = f.value as number; break;
      case 7: s.recommend = !!f.value; break;
      case 8: s.priority = f.value as number; break;
      case 9: s.siteType = f.value as number; break;
      case 10: s.fullName = str(f.value); break;
      case 11: s.urlCdnType = f.value as number; break;
      case 20: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) s.headers[e[0]] = e[1];
        break;
      }
      case 21: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) s.extra[e[0]] = e[1];
        break;
      }
      case 50: s.matchId = f.value as number; break;
      case 120: s.pageUrl = str(f.value); break;
      default: break;
    }
  }
  return s;
}

// PBChannel (live/proto/live/PBChannel.java)
export function decodeChannel(buf: Uint8Array): Stream {
  const c: Stream = { headers: {}, extra: {} };
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: c.channelId = f.value as number; break;
      case 2: c.name = str(f.value); break;
      case 3: c.url = str(f.value); break;
      case 4: c.status = f.value as number; break;
      case 5: c.availableType = f.value as number; break;
      case 10: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) c.headers[e[0]] = e[1];
        break;
      }
      case 11: {
        const e = decodeStrMapEntry(f.value as Uint8Array);
        if (e) c.extra[e[0]] = e[1];
        break;
      }
      case 20: c.matchId = f.value as number; break;
      case 30: c.siteType = f.value as number; break;
      default: break;
    }
  }
  return c;
}

export function decodeMatchDetailResp(payload: Uint8Array, lang: number): MatchDetail {
  const out: MatchDetail = { source: 'data', streams: [] };
  const streams = out.streams!;
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) out.match = decodeDataMatch(f.value as Uint8Array, lang);
    else if (f.field === 2 && f.wire === 2) streams.push(decodeDataStream(f.value as Uint8Array));
  }
  return out;
}

/** PBMatchAnalysisResp (code 107): 1=h2h, 2=homeLatest, 3=awayLatest, 4=homeNext, 5=awayNext.
 *  Each list item is a full PBDataMatch (contenders + home/away scores). */
export function decodeMatchAnalysisResp(payload: Uint8Array, lang: number): MatchAnalysis {
  const out: MatchAnalysis = { h2h: [], homeLatest: [], awayLatest: [], homeNext: [], awayNext: [] };
  for (const f of iterFields(payload)) {
    if (f.wire !== 2) continue;
    const m = decodeDataMatch(f.value as Uint8Array, lang);
    if (f.field === 1) out.h2h.push(m);
    else if (f.field === 2) out.homeLatest.push(m);
    else if (f.field === 3) out.awayLatest.push(m);
    else if (f.field === 4) out.homeNext.push(m);
    else if (f.field === 5) out.awayNext.push(m);
  }
  return out;
}

/* ---------- lineup (PBMatchLineupResp, code 106) ---------- */

/** PBPlayerPositionType → readable label. */
export const positionLabel = (code?: number): string =>
  ({ 1: 'Forward', 2: 'Midfielder', 3: 'Defender', 4: 'Goalkeeper' } as Record<number, string>)[code ?? 0] ?? '—';

/** PBPlayerAppearanceType → starting/substitute. */
export const appearanceLabel = (code?: number): string =>
  ({ 1: 'Starting', 2: 'Substitute' } as Record<number, string>)[code ?? 0] ?? '';

/** PBDataMatchLineup: 1=player(PBDataPlayer), 2=position, 3=positionOrder, 4=appearance, 5=number. */
function decodeDataMatchLineup(buf: Uint8Array, lang: number): LineupPlayer {
  const out: LineupPlayer = {};
  for (const f of iterFields(buf)) {
    if (f.field === 1 && f.wire === 2) out.player = decodeDataPlayer(f.value as Uint8Array, lang);
    else if (f.field === 2) out.position = f.value as number;
    else if (f.field === 3) out.positionOrder = f.value as number;
    else if (f.field === 4) out.appearance = f.value as number;
    else if (f.field === 5 && f.wire === 2) out.number = str(f.value);
  }
  return out;
}

/** PBMatchLineupResp: 1=homeLineup, 2=awayLineup (each repeated PBDataMatchLineup). */
export function decodeMatchLineupResp(payload: Uint8Array, lang: number): MatchLineup {
  const out: MatchLineup = { home: [], away: [] };
  for (const f of iterFields(payload)) {
    if (f.wire !== 2) continue;
    if (f.field === 1) out.home.push(decodeDataMatchLineup(f.value as Uint8Array, lang));
    else if (f.field === 2) out.away.push(decodeDataMatchLineup(f.value as Uint8Array, lang));
  }
  return out;
}

/* ---------- events (PBMatchEventResp, code 105) ---------- */

/** PBMatchEventType → readable label. */
export const eventTypeLabel = (code?: number): string =>
  ({
    101: 'Goal',
    102: 'Own Goal',
    103: 'Penalty Goal',
    104: 'Penalty Missed',
    105: 'Substitution',
    106: 'Yellow Card',
    107: 'Red Card',
    108: 'Second Yellow',
    109: 'Corner',
    10001: 'Kick Off',
    10002: 'Full Time',
    10003: 'Half Time',
    10005: 'Full Time',
    10010: 'Full Time',
    10022: 'Full Time',
  } as Record<number, string>)[code ?? 0] ?? '';

/** PBDataMatchEvent: 1=match, 2=team, 3=eventType, 4=minute, 5=score,
 *  6=description, 7=teamSide, 10=scorer, 11=assistant, 20=offender,
 *  30=substitutionIn, 31=substitutionOut. */
function decodeDataMatchEvent(buf: Uint8Array, lang: number): MatchEvent {
  const out: MatchEvent = { eventType: 0 };
  for (const f of iterFields(buf)) {
    if (f.field === 3) out.eventType = f.value as number;
    else if (f.field === 4 && f.wire === 2) out.minute = str(f.value);
    else if (f.field === 5 && f.wire === 2) out.score = str(f.value);
    else if (f.field === 6 && f.wire === 2) out.description = str(f.value);
    else if (f.field === 7) out.teamSide = f.value as number;
    else if (f.field === 10 && f.wire === 2) out.scorer = decodeDataPlayer(f.value as Uint8Array, lang);
    else if (f.field === 11 && f.wire === 2) out.assistant = decodeDataPlayer(f.value as Uint8Array, lang);
    else if (f.field === 20 && f.wire === 2) out.offender = decodeDataPlayer(f.value as Uint8Array, lang);
    else if (f.field === 30 && f.wire === 2) out.substitutionIn = decodeDataPlayer(f.value as Uint8Array, lang);
    else if (f.field === 31 && f.wire === 2) out.substitutionOut = decodeDataPlayer(f.value as Uint8Array, lang);
  }
  return out;
}

/** PBMatchEventResp: 1 = repeated PBDataMatchEvent. */
export function decodeMatchEventResp(payload: Uint8Array, lang: number): MatchEvents {
  const out: MatchEvent[] = [];
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) out.push(decodeDataMatchEvent(f.value as Uint8Array, lang));
  }
  return out;
}

/* ---------- statistic (PBMatchStatisticResp, code 104) ---------- */

/** PBMatchStatType → readable label (100–120, plus 154/155 shot summaries). */
export const statTypeLabel = (code?: number): string =>
  ({
    100: 'Ball Possession',
    101: 'Attacks',
    102: 'Dangerous Attacks',
    103: 'Total Shots',
    104: 'Shots On Target',
    105: 'Shots Off Target',
    106: 'Blocked Shots',
    107: 'Corner Kicks',
    108: 'Offsides',
    109: 'Yellow Cards',
    110: 'Red Cards',
    111: 'Goalkeeper Saves',
    112: 'Total Passes',
    113: 'Accurate Passes',
    114: 'Long Balls',
    115: 'Crosses',
    116: 'Dribbles',
    117: 'Duels Won',
    118: 'Tackles',
    119: 'Interceptions',
    120: 'Clearances',
    154: 'Shots On Target',
    155: 'Shots Off Target',
  } as Record<number, string>)[code ?? 0] ?? `#${code}`;

/** Stats that are percentages (already sum to 100), shown as-is rather than split. */
export const isPercentStat = (code?: number): boolean => code === 100;

/** PBDataMatchStatistic: 1=match, 2=statRange, 3=statType,
 *  10=homeValue, 11=awayValue, 12=homeTotalValue, 13=awayTotalValue. */
function decodeDataMatchStatistic(buf: Uint8Array): MatchStat {
  const out: MatchStat = { statType: 0, statRange: 0 };
  for (const f of iterFields(buf)) {
    if (f.field === 2) out.statRange = f.value as number;
    else if (f.field === 3) out.statType = f.value as number;
    else if (f.field === 10) out.homeValue = f.value as number;
    else if (f.field === 11) out.awayValue = f.value as number;
  }
  return out;
}

/** PBMatchStatisticResp: 1 = repeated PBDataMatchStatistic. Keeps only the
 *  full-match rows (statRange 0) and de-dupes by statType so the UI shows one
 *  clean comparison per stat. */
export function decodeMatchStatisticResp(payload: Uint8Array): MatchStats {
  const seen = new Set<number>();
  const out: MatchStat[] = [];
  for (const f of iterFields(payload)) {
    if (f.field !== 1 || f.wire !== 2) continue;
    const s = decodeDataMatchStatistic(f.value as Uint8Array);
    if (s.statRange !== 0 || s.statType === 0) continue;
    if (seen.has(s.statType)) continue;
    seen.add(s.statType);
    out.push(s);
  }
  return out;
}

/** Per-player event stats, keyed by playerId, for annotating lineup rows with
 *  goals / assists / cards / substitutions. */
export interface PlayerEventStats {
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  subIn: boolean;
  subOut: boolean;
}

const GOAL_TYPES = new Set([101, 102, 103]);

/** Aggregate events into per-player stats (match by playerId). */
export function computePlayerEventStats(events: MatchEvents | undefined): Map<number, PlayerEventStats> {
  const map = new Map<number, PlayerEventStats>();
  if (!events) return map;
  const slot = (p: Team | undefined): PlayerEventStats | null => {
    const id = p?.playerId;
    if (!id) return null;
    let s = map.get(id);
    if (!s) { s = { goals: 0, assists: 0, yellow: 0, red: 0, subIn: false, subOut: false }; map.set(id, s); }
    return s;
  };
  for (const e of events) {
    switch (e.eventType) {
      case 101: case 102: case 103: {
        const s = slot(e.scorer);
        if (s) s.goals += 1;
        const a = slot(e.assistant);
        if (a) a.assists += 1;
        break;
      }
      case 106: { const s = slot(e.offender); if (s) s.yellow += 1; break; }
      case 107: case 108: { const s = slot(e.offender); if (s) s.red += 1; break; }
      case 105: {
        const i = slot(e.substitutionIn); if (i) i.subIn = true;
        const o = slot(e.substitutionOut); if (o) o.subOut = true;
        break;
      }
      default: break;
    }
  }
  return map;
}

/** Human "minute" label (events carry it as a string like "45+2"). */
export const eventMinute = (e: MatchEvent): string => (e.minute ? `${e.minute}'` : '');

/* ---------- live.proto (LiveAPI) ---------- */

function decodeLiveTeam(buf: Uint8Array): Team {
  const t: Team = {};
  for (const f of iterFields(buf)) {
    if (f.field === 2) t.name = str(f.value);
    else if (f.field === 3) t.logo = str(f.value);
    else if (f.field === 4) t.score = f.value as number;
  }
  return t;
}

function decodeLiveMatch(buf: Uint8Array): Match {
  const m: Match = { source: 'live' };
  for (const f of iterFields(buf)) {
    switch (f.field) {
      case 1: m.matchId = f.value as number; break;
      case 2: m.matchDate = f.value as number; break;
      case 3: m.showStatus = f.value as number; break;
      case 4: m.status = f.value as number; break;
      case 5: m.name = str(f.value); break;
      case 10: m.sportType = f.value as number; break;
      case 11: m.scoringMatch = !!f.value; break;
      case 20: m.league = { name: str(f.value) }; break;
      case 21: {
        for (const v of iterFields(f.value as Uint8Array)) {
          if (v.field === 1) m.home = decodeLiveTeam(v.value as Uint8Array);
          else if (v.field === 2) m.away = decodeLiveTeam(v.value as Uint8Array);
        }
        break;
      }
      default: break;
    }
  }
  if (m.home && m.home.score !== undefined) m.homeScore = m.home.score;
  if (m.away && m.away.score !== undefined) m.awayScore = m.away.score;
  resolveMatchLogos(m);
  return m;
}

export function decodeLiveMatchList(payload: Uint8Array): Match[] {
  const matches: Match[] = [];
  for (const f of iterFields(payload)) {
    if (f.field !== 1 || f.wire !== 2) continue; // repeated PBLiveMatch
    const item: { match?: Match } = {};
    for (const e of iterFields(f.value as Uint8Array)) {
      if (e.field === 1 && e.wire === 2) item.match = decodeLiveMatch(e.value as Uint8Array);
    }
    if (item.match) matches.push(item.match);
  }
  return matches;
}

export function decodeLiveMatchDetail(payload: Uint8Array): MatchDetail {
  // PBLiveMatch: 1 = PBMatch, 2 = repeated PBChannel
  const out: MatchDetail = { source: 'live', channels: [] };
  const channels = out.channels!;
  for (const f of iterFields(payload)) {
    if (f.field === 1 && f.wire === 2) out.match = decodeLiveMatch(f.value as Uint8Array);
    else if (f.field === 2 && f.wire === 2) channels.push(decodeChannel(f.value as Uint8Array));
  }
  return out;
}

/** Stream is playable? (PBStreamStatus.SS_PLAYABLE = 1) */
export const isPlayable = (s: Stream): boolean => (s.streamStatus ?? s.status) === 1 && !!s.url;

/* ---------- util ---------- */

/** Kick-off maths — `matchDateMs` (normalize seconds/milliseconds) and the
 *  zone-aware formatters `formatMatchDate` / `formatKickoffLong` — live in
 *  `lib/datetime.ts`, together with the `<LocalTime>` primitive that renders a
 *  kick-off in the viewer's own timezone. */

/** Headline matchup — "Home vs Away". Falls back to the payload's own title
 *  (the live/data payloads carry it), then the competition name. Shared by the
 *  watch page heading and its SEO metadata so both always read identically. */
export function matchHeading(m?: Match | null): string {
  const home = m?.home?.name || m?.homeTeams?.[0]?.name;
  const away = m?.away?.name || m?.awayTeams?.[0]?.name;
  if (home && away) return `${home} vs ${away}`;
  return m?.title || m?.name || m?.league?.name || 'Live Stream';
}

/** Home/away competitor lists for crest strips — `homeTeams`/`awayTeams` carry
 *  every player of a doubles pair, with the single-team fields as the fallback. */
export function matchSides(m?: Match | null): { home: Team[]; away: Team[] } {
  return {
    home: m?.homeTeams?.length ? m.homeTeams : m?.home ? [m.home] : [],
    away: m?.awayTeams?.length ? m.awayTeams : m?.away ? [m.away] : [],
  };
}

/** Result of a single fixture from `ref`'s perspective (win/draw/loss), or `null`
 *  when `ref` is neither side. Lists alternate home/away, so we locate the
 *  reference team on either side (by teamId, falling back to name) and compare
 *  its score — proto3 omits a 0 score, so a missing score field means 0. */
export function matchOutcome(m: Match, ref: Team | undefined): MatchOutcome | null {
  const hs = m.homeScore ?? 0;
  const as = m.awayScore ?? 0;
  const refId = ref?.teamId;
  const refName = ref?.name;
  let refScore: number | undefined;
  let oppScore: number | undefined;
  if (refId !== undefined) {
    if (m.home?.teamId === refId) { refScore = hs; oppScore = as; }
    else if (m.away?.teamId === refId) { refScore = as; oppScore = hs; }
  }
  if (refScore === undefined && refName) {
    if (m.home?.name === refName) { refScore = hs; oppScore = as; }
    else if (m.away?.name === refName) { refScore = as; oppScore = hs; }
  }
  if (refScore === undefined || oppScore === undefined) return null;
  if (refScore > oppScore) return 'W';
  if (refScore < oppScore) return 'L';
  return 'D';
}

/** Win / draw / loss summary from a head-to-head list, from `ref`'s perspective.
 *  Fixtures whose reference team cannot be located are skipped. */
export function computeH2HSummary(h2h: Match[], ref: Team | undefined): H2HSummary {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let total = 0;
  for (const m of h2h) {
    const outcome = matchOutcome(m, ref);
    if (!outcome) continue;
    total += 1;
    if (outcome === 'W') wins += 1;
    else if (outcome === 'L') losses += 1;
    else draws += 1;
  }
  const pct = (n: number): number => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);
  return {
    total,
    wins,
    draws,
    losses,
    winPct: pct(wins),
    drawPct: pct(draws),
    lossPct: pct(losses),
  };
}



