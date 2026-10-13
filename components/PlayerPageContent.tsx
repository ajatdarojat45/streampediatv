import Link from 'next/link';
import { CalendarClock, Play, Shirt, Trophy } from 'lucide-react';
import { GoalooLogo } from '@/components/GoalooLogo';
import { LocalTime } from '@/components/LocalTime';
import { PLAYER_MATCHES } from '@/lib/goalooPlayer';
import { clubHref, leagueHref, watchHref } from '@/lib/sports';
import type { GoalooPlayer, GoalooPlayerMatch, GoalooPlayerTransfer } from '@/lib/types';

/** The player feed is a football feed — every link built here is football. */
const FOOTBALL = 1;

const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
const CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-semibold [&_strong]:text-text';
const ROW = 'flex items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px]';
/** The row-wide stream link is an overlay, so the two club links inside the row
 *  can be anchors of their own (an anchor may not wrap an anchor). */
const ROW_ITEM =
  'relative m-0 list-none rounded-[var(--radius-sm)] transition-colors hover:bg-card';
const ROW_OVERLAY = 'absolute inset-0 rounded-[var(--radius-sm)]';
const ROW_SIDES = 'relative z-10 min-w-0 flex-1 truncate';
/** Column widths shared by the match log, so the rows line up as a table. */
const WHEN = 'w-[124px] shrink-0 text-[12px] text-muted max-[640px]:w-[86px]';
const COMP = 'w-[132px] shrink-0 truncate text-[12px] text-muted max-[640px]:hidden';
const ACTION = 'ml-auto shrink-0';
const WATCH_BADGE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent';
const NO_STREAM =
  'inline-flex items-center whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** Contribution chip in the match log ("68'", "2 goals", "1 yellow"). */
const MARK =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border-soft px-2 py-0.5 text-[11px] font-semibold text-muted';
const GROUP_HEAD = 'm-0 mt-4 text-[12px] font-bold uppercase tracking-[0.06em] text-muted';
/** Season table chrome — the metrics the competition tables use. */
const TH = 'py-2 pr-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
const TD = 'py-1.5 pr-3 tabular-nums';

/** Age in whole years, floored the way the feed's own page floors it. */
function ageOf(dateOfBirth: string): number {
  const born = Date.parse(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(born)) return 0;
  const days = (Date.now() - born) / 86_400_000;
  return days > 0 ? Math.floor(days / 365.2425) : 0;
}

/** The feed publishes this number in hundredths of its £M unit ("40" is
 *  £0.400M). */
function personValue(value: string): string {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? `£${(n / 100).toFixed(3)}M` : '';
}

/** One side of a match-log row — always a link to that club's page. */
function ClubName({ team }: { team: GoalooPlayerMatch['home'] }) {
  const href = clubHref(team.id);
  if (!href) return <span>{team.name}</span>;
  return (
    <Link
      href={href}
      className="hover:text-accent hover:underline"
      title={`${team.name} — squad, fixtures & results`}
    >
      {team.name}
    </Link>
  );
}

/** One appearance. Carries the same stream link as a club page's fixture row —
 *  `/watch/{id}` when the join found the match in the stream catalogue, none
 *  when it did not — plus a club link per side. */
function AppearanceRow({ match }: { match: GoalooPlayerMatch }) {
  const marks: string[] = [];
  if (match.minutes > 0) marks.push(`${match.minutes}'`);
  if (match.goals > 0) marks.push(match.goals > 1 ? `${match.goals} goals` : 'Goal');
  if (match.assists > 0) marks.push(match.assists > 1 ? `${match.assists} assists` : 'Assist');
  if (match.yellow > 0) marks.push('Yellow');
  if (match.red > 0) marks.push('Red');
  const label = `${match.home.name} vs ${match.away.name}`;
  const body = (
    <>
      <LocalTime ts={match.kickoff} className={WHEN} />
      {match.competition && <span className={COMP}>{match.competition}</span>}
      <span className={ROW_SIDES}>
        <ClubName team={match.home} />
        <span className="mx-1 text-muted">vs</span>
        <ClubName team={match.away} />
      </span>
      {match.score && (
        <span className="shrink-0 font-bold tabular-nums text-text">
          {match.score.home}–{match.score.away}
        </span>
      )}
      {marks.length > 0 && (
        <span className="hidden shrink-0 items-center gap-1.5 min-[720px]:flex">
          {marks.map((mark) => (
            <span key={mark} className={MARK}>
              {mark}
            </span>
          ))}
        </span>
      )}
      {match.rating > 0 && (
        <span className="shrink-0 text-[12px] font-bold tabular-nums text-text" title="Match rating">
          {match.rating.toFixed(2)}
        </span>
      )}
      <span className={ACTION}>
        {match.streamId > 0 ? (
          <span className={WATCH_BADGE}>
            <Play size={11} aria-hidden="true" />
            Watch
          </span>
        ) : (
          <span className={NO_STREAM}>No stream</span>
        )}
      </span>
    </>
  );
  return (
    <li className={ROW_ITEM}>
      <span className={ROW}>{body}</span>
      {match.streamId > 0 && (
        <Link
          href={watchHref(match.streamId, FOOTBALL)}
          className={ROW_OVERLAY}
          aria-label={`${label} — live stream`}
          title={`${label} — live stream`}
        />
      )}
    </li>
  );
}

/** The player page: bio, current club, season totals over the published
 *  appearances, the match log — each row linking into `/watch/{id}` when the
 *  stream catalogue knows the match — and the transfer record. */
export function PlayerPageContent({ player }: { player: GoalooPlayer }) {
  const matches = player.matches.slice(0, PLAYER_MATCHES);
  const streamed = matches.filter((m) => m.streamId > 0).length;
  const age = ageOf(player.dateOfBirth);
  const value = personValue(player.marketValue);
  const hidden = player.matches.length - matches.length;
  const teamHref = clubHref(player.teamId);
  /** Crest and name in one chip — the crest is the club's logo, and the whole
   *  chip opens that club's page. */
  const clubChip = player.teamName ? (
    <>
      <GoalooLogo src={player.teamLogo} name={player.teamName} size="sm" />
      {player.teamName}
    </>
  ) : null;
  const competition =
    player.leagueName && player.leagueStreamId > 0 ? (
      <Link
        href={leagueHref(player.leagueStreamId, FOOTBALL)}
        className={`${CHIP} hover:border-[#c7ccd2] hover:text-text`}
        title={`${player.leagueName} — fixtures, results & live streams`}
      >
        <Trophy size={12} aria-hidden="true" />
        {player.leagueName}
      </Link>
    ) : player.leagueName ? (
      <span className={CHIP}>
        <Trophy size={12} aria-hidden="true" />
        {player.leagueName}
      </span>
    ) : null;

  return (
    <>
      <section className={PANEL}>
        <div className="flex items-start gap-4">
          <GoalooLogo src={player.photo} name={player.name} size="lg" round />
          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-muted">Player</span>
            <h1 className="m-0 mt-1 flex items-center gap-2 text-[22px] font-extrabold leading-tight">
              {player.name}
              {player.number && (
                <span className="text-[14px] font-bold text-muted">#{player.number}</span>
              )}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {clubChip &&
                (teamHref ? (
                  <Link
                    href={teamHref}
                    className={`${CHIP} hover:border-[#c7ccd2] hover:text-text`}
                    title={`${player.teamName} — squad, fixtures & results`}
                  >
                    {clubChip}
                  </Link>
                ) : (
                  <span className={CHIP}>{clubChip}</span>
                ))}
              {competition}
              {player.country && (
                <span className={CHIP}>
                  <GoalooLogo src={player.countryFlag} name={player.country} size="sm" />
                  {player.country}
                </span>
              )}
              {age > 0 && (
                <span className={CHIP}>
                  Age <strong>{age}</strong>
                </span>
              )}
              {player.height && (
                <span className={CHIP}>
                  Height <strong>{player.height} cm</strong>
                </span>
              )}
              {player.weight && (
                <span className={CHIP}>
                  Weight <strong>{player.weight} kg</strong>
                </span>
              )}
              {player.foot && (
                <span className={CHIP}>
                  Foot <strong>{player.foot}</strong>
                </span>
              )}
              {value && (
                <span className={CHIP}>
                  Value <strong>{value}</strong>
                </span>
              )}
              {player.contract && (
                <span className={CHIP}>
                  Contract to <strong>{player.contract}</strong>
                </span>
              )}
            </div>
            <p className="m-0 mt-2 text-[12px] leading-[1.6] text-muted">
              <strong className="text-text">{player.matches.length}</strong> appearances on file ·{' '}
              <strong className="text-text">{streamed}</strong> of the {matches.length} shown below
              are in the stream catalogue.
              {player.dateOfBirth ? ` Born ${player.dateOfBirth}.` : ''}
              {player.updatedAt ? ` Feed updated ${player.updatedAt}.` : ''}
            </p>
          </div>
        </div>
      </section>

      {player.seasons.length > 0 && (
        <section className={PANEL}>
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
            <Shirt className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Season totals
          </h2>
          <p className="m-0 mt-1 text-[12px] text-muted">
            Summed over the appearances this feed publishes — not a league-wide table.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className={TH}>Season</th>
                  <th className={TH}>Apps</th>
                  <th className={TH}>Minutes</th>
                  <th className={TH}>Goals</th>
                  <th className={TH}>Assists</th>
                  <th className={TH}>Yellow</th>
                  <th className={TH}>Red</th>
                </tr>
              </thead>
              <tbody>
                {player.seasons.map((season) => (
                  <tr key={season.season} className="border-b border-border-soft last:border-0">
                    <td className={`${TD} font-semibold text-text`}>{season.season}</td>
                    <td className={TD}>{season.matches}</td>
                    <td className={TD}>{season.minutes}</td>
                    <td className={TD}>{season.goals}</td>
                    <td className={TD}>{season.assists}</td>
                    <td className={TD}>{season.yellow}</td>
                    <td className={TD}>{season.red}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={PANEL}>
        <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
          <CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          Match log
        </h2>
        <p className="m-0 mt-1 text-[12px] text-muted">
          {hidden > 0
            ? `Latest ${matches.length} of ${player.matches.length} published appearances.`
            : 'Every appearance this feed publishes.'}
        </p>
        {matches.length > 0 ? (
          <ul className="m-0 list-none p-0">
            {matches.map((match) => (
              <AppearanceRow key={match.matchId} match={match} />
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-2 text-[12px] text-muted">
            This feed publishes no match log for the player yet.
          </p>
        )}
      </section>

      {player.transfers.length > 0 && (
        <section className={PANEL}>
          <h2 className="m-0 text-[15px] font-bold">Transfers</h2>
          <ul className="m-0 list-none p-0">
            {player.transfers.map((transfer) => (
              <TransferRow
                key={`${transfer.season}-${transfer.fromId}-${transfer.toId}`}
                transfer={transfer}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** One line of the transfer record — both clubs named and crested, and both the
 *  name and the crest of each side open that club's page. */
function TransferRow({ transfer }: { transfer: GoalooPlayerTransfer }) {
  const from = clubHref(transfer.fromId);
  const to = clubHref(transfer.toId);
  return (
    <li className="flex flex-wrap items-center gap-2.5 border-b border-border-soft py-2 last:border-0">
      <span className="w-[92px] shrink-0 text-[12px] tabular-nums text-muted">
        {transfer.season}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {from ? (
          <Link
            href={from}
            className="flex min-w-0 items-center gap-2"
            title={`${transfer.fromName} — squad, fixtures & results`}
          >
            <GoalooLogo src={transfer.fromLogo} name={transfer.fromName} size="sm" round />
            <span className="min-w-0 truncate text-[13px] text-muted hover:text-accent">
              {transfer.fromName}
            </span>
          </Link>
        ) : (
          <>
            <GoalooLogo src={transfer.fromLogo} name={transfer.fromName} size="sm" round />
            <span className="min-w-0 truncate text-[13px] text-muted">{transfer.fromName}</span>
          </>
        )}
        <span className="shrink-0 text-muted" aria-hidden="true">
          →
        </span>
        {to ? (
          <Link
            href={to}
            className="flex min-w-0 items-center gap-2"
            title={`${transfer.toName} — squad, fixtures & results`}
          >
            <GoalooLogo src={transfer.toLogo} name={transfer.toName} size="sm" round />
            <span className="min-w-0 truncate text-[13px] font-semibold text-text hover:text-accent">
              {transfer.toName}
            </span>
          </Link>
        ) : (
          <>
            <GoalooLogo src={transfer.toLogo} name={transfer.toName} size="sm" round />
            <span className="min-w-0 truncate text-[13px] font-semibold text-text">
              {transfer.toName}
            </span>
          </>
        )}
      </span>
      {transfer.type && (
        <span className="shrink-0 text-[12px] text-muted max-[640px]:hidden">{transfer.type}</span>
      )}
      {transfer.fee && (
        <span className="shrink-0 text-[12px] font-semibold text-text">{transfer.fee}</span>
      )}
      <span className="hidden shrink-0 text-[12px] tabular-nums text-muted min-[720px]:inline">
        {transfer.fromDate}
        {transfer.toDate ? ` – ${transfer.toDate}` : ''}
      </span>
    </li>
  );
}

