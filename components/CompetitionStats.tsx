'use client';

import { useMemo, useState } from 'react';
import { Goal, ThumbsUp } from 'lucide-react';
import { TeamLogo } from '@/components/Match';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { totalPlayer, totalTeam } from '@/lib/leagueProto';
import type { LeaguePlayerTotals, PlayerTotal, Team } from '@/lib/types';

/** Panel header row (summary on the left, the top-N switch on the right). */
const HEAD = 'mb-3.5 flex flex-wrap items-center justify-between gap-2.5';
/** Leaderboard grid — two boards side by side once there is room for them. */
const BOARD_GRID = 'grid gap-x-5 gap-y-5 min-[720px]:grid-cols-2';
/** Board title (same eyebrow style as the standings group labels). */
const BOARD_TITLE =
  'mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-muted';
/** One leaderboard row — the same card chrome the fixture rows use. */
const ROW = 'flex items-start gap-2.5 rounded-md border border-border-soft bg-card px-2.5 py-1.5';
const RANK = 'mt-0.5 w-4 shrink-0 text-center text-[12px] font-bold tabular-nums text-muted';
const VALUE = 'mt-0.5 shrink-0 text-[14px] font-extrabold tabular-nums';
const BAR = 'mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-border-soft';
const EMPTY = 'rounded-md border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted';
/** Top-N switch (same active/idle pill pair as the page tabs). */
const PILL = 'cursor-pointer rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors';
const PILL_IDLE = `${PILL} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const PILL_ACTIVE = `${PILL} border-accent bg-accent-soft text-accent`;

/** How many rows each board shows — a competition can hold 1k+ scorers. */
const LIMITS = [10, 25, 50] as const;
type Limit = (typeof LIMITS)[number];

/** Referee's card — a plain coloured glyph, no icon font needed. */
function CardGlyph({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="h-3.5 w-2.5 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
      aria-label={label}
      role="img"
    />
  );
}

interface Leader {
  row: PlayerTotal;
  player?: Team;
  team?: Team;
  value: number;
}

/** One leaderboard: rank, avatar, name, club crest and the counter itself,
 *  with a proportional bar so the gap between #1 and #10 is readable. */
function Board({
  title,
  glyph,
  rows,
  total,
  accent,
  sportType,
}: {
  title: string;
  glyph: React.ReactNode;
  rows: Leader[];
  /** Largest value in the whole competition (bar scale), not just this page. */
  total: number;
  accent: string;
  sportType: number;
}) {
  return (
    <section className="min-w-0">
      <h3 className={BOARD_TITLE}>
        {glyph}
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className={EMPTY}>No {title.toLowerCase()} recorded this season.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((l, i) => {
            const name =
              l.player?.name ?? (l.row.playerId !== undefined ? `#${l.row.playerId}` : 'Unknown player');
            const pct = total > 0 ? Math.max(4, Math.round((l.value / total) * 100)) : 0;
            return (
              <li key={`${l.row.playerId ?? 'x'}-${i}`} className={ROW}>
                <span className={RANK}>{i + 1}</span>
                <PlayerAvatar path={l.player?.logo} name={name} sportType={sportType} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="w-full truncate text-[13px] font-semibold leading-tight">{name}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <TeamLogo
                      path={l.team?.logo}
                      name={l.team?.name}
                      sportType={sportType}
                      kind="team"
                      size="league"
                    />
                    <span className="min-w-0 truncate text-[11px] leading-tight text-muted">
                      {l.team?.name ?? (l.row.teamId !== undefined ? `#${l.row.teamId}` : '—')}
                    </span>
                  </span>
                  <span className={BAR}>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: accent }}
                    />
                  </span>
                </span>
                <span className={VALUE}>{l.value}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Competition statistics tab: the leaderboards the feed ranks per player —
 *  goals, assists, yellow cards and red cards. Pure presentation: the page
 *  gates the request and hands the decoded payload in. */
export function CompetitionStats({
  totals,
  sportType,
}: {
  totals: LeaguePlayerTotals;
  sportType: number;
}) {
  const [limit, setLimit] = useState<Limit>(10);

  /** Every board is cut from the SAME row set, so a player who only ever
   *  collected cards still appears on the card boards. */
  const boards = useMemo(() => {
    const build = (pick: (r: PlayerTotal) => number): Leader[] =>
      totals.rows
        .map((row) => ({
          row,
          player: totalPlayer(totals, row),
          team: totalTeam(totals, row),
          value: pick(row),
        }))
        .filter((l) => l.value > 0)
        .sort((a, b) => b.value - a.value || (a.player?.name ?? '').localeCompare(b.player?.name ?? ''))
        .slice(0, limit);
    const max = (pick: (r: PlayerTotal) => number): number =>
      totals.rows.reduce((m, r) => Math.max(m, pick(r)), 0);

    return {
      goals: { rows: build((r) => r.goals ?? 0), top: max((r) => r.goals ?? 0) },
      assists: { rows: build((r) => r.assists ?? 0), top: max((r) => r.assists ?? 0) },
      yellow: { rows: build((r) => r.yellowCards ?? 0), top: max((r) => r.yellowCards ?? 0) },
      red: { rows: build((r) => r.redCards ?? 0), top: max((r) => r.redCards ?? 0) },
    };
  }, [totals, limit]);

  if (totals.rows.length === 0) {
    return <p className={EMPTY}>No player statistics for this competition yet.</p>;
  }

  const players = Object.keys(totals.players).length;
  const teams = Object.keys(totals.teams).length;

  return (
    <div>
      <div className={HEAD}>
        <p className="m-0 text-[12px] text-muted">
          <strong className="text-text">{totals.rows.length.toLocaleString('en-US')}</strong> ranked players
          {players > 0 && (
            <>
              {' · '}
              <strong className="text-text">{players.toLocaleString('en-US')}</strong> players
            </>
          )}
          {teams > 0 && (
            <>
              {' · '}
              <strong className="text-text">{teams}</strong> teams
            </>
          )}
        </p>
        <div className="inline-flex items-center gap-1.5" role="group" aria-label="Rows per leaderboard">
          {LIMITS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={limit === n}
              className={limit === n ? PILL_ACTIVE : PILL_IDLE}
              onClick={() => setLimit(n)}
            >
              Top {n}
            </button>
          ))}
        </div>
      </div>

      <div className={BOARD_GRID}>
        <Board
          title="Goals"
          glyph={<Goal size={14} className="shrink-0" aria-hidden="true" />}
          rows={boards.goals.rows}
          total={boards.goals.top}
          accent="var(--accent)"
          sportType={sportType}
        />
        <Board
          title="Assists"
          glyph={<ThumbsUp size={14} className="shrink-0" aria-hidden="true" />}
          rows={boards.assists.rows}
          total={boards.assists.top}
          accent="#22c55e"
          sportType={sportType}
        />
        <Board
          title="Yellow cards"
          glyph={<CardGlyph color="#eab308" label="Yellow card" />}
          rows={boards.yellow.rows}
          total={boards.yellow.top}
          accent="#eab308"
          sportType={sportType}
        />
        <Board
          title="Red cards"
          glyph={<CardGlyph color="#ef4444" label="Red card" />}
          rows={boards.red.rows}
          total={boards.red.top}
          accent="#ef4444"
          sportType={sportType}
        />
      </div>
    </div>
  );
}
