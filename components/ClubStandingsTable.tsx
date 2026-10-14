import { TeamLogo } from '@/components/Match';
import { ClubLink } from '@/components/ClubLink';
import { standingTeam } from '@/lib/leagueProto';
import type { LeagueStandings, TeamStanding } from '@/lib/types';

/** The club feed is a football feed — every page built from it is football. */
const FOOTBALL = 1;

/** Table chrome — the same metrics the competition page's standings table uses,
 *  so the two tables read as one component. */
const HEAD = 'px-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
const CELL = 'px-1.5 py-1.5 text-center tabular-nums';

/** The club's own row is tinted, so the visitor finds it without scanning the
 *  whole table. */
const MINE = 'bg-accent-soft';

/**
 * A competition's table, with THIS club's row marked — the club page's Standing
 * panel. Rows arrive grouped by the stage/group the payload names (a cup's
 * groups are separate tables there), the promotion bands keep their own colour
 * stripe, and every other club's crest + name links into its page exactly as it
 * does on the competition page (lib/goalooTeams resolves the club id).
 *
 * Only what the payload publishes is drawn: a counter the row omits reads as 0,
 * never as a plausible-looking number.
 */
export function ClubStandingsTable({
  standings,
  highlightClubId,
}: {
  standings: LeagueStandings;
  /** Goaloo club id of the club the page is about; 0 when it could not be
   *  resolved, in which case no row is marked. */
  highlightClubId: number;
}) {
  const groups: { key: string; label: string; rows: TeamStanding[] }[] = [];
  const index = new Map<string, TeamStanding[]>();
  for (const row of standings.rows) {
    const key = row.groupName || '';
    let list = index.get(key);
    if (!list) {
      list = [];
      index.set(key, list);
      groups.push({ key, label: key, rows: list });
    }
    list.push(row);
  }

  return (
    <div className="overflow-x-auto">
      {groups.map((group) => (
        <div key={group.key || 'all'} className="mb-4 last:mb-0">
          {group.label && (
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">
              {group.label}
            </h3>
          )}
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className={`${HEAD} w-9 text-left`} scope="col">#</th>
                <th className={`${HEAD} text-left`} scope="col">Team</th>
                <th className={`${HEAD} w-9 text-center`} scope="col">P</th>
                <th className={`${HEAD} w-9 text-center`} scope="col">W</th>
                <th className={`${HEAD} w-9 text-center`} scope="col">D</th>
                <th className={`${HEAD} w-9 text-center`} scope="col">L</th>
                <th className={`${HEAD} w-10 text-center`} scope="col">GF</th>
                <th className={`${HEAD} w-10 text-center`} scope="col">GA</th>
                <th className={`${HEAD} w-10 text-center`} scope="col">GD</th>
                <th className={`${HEAD} w-11 text-center`} scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, i) => {
                const team = standingTeam(standings, row);
                const promo =
                  row.promotionId !== undefined ? standings.promotions[row.promotionId] : undefined;
                const goals = row.goals ?? 0;
                const against = row.goalsAgainst ?? 0;
                const diff = goals - against;
                const mine = highlightClubId > 0 && team?.clubId === highlightClubId;
                return (
                  <tr
                    key={`${row.teamId}-${i}`}
                    className={`border-b border-border-soft last:border-0 ${
                      mine ? MINE : 'hover:bg-border-soft/40'
                    }`}
                  >
                    <td
                      className={`${CELL} border-l-[3px] text-left font-bold text-muted`}
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
                          sportType={FOOTBALL}
                          size="league"
                        />
                        <span
                          className={`min-w-0 truncate ${
                            mine ? 'font-bold text-accent' : 'font-semibold'
                          }`}
                        >
                          {team?.name ?? (row.teamId !== undefined ? `#${row.teamId}` : '—')}
                        </span>
                      </ClubLink>
                    </td>
                    <td className={CELL}>{row.total ?? 0}</td>
                    <td className={CELL}>{row.won ?? 0}</td>
                    <td className={CELL}>{row.draw ?? 0}</td>
                    <td className={CELL}>{row.loss ?? 0}</td>
                    <td className={CELL}>{goals}</td>
                    <td className={CELL}>{against}</td>
                    <td className={CELL}>{diff > 0 ? `+${diff}` : diff}</td>
                    <td className={`${CELL} font-bold`}>{row.points ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {Object.values(standings.promotions).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
          {Object.values(standings.promotions).map((p) => (
            <span key={p.promotionId} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: p.color }}
                aria-hidden="true"
              />
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
