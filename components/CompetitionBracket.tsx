'use client';

import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { TeamLogo } from '@/components/Match';
import { ClubLink } from '@/components/ClubLink';
import type { BracketRound, BracketTie } from '@/lib/leagueProto';
import { formatMatchDate, kickoffISO, matchDateMs } from '@/lib/datetime';
import { isLiveStatus, isStarted } from '@/lib/matchProto';
import type { Match } from '@/lib/types';

/* Match Chart — the competition BRACKET (16 besar → 8 besar → … → final).
 *
 * This is not a per-match chart: it is the shape of the competition itself. The
 * feed publishes no bracket of its own (see `buildBracket` in lib/leagueProto),
 * so the columns are reconstructed from the same season fixtures the Schedule
 * tab already pays for — one column per named knockout round, one card per tie,
 * ordered widest → final.
 *
 * Every club in a tie is a {@link ClubLink}: crest + name go into `/club/{id}`,
 * while the rest of the card is one big click target onto the watch page (the
 * same overlay trick the fixture rows use, so a link inside a clickable card
 * stays reachable). A competition whose fixtures name no knockout round — every
 * domestic league — renders its own message instead of an empty grid.
 */

/** Bracket column — a fixed width so the rounds line up and scroll sideways. */
const COLUMN = 'flex w-[252px] shrink-0 flex-col';
/** Column heading (round name on the left, tie count on the right). */
const ROUND_HEAD = 'mb-2 flex items-center justify-between gap-2 px-0.5';
const ROUND_TITLE = 'min-w-0 truncate text-[12px] font-bold uppercase tracking-[0.06em] text-text';
const ROUND_CHIP =
  'shrink-0 rounded-full border border-border bg-card px-2 py-px text-[11px] font-bold text-muted';
/** One tie — the same card chrome the leaderboard rows use. */
const TIE = 'relative rounded-md border border-border-soft bg-card px-2.5 py-2';
/** The card's own click target (the fixture rows' overlay pattern). */
const TIE_OVERLAY = 'absolute inset-0 cursor-pointer rounded-md';
const SIDE = 'flex items-center gap-2 py-0.5';
const SIDE_NAME = 'min-w-0 flex-1 truncate';
const SIDE_WIN = `${SIDE_NAME} font-bold text-text`;
const SIDE_LOSE = `${SIDE_NAME} text-muted`;
const SCORE = 'w-5 shrink-0 text-right text-[13px] font-bold tabular-nums';
const SCORE_IDLE = `${SCORE} text-muted`;
const TIE_FOOT =
  'mt-1.5 flex items-center justify-between gap-2 border-t border-border-soft pt-1 text-[11px] text-muted';
const LIVE_CHIP =
  'shrink-0 rounded-full border border-[color:var(--live)] px-1.5 py-px text-[10px] font-bold uppercase text-[color:var(--live)]';
/** Empty state (the leaderboards' dashed box). */
const EMPTY = 'rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted';

/** One side of a tie: crest + club name, linked into the club's own page, with
 *  the goals the side has scored so far. A slot the feed has not filled in yet
 *  ("Winner SF 1") prints as TBD — there is no club to link to. */
function Side({
  team,
  goals,
  winner,
  sportType,
}: {
  team?: Match['home'];
  goals: number;
  /** This side is the one that advances (or the only one that has scored). */
  winner: boolean;
  sportType: number;
}) {
  return (
    <div className={SIDE}>
      {team ? (
        <ClubLink
          id={team.clubId}
          name={team.name}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <TeamLogo path={team.logo} name={team.name} sportType={sportType} size="league" />
          <span className={winner ? SIDE_WIN : SIDE_LOSE}>{team.name || '?'}</span>
        </ClubLink>
      ) : (
        <>
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-dashed border-border"
            aria-hidden="true"
          />
          <span className={`${SIDE_LOSE} italic`}>TBD</span>
        </>
      )}
      <span className={winner ? SCORE : SCORE_IDLE}>{goals}</span>
    </div>
  );
}

/** One tie card — both sides plus the leg the card opens on. */
function Tie({
  tie,
  sportType,
  onOpenMatch,
}: {
  tie: BracketTie;
  sportType: number;
  onOpenMatch: (m: Match) => void;
}) {
  /** The leg the card opens: the latest one (the decider of a two-legged tie).
   *  `legs` already arrive in playing order — the sort is a guard for a feed
   *  that publishes a replayed fixture out of sequence. */
  const legs = useMemo(
    () => [...tie.legs].sort((a, b) => (matchDateMs(a.matchDate) ?? 0) - (matchDateMs(b.matchDate) ?? 0)),
    [tie.legs]
  );
  const last = legs[legs.length - 1];
  const live = tie.legs.some((l) => isLiveStatus(l.status));
  const over = tie.legs.every((l) => isStarted(l.status));
  const iso = kickoffISO(last.matchDate);

  return (
    <div className={TIE}>
      <Side team={tie.home} goals={tie.homeGoals} winner={tie.winner === 1} sportType={sportType} />
      <Side team={tie.away} goals={tie.awayGoals} winner={tie.winner === 2} sportType={sportType} />
      <div className={TIE_FOOT}>
        <span className="min-w-0 truncate">
          {iso ? <time dateTime={iso}>{formatMatchDate(last.matchDate)}</time> : 'Date TBC'}
          {legs.length > 1 && ` · agg over ${legs.length} legs`}
        </span>
        {live ? <span className={LIVE_CHIP}>Live</span> : over ? <span className="shrink-0 font-bold">FT</span> : null}
      </div>
      {/* The card's own navigation, painted above the static content — the club
          links inside it are lifted with `relative z-10` (see ClubLink). */}
      <button
        type="button"
        className={TIE_OVERLAY}
        onClick={() => onOpenMatch(last)}
        aria-label={`Open ${tie.home?.name ?? 'TBD'} vs ${tie.away?.name ?? 'TBD'}`}
      />
    </div>
  );
}

/** The bracket: one column per round, widest first. */
export function CompetitionBracket({
  rounds,
  sportType,
  seasonLabel,
  onOpenMatch,
}: {
  /** Built by `buildBracket` — the page owns the memo so the pill's count and
   *  the grid can never disagree. */
  rounds: BracketRound[];
  sportType: number;
  /** The season on screen, for the empty state ("… for 26-27"). */
  seasonLabel?: string;
  onOpenMatch: (m: Match) => void;
}) {
  if (rounds.length === 0) {
    return (
      <div>
        <p className={`${EMPTY} mb-3`}>
          No knockout bracket to show{seasonLabel ? ` for ${seasonLabel}` : ''} — the feed has
          published no knockout round for this competition.
        </p>
        <p className="m-0 text-[12px] text-muted">
          A cup&apos;s bracket appears here round by round, as soon as the feed publishes it
          (16 besar, 8 besar, the semifinals and the final). A competition played as a league
          has no bracket at all — its shape is the table on the{' '}
          <strong className="text-text">Standing</strong> tab.
        </p>
      </div>
    );
  }

  const multiLeg = rounds.some((r) => r.ties.some((t) => t.legs.length > 1));

  return (
    <div>
      <ol className="m-0 flex list-none items-start gap-3 overflow-x-auto p-0 pb-1">
        {rounds.map((round) => (
          <li key={round.key} className={COLUMN}>
            <div className={ROUND_HEAD}>
              <span className={ROUND_TITLE} title={round.label}>
                {round.label}
              </span>
              <span className={ROUND_CHIP}>
                {round.ties.length} {round.ties.length === 1 ? 'tie' : 'ties'}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {round.ties.map((tie) => (
                <Tie key={tie.key} tie={tie} sportType={sportType} onOpenMatch={onOpenMatch} />
              ))}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Trophy size={13} className="shrink-0" aria-hidden="true" />
          The side that goes through is in bold.
        </span>
        {multiLeg && <span>The score of a two-legged tie is the aggregate.</span>}
        <span>An open slot stays TBD until the feed fills it in.</span>
      </p>
    </div>
  );
}
