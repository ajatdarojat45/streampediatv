import { NextRequest } from 'next/server';
import { getMatchDetail, getMatches, getGoalooMatchCentre } from '@/app/actions';
import { goalooCompetitionsForLeague } from '@/lib/rblinkLeagues';
import { findCompetition } from '@/lib/competitions';
import { goalooCompetitionUrl, parseGoalooCompetition } from '@/lib/goaloo';
import { matchDateMs } from '@/lib/datetime';
import { sameClub } from '@/lib/clubNames';
import { getGoalooLiveMatch } from '@/lib/goalooLive';
import { goalooScheduleIdForMatch } from '@/lib/goalooLiveJoin';
import type { GoalooFixture, GoalooLiveMatch, MatchSource } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Compact one-liner for a fixture inside a feed listing. */
function brief(x: GoalooFixture) {
  return {
    matchId: x.matchId,
    kickoff: new Date(x.kickoff).toISOString(),
    statusKind: x.statusKind,
    score: x.score,
    home: x.home.name,
    away: x.away.name,
  };
}

/** Compact shape of one Goaloo match centre, for eyeballing the parse. */
function summarise(m: GoalooLiveMatch) {
  return {
    home: m.home.name,
    away: m.away.name,
    state: m.state,
    minute: m.minute,
    score: m.score,
    kickoff: m.kickoff,
    stats: m.stats.map((s) => `${s.key}:${s.rows.length}`),
    lineups: m.lineups.map((s) => ({
      team: s.team.name,
      formation: s.formation,
      starters: s.starters.length,
      subs: s.substitutes.length,
      sample: s.starters.slice(0, 2).map((pl) => ({
        name: pl.name,
        id: pl.id,
        number: pl.number,
        rating: pl.rating,
        marks: pl.marks.map((k) => `${k.label}|${k.time}`),
      })),
    })),
    events: m.events.length,
    eventSample: m.events
      .slice(0, 5)
      .map((e) => `${e.minute || '-'}|${e.kind || e.label}|${e.side}|h:${e.home || '-'} a:${e.away || '-'}|clip:${e.clip ? 'yes' : 'no'}`),
    highlights: m.highlights.map((c) => ({ minute: c.minute, kind: c.kind, title: c.title.slice(0, 60), url: c.url })),
    form: m.form.length,
    buckets: m.buckets.length,
    htft: m.htft ? m.htft.teams.map((t) => t.name) : null,
    text: m.text.length,
  };
}

/** Read one Goaloo competition feed fresh (no Next data cache, no in-process cache). */
async function feed(path: string, seasonDir: string) {
  const comp = findCompetition(path);
  if (!comp) return { path, seasonDir, error: 'competition not in catalogue' } as Record<string, unknown>;
  const url = goalooCompetitionUrl({ path, seasonDir });
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return { path, seasonDir, url, status: res.status } as Record<string, unknown>;
    const raw = (await res.json()) as unknown;
    const fixtures: GoalooFixture[] = parseGoalooCompetition(raw, comp).stages.flatMap((s) => s.items);
    return { path, seasonDir, url, status: res.status, fixtures: fixtures.length, list: fixtures } as Record<
      string,
      unknown
    >;
  } catch (e) {
    return { path, seasonDir, url, error: String(e) } as Record<string, unknown>;
  }
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const matchId = p.get('id') ?? '';
  const sportType = Number(p.get('sport')) || 1;
  const mode = p.get('mode') ?? 'centre';

  if (mode === 'diag') {
    const detail = await getMatchDetail({ matchId, sportType, language: 0, source: 'data' });
    if (!detail.ok) return Response.json({ ok: false, error: detail.error });
    const m = detail.data.match;
    const league = Number(m?.league?.leagueId) || 0;
    const at = matchDateMs(m?.matchDate) || 0;
    const home = m?.home?.name ?? '';
    const away = m?.away?.name ?? '';
    const comps = goalooCompetitionsForLeague(league);
    const feeds = [];
    for (const comp of comps.slice(0, 4)) {
      const f = await feed(comp.path, comp.seasonDir);
      const list = (f.list as GoalooFixture[] | undefined) ?? [];
      const near = list
        .filter((x) => sameClub(home, x.home.name) && sameClub(away, x.away.name))
        .map((x) => ({
          matchId: x.matchId,
          kickoff: x.kickoff,
          deltaMin: (x.kickoff - at) / 60000,
          home: x.home.name,
          away: x.away.name,
        }));
      const byOne = list
        .filter((x) => sameClub(home, x.home.name) || sameClub(away, x.away.name))
        .slice(0, 6)
        .map((x) => ({ matchId: x.matchId, deltaMin: (x.kickoff - at) / 60000, home: x.home.name, away: x.away.name }));
      delete f.list;
      feeds.push({ ...f, bothSides: near, oneSide: byOne });
    }
    return Response.json({
      ok: true,
      ref: {
        matchId,
        league,
        kickoff: at,
        kickoffIso: new Date(at).toISOString(),
        home,
        away,
        rblinkLeague: m?.league?.name,
      },
      comps: comps.map((c) => `${c.path} ${c.seasonDir} ${c.name}`),
      compCount: comps.length,
      feeds,
    });
  }

  if (mode === 'list') {
    const path = p.get('path') ?? '';
    const season = p.get('season') ?? '';
    const f = await feed(path, season);
    const list = (f.list as GoalooFixture[] | undefined) ?? [];
    delete f.list;
    return Response.json({
      ok: true,
      ...f,
      fixtures: list.length,
      head: list.slice(0, 4).map(brief),
      finished: list.filter((x) => x.statusKind === 'finished').slice(-4).map(brief),
      live: list.filter((x) => x.statusKind === 'live').slice(0, 6).map(brief),
    });
  }

  if (mode === 'read') {
    const sid = Number(p.get('sid')) || 0;
    const m = await getGoalooLiveMatch(sid);
    if (!m) return Response.json({ ok: false, error: 'page unreadable', sid });
    return Response.json({ ok: true, matched: true, scheduleId: sid, ...summarise(m) });
  }

  if (mode === 'scan') {
    const limit = Number(p.get('limit')) || 40;
    const src: MatchSource = p.get('src') === 'live' ? 'live' : 'data';
    const res = await getMatches({ source: src, sportType, language: 0 });
    if (!res.ok) return Response.json({ ok: false, error: res.error });
    const all = res.data.list ?? [];
    const rows: Record<string, unknown>[] = [];
    const misses: Record<string, unknown>[] = [];
    const counts = { noCompetition: 0, unmatched: 0, unmatchedWithNear: 0 };
    for (const m of all.slice(0, limit)) {
      const ref = {
        leagueId: Number(m?.league?.leagueId) || 0,
        kickoff: matchDateMs(m?.matchDate) || 0,
        home: m?.home?.name ?? '',
        away: m?.away?.name ?? '',
      };
      if (!ref.leagueId || !ref.kickoff || !ref.home || !ref.away) continue;
      const comps = goalooCompetitionsForLeague(ref.leagueId);
      const base = {
        matchId: m?.matchId,
        league: m?.league?.name,
        leagueId: ref.leagueId,
        kickoffIso: new Date(ref.kickoff).toISOString(),
        home: ref.home,
        away: ref.away,
      };
      if (!comps.length) {
        counts.noCompetition++;
        misses.push({ ...base, reason: 'league has no Goaloo competition' });
        continue;
      }
      const sid = await goalooScheduleIdForMatch(ref);
      if (sid) {
        rows.push({ ...base, sid });
        continue;
      }
      // Nothing paired: look for the same two clubs in the mapped feeds and
      // report how far their kick-off sits from Rblink's.
      const near: Record<string, unknown>[] = [];
      for (const comp of comps.slice(0, 2)) {
        const f = await feed(comp.path, comp.seasonDir);
        for (const x of ((f.list as GoalooFixture[] | undefined) ?? [])) {
          if (sameClub(ref.home, x.home.name) && sameClub(ref.away, x.away.name)) {
            near.push({
              sid: x.matchId,
              kickoffIso: new Date(x.kickoff).toISOString(),
              deltaMin: (x.kickoff - ref.kickoff) / 60000,
            });
          }
        }
      }
      counts.unmatched++;
      if (near.length) counts.unmatchedWithNear++;
      misses.push({ ...base, comps: comps.map((c) => c.path), near });
    }
    return Response.json({
      ok: true,
      source: src,
      scanned: Math.min(limit, all.length),
      total: all.length,
      joined: rows.length,
      counts,
      rows,
      misses: p.get('all') === '1' ? misses : misses.slice(0, 12),
    });
  }

  if (mode === 'clips') {
    const path = p.get('path') ?? '';
    const season = p.get('season') ?? '';
    const tail = Number(p.get('tail')) || 10;
    const f = await feed(path, season);
    const list = ((f.list as GoalooFixture[] | undefined) ?? []).filter((x) => x.statusKind === 'finished').slice(-tail);
    delete f.list;
    const withClips: Record<string, unknown>[] = [];
    for (const x of list) {
      const m = await getGoalooLiveMatch(x.matchId);
      if (!m) continue;
      if (m.highlights.length) {
        withClips.push({
          sid: x.matchId,
          fixture: `${x.home.name} ${m.score?.home}-${m.score?.away} ${x.away.name}`,
          clips: m.highlights.length,
          sample: m.highlights.slice(0, 3).map((c) => `${c.minute || '-'} ${c.kind} :: ${c.title} :: ${c.url}`),
        });
      }
    }
    return Response.json({ ok: true, path, season, checked: list.length, withClips });
  }

  const res = await getGoalooMatchCentre({ matchId, sportType });
  if (!res.ok) return Response.json({ ok: false, error: res.error });
  const data = res.data;
  if (!data.matched) return Response.json({ ok: true, matched: false });
  return Response.json({ ok: true, matched: true, scheduleId: data.scheduleId, ...summarise(data.live) });
}
