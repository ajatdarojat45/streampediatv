import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  Play,
  Trophy,
  Users,
} from 'lucide-react';
import {
  ClubCompetitionFilter,
  ClubLeagueSeasonPicker,
  ClubYearFilter,
} from '@/components/ClubFilters';
import { ClubSquadStats } from '@/components/ClubSquadStats';
import { ClubStandingsTable } from '@/components/ClubStandingsTable';
import { GoalooLogo } from '@/components/GoalooLogo';
import { MatchLinkCard } from '@/components/Match';
import { clubCompetitionList, clubCompetitionRefs } from '@/lib/clubLeagues';
import { CLUB_FIXTURES, CLUB_RESULTS } from '@/lib/goalooClub';
import { goalooMiniTeamLogoUrl } from '@/lib/goaloo';
import { matchLabel } from '@/lib/matchProto';
import { clubHref, leagueHref, playerHref, watchHref } from '@/lib/sports';
import type {
  ClubLeagueOption,
  ClubPlayerView,
  ClubTab,
  GoalooClub,
  GoalooClubPerson,
  GoalooClubSchedulePage,
  GoalooMatchRef,
  GoalooTransfer,
  LeaguePlayerTotals,
  LeagueStandings,
  Match,
  TransferDirection,
} from '@/lib/types';

/** The club feed is a football feed — every link built here is football. */
const FOOTBALL = 1;

/** Surface panel (`.panel`) — the card every page in the app is built from. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Fact chip (the competition page's META_CHIP shape). */
const CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-semibold [&_strong]:text-text';
/** A list of match cards — one sport-category card per row, the way the player
 *  page's match log draws them. */
const CARD_LIST = 'm-0 flex list-none flex-col gap-2 p-0';
/** Sub-heading inside a panel ("Goalkeepers", "Arrivals", …). */
const GROUP_HEAD = 'm-0 mt-4 text-[12px] font-bold uppercase tracking-[0.06em] text-muted';
const SQUAD_ROW = 'flex items-center gap-2.5 border-b border-border-soft py-2 last:border-0';
/** A squad member's name and photo both lead to his player page. */
const PLAYER_TEXT = 'min-w-0 flex-1 truncate font-semibold text-text';
const PLAYER_LINK = `${PLAYER_TEXT} hover:text-accent`;

/** Panel tab pills — the same active/idle pair the competition page draws. */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
const TAB_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const TAB_COUNT_IDLE = `${TAB_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const TAB_COUNT_ACTIVE = `${TAB_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;
/** Sub-tab strip (Line up / Player data, Transfers in / out) — the watch page's
 *  underlined tabs, which is what marks the second level of a panel. */
const SUB = '-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-semibold transition-colors';
const SUB_IDLE = `${SUB} border-transparent text-muted hover:text-text`;
const SUB_ACTIVE = `${SUB} border-accent text-accent`;
/** Pager buttons (the same pill chrome the filter row uses). */
const PAGE_BTN =
  'inline-flex min-w-9 cursor-pointer items-center justify-center gap-1 rounded-full border border-border bg-panel px-3 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:border-[#c7ccd2] hover:text-text';
const PAGE_ON = 'inline-flex min-w-9 items-center justify-center rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-[13px] font-bold text-accent';
const PAGE_OFF = 'inline-flex min-w-9 cursor-not-allowed items-center justify-center rounded-full border border-border bg-panel px-3 py-1.5 text-[13px] font-semibold text-muted opacity-45';
const PAGE_GAP = 'px-1 text-[13px] text-muted';
/** What a panel says when the app has nothing to draw. */
const NOTICE =
  'm-0 rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted';

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

/** One row of a Goaloo club feed turned into the sport category's own match
 *  payload, so every list on this page draws the shared match card (components/
 *  Match) exactly as the player page's match log does — instead of this page
 *  keeping a row of its own.
 *
 *  The feed names the competition but identifies it by a bare Goaloo id, so the
 *  card's league badge — its crest, its name and the `/competition/{id}` it opens
 *  — comes from the catalogue (lib/clubLeagues). `leagueId` is therefore the
 *  RBLINK league id, not the feed's; a competition the catalogue pairs no stream
 *  with leaves the badge plain text rather than a dead link. `status` is the
 *  card's own vocabulary: a row the feed published a score for is a finished
 *  match (10000, the gray accent), everything else is still to come. */
function matchCardOf(match: GoalooMatchRef): Match {
  const refs = clubCompetitionRefs(match.leagueId);
  return {
    matchId: match.matchId,
    sportType: FOOTBALL,
    matchDate: match.kickoff,
    status: match.score ? 10000 : 0,
    league: {
      sportType: FOOTBALL,
      leagueId: refs.streamId || undefined,
      name: match.competition || refs.name || 'Football',
      logo: refs.logo,
    },
    home: { teamId: match.home.id, clubId: match.home.id, name: match.home.name },
    away: { teamId: match.away.id, clubId: match.away.id, name: match.away.name },
    homeScore: match.score?.home,
    awayScore: match.score?.away,
  };
}

/** One match row of any list on this page — a fixture, a result or a schedule
 *  row — as the sport category's own card (components/Match). The card's link to
 *  the streamed match detail (`/watch/{id}`) is an overlay, so the two clubs
 *  inside it stay real links to their own club pages (and the club being read
 *  links back to this very page). A match the join did not find in the stream
 *  catalogue carries no overlay at all — its clubs still link, and it is never a
 *  dead link. */
function MatchCard({ match }: { match: GoalooMatchRef }) {
  const card = matchCardOf(match);
  const label = matchLabel(card);
  return (
    <li className="m-0 list-none">
      <MatchLinkCard
        match={card}
        href={match.streamId > 0 ? watchHref(match.streamId, FOOTBALL) : ''}
        label={match.streamId > 0 ? `${label} — live stream` : label}
        crest="goaloo"
      />
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
 *  it did not bucket. The Line up panel draws them top (goalkeepers) to bottom
 *  (strikers), the way a team sheet is read. */
const SQUAD_GROUPS = [
  { rank: 4, label: 'Goalkeepers', short: 'GK' },
  { rank: 3, label: 'Defenders', short: 'DF' },
  { rank: 2, label: 'Midfielders', short: 'MF' },
  { rank: 1, label: 'Strikers', short: 'FW' },
  { rank: 0, label: 'Squad', short: '—' },
];

/** One transfer. The feed names the player and the counterpart club by id only;
 *  the club's NAME comes from the app's own club index (lib/goalooTeams), so the
 *  row shows a real club instead of inventing one — and both the crest and the
 *  name lead into that club's page. */
function TransferRow({ transfer }: { transfer: GoalooTransfer }) {
  const player = playerHref(transfer.playerId);
  const club = clubHref(transfer.clubId);
  const face = <GoalooLogo src={transfer.photo} name={transfer.playerName} size="sm" round />;
  const counterpart = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <GoalooLogo
        src={goalooMiniTeamLogoUrl(transfer.clubId)}
        name={transfer.clubName || 'Club'}
        size="sm"
        round
      />
      {transfer.clubName && (
        <span className="min-w-0 truncate text-[12px] text-muted max-[640px]:hidden">
          {transfer.clubName}
        </span>
      )}
    </span>
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
        <Link href={player} className={PLAYER_LINK} title={`${transfer.playerName} — profile`}>
          {transfer.playerName}
        </Link>
      ) : (
        <span className={PLAYER_TEXT}>{transfer.playerName}</span>
      )}
      {transfer.clubId > 0 &&
        (club ? (
          <Link
            href={club}
            className="ml-auto shrink-0"
            aria-label={`${transfer.clubName || 'Counterpart club'} — squad, fixtures & results`}
            title={`${transfer.clubName || 'Counterpart club'} — squad, fixtures & results`}
          >
            {counterpart}
          </Link>
        ) : (
          <span className="ml-auto shrink-0">{counterpart}</span>
        ))}
      {transfer.type && (
        <span className="shrink-0 text-[12px] text-muted max-[640px]:hidden">{transfer.type}</span>
      )}
      {transfer.fee && <span className="shrink-0 text-[12px] font-semibold text-text">{transfer.fee}</span>}
      <span className="shrink-0 text-[12px] tabular-nums text-muted">{transfer.date}</span>
    </li>
  );
}

/** The club's last few results as W/D/L, read off the score the feed published
 *  for a row that names this club on one side (the club feed's own history rows
 *  are newest first). A row without a published score contributes nothing, which
 *  is why fewer than `count` chips can come back. */
function formOf(clubId: number, results: GoalooMatchRef[], count: number): ('W' | 'D' | 'L')[] {
  const out: ('W' | 'D' | 'L')[] = [];
  for (const match of results) {
    if (out.length >= count) break;
    if (!match.score) continue;
    const home = match.home.id === clubId;
    const mine = home ? match.score.home : match.score.away;
    const theirs = home ? match.score.away : match.score.home;
    out.push(mine > theirs ? 'W' : mine === theirs ? 'D' : 'L');
  }
  return out;
}

/** One panel tab, as a link: the panel rides in the URL, so a tab is shareable,
 *  reloadable and rendered by the server — the arrangement the player page's own
 *  tabs use (app/player/[id]/page.tsx). Overview is the page's default, so it
 *  needs no key at all. */
function TabLink({
  clubId,
  tab,
  active,
  count,
  children,
}: {
  clubId: number;
  tab: ClubTab;
  active: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={tab === 'overview' ? `/club/${clubId}` : `/club/${clubId}?tab=${tab}`}
      className={active ? TAB_ACTIVE : TAB_IDLE}
      aria-current={active ? 'page' : undefined}
      scroll={false}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={active ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>{count}</span>
      )}
    </Link>
  );
}

/** A sub-tab of the open panel — the second level (Line up / Player data,
 *  Transfers in / out), drawn as the watch page's underlined tabs. */
function SubTabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={active ? SUB_ACTIVE : SUB_IDLE}
      aria-current={active ? 'page' : undefined}
      scroll={false}
    >
      {children}
    </Link>
  );
}

/** What a panel says when the app has no rows for it — never a broken layout. */
function PanelNotice({ children }: { children: ReactNode }) {
  return <p className={NOTICE}>{children}</p>;
}

/** What a panel says when the request behind it failed. */
function PanelError({ message }: { message: string }) {
  return (
    <p className="m-0 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] break-words text-[#c5221f] [[data-theme=dark]_&]:text-[#fca5a5]">
      {message}
    </p>
  );
}

/** The page numbers a pager draws: both ends, a window around the open page, and
 *  a gap where numbers were skipped — a club's schedule can run to 121 pages. */
function pageWindow(page: number, total: number): (number | 'gap')[] {
  const out: (number | 'gap')[] = [];
  for (let n = 1; n <= total; n += 1) {
    if (n === 1 || n === total || Math.abs(n - page) <= 1) out.push(n);
    else if (out[out.length - 1] !== 'gap') out.push('gap');
  }
  return out;
}

/** The Schedule panel's pager. Every control is a real link, so a page of the
 *  schedule is a URL: the competition filter travels with the page number, and
 *  the active page is a `<span>` because a page never links to itself. */
function SchedulePager({
  clubId,
  comp,
  page,
  totalPages,
}: {
  clubId: number;
  comp: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (n: number): string => {
    const q = new URLSearchParams({ tab: 'schedule' });
    if (comp) q.set('comp', comp);
    if (n > 1) q.set('page', String(n));
    return `/club/${clubId}?${q}`;
  };
  return (
    <nav className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Schedule pages">
      {page > 1 ? (
        <Link href={href(page - 1)} className={PAGE_BTN} rel="prev" scroll={false}>
          <ChevronLeft size={15} aria-hidden="true" />
          Prev
        </Link>
      ) : (
        <span className={PAGE_OFF}>
          <ChevronLeft size={15} aria-hidden="true" />
          Prev
        </span>
      )}
      {pageWindow(page, totalPages).map((entry, i) =>
        entry === 'gap' ? (
          <span key={`gap-${i}`} className={PAGE_GAP} aria-hidden="true">
            …
          </span>
        ) : entry === page ? (
          <span key={entry} className={PAGE_ON} aria-current="page">
            {entry}
          </span>
        ) : (
          <Link key={entry} href={href(entry)} className={PAGE_BTN} scroll={false}>
            {entry}
          </Link>
        )
      )}
      {page < totalPages ? (
        <Link href={href(page + 1)} className={PAGE_BTN} rel="next" scroll={false}>
          Next
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      ) : (
        <span className={PAGE_OFF}>
          Next
          <ChevronRight size={15} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

/** The competition × season a table was read from — the competition's own crest
 *  and name (a link into `/competition/{id}`), then the season. */
function LeagueCaption({ league, season }: { league: ClubLeagueOption; season: string }) {
  const href = leagueHref(league.streamId, FOOTBALL);
  return (
    <p className="m-0 mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
      <GoalooLogo src={league.logo} name={league.name} size="xs" />
      <span>
        Showing{' '}
        {href ? (
          <Link
            href={href}
            title={`${league.name} — fixtures, results & standings`}
            className="font-bold text-text no-underline transition-colors hover:text-accent hover:underline"
          >
            {league.name}
          </Link>
        ) : (
          <strong className="text-text">{league.name}</strong>
        )}{' '}
        · <strong className="text-text">{season || 'Current season'}</strong>
      </span>
    </p>
  );
}

/** Form chips — the club's last few results, one colour per outcome. */
const FORM: Record<'W' | 'D' | 'L', string> = {
  W: 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(34,197,94,0.16)] text-[11px] font-bold text-[#15803d] [[data-theme=dark]_&]:text-[#4ade80]',
  D: 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f1f3f4] text-[11px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft',
  L: 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(239,68,68,0.14)] text-[11px] font-bold text-[#b91c1c] [[data-theme=dark]_&]:text-[#fca5a5]',
};

/** A panel's own heading, with an optional "see all" link into another tab. */
function SectionHead({
  icon,
  title,
  href,
  linkLabel,
}: {
  icon: ReactNode;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <h2 className="m-0 mb-2 flex items-center gap-2 text-[15px] font-bold">
      {icon}
      <span className="min-w-0 truncate">{title}</span>
      {href && (
        <Link
          href={href}
          className="ml-auto shrink-0 text-[12px] font-semibold text-accent no-underline hover:underline"
          scroll={false}
        >
          {linkLabel ?? 'See all'}
        </Link>
      )}
    </h2>
  );
}

/**
 * Everything the open panel needs, resolved by the server page: the club payload
 * always, plus the payload of the panel being rendered — and only that one, so
 * opening `/club/100` never fetches a schedule page, a transfer year or a league
 * table nobody asked for.
 */
export interface ClubPanel {
  /** The panel the URL asked for. */
  tab: ClubTab;
  /** Schedule: the page of the feed's schedule ajax that is open. */
  schedule: GoalooClubSchedulePage | null;
  /** Schedule: the competition filter, "" = every competition. */
  comp: string;
  /** Players: which sub-panel is open. */
  view: ClubPlayerView;
  /** Players → Player data: the competition's totals for the open pair. */
  totals: LeaguePlayerTotals | null;
  /** Transfers: the year and the direction the panel shows, plus its rows. */
  year: string;
  dir: TransferDirection;
  transfers: GoalooTransfer[] | null;
  /** Standing: the competition's table for the open pair. */
  standings: LeagueStandings | null;
  /** The competitions the Standing and Player data panels can read. */
  leagues: ClubLeagueOption[];
  /** The one those panels are reading (null when the club has none). */
  league: ClubLeagueOption | null;
  /** Its seasons, newest first, for the picker. */
  seasons: { id: string; label: string }[];
  /** The season the open pair reads — an id the competition itself publishes,
   *  "" only when it published no season list at all. */
  season: string;
  /** Why the open panel has nothing to show, when the app knows — "" otherwise. */
  error: string;
}

/**
 * The club page: one panel at a time — an overview, the feed's own schedule
 * (paged, filterable by competition), the players (the team sheet, and the
 * competition's own totals for them), the transfer windows, and the standing
 * table of a competition the club plays in.
 *
 * The club payload decides the header and the Overview; every other panel is
 * resolved by the page for the panel the URL asks for (app/club/[id]/page.tsx) —
 * the tab, the page, the competition, the season, the direction and the year all
 * ride in the query string, so each view is a linkable, reloadable URL and the
 * server decides what gets fetched.
 *
 * A club name inside a match row never becomes a dead link either: every list on
 * this page draws the sport category's own match card (components/Match), so both
 * clubs link to their own pages, and a row the join found no stream for simply
 * carries no `/watch/{id}` overlay.
 */
export function ClubPageContent({ club, panel }: { club: GoalooClub; panel: ClubPanel }) {
  const fixtures = club.fixtures.slice(0, CLUB_FIXTURES);
  const results = club.results.slice(0, CLUB_RESULTS);
  const coachHref = club.coach ? playerHref(club.coach.id) : '';
  const competitions = clubCompetitionList(club);
  const groups = SQUAD_GROUPS.map((g) => ({
    ...g,
    people: club.squad.filter((p) => p.positionRank === g.rank),
  })).filter((g) => g.people.length > 0);
  const form = formOf(club.id, club.results, 5);
  const shown = [...fixtures, ...results];
  const streamed = shown.filter((m) => m.streamId > 0).length;
  const arrivals = (panel.transfers ?? []).filter((t) => t.joined);
  const departures = (panel.transfers ?? []).filter((t) => !t.joined);
  /** The rows the open sub-tab of the Transfers panel draws. */
  const windowRows = panel.dir === 'in' ? arrivals : departures;
  const seasonLabel = panel.season
    ? panel.seasons.find((s) => s.id === panel.season)?.label ?? panel.season
    : 'Current season';
  const compName = panel.comp
    ? competitions.find((c) => String(c.id) === panel.comp)?.name ?? ''
    : '';
  const transfersHref = (dir: TransferDirection): string =>
    `/club/${club.id}?tab=transfers&dir=${dir}${panel.year ? `&year=${panel.year}` : ''}`;
  const dataHref = ((): string => {
    const q = new URLSearchParams({ tab: 'players', view: 'data' });
    if (panel.league) q.set('league', String(panel.league.streamId));
    if (panel.season) q.set('season', panel.season);
    return `/club/${club.id}?${q}`;
  })();

  return (
    <>
      {/* 1. Header — identity, the facts the feed publishes and the coach. Every
             panel below shares it, so the club is never out of sight. */}
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
          </div>
        </div>
      </section>

      {/* 2. Tabs — one panel at a time. Each one is a link, so the panel is part
             of the URL: shareable, reloadable and rendered by the server.
             The feed's own clock rides *beside* the strip, never inside it: a
             tablist holds nothing but its tabs, and as a flex item of the strip
             this span was the one thing too wide for the row — it pushed the
             strip past the panel and clipped its own tail. Out here the strip
             keeps the width its tabs need, and when the two no longer fit on one
             line the clock simply drops to a line of its own. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <section
          className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          <TabLink clubId={club.id} tab="overview" active={panel.tab === 'overview'}>
            Overview
          </TabLink>
          <TabLink
            clubId={club.id}
            tab="schedule"
            active={panel.tab === 'schedule'}
            count={club.results.length + club.fixtures.length}
          >
            Schedule
          </TabLink>
          <TabLink
            clubId={club.id}
            tab="players"
            active={panel.tab === 'players'}
            count={club.squad.length}
          >
            Players
          </TabLink>
          <TabLink clubId={club.id} tab="transfers" active={panel.tab === 'transfers'}>
            Transfers
          </TabLink>
          <TabLink clubId={club.id} tab="standing" active={panel.tab === 'standing'}>
            Standing
          </TabLink>
        </section>
        {club.updatedAt && (
          <span className="ml-auto shrink-0 text-[12px] text-muted max-[640px]:hidden">
            Feed updated {club.updatedAt}
          </span>
        )}
      </div>

      {/* 3. The Overview panel — everything the club payload itself answers. */}
      {panel.tab === 'overview' && (
        <>
          <section className={PANEL}>
            <SectionHead
              icon={<Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              title="At a glance"
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {form.length > 0 && (
                <span className={CHIP}>
                  Form
                  {form.map((outcome, i) => (
                    <strong
                      key={`${outcome}-${i}`}
                      className={FORM[outcome]}
                      title={outcome === 'W' ? 'Won' : outcome === 'D' ? 'Drew' : 'Lost'}
                    >
                      {outcome}
                    </strong>
                  ))}
                </span>
              )}
              <span className={CHIP}>
                Players <strong>{club.squad.length}</strong>
              </span>
              <span className={CHIP}>
                Results on file <strong>{club.results.length}</strong>
              </span>
              <span className={CHIP}>
                Fixtures ahead <strong>{club.fixtures.length}</strong>
              </span>
              {club.transferYears[0] && club.transfers.length > 0 && (
                <span className={CHIP}>
                  {club.transferYears[0]} window <strong>{club.transfers.length}</strong>
                </span>
              )}
            </div>
            <p className="m-0 mt-3 text-[12px] leading-[1.6] text-muted">
              <strong className="text-text">{streamed}</strong> of the {shown.length} matches shown
              on this page are in the stream catalogue, and each of those opens its live stream.
              The first team, the full schedule, the transfer windows and a competition&rsquo;s own
              table each have a tab above.
            </p>
          </section>

          <section className={PANEL}>
            <SectionHead
              icon={<CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              title="Next up"
              href={`/club/${club.id}?tab=schedule`}
              linkLabel="Full schedule"
            />
            {fixtures.length > 0 ? (
              <ul className={`${CARD_LIST} mt-3`}>
                {fixtures.slice(0, 3).map((match) => (
                  <MatchCard key={match.matchId} match={match} />
                ))}
              </ul>
            ) : (
              <PanelNotice>The feed publishes no fixture ahead for this club yet.</PanelNotice>
            )}
          </section>

          <section className={PANEL}>
            <SectionHead
              icon={<Play className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              title="Recent results"
              href={`/club/${club.id}?tab=schedule`}
              linkLabel="Full schedule"
            />
            {results.length > 0 ? (
              <ul className={`${CARD_LIST} mt-3`}>
                {results.slice(0, 5).map((match) => (
                  <MatchCard key={match.matchId} match={match} />
                ))}
              </ul>
            ) : (
              <PanelNotice>The feed publishes no played match for this club yet.</PanelNotice>
            )}
          </section>

          {club.honours.length > 0 && (
            <section className={PANEL}>
              <SectionHead
                icon={<Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
                title="Honours"
              />
              <ul className="m-0 list-none p-0">
                {club.honours.map((honour, i) => (
                  <li
                    key={`${honour.title}-${i}`}
                    className="flex items-baseline gap-2.5 border-b border-border-soft py-2 last:border-0"
                  >
                    <span className="min-w-0 flex-1 font-semibold text-text">{honour.title}</span>
                    {honour.years && (
                      <span className="shrink-0 text-right text-[12px] tabular-nums text-muted">
                        {honour.years}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* 4. The Schedule panel — the feed's own paged schedule, newest first,
             optionally narrowed to one of the competitions the club plays in. */}
      {panel.tab === 'schedule' && (
        <section className={PANEL}>
          <SectionHead
            icon={<CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            title="Schedule"
          />
          <p className="m-0 mb-3 text-[12px] text-muted">
            The club feed&rsquo;s own schedule, newest first, ten matches a page
            {compName ? ` — ${compName} only` : ''}. A played match keeps the score the feed
            published with it, and a row the stream catalogue knows opens its live stream.
          </p>
          <ClubCompetitionFilter clubId={club.id} options={competitions} value={panel.comp} />
          {panel.error ? (
            <PanelError message={panel.error} />
          ) : !panel.schedule ? (
            <PanelNotice>The feed did not answer for this page of the schedule.</PanelNotice>
          ) : panel.schedule.matches.length === 0 ? (
            <PanelNotice>
              The feed publishes no match on this page
              {compName ? ` of ${compName}` : ''}.
            </PanelNotice>
          ) : (
            <>
              <ul className={CARD_LIST}>
                {panel.schedule.matches.map((match) => (
                  <MatchCard key={match.matchId} match={match} />
                ))}
              </ul>
              <p className="m-0 mt-3 text-[12px] text-muted">
                Page <strong className="text-text">{panel.schedule.page}</strong> of{' '}
                <strong className="text-text">{panel.schedule.totalPages}</strong>
              </p>
              <SchedulePager
                clubId={club.id}
                comp={panel.comp}
                page={panel.schedule.page}
                totalPages={panel.schedule.totalPages}
              />
            </>
          )}
        </section>
      )}

      {/* 5. The Players panel — its two sub-panels: the team sheet the club feed
             publishes, and the competition's own totals for the squad. */}
      {panel.tab === 'players' && (
        <section className={PANEL}>
          <SectionHead
            icon={<Users className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            title="Players"
          />
          <div
            className="mb-3 flex flex-nowrap items-stretch gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            <SubTabLink href={`/club/${club.id}?tab=players`} active={panel.view === 'lineup'}>
              Line up
            </SubTabLink>
            <SubTabLink href={dataHref} active={panel.view === 'data'}>
              Player data
            </SubTabLink>
          </div>

          {panel.view === 'lineup' ? (
            <>
              <p className="m-0 text-[12px] text-muted">
                The first team exactly as the club feed publishes it —{' '}
                {groups.length > 0
                  ? groups
                      .map((group) => `${group.people.length} ${group.label.toLowerCase()}`)
                      .join(' · ')
                  : 'no squad group is published'}
                {club.coach ? ' — with the coach the header above names' : ''}. Positions are the
                feed&rsquo;s own groups, and every name and photo leads to that player&rsquo;s page.
              </p>
              {groups.length > 0 ? (
                groups.map((group) => (
                  <div key={group.label}>
                    <h3 className={GROUP_HEAD}>
                      {group.label} ({group.people.length})
                    </h3>
                    <ul className="m-0 list-none p-0">
                      {group.people.map((person) => (
                        <SquadRow key={person.id} person={person} />
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <PanelNotice>The feed publishes no first-team squad for this club.</PanelNotice>
              )}
            </>
          ) : (
            <>
              {panel.league && (
                <ClubLeagueSeasonPicker
                  clubId={club.id}
                  tab="players"
                  options={panel.leagues}
                  leagueId={panel.league.streamId}
                  seasons={panel.seasons}
                  season={panel.season}
                />
              )}
              {panel.league && <LeagueCaption league={panel.league} season={seasonLabel} />}
              {panel.error ? (
                <PanelError message={panel.error} />
              ) : !panel.league ? (
                <PanelNotice>
                  None of this club&rsquo;s competitions is part of the stream catalogue, so there
                  is no player table to read for it.
                </PanelNotice>
              ) : panel.totals ? (
                <ClubSquadStats totals={panel.totals} clubId={club.id} squad={club.squad} />
              ) : (
                <PanelNotice>
                  The competition did not answer with a player table for that season.
                </PanelNotice>
              )}
            </>
          )}
        </section>
      )}

      {/* 6. The Transfers panel — its two sub-panels (in / out) for one year of
             the feed's own transfer record. */}
      {panel.tab === 'transfers' && (
        <section className={PANEL}>
          <SectionHead
            icon={<History className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            title={panel.year ? `Transfers ${panel.year}` : 'Transfers'}
          />
          <div
            className="mb-3 flex flex-nowrap items-stretch gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            <SubTabLink href={transfersHref('in')} active={panel.dir === 'in'}>
              Transfers in{panel.transfers ? ` (${arrivals.length})` : ''}
            </SubTabLink>
            <SubTabLink href={transfersHref('out')} active={panel.dir === 'out'}>
              Transfers out{panel.transfers ? ` (${departures.length})` : ''}
            </SubTabLink>
          </div>
          <p className="m-0 mb-3 text-[12px] text-muted">
            The feed publishes several decades of transfer windows for a club and serves one year per
            request, so the year picker decides which one is read. A counterpart club is published by
            id alone — its name is read from the app&rsquo;s own club index (lib/goalooTeams), and both
            the crest and the name lead into that club&rsquo;s page.
          </p>
          <ClubYearFilter clubId={club.id} years={club.transferYears} value={panel.year} />
          {panel.error ? (
            <PanelError message={panel.error} />
          ) : !panel.year ? (
            <PanelNotice>The feed publishes no transfer year for this club.</PanelNotice>
          ) : !panel.transfers ? (
            <PanelNotice>The feed did not answer for {panel.year}.</PanelNotice>
          ) : windowRows.length === 0 ? (
            <PanelNotice>
              The feed publishes no transfer {panel.dir === 'in' ? 'into' : 'out of'} the club in{' '}
              {panel.year}.
            </PanelNotice>
          ) : (
            <ul className="m-0 list-none p-0">
              {windowRows.map((transfer) => (
                <TransferRow key={`${transfer.playerId}-${transfer.date}`} transfer={transfer} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 7. The Standing panel — one of the club's competitions and one of its
             seasons, with the club's own row marked in the table. */}
      {panel.tab === 'standing' && (
        <section className={PANEL}>
          <SectionHead
            icon={<Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            title="Standing"
          />
          <p className="m-0 mb-3 text-[12px] text-muted">
            A competition this club plays in, and the season to read it for. The Goaloo host publishes
            no league table, so the table itself comes from the app&rsquo;s own league feed — the very
            one the competition pages draw — and only the competitions that feed also knows are
            offered here.
          </p>
          {panel.league && (
            <ClubLeagueSeasonPicker
              clubId={club.id}
              tab="standing"
              options={panel.leagues}
              leagueId={panel.league.streamId}
              seasons={panel.seasons}
              season={panel.season}
            />
          )}
          {panel.league && <LeagueCaption league={panel.league} season={seasonLabel} />}
          {panel.error ? (
            <PanelError message={panel.error} />
          ) : !panel.league ? (
            <PanelNotice>
              None of this club&rsquo;s competitions is part of the stream catalogue, so there is no
              table to read for it.
            </PanelNotice>
          ) : !panel.standings ? (
            <PanelNotice>The competition did not answer with a table for that season.</PanelNotice>
          ) : panel.standings.rows.length === 0 ? (
            <PanelNotice>The competition publishes no table for that season.</PanelNotice>
          ) : (
            <ClubStandingsTable standings={panel.standings} highlightClubId={club.id} />
          )}
        </section>
      )}
    </>
  );
}
