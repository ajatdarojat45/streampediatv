import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayerLink } from '@/components/PlayerLink';
import { totalPlayer, totalTeam } from '@/lib/leagueProto';
import type { GoalooClubPerson, LeaguePlayerTotals, PlayerTotal } from '@/lib/types';

/** Table chrome — the metrics the competition page's player leaderboard uses. */
const HEAD = 'px-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
const CELL = 'px-1.5 py-1.5 text-center tabular-nums';

/** The club feed is a football feed — every page built from it is football. */
const FOOTBALL = 1;

/** The feed sends per-game numbers as strings ("2.0"); anything unreadable is
 *  reported as no number at all rather than as 0.00. */
function perGame(value?: string): string {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n.toFixed(1) : '—';
}

/**
 * The club's player data for one competition × season — the rows the
 * competition's own player table publishes for THIS club.
 *
 * The payload ranks every player the competition has on file and carries its own
 * player/team lists, so a row resolves its footballer and its club without a
 * second request (lib/leagueProto); every other club's rows are simply not this
 * table's business. A player the club feed also lists (matched through the page
 * id the squad bridge resolved, lib/goalooSquad) shows the position the feed
 * gives him — one more thing read from a payload rather than guessed.
 *
 * An empty list is honest here: the competition may predate this club, or the
 * club may simply have no ranked player in it.
 */
export function ClubSquadStats({
  totals,
  clubId,
  squad,
}: {
  totals: LeaguePlayerTotals;
  /** Goaloo club id of the club the page is about. */
  clubId: number;
  /** The club's own squad, for the position each player plays in. */
  squad: GoalooClubPerson[];
}) {
  /** The squad member behind a row, matched on the player page the same name
   *  bridge resolved — never on the name itself. */
  const positionOf = (row: PlayerTotal): string => {
    const page = totalPlayer(totals, row)?.playerPageId;
    if (!page) return '';
    return squad.find((person) => person.id === page)?.position ?? '';
  };

  const rows = totals.rows
    .filter((row) => totalTeam(totals, row)?.clubId === clubId)
    .map((row) => {
      const player = totalPlayer(totals, row);
      return {
        row,
        player,
        name: player?.name ?? '—',
        position: positionOf(row),
        goals: row.goals ?? 0,
        assists: row.assists ?? 0,
      };
    })
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted">
        This competition publishes no player totals for this club in the season picked.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className={`${HEAD} text-left`} scope="col">Player</th>
              <th className={`${HEAD} text-left`} scope="col">Position</th>
              <th className={`${HEAD} w-11 text-center`} scope="col">Goals</th>
              <th className={`${HEAD} w-10 text-center`} scope="col">Pens</th>
              <th className={`${HEAD} w-11 text-center`} scope="col">Assists</th>
              <th className={`${HEAD} w-10 text-center`} scope="col">YC</th>
              <th className={`${HEAD} w-10 text-center`} scope="col">RC</th>
              <th className={`${HEAD} w-14 text-center`} scope="col">Min/G</th>
              <th className={`${HEAD} w-14 text-center`} scope="col">Shots/G</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.row.playerId ?? r.name}
                className="border-b border-border-soft last:border-0 hover:bg-border-soft/40"
              >
                <td className="max-w-[240px] px-1.5 py-1.5">
                  {/* Photo + name lead into the player's own page — plain text
                      for a name the club's squad could not resolve. */}
                  <PlayerLink
                    id={r.player?.playerPageId}
                    name={r.name}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <PlayerAvatar path={r.player?.logo} name={r.name} sportType={FOOTBALL} />
                    <span className="min-w-0 truncate font-semibold" title={r.name}>
                      {r.name}
                    </span>
                  </PlayerLink>
                </td>
                <td className="px-1.5 py-1.5 text-[12px] text-muted max-[640px]:hidden">
                  {r.position || '—'}
                </td>
                <td className={`${CELL} font-bold`}>{r.goals}</td>
                <td className={`${CELL} text-muted`}>{r.row.penaltyKick ?? 0}</td>
                <td className={CELL}>{r.assists}</td>
                <td className={CELL}>{r.row.yellowCards ?? 0}</td>
                <td className={CELL}>{r.row.redCards ?? 0}</td>
                <td className={`${CELL} text-muted`}>{perGame(r.row.minutesPerGame)}</td>
                <td className={`${CELL} text-muted max-[640px]:hidden`}>
                  {perGame(r.row.shotsPerGame)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        <strong className="text-text">{rows.length}</strong> of the club&rsquo;s players are ranked by
        this competition, with the totals it publishes for them. Pens is the penalty goals inside
        Goals, and Min/G and Shots/G are the feed&rsquo;s own per-game figures.
      </p>
    </>
  );
}
