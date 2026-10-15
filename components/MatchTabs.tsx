'use client';

import { useState } from 'react';
import type {
  GoalooLiveMatch,
  MatchAnalysis,
  MatchLineup,
  MatchEvents,
  MatchStats,
  Team,
} from '@/lib/types';
import type { PlayerEventStats } from '@/lib/matchProto';
import { computePlayerEventStats, isLiveStatus } from '@/lib/matchProto';
import { H2H } from '@/components/H2H';
import { LatestMatches, NextMatches } from '@/components/TeamMatches';
import { Lineup } from '@/components/Lineup';
import { Timeline } from '@/components/Timeline';
import { Stats } from '@/components/Stats';
import {
  GoalooFormPanel,
  GoalooLineupsPanel,
  GoalooPendingPanel,
  GoalooStatsPanel,
} from '@/components/GoalooPanels';

type TabId = 'overview' | 'h2h' | 'latest' | 'next' | 'lineup' | 'timeline' | 'form';

/** Split a match-events list into per-team player-stat maps (keyed by playerId).
 *  Attributes each event to home/away by teamSide, reusing the shared
 *  computePlayerEventStats rules so goal/assist/card/sub logic stays in one place. */
function teamStats(events: MatchEvents | undefined): {
  home: Map<number, PlayerEventStats>;
  away: Map<number, PlayerEventStats>;
} {
  const home = new Map<number, PlayerEventStats>();
  const away = new Map<number, PlayerEventStats>();
  if (!events) return { home, away };
  const blank = (): PlayerEventStats => ({
    goals: 0,
    assists: 0,
    yellow: 0,
    red: 0,
    subIn: false,
    subOut: false,
  });
  for (const e of events) {
    const map = e.teamSide === 2 ? away : home;
    const merged = computePlayerEventStats([e]);
    for (const [id, st] of merged) {
      const cur = map.get(id) ?? blank();
      cur.goals += st.goals;
      cur.assists += st.assists;
      cur.yellow += st.yellow;
      cur.red += st.red;
      cur.subIn = cur.subIn || st.subIn;
      cur.subOut = cur.subOut || st.subOut;
      map.set(id, cur);
    }
  }
  return { home, away };
}

/** Panelled tab strip: Overview (statistics), Head to Head, the two matches
 *  tabs, Lineups, Timeline and Form. Tabs with no data are hidden; if only one
 *  has data it renders directly with no strip.
 *
 *  Overview, Lineups and Form draw the Goaloo match centre's own numbers when
 *  the fixture is in that catalogue (components/GoalooPanels.tsx) — statistics of
 *  every period, the team sheets with ratings and substitution minutes, the two
 *  clubs' recent numbers — and Overview and Lineups fall back to the catalogue's
 *  own payload when it is not (every other category, and any part of a football
 *  match the publisher has not filed yet). The Goaloo read itself happens once,
 *  in the page (components/WatchPageContent.tsx): it is the very read the
 *  player's incident clips come from. */
export function MatchTabs({
  analysis,
  lineup,
  events,
  stats,
  homeTeam,
  awayTeam,
  sportType,
  matchStatus,
  goaloo,
  goalooLoading = false,
}: {
  analysis?: MatchAnalysis;
  lineup?: MatchLineup;
  events?: MatchEvents;
  stats?: MatchStats;
  homeTeam?: Team;
  awayTeam?: Team;
  sportType?: number;
  matchStatus?: number;
  /** The fixture's Goaloo match centre, when the publisher carries it. */
  goaloo?: GoalooLiveMatch | null;
  /** True while that read is in flight (the caller gates it on the category, so
   *  this is never set for a sport Goaloo does not carry). Overview and Lineups
   *  then hold their place with one loading line instead of drawing the
   *  catalogue's numbers and swapping them out a moment later. */
  goalooLoading?: boolean;
}) {
  // `null` = user hasn't picked yet → default to the phase-preferred first tab.
  const [active, setActive] = useState<TabId | null>(null);

  // What only Goaloo carries. Statistics and the team sheets are PREFERRED over
  // the catalogue's own (its statistics run per period; its sheets carry each
  // player's rating and the minute he came on or went off) but never required —
  // the catalogue's payload is the fallback behind both.
  const hasGoalooStats = !!goaloo && goaloo.stats.length > 0;
  const hasGoalooSheets = !!goaloo && goaloo.lineups.length > 0;
  // Form, the goal distribution and the HT/FT record exist only at Goaloo, so
  // this tab has nothing to fall back to and is simply absent without them.
  const hasGoalooForm =
    !!goaloo && (goaloo.form.length > 0 || goaloo.buckets.length > 0 || !!goaloo.htft);

  const hasStats = !!stats && stats.length > 0;
  const hasH2H = !!analysis && analysis.h2h.length > 0;
  // Two matches tabs, both from the analysis payload (endpoint 107): each team's
  // latest results (`homeLatest`/`awayLatest`) and its next fixtures
  // (`homeNext`/`awayNext`). Shown independently — either can be empty.
  const hasLatest = !!analysis && (analysis.homeLatest.length > 0 || analysis.awayLatest.length > 0);
  const hasNext = !!analysis && (analysis.homeNext.length > 0 || analysis.awayNext.length > 0);
  const hasLineup = !!lineup && (lineup.home.length > 0 || lineup.away.length > 0);
  const hasTimeline = !!events && events.some((e) =>
    [101, 102, 103, 104, 105, 106, 107, 108, 109, 10020, 10021].includes(e.eventType)
  );

  // Tab availability is data-driven; tab ORDER + the default-open tab are
  // phase-driven — the content people reach for first changes with the match.
  //   upcoming → Lineups, H2H & the two matches tabs (probable XI, past meetings,
  //              latest results / next fixtures) lead; stats/timeline are empty
  //   live     → Timeline (goals/cards as they happen) leads, then live stats
  //   finished → Overview (final stat summary) leads, then the goal recap
  // Form rides last in every phase: it is a reference panel — the two clubs'
  // recent numbers — and never the first thing a reader opens for a match that
  // is being played or has just ended.
  const finished = (matchStatus ?? 0) >= 10000;
  const live = isLiveStatus(matchStatus);
  const phaseOrder: TabId[] = finished
    ? ['overview', 'timeline', 'h2h', 'latest', 'next', 'lineup', 'form']
    : live
    ? ['timeline', 'overview', 'lineup', 'h2h', 'latest', 'next', 'form']
    : ['lineup', 'h2h', 'latest', 'next', 'overview', 'timeline', 'form'];

  const defs: Record<TabId, { label: string; show: boolean }> = {
    overview: { label: 'Overview', show: hasGoalooStats || hasStats || goalooLoading },
    h2h: { label: 'Head to Head', show: hasH2H },
    latest: { label: 'Latest Matches', show: hasLatest },
    next: { label: 'Next Matches', show: hasNext },
    lineup: { label: 'Lineups', show: hasGoalooSheets || hasLineup || goalooLoading },
    timeline: { label: 'Timeline', show: hasTimeline },
    form: { label: 'Form', show: hasGoalooForm },
  };
  const available = phaseOrder
    .map((id) => ({ id, ...defs[id] }))
    .filter((t) => t.show);
  if (!available.length) return null;

  const stats2 = teamStats(events);
  const content = (id: TabId) => {
    switch (id) {
      case 'overview':
        // The publisher's own statistics when it has them, one loading line
        // while its page is still being read, and the catalogue's own numbers
        // when it has none — never the catalogue's first and the publisher's a
        // moment later, which would swap the panel under the reader's cursor.
        if (goaloo && hasGoalooStats) return <GoalooStatsPanel match={goaloo} />;
        if (goalooLoading) return <GoalooPendingPanel />;
        return <Stats stats={stats!} homeTeam={homeTeam} awayTeam={awayTeam} />;
      case 'h2h':
        return <H2H analysis={analysis!} homeTeam={homeTeam} awayTeam={awayTeam} sportType={sportType} />;
      case 'latest':
        return <LatestMatches analysis={analysis!} homeTeam={homeTeam} awayTeam={awayTeam} sportType={sportType} />;
      case 'next':
        return <NextMatches analysis={analysis!} homeTeam={homeTeam} awayTeam={awayTeam} sportType={sportType} />;
      case 'lineup':
        // The publisher's team sheets (ratings and substitution minutes) when
        // they are out, the catalogue's lineup until then — the tab keeps the
        // "Lineups" reading either way.
        if (goaloo && hasGoalooSheets) return <GoalooLineupsPanel match={goaloo} />;
        if (goalooLoading) return <GoalooPendingPanel />;
        return (
          <Lineup
            lineup={lineup!}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            sportType={sportType}
            homeStats={stats2.home}
            awayStats={stats2.away}
          />
        );
      case 'timeline':
        return <Timeline events={events!} sportType={sportType} homeTeam={homeTeam} awayTeam={awayTeam} />;
      case 'form':
        return goaloo ? <GoalooFormPanel match={goaloo} /> : null;
      default:
        return null;
    }
  };

  // Single tab — render it directly (no strip, and drop the component's own
  // outer panel margin since it sits where the strip would have).
  if (available.length === 1) return content(available[0].id);

  // Keep the active tab valid if data arrives/changes. Until the user picks one,
  // `active` is null → show the phase-preferred first available tab.
  const current =
    active && available.some((t) => t.id === active) ? active : available[0].id;

  return (
    <div className="mb-4">
      {/* Tab strip — pinned to a single row at every width: the buttons never
          wrap (`nowrap` + `shrink-0`) and the <640px paddings/type shrink. The
          strip sits in a hidden-scrollbar overflow container so a very narrow
          viewport scrolls the tabs instead of spilling onto a second line or
          overflowing the page. ≥640px keeps the original size. */}
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mb-0 flex w-max min-w-full flex-nowrap items-stretch gap-1 border-b border-border max-[640px]:gap-0.5">
          {available.map((t) => {
            const on = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={`-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-[14px] font-semibold transition-colors duration-150 max-[640px]:px-2 max-[640px]:py-2 max-[640px]:text-[13px] ${
                  on
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="pt-4">{content(current)}</div>
    </div>
  );
}
