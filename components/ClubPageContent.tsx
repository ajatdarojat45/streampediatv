import type { ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, Play, Shirt, Trophy } from 'lucide-react';
import { GoalooLogo } from '@/components/GoalooLogo';
import { LocalTime } from '@/components/LocalTime';
import { CLUB_FIXTURES, CLUB_RESULTS } from '@/lib/goalooClub';
import { goalooMiniTeamLogoUrl } from '@/lib/goaloo';
import { clubHref, leagueHref, playerHref, watchHref } from '@/lib/sports';
import type { GoalooClub, GoalooClubPerson, GoalooMatchRef, GoalooTransfer } from '@/lib/types';

/** The club feed is a football feed — every link built here is football. */
const FOOTBALL = 1;

/** Surface panel (`.panel`) — the card every page in the app is built from. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Fact chip (the competition page's META_CHIP shape). */
const CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-semibold [&_strong]:text-text';
/** Row of a fixture list. The row itself is one big click target, so its hover
 *  sits on the list item — the club links inside the row are siblings of the
 *  overlay link rather than children of it (an anchor may not wrap an anchor). */
const ROW = 'flex items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px]';
const ROW_ITEM =
  'relative m-0 list-none rounded-[var(--radius-sm)] transition-colors hover:bg-card';
/** The row-wide stream link: an invisible overlay to `/watch/{id}`. */
const ROW_OVERLAY = 'absolute inset-0 rounded-[var(--radius-sm)]';
/** Lifts the two club links above that overlay, so they stay clickable. */
const ROW_SIDES = 'relative z-10 min-w-0 flex-1 truncate';
/** Column widths shared by the two fixture lists, so they read as one table. */
const WHEN = 'w-[124px] shrink-0 text-[12px] text-muted max-[640px]:w-[86px]';
const COMP = 'w-[132px] shrink-0 truncate text-[12px] text-muted max-[640px]:hidden';
const ACTION = 'ml-auto shrink-0';
const WATCH_BADGE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent';
const NO_STREAM =
  'inline-flex items-center whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** Sub-heading inside a panel ("Goalkeepers", "Arrivals", …). */
const GROUP_HEAD = 'm-0 mt-4 text-[12px] font-bold uppercase tracking-[0.06em] text-muted';
const SQUAD_ROW = 'flex items-center gap-2.5 border-b border-border-soft py-2 last:border-0';
/** A squad member's name and photo both lead to his player page. */
const PLAYER_TEXT = 'min-w-0 flex-1 truncate font-semibold text-text';
const PLAYER_LINK = `${PLAYER_TEXT} hover:text-accent`;

/** Age in whole years, floored the way the feed's own page floors it. */
function ageOf(dateOfBirth: string): number {
  const born = Date.parse(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(born)) return 0;
  const days = (Date.now() - born) / 86_400_000;
  return days > 0 ? Math.floor(days / 365.2425) : 0;
}

/** A squad valuation. These numbers are hundredths of the feed's £M unit
 *  (`"40"` is £0.400M) — unlike the club header's value, which the feed already
 *  publishes in millions. */
function personValue(value: string): string {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? `£${(n / 100).toFixed(3)}M` : '';
}

/** One side of a fixture: the club being read is bold text (it is this page),
 *  every other club is a link to its own club page. */
function Side({ team, mine }: { team: GoalooMatchRef['home']; mine: boolean }) {
  if (mine) return <strong className="font-bold text-text">{team.name}</strong>;
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

/** One fixture row of either list. The row-wide link to the streamed match
 *  detail (`/watch/{id}`) is an overlay, so the two club names inside the row can
 *  stay real links to their own club pages. A fixture the join did not find in
 *  the stream catalogue carries no overlay — its clubs still link, and it is
 *  never a dead link. */
function MatchRow({ match, clubId }: { match: GoalooMatchRef; clubId: number }) {
  const label = `${match.home.name} vs ${match.away.name}`;
  const body = (
    <>
      <LocalTime ts={match.kickoff} className={WHEN} />
      {match.competition && <span className={COMP}>{match.competition}</span>}
      <span className={ROW_SIDES}>
        <Side team={match.home} mine={match.home.id === clubId} />
        <span className="mx-1 text-muted">vs</span>
        <Side team={match.away} mine={match.away.id === clubId} />
      </span>
      {match.score && (
        <span className="shrink-0 font-bold tabular-nums text-text">
          {match.score.home}–{match.score.away}
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

/** One squad member — photo and name both lead to his player page, carrying
 *  exactly what the feed publishes about him. */
function SquadRow({ person }: { person: GoalooClubPerson }) {
  const age = ageOf(person.dateOfBirth);
  const value = personValue(person.marketValue);
  const href = playerHref(person.id);
  const face = <GoalooLogo src={person.photo} name={person.name} size="base" round />;
  return (
    <li className={SQUAD_ROW}>
      {href ? (
        <Link
          href={href}
          className="shrink-0"
          aria-label={`${person.name} — profile`}
          title={`${person.name} — profile`}
        >
          {face}
        </Link>
      ) : (
        face
      )}
      <span className="w-8 shrink-0 text-center text-[12px] font-bold tabular-nums text-muted">
        {person.number ? `#${person.number}` : '–'}
      </span>
      {href ? (
        <Link href={href} className={PLAYER_LINK} title={`${person.name} — profile`}>
          {person.name}
        </Link>
      ) : (
        <span className={PLAYER_TEXT}>{person.name}</span>
      )}
      {person.position && (
        <span className="shrink-0 text-[12px] text-muted max-[640px]:hidden">{person.position}</span>
      )}
      {person.country && (
        <span className="shrink-0 text-[12px] text-muted max-[640px]:hidden">{person.country}</span>
      )}
      {age > 0 && (
        <span className="shrink-0 text-[12px] tabular-nums text-muted" title={person.dateOfBirth}>
          {age} yrs
        </span>
      )}
      {value && (
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-text max-[640px]:hidden">
          {value}
        </span>
      )}
    </li>
  );
}

/** Squad groups in reading order — the feed's own four buckets, plus whatever
 *  it did not bucket. */
const SQUAD_GROUPS = [
  { rank: 4, label: 'Goalkeepers' },
  { rank: 3, label: 'Defenders' },
  { rank: 2, label: 'Midfielders' },
  { rank: 1, label: 'Strikers' },
  { rank: 0, label: 'Squad' },
];

/** One panel of the fixtures/results pair. */
function MatchList({
  title,
  icon,
  matches,
  clubId,
  empty,
}: {
  title: string;
  icon: ReactNode;
  matches: GoalooMatchRef[];
  clubId: number;
  empty: string;
}) {
  return (
    <section className={PANEL}>
      <h2 className="m-0 mb-2 flex items-center gap-2 text-[15px] font-bold">
        {icon}
        {title}
      </h2>
      {matches.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {matches.map((m) => (
            <MatchRow key={m.matchId} match={m} clubId={clubId} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[12px] text-muted">{empty}</p>
      )}
    </section>
  );
}

/** One transfer. The feed names the player and the counterpart club's id only,
 *  so the counterpart shows as its crest — linked to that club's page rather
 *  than an invented name. */
function TransferRow({ transfer }: { transfer: GoalooTransfer }) {
  const player = playerHref(transfer.playerId);
  const club = clubHref(transfer.clubId);
  const face = <GoalooLogo src={transfer.photo} name={transfer.playerName} size="sm" round />;
  const crest = (
    <GoalooLogo
      src={goalooMiniTeamLogoUrl(transfer.clubId)}
      name={transfer.joined ? 'From' : 'To'}
      size="sm"
      round
    />
  );
  return (
    <li className="flex items-center gap-2.5 border-b border-border-soft py-2 last:border-0">
      {player ? (
        <Link
          href={player}
          className="shrink-0"
          aria-label={`${transfer.playerName} — profile`}
          title={`${transfer.playerName} — profile`}
        >
          {face}
        </Link>
      ) : (
        face
      )}
      {player ? (
        <Link
          href={player}
          className={PLAYER_LINK}
          title={`${transfer.playerName} — profile`}
        >
          {transfer.playerName}
        </Link>
      ) : (
        <span className={PLAYER_TEXT}>{transfer.playerName}</span>
      )}
      {transfer.clubId > 0 &&
        (club ? (
          <Link
            href={club}
            className="shrink-0"
            aria-label="Counterpart club — squad, fixtures & results"
            title="Counterpart club — squad, fixtures & results"
          >
            {crest}
          </Link>
        ) : (
          crest
        ))}
      {transfer.type && (
        <span className="shrink-0 text-[12px] text-muted max-[640px]:hidden">{transfer.type}</span>
      )}
      {transfer.fee && <span className="shrink-0 text-[12px] font-semibold text-text">{transfer.fee}</span>}
      <span className="shrink-0 text-[12px] tabular-nums text-muted">{transfer.date}</span>
    </li>
  );
}

/** The club page: identity, first team, fixtures, results and the newest
 *  transfer window. Every fixture row carries the stream link the join resolved
 *  (lib/goalooJoin.ts), so a match on this page leads straight into
 *  `/watch/{id}` whenever the stream catalogue knows it. */
export function ClubPageContent({ club }: { club: GoalooClub }) {
  const fixtures = club.fixtures.slice(0, CLUB_FIXTURES);
  const results = club.results.slice(0, CLUB_RESULTS);
  const arrivals = club.transfers.filter((t) => t.joined);
  const departures = club.transfers.filter((t) => !t.joined);
  const shown = [...fixtures, ...results];
  const streamed = shown.filter((m) => m.streamId > 0).length;
  const groups = SQUAD_GROUPS.map((g) => ({
    ...g,
    people: club.squad.filter((p) => p.positionRank === g.rank),
  })).filter((g) => g.people.length > 0);
  const coachHref = club.coach ? playerHref(club.coach.id) : '';

  return (
    <>
      <section className={PANEL}>
        <div className="flex items-start gap-4">
          <GoalooLogo src={club.logo} name={club.name} size="lg" />
          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-muted">Club</span>
            <h1 className="m-0 mt-1 text-[22px] font-extrabold leading-tight">{club.name}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {club.leagueName &&
                (club.leagueStreamId > 0 ? (
                  <Link
                    href={leagueHref(club.leagueStreamId, FOOTBALL)}
                    className={`${CHIP} hover:border-[#c7ccd2] hover:text-text`}
                    title={`${club.leagueName} — fixtures, results & live streams`}
                  >
                    <Trophy size={12} aria-hidden="true" />
                    {club.leagueName}
                  </Link>
                ) : (
                  <span className={CHIP}>
                    <Trophy size={12} aria-hidden="true" />
                    {club.leagueName}
                  </span>
                ))}
              {club.city && <span className={CHIP}>{club.city}</span>}
              {club.stadium && <span className={CHIP}>{club.stadium}</span>}
              {club.capacity && (
                <span className={CHIP}>
                  Capacity <strong>{club.capacity}</strong>
                </span>
              )}
              {club.founded && (
                <span className={CHIP}>
                  Founded <strong>{club.founded}</strong>
                </span>
              )}
              {club.marketValue && (
                <span className={CHIP}>
                  Squad value <strong>£{club.marketValue}M</strong>
                </span>
              )}
              {club.avgAge && (
                <span className={CHIP}>
                  Average age <strong>{club.avgAge}</strong>
                </span>
              )}
            </div>
            {club.coach && (
              <p className="m-0 mt-2 text-[13px] text-muted">
                Coach{' '}
                {coachHref ? (
                  <Link
                    href={coachHref}
                    className="font-semibold text-text hover:text-accent"
                    title={`${club.coach.name} — profile`}
                  >
                    {club.coach.name}
                  </Link>
                ) : (
                  <strong className="font-semibold text-text">{club.coach.name}</strong>
                )}
              </p>
            )}
            <p className="m-0 mt-2 text-[12px] leading-[1.6] text-muted">
              <strong className="text-text">{club.squad.length}</strong> players ·{' '}
              <strong className="text-text">{club.results.length}</strong> results ·{' '}
              <strong className="text-text">{club.fixtures.length}</strong> fixtures on file ·{' '}
              <strong className="text-text">{streamed}</strong> of the {shown.length} matches shown
              below are in the stream catalogue.
              {club.updatedAt ? ` Feed updated ${club.updatedAt}.` : ''}
            </p>
          </div>
        </div>
      </section>

      <MatchList
        title="Upcoming fixtures"
        icon={<CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
        matches={fixtures}
        clubId={club.id}
        empty="The feed publishes no fixture ahead for this club yet."
      />

      <MatchList
        title="Recent results"
        icon={<CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
        matches={results}
        clubId={club.id}
        empty="The feed publishes no played match for this club yet."
      />

      {groups.length > 0 && (
        <section className={PANEL}>
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
            <Shirt className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Squad
          </h2>
          <p className="m-0 mt-1 text-[12px] text-muted">
            As published by the club feed — positions are the feed&rsquo;s own groups.
          </p>
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className={GROUP_HEAD}>{group.label}</h3>
              <ul className="m-0 list-none p-0">
                {group.people.map((person) => (
                  <SquadRow key={person.id} person={person} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {club.transfers.length > 0 && (
        <section className={PANEL}>
          <h2 className="m-0 text-[15px] font-bold">
            Transfers{club.transferYears[0] ? ` ${club.transferYears[0]}` : ''}
          </h2>
          <p className="m-0 mt-1 text-[12px] text-muted">
            The feed publishes each counterpart club by id, so it is shown as its crest — and each
            crest opens that club&rsquo;s page.
          </p>
          {arrivals.length > 0 && (
            <>
              <h3 className={GROUP_HEAD}>Arrivals</h3>
              <ul className="m-0 list-none p-0">
                {arrivals.map((transfer) => (
                  <TransferRow key={`${transfer.playerId}-in`} transfer={transfer} />
                ))}
              </ul>
            </>
          )}
          {departures.length > 0 && (
            <>
              <h3 className={GROUP_HEAD}>Departures</h3>
              <ul className="m-0 list-none p-0">
                {departures.map((transfer) => (
                  <TransferRow key={`${transfer.playerId}-out`} transfer={transfer} />
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}


