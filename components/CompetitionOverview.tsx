'use client';

import { useMemo } from 'react';
import { CalendarDays, ChevronRight, Goal, Star, Trophy } from 'lucide-react';
import { MatchRow, TeamLogo } from '@/components/Match';
import { ClubLink } from '@/components/ClubLink';
import { standingTeam } from '@/lib/leagueProto';
import { matchDateMs } from '@/lib/datetime';
import { isStarted } from '@/lib/matchProto';
import type { LeagueExtra, LeagueStandings, Match } from '@/lib/types';

/** Section eyebrow — the same label style the standings groups use. */
const EYEBROW =
  'mb-2 flex items-center justify-between gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted';
const EYEBROW_LEAD = 'flex items-center gap-1.5';
/** Card used by every overview block. */
const CARD = 'flex flex-col gap-3 rounded-md border border-border-soft bg-card px-3.5 py-3';
/** Fact chip (mirrors the page header's META_CHIP). */
const FACT =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-panel px-2.5 py-1 text-[12px] text-muted [&_strong]:font-bold [&_strong]:text-text';
/** Small text link that hands the visitor to the matching tab. */
const JUMP =
  'inline-flex cursor-pointer items-center gap-0.5 rounded-full border border-border bg-panel px-2.5 py-1 text-[12px] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-soft';
const SK = 'animate-pulse rounded bg-[#e8eaed] [[data-theme=dark]_&]:bg-border-soft';
const EMPTY = 'rounded-md border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted';

/** Share of matches won/drawn/lost by the home side, as the aggregate block
 *  reports it (percent strings, e.g. "54.0"). */
function formShares(extra?: LeagueExtra): { win: number; draw: number; loss: number } | null {
  const win = Number.parseFloat(extra?.win ?? '');
  const draw = Number.parseFloat(extra?.draw ?? '');
  const loss = Number.parseFloat(extra?.loss ?? '');
  if (!Number.isFinite(win) && !Number.isFinite(draw) && !Number.isFinite(loss)) return null;
  const w = Number.isFinite(win) ? win : 0;
  const d = Number.isFinite(draw) ? draw : 0;
  const l = Number.isFinite(loss) ? loss : 0;
  const sum = w + d + l;
  if (sum <= 0) return null;
  // Normalise: the three strings do not always add up to exactly 100.
  return { win: (w / sum) * 100, draw: (d / sum) * 100, loss: (l / sum) * 100 };
}

/** One compact fact chip. */
function Fact({ icon: Icon, label, value }: { icon?: typeof Trophy; label: string; value: string | number }) {
  return (
    <span className={FACT}>
      {Icon && <Icon size={13} className="shrink-0" aria-hidden="true" />}
      {label} <strong>{value}</strong>
    </span>
  );
}


/** A 3-row fixture teaser (next up / latest results) with a jump link. */
function FixtureBlock({
  title,
  icon,
  matches,
  loading,
  empty,
  onOpenMatch,
  jumpLabel,
  onJump,
}: {
  title: string;
  icon: React.ReactNode;
  matches: Match[];
  loading: boolean;
  empty: string;
  onOpenMatch: (m: Match) => void;
  jumpLabel: string;
  onJump: () => void;
}) {
  return (
    <section className="min-w-0">
      <div className={EYEBROW}>
        <span className={EYEBROW_LEAD}>
          {icon}
          {title}
        </span>
        <button type="button" className={JUMP} onClick={onJump}>
          {jumpLabel}
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className={`${SK} block h-[86px] w-full`} />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <p className={EMPTY}>{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((m, i) => (
            <MatchRow key={`${m.matchId}-${i}`} match={m} onClick={() => onOpenMatch(m)} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Top-5 snapshot of the table — the full standings live on their own tab. */
function StandingsSnapshot({
  standings,
  sportType,
  loading,
  onJump,
}: {
  standings?: LeagueStandings;
  sportType: number;
  loading: boolean;
  onJump: () => void;
}) {
  const rows = useMemo(() => standings?.rows.slice(0, 5) ?? [], [standings]);
  const head = 'px-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
  const cell = 'px-1.5 py-1.5 text-center tabular-nums';

  return (
    <section className="min-w-0">
      <div className={EYEBROW}>
        <span className={EYEBROW_LEAD}>
          <Trophy size={14} aria-hidden="true" />
          Standings
        </span>
        <button type="button" className={JUMP} onClick={onJump}>
          Full table
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`${SK} block h-6 w-full`} />
          ))}
        </div>
      ) : !standings || rows.length === 0 ? (
        <p className={EMPTY}>No table published for this competition yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className={`${head} w-8 text-left`} scope="col">
                  #
                </th>
                <th className={`${head} text-left`} scope="col">
                  Team
                </th>
                <th className={`${head} w-9 text-center`} scope="col">
                  P
                </th>
                <th className={`${head} w-10 text-center`} scope="col">
                  GD
                </th>
                <th className={`${head} w-11 text-center`} scope="col">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const team = standingTeam(standings, row);
                const promo =
                  row.promotionId !== undefined ? standings.promotions[row.promotionId] : undefined;
                const diff = (row.goals ?? 0) - (row.goalsAgainst ?? 0);
                return (
                  <tr key={`${row.teamId}-${i}`} className="border-b border-border-soft last:border-0">
                    <td
                      className={`${cell} border-l-[3px] text-left font-bold text-muted`}
                      style={{ borderLeftColor: promo?.color || 'transparent' }}
                      title={promo?.name}
                    >
                      {i + 1}
                    </td>
                    <td className="px-1.5 py-1.5">
                      {/* Crest + name of the row's club, linked into its page. */}
                      <ClubLink
                        id={team?.clubId}
                        name={team?.name}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <TeamLogo
                          path={team?.logo}
                          name={team?.name}
                          sportType={sportType}
                          kind="team"
                          size="league"
                        />
                        <span className="min-w-0 truncate font-semibold">
                          {team?.name ?? (row.teamId !== undefined ? `#${row.teamId}` : '—')}
                        </span>
                      </ClubLink>
                    </td>
                    <td className={cell}>{row.total ?? 0}</td>
                    <td className={cell}>{diff > 0 ? `+${diff}` : diff}</td>
                    <td className={`${cell} font-bold`}>{row.points ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}



/** Overview tab — the competition at a glance: the home/away outcome split,
 *  the next and the most recent fixtures, a top-5 table snapshot and the MVP.
 *  Every block degrades on its own, so a slow standings call never blanks the
 *  fixtures (and vice versa). */
export function CompetitionOverview({
  extra,
  sportType,
  seasonLabel,
  matches,
  standings,
  matchesLoading,
  standingsLoading,
  onOpenTab,
  onOpenMatch,
}: {
  extra?: LeagueExtra;
  sportType: number;
  seasonLabel: string;
  matches: Match[];
  standings?: LeagueStandings;
  matchesLoading: boolean;
  standingsLoading: boolean;
  onOpenTab: (tab: 'matches' | 'standings' | 'stats') => void;
  onOpenMatch: (m: Match) => void;
}) {
  const form = useMemo(() => formShares(extra), [extra]);
  /** Upcoming vs played is read from the match STATUS (not from the clock), so
   *  the server render and the first client render always agree. */
  const upcoming = useMemo(() => matches.filter((m) => !isStarted(m.status)).slice(0, 3), [matches]);
  const latest = useMemo(
    () =>
      matches
        .filter((m) => isStarted(m.status))
        .sort((a, b) => (matchDateMs(b.matchDate) ?? 0) - (matchDateMs(a.matchDate) ?? 0))
        .slice(0, 3),
    [matches]
  );
  const played = useMemo(() => matches.filter((m) => isStarted(m.status)).length, [matches]);

  return (
    <div className="flex flex-col gap-5">
      {/* Season at a glance — the outcome split the header only states as a
          percentage, plus how far the season has progressed. */}
      <section>
        <div className={EYEBROW}>
          <span className={EYEBROW_LEAD}>
            <Goal size={14} aria-hidden="true" />
            {seasonLabel ? `${seasonLabel} at a glance` : 'At a glance'}
          </span>
        </div>
        <div className={CARD}>
          {form ? (
            <div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-border-soft">
                <span style={{ width: `${form.win}%`, backgroundColor: '#22c55e' }} />
                <span style={{ width: `${form.draw}%`, backgroundColor: '#9ca3af' }} />
                <span style={{ width: `${form.loss}%`, backgroundColor: '#ef4444' }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                <span>
                  <strong className="text-text">{Math.round(form.win)}%</strong> home wins
                </span>
                <span>
                  <strong className="text-text">{Math.round(form.draw)}%</strong> draws
                </span>
                <span>
                  <strong className="text-text">{Math.round(form.loss)}%</strong> away wins
                </span>
              </div>
            </div>
          ) : extra ? (
            <p className={EMPTY}>No outcome split published for this competition.</p>
          ) : (
            // Detail call still in flight — a skeleton beats a false "no data".
            <span className={`${SK} block h-2.5 w-full rounded-full`} />
          )}
          {matches.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Fact icon={CalendarDays} label="Fixtures" value={matches.length} />
              <Fact label="Played" value={played} />
              <Fact label="Upcoming" value={matches.length - played} />
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 min-[720px]:grid-cols-2">
        <FixtureBlock
          title="Next up"
          icon={<CalendarDays size={14} aria-hidden="true" />}
          matches={upcoming}
          loading={matchesLoading}
          empty="No upcoming fixtures — this season looks complete."
          onOpenMatch={onOpenMatch}
          jumpLabel="All fixtures"
          onJump={() => onOpenTab('matches')}
        />
        <FixtureBlock
          title="Latest results"
          icon={<Trophy size={14} aria-hidden="true" />}
          matches={latest}
          loading={matchesLoading}
          empty="No results yet this season."
          onOpenMatch={onOpenMatch}
          jumpLabel="All results"
          onJump={() => onOpenTab('matches')}
        />
      </div>

      <div className="grid gap-5 min-[720px]:grid-cols-2">
        <StandingsSnapshot
          standings={standings}
          sportType={sportType}
          loading={standingsLoading}
          onJump={() => onOpenTab('standings')}
        />
        <section className="min-w-0">
          <div className={EYEBROW}>
            <span className={EYEBROW_LEAD}>
              <Star size={14} aria-hidden="true" />
              Leaders
            </span>
            <button type="button" className={JUMP} onClick={() => onOpenTab('stats')}>
              Statistics
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
          <div className={CARD}>
            {extra?.mvpPlayer?.name ? (
              <div className="flex items-center gap-3">
                <TeamLogo
                  path={extra.mvpPlayer.logo}
                  name={extra.mvpPlayer.name}
                  sportType={sportType}
                  size="detailTeam"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-[0.06em] text-muted">
                    MVP of the competition
                  </span>
                  <span className="block truncate text-[14px] font-bold">{extra.mvpPlayer.name}</span>
                  {extra.mvpPlayer.country && (
                    <span className="block truncate text-[12px] text-muted">{extra.mvpPlayer.country}</span>
                  )}
                </span>
              </div>
            ) : (
              <p className={EMPTY}>No MVP published for this competition.</p>
            )}
            <p className="m-0 text-[12px] text-muted">
              Top scorers, assists, yellow and red cards are listed on the{' '}
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent underline"
                onClick={() => onOpenTab('stats')}
              >
                Statistics tab
              </button>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

