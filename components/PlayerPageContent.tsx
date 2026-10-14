import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Radar,
  Share2,
  Shield,
  Shirt,
  Star,
  Target,
} from 'lucide-react';
import { GoalooLogo } from '@/components/GoalooLogo';
import { MatchLinkCard } from '@/components/Match';
import { PlayerRadar } from '@/components/PlayerRadar';
import { PlayerTechPicker, type PlayerTechGroup } from '@/components/PlayerTechPicker';
import { PLAYER_MATCHES_PER_PAGE, PLAYER_RECENT_MATCHES } from '@/lib/goalooPlayer';
import { matchLabel } from '@/lib/matchProto';
import { clubHref, leagueHref, watchHref } from '@/lib/sports';
import type {
  GoalooPlayer,
  GoalooPlayerMatch,
  GoalooPlayerTech,
  GoalooPlayerTransfer,
  Match,
} from '@/lib/types';

/** The player feed is a football feed — every link built here is football. */
const FOOTBALL = 1;

const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
const CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-semibold [&_strong]:text-text';
/** The match log: one sport-category card per appearance. */
const CARD_LIST = 'm-0 flex list-none flex-col gap-2 p-0';
const WATCH_BADGE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent';
const NO_STREAM =
  'inline-flex items-center whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** One of the player's own numbers on a match card ("68'", "2 goals", "7.70"). */
const MARK =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border-soft bg-panel px-2 py-0.5 text-[11px] font-semibold text-muted';
/** The personal strip under a card's body — the player's line for that match. */
const MARK_STRIP =
  'mt-2 flex flex-wrap items-center justify-center gap-1.5 border-t border-border-soft pt-2';
/** The feed's own card, drawn as the small swatch its page prints beside the
 *  counts: 8×11mm-ish yellow or red, exactly the two colours it uses. */
const CARD_SWATCH = 'h-[11px] w-2 shrink-0 rounded-[2px]';
const CARD_YELLOW = '#f2c31c';
const CARD_RED = '#d93025';
/** Season table chrome — the metrics the competition tables use. */
const TH = 'py-2 pr-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
const TD = 'py-1.5 pr-3 tabular-nums';
/** Tab pills — the same active/idle pair the competition page's tabs use, drawn
 *  as links so every panel is a URL of its own. */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
const TAB_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const TAB_COUNT_IDLE = `${TAB_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const TAB_COUNT_ACTIVE = `${TAB_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;
/** Match-log pager — the feed paginates the same log 10 rows at a time. */
const PAGE =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[12px] font-semibold tabular-nums transition-colors';
const PAGE_IDLE = `${PAGE} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const PAGE_ON = `${PAGE} border-accent bg-accent-soft text-accent`;
const PAGE_OFF = `${PAGE} border-border-soft text-muted opacity-40`;
const PAGE_GAP = 'inline-flex h-8 w-5 items-center justify-center text-[12px] text-muted';
/** Tech Stats: one of the feed's own "important" plates. */
const PLATE = 'rounded-[var(--radius-sm)] border border-border-soft bg-card px-3 py-2.5';
const PLATE_LABEL =
  'm-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted';
const PLATE_VALUE = 'm-0 mt-0.5 text-[16px] font-extrabold tabular-nums text-text';
/** A card nested inside a panel — the Tech Stats counter groups and the two
 *  blocks of the Overview profile — plus one tile (a label over its value) in it. */
const SUB_CARD = 'rounded-[var(--radius-sm)] border border-border-soft bg-card p-3.5';
const SUB_TITLE =
  'm-0 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted';
const TILE = 'rounded-[var(--radius-sm)] bg-panel px-2.5 py-2';
const TILE_LABEL = 'm-0 text-[11px] leading-tight text-muted';
const TILE_VALUE = 'm-0 mt-0.5 text-[15px] font-bold tabular-nums text-text';
/** The two ratios the panel derives, drawn as a bar under their own tiles. */
const BAR_HEAD =
  'm-0 mt-2.5 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-muted';
const BAR_TRACK =
  'mt-1 h-1.5 overflow-hidden rounded-full bg-[#f1f3f4] [[data-theme=dark]_&]:bg-border-soft';
const BAR_FILL = 'h-full rounded-full bg-accent';
/** Transfer tab: one move, the crest pair, and the feed's own fee/type chips. */
const MOVE =
  'rounded-[var(--radius-sm)] border border-border-soft bg-card px-3 py-2.5 transition-colors hover:border-[#c7ccd2]';
const MOVE_ARROW =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent';
const MOVE_FEE =
  'inline-flex items-center whitespace-nowrap rounded-full border border-[rgba(26,115,232,0.35)] bg-accent-soft px-2.5 py-0.5 text-[12px] font-bold text-accent';
const MOVE_TYPE =
  'inline-flex items-center whitespace-nowrap rounded-full border border-border bg-panel px-2.5 py-0.5 text-[11px] font-semibold text-muted';
const MOVE_WINDOW = 'm-0 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted';

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

/** The feed's own yellow/red card, drawn as the swatch its page prints beside the
 *  counts — 8×11 px of exactly the two colours it uses. */
function CardSwatch({ color }: { color: string }) {
  return <span className={CARD_SWATCH} style={{ background: color }} aria-hidden="true" />;
}

/** The player's appearance as the sport category's own match payload: the fields
 *  its cards read (both clubs with their ids, the competition, the kickoff and the
 *  final score), so `MatchLinkCard` draws the row exactly the way the category
 *  page draws it — same chrome, crests, league line and score.
 *
 *  The feed lists played matches, so the score is what marks a row finished; a row
 *  the feed published without one keeps the upcoming card (and shows "VS") rather
 *  than a 0-0 it never claimed. Both clubs travel as Goaloo ids with no crest
 *  filename, hence `crest="goaloo"` on the card and `clubId` on each side — the two
 *  things that turn the ids into a crest (`goalooMiniTeamLogoUrl`) and a link
 *  (`ClubLink` → `/club/{id}`).
 *
 *  The competition travels the same way: the row publishes a name of its own but no
 *  crest and no link, so both come from the loader's catalogue reference. `logo` is
 *  that crest (a Goaloo CDN URL, which `crest="goaloo"` draws), and `leagueId` is
 *  the RBLINK league id — the one `leagueHref` needs to open `/competition/{id}`;
 *  a competition the catalogue pairs no stream with leaves the card's league badge
 *  plain text instead of a dead link. */
function matchCardOf(match: GoalooPlayerMatch): Match {
  return {
    matchId: match.matchId,
    sportType: FOOTBALL,
    matchDate: match.kickoff,
    status: match.score ? 10000 : 0,
    league: {
      sportType: FOOTBALL,
      leagueId: match.leagueStreamId || undefined,
      name: match.competition,
      logo: match.leagueLogo,
    },
    home: { teamId: match.home.id, clubId: match.home.id, name: match.home.name },
    away: { teamId: match.away.id, clubId: match.away.id, name: match.away.name },
    homeScore: match.score?.home,
    awayScore: match.score?.away,
  };
}

/** The personal half of a match-log row: what the player himself did in that
 *  match, and whether the stream catalogue knows it. Only what the feed publishes
 *  — minutes played, goals, assists, the cards (it counts a second yellow apart
 *  from a straight red) and its own match rating. */
function AppearanceMarks({ match }: { match: GoalooPlayerMatch }) {
  const marks: Array<{ key: string; icon: ReactNode; text: string }> = [];
  if (match.minutes > 0) {
    marks.push({
      key: 'minutes',
      icon: <Clock size={11} aria-hidden="true" />,
      text: `${match.minutes}'`,
    });
  }
  if (match.goals > 0) {
    marks.push({
      key: 'goals',
      icon: <Target size={11} aria-hidden="true" />,
      text: match.goals > 1 ? `${match.goals} goals` : 'Goal',
    });
  }
  if (match.assists > 0) {
    marks.push({
      key: 'assists',
      icon: <Share2 size={11} aria-hidden="true" />,
      text: match.assists > 1 ? `${match.assists} assists` : 'Assist',
    });
  }
  if (match.yellow > 0) {
    marks.push({ key: 'yellow', icon: <CardSwatch color={CARD_YELLOW} />, text: 'Yellow' });
  }
  if (match.red > 0) {
    marks.push({ key: 'red', icon: <CardSwatch color={CARD_RED} />, text: 'Red' });
  }
  if (match.twoYellow > 0) {
    marks.push({ key: 'second-yellow', icon: <CardSwatch color={CARD_YELLOW} />, text: 'Second yellow' });
  }
  if (match.rating > 0) {
    marks.push({
      key: 'rating',
      icon: <Star size={11} aria-hidden="true" />,
      text: match.rating.toFixed(2),
    });
  }
  return (
    <span className={MARK_STRIP} role="group" aria-label="The player's numbers in this match">
      {marks.map((mark) => (
        <span key={mark.key} className={MARK}>
          {mark.icon}
          {mark.text}
        </span>
      ))}
      {match.streamId > 0 ? (
        <span className={WATCH_BADGE}>
          <Play size={11} aria-hidden="true" />
          Watch
        </span>
      ) : (
        <span className={NO_STREAM}>No stream</span>
      )}
    </span>
  );
}

/** One appearance. The card is the row's own click target — it links straight
 *  into `/watch/{id}` when the join found the match in the stream catalogue, and
 *  carries no link at all when it did not — while the two clubs inside stay links
 *  to their own pages, exactly like the sport category's cards. */
function AppearanceCard({ match }: { match: GoalooPlayerMatch }) {
  const card = matchCardOf(match);
  const label = matchLabel(card);
  return (
    <li className="m-0 list-none">
      <MatchLinkCard
        match={card}
        href={match.streamId > 0 ? watchHref(match.streamId, FOOTBALL) : ''}
        label={match.streamId > 0 ? `${label} — live stream` : label}
        crest="goaloo"
      >
        <AppearanceMarks match={match} />
      </MatchLinkCard>
    </li>
  );
}

/** The tab ids the URL carries in `?tab=`. `attributes` is deliberately not one
 *  of them any more: the radar and the feed's profile facts are part of Overview,
 *  and a stale `?tab=attributes` link lands there (an id the strip does not know
 *  falls back to its first tab). */
type PlayerTabId = 'overview' | 'matches' | 'transfers' | 'stats';

/** One tab of the strip: its label, and the count it shows when the panel behind
 *  it has something worth counting. */
interface PlayerTab {
  id: PlayerTabId;
  label: string;
  count?: number;
}

/** The tabs THIS player has. Availability is data-driven, the way the match
 *  page's strip is: a panel with nothing behind it is never drawn, so no tab ever
 *  opens on an apology. Overview is always there — it is the page: the bio, the
 *  season totals, the attribute radar and the feed's own profile facts. */
function playerTabs(player: GoalooPlayer): PlayerTab[] {
  const tabs: PlayerTab[] = [{ id: 'overview', label: 'Overview' }];
  if (player.matches.length > 0) {
    tabs.push({ id: 'matches', label: 'Matches', count: player.matches.length });
  }
  if (player.transfers.length > 0) {
    tabs.push({ id: 'transfers', label: 'Transfers', count: player.transfers.length });
  }
  if (player.tech.length > 0) tabs.push({ id: 'stats', label: 'Tech Stats' });
  return tabs;
}

/** The facts Overview's "Attributes & profile" panel lists — the feed's own
 *  `playerInfoBox`, under the feed's own labels and units. The bio header stays
 *  identity-only (club, competition, country) so this panel is the single home for
 *  them; for a player the feed publishes no radar for, the list is the whole
 *  attribute half of the panel. Ordered the way the tile grid reads it: the body
 *  first, then the paperwork. */
function attributeFacts(
  player: GoalooPlayer,
  age: number,
  value: string
): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  if (age > 0) {
    facts.push({
      label: 'Age',
      value: player.dateOfBirth ? `${age} (${player.dateOfBirth})` : String(age),
    });
  }
  if (player.height) facts.push({ label: 'Height', value: `${player.height} cm` });
  if (player.weight) facts.push({ label: 'Weight', value: `${player.weight} kg` });
  if (player.foot) facts.push({ label: 'Preferred Foot', value: player.foot });
  if (value) facts.push({ label: 'Estimated Value', value });
  if (player.contract) facts.push({ label: 'Contract Expires', value: player.contract });
  return facts;
}

/** The Tech Stats competitions, each with the seasons the feed aggregates for the
 *  player — the order of the feed's own dropdowns: competition ascending, and
 *  each competition's seasons as published (newest first) — and with the
 *  catalogue's own reference to it, so the picker can draw and link its badge. */
function techGroupsOf(tech: GoalooPlayerTech[]): PlayerTechGroup[] {
  const groups: PlayerTechGroup[] = [];
  for (const row of tech) {
    const group = groups.find((g) => g.leagueId === row.leagueId);
    if (group) group.seasons.push(row.season);
    else {
      groups.push({
        leagueId: row.leagueId,
        competition: row.competition,
        logo: row.leagueLogo,
        streamId: row.leagueStreamId,
        seasons: [row.season],
      });
    }
  }
  return groups;
}

/** A published percentage, or "0%" where the feed publishes no denominator. */
const percent = (part: number, whole: number): string =>
  whole > 0 ? `${((part * 100) / whole).toFixed(1)}%` : '0%';

/** Minutes per goal, or "0" where the feed credits none. */
const minutesPerGoal = (minutes: number, goals: number): string =>
  goals > 0 ? (minutes / goals).toFixed(1) : '0';

/** The page numbers the pager draws: all of them while there are few, otherwise
 *  the current page's neighbourhood with gaps — the feed's own pager window. */
function pageNumbers(current: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, current - 1, current, current + 1]);
  const numbers: Array<number | 'gap'> = [];
  for (let n = 1; n <= pages; n += 1) {
    if (keep.has(n)) numbers.push(n);
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap');
  }
  return numbers;
}

/** Split the transfer record into the seasons the feed labels the rows with, in
 *  the order it publishes them (newest first), so the record reads as seasons at
 *  a glance. */
function transferSeasons(
  transfers: GoalooPlayerTransfer[]
): Array<{ season: string; transfers: GoalooPlayerTransfer[] }> {
  const runs: Array<{ season: string; transfers: GoalooPlayerTransfer[] }> = [];
  for (const transfer of transfers) {
    const last = runs[runs.length - 1];
    if (last && last.season === transfer.season) last.transfers.push(transfer);
    else runs.push({ season: transfer.season, transfers: [transfer] });
  }
  return runs;
}

/** The Matches tab's pager — links, so a page of the log is a URL the crawler and
 *  the back button both understand. */
function MatchPager({ base, current, pages }: { base: string; current: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number): string => `${base}&page=${n}`;
  return (
    <nav className="mt-3 flex flex-wrap items-center gap-1" aria-label="Match log pages">
      {current > 1 ? (
        <Link href={href(current - 1)} className={PAGE_IDLE} rel="prev" aria-label="Previous page">
          <ChevronLeft size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span className={PAGE_OFF} aria-hidden="true">
          <ChevronLeft size={14} />
        </span>
      )}
      {pageNumbers(current, pages).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className={PAGE_GAP} aria-hidden="true">
            …
          </span>
        ) : n === current ? (
          <span key={n} className={PAGE_ON} aria-current="page">
            {n}
          </span>
        ) : (
          <Link key={n} href={href(n)} className={PAGE_IDLE} aria-label={`Page ${n}`}>
            {n}
          </Link>
        )
      )}
      {current < pages ? (
        <Link href={href(current + 1)} className={PAGE_IDLE} rel="next" aria-label="Next page">
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span className={PAGE_OFF} aria-hidden="true">
          <ChevronRight size={14} />
        </span>
      )}
    </nav>
  );
}

/**
 * The player page: the bio header, then the tabbed panels — Overview (the season
 * totals, the feed's attribute radar and profile facts, plus the latest
 * appearances), Matches (the full log, 10 to a page, each row linking into
 * `/watch/{id}` when the stream catalogue knows the match), Transfers and Tech
 * Stats (one competition × season at a time, driven by the feed's own two
 * dropdowns).
 *
 * The tab, the page number and both Tech Stats selections travel in the URL
 * (`?tab=&page=&league=&season=`), so every panel is shareable, crawlable and
 * back-button friendly; `app/player/[id]/page.tsx` resolves them and hands them
 * down here. An unknown or unavailable `tab` falls back to Overview and a `page`
 * outside the log to its first page.
 */
export function PlayerPageContent({
  player,
  tab,
  page,
  league,
  season,
}: {
  player: GoalooPlayer;
  /** `?tab=` — the panel to show. */
  tab?: string;
  /** `?page=` — 1-based page of the Matches tab (clamped to the log). */
  page?: string;
  /** `?league=` — Goaloo competition id of the Tech Stats selection. */
  league?: string;
  /** `?season=` — season label of the Tech Stats selection. */
  season?: string;
}) {
  const age = ageOf(player.dateOfBirth);
  const value = personValue(player.marketValue);
  const facts = attributeFacts(player, age, value);
  /** Season totals: the whole published log, summed for the table's own total row. */
  const logged = player.seasons.reduce(
    (sum, row) => ({
      matches: sum.matches + row.matches,
      minutes: sum.minutes + row.minutes,
      goals: sum.goals + row.goals,
      assists: sum.assists + row.assists,
      yellow: sum.yellow + row.yellow,
      red: sum.red + row.red,
    }),
    { matches: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 }
  );
  const tabs = playerTabs(player);
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  const streamed = player.matches.filter((m) => m.streamId > 0).length;
  const teamHref = clubHref(player.teamId);
  /** Matches tab: the feed's own page size, newest appearance first. */
  const matchesHref = `/player/${player.id}?tab=matches`;
  const pages = Math.max(1, Math.ceil(player.matches.length / PLAYER_MATCHES_PER_PAGE));
  const asked = Number.parseInt(page ?? '', 10);
  const current = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1;
  const from = (current - 1) * PLAYER_MATCHES_PER_PAGE;
  const shown = player.matches.slice(from, from + PLAYER_MATCHES_PER_PAGE);
  const recent = player.matches.slice(0, PLAYER_RECENT_MATCHES);
  /** Tech Stats: the feed's own default — the player's own competition where the
   *  feed aggregates stats for it, otherwise the first competition it lists — and
   *  that competition's newest season unless the URL asked for another season of
   *  it. */
  const techGroups = techGroupsOf(player.tech);
  const wantedLeague = Number.parseInt(league ?? '', 10);
  const selected =
    player.tech.find((t) => t.leagueId === wantedLeague && t.season === season) ??
    player.tech.find((t) => t.leagueId === wantedLeague) ??
    player.tech.find((t) => t.leagueId === player.leagueId) ??
    player.tech[0];
  /** Crest and name in one chip — the crest is the club's logo, and the whole
   *  chip opens that club's page. */
  const clubChip = player.teamName ? (
    <>
      <GoalooLogo src={player.teamLogo} name={player.teamName} size="sm" />
      {player.teamName}
    </>
  ) : null;
  /** The competition chip: the catalogue's own crest and name in one link, so the
   *  badge and the name both open the competition page — and the same chip without
   *  the link for a competition the stream catalogue pairs nothing with. */
  const competition =
    player.leagueName && player.leagueStreamId > 0 ? (
      <Link
        href={leagueHref(player.leagueStreamId, FOOTBALL)}
        className={`${CHIP} hover:border-[#c7ccd2] hover:text-text`}
        title={`${player.leagueName} — fixtures, results & live streams`}
      >
        <GoalooLogo src={player.leagueLogo} name={player.leagueName} size="sm" />
        {player.leagueName}
      </Link>
    ) : player.leagueName ? (
      <span className={CHIP}>
        <GoalooLogo src={player.leagueLogo} name={player.leagueName} size="sm" />
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
            </div>
            <p className="m-0 mt-2 text-[12px] leading-[1.6] text-muted">
              <strong className="text-text">{player.matches.length}</strong> appearances on file ·{' '}
              <strong className="text-text">{streamed}</strong> of them are in the stream
              catalogue.
              {player.dateOfBirth ? ` Born ${player.dateOfBirth}.` : ''}
              {player.updatedAt ? ` Feed updated ${player.updatedAt}.` : ''}
            </p>
          </div>
        </div>
      </section>

      <nav
        className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Player sections"
      >
        {tabs.map((entry) => {
          const on = entry.id === active.id;
          return (
            <Link
              key={entry.id}
              href={`/player/${player.id}?tab=${entry.id}`}
              className={on ? TAB_ACTIVE : TAB_IDLE}
              role="tab"
              aria-selected={on}
            >
              {entry.label}
              {entry.count !== undefined && (
                <span className={on ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>{entry.count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {active.id === 'overview' && (
        <>
          {(player.attribute || facts.length > 0) && (
            <section className={PANEL}>
              <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
                <Radar className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                Attributes &amp; profile
              </h2>
              <p className="m-0 mt-1 text-[12px] text-muted">
                {player.attribute
                  ? `The six ratings the feed publishes for the player, 0–100 exactly as it prints them${
                      player.attribute.outfield
                        ? ' — pace, shooting, physicality, passing, defending and dribbling'
                        : ' — diving, handling, positioning, kicking, speed and reflexes, for a goalkeeper'
                    }${facts.length > 0 ? ', charted and listed together with the profile facts it publishes under its own headings.' : '.'}`
                  : 'The facts the feed publishes for the player, in its own words and units.'}
              </p>
              <div
                className={`mt-3 grid gap-3${
                  player.attribute && facts.length > 0
                    ? ' min-[780px]:grid-cols-[minmax(0,340px)_minmax(0,1fr)]'
                    : ''
                }`}
              >
                {player.attribute && (
                  <div className={SUB_CARD}>
                    <h3 className={SUB_TITLE}>Attribute radar</h3>
                    <div className="mt-3">
                      <PlayerRadar attribute={player.attribute} name={player.name} />
                    </div>
                  </div>
                )}
                {facts.length > 0 && (
                  <div className={SUB_CARD}>
                    <h3 className={SUB_TITLE}>
                      {player.attribute ? 'Profile' : 'Profile facts'}
                    </h3>
                    <dl className="m-0 mt-2.5 grid gap-2 min-[480px]:grid-cols-2 min-[1000px]:grid-cols-3">
                      {facts.map((fact) => (
                        <div key={fact.label} className={TILE}>
                          <dt className={TILE_LABEL}>{fact.label}</dt>
                          <dd className={TILE_VALUE}>{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </section>
          )}

          {player.seasons.length > 0 && (
            <section className={PANEL}>
              <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
                <Shirt className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                Season totals
              </h2>
              <p className="m-0 mt-1 text-[12px] text-muted">
                Summed over the {player.matches.length} appearances this feed publishes — not a
                league-wide table.
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
                    {player.seasons.map((seasonRow) => (
                      <tr
                        key={seasonRow.season}
                        className="border-b border-border-soft last:border-0"
                      >
                        <td className={`${TD} font-semibold text-text`}>{seasonRow.season}</td>
                        <td className={TD}>{seasonRow.matches}</td>
                        <td className={TD}>{seasonRow.minutes}</td>
                        <td className={TD}>{seasonRow.goals}</td>
                        <td className={TD}>{seasonRow.assists}</td>
                        <td className={TD}>{seasonRow.yellow}</td>
                        <td className={TD}>{seasonRow.red}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-bold text-text">
                      <td className={TD}>Total</td>
                      <td className={TD}>{logged.matches}</td>
                      <td className={TD}>{logged.minutes}</td>
                      <td className={TD}>{logged.goals}</td>
                      <td className={TD}>{logged.assists}</td>
                      <td className={TD}>{logged.yellow}</td>
                      <td className={TD}>{logged.red}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          <section className={PANEL}>
            <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
              <CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              Recent appearances
            </h2>
            {player.matches.length > 0 && (
              <p className="m-0 mt-1 text-[12px] text-muted">
                The latest {recent.length} of {player.matches.length} appearances, drawn as the
                match cards the sport pages use — the full log, {PLAYER_MATCHES_PER_PAGE} to a page,
                is on the{' '}
                <Link href={matchesHref} className="font-semibold text-accent hover:underline">
                  Matches tab
                </Link>
                .
              </p>
            )}
            {recent.length > 0 ? (
              <ul className={`${CARD_LIST} mt-3`}>
                {recent.map((match) => (
                  <AppearanceCard key={match.matchId} match={match} />
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-[12px] text-muted">
                This feed publishes no match log for the player yet.
              </p>
            )}
          </section>
        </>
      )}

      {active.id === 'matches' && (
        <section className={PANEL}>
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
            <CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Match log
          </h2>
          <p className="m-0 mt-1 text-[12px] text-muted">
            {player.matches.length} published appearances, newest first — page {current} of{' '}
            {pages}. Every row is the match card the sport pages use: the competition and the score
            are on the card itself and the player's own numbers for that match sit under it; the
            chip says whether the stream catalogue knows the match.
          </p>
          <ul className={`${CARD_LIST} mt-3`}>
            {shown.map((match) => (
              <AppearanceCard key={match.matchId} match={match} />
            ))}
          </ul>
          <MatchPager base={matchesHref} current={current} pages={pages} />
        </section>
      )}

      {active.id === 'transfers' && (
        <section className={PANEL}>
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Transfers
          </h2>
          <p className="m-0 mt-1 text-[12px] text-muted">
            The feed's own transfer record, newest season first — the club left, the club joined,
            the fee and type it published, and the window each spell covers. Both crests open their
            club's page.
          </p>
          <div className="mt-3 flex flex-col gap-4">
            {transferSeasons(player.transfers).map((group) => (
              <div key={group.season}>
                <h3 className="m-0 mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
                  <CalendarDays size={13} className="shrink-0 text-accent" aria-hidden="true" />
                  {group.season}
                  <span className="font-semibold normal-case tracking-normal">
                    {group.transfers.length} {group.transfers.length === 1 ? 'move' : 'moves'}
                  </span>
                </h3>
                <ul className={CARD_LIST}>
                  {group.transfers.map((transfer) => (
                    <TransferRow
                      key={`${transfer.fromId}-${transfer.toId}-${transfer.fromDate}`}
                      transfer={transfer}
                      current={player.teamId > 0 && transfer.toId === player.teamId}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {active.id === 'stats' && (
        <TechStatsPanel
          tech={selected}
          playerId={player.id}
          groups={techGroups}
          leagueId={selected.leagueId}
          season={selected.season}
        />
      )}
    </>
  );
}

/**
 * The Tech Stats panel: the feed's own competition × season dropdowns, the six
 * "important" plates it prints for that pair, then its three groups of counters.
 * Picking a pair rewrites `?league=&season=` on the stats tab (see
 * `PlayerTechPicker`), so this panel is re-rendered by the server from the URL —
 * no counter ever comes from the client.
 *
 * Every number is the feed's own count summed over the matches it lists for the
 * pair (see `GoalooPlayerTech`); the derived lines are marked as such: "Avg
 * Rating" is its own sum ÷ plays, and the two ratios it implies but never prints
 * (goals ÷ shots, accurate passes ÷ passes) are drawn as bars under the group they
 * belong to — its own numerators over its own denominators, nothing else.
 */
function TechStatsPanel({
  tech,
  playerId,
  groups,
  leagueId,
  season,
}: {
  tech: GoalooPlayerTech;
  /** Goaloo player id — only used to rewrite the Tech Stats URL. */
  playerId: number;
  /** The competitions the feed aggregates for the player, seasons inside. */
  groups: PlayerTechGroup[];
  leagueId: number;
  season: string;
}) {
  /** The feed's "important" plates, in the order it prints them; `Goals(P)` is the
   *  goals with the penalties in brackets, as it writes it. Each plate carries the
   *  icon of what it counts — the cards plate draws the two cards themselves. */
  const plates: Array<{ label: string; value: string; icon: ReactNode }> = [
    {
      label: 'Plays',
      value: String(tech.count),
      icon: <CalendarClock size={12} aria-hidden="true" />,
    },
    { label: 'Mins', value: String(tech.minutes), icon: <Clock size={12} aria-hidden="true" /> },
    {
      label: 'Avg Rating',
      value: tech.count > 0 ? (tech.rating / tech.count).toFixed(2) : '0',
      icon: <Star size={12} aria-hidden="true" />,
    },
    {
      label: 'Goals(P)',
      value: `${tech.goals}(${tech.penalty})`,
      icon: <Target size={12} aria-hidden="true" />,
    },
    {
      label: 'Assists',
      value: String(tech.assists),
      icon: <Share2 size={12} aria-hidden="true" />,
    },
    {
      label: 'Cards (R/Y)',
      value: `${tech.red}/${tech.yellow}`,
      icon: (
        <span className="inline-flex items-center gap-0.5">
          <CardSwatch color={CARD_RED} />
          <CardSwatch color={CARD_YELLOW} />
        </span>
      ),
    },
  ];
  /** The feed's own three groups and its own labels, with the typo ("Througth")
   *  and the mangled "Passes Success" written the way a reader expects. The two
   *  ratios it implies but never prints sit in `bars`, drawn under the tiles. */
  const sections: Array<{
    title: string;
    icon: ReactNode;
    rows: Array<{ label: string; value: string }>;
    bars: Array<{ label: string; value: string; ratio: number }>;
  }> = [
    {
      title: 'Offensive',
      icon: <Target size={13} aria-hidden="true" />,
      rows: [
        {
          label: 'Minutes per goal',
          value: minutesPerGoal(tech.minutes, tech.goals - tech.penalty),
        },
        { label: 'Shots', value: String(tech.shots) },
        { label: 'Shots on target', value: String(tech.shotsOnTarget) },
        { label: 'Fouled', value: String(tech.fouled) },
        { label: 'Offsides', value: String(tech.offsides) },
        { label: 'Best', value: String(tech.best) },
      ],
      bars: [
        {
          label: 'Conversion',
          value: percent(tech.goals - tech.penalty, tech.shots),
          ratio: tech.shots > 0 ? (tech.goals - tech.penalty) / tech.shots : 0,
        },
      ],
    },
    {
      title: 'Passing',
      icon: <Share2 size={13} aria-hidden="true" />,
      rows: [
        { label: 'Passes', value: String(tech.passes) },
        { label: 'Key passes', value: String(tech.keyPasses) },
        { label: 'Assists', value: String(tech.assists) },
        { label: 'Long passes', value: String(tech.longPasses) },
        { label: 'Through balls', value: String(tech.throughBalls) },
        { label: 'Break loose', value: String(tech.breakLoose) },
      ],
      bars: [
        {
          label: 'Pass accuracy',
          value: percent(tech.passesAccurate, tech.passes),
          ratio: tech.passes > 0 ? tech.passesAccurate / tech.passes : 0,
        },
      ],
    },
    {
      title: 'Defensive',
      icon: <Shield size={13} aria-hidden="true" />,
      rows: [
        { label: 'Tackles', value: String(tech.tackles) },
        { label: 'Interceptions', value: String(tech.interceptions) },
        { label: 'Clearances', value: String(tech.clearances) },
        { label: 'Steals', value: String(tech.steals) },
        { label: 'Blocked', value: String(tech.blocked) },
        { label: 'Heads', value: String(tech.headers) },
        { label: 'Fouls', value: String(tech.fouls) },
      ],
      bars: [],
    },
  ];
  return (
    <section className={PANEL}>
      <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
        <ChartColumn className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        Tech Stats
      </h2>
      <p className="m-0 mt-1 text-[12px] text-muted">
        The feed's own counter totals for one competition and season — every number below is
        one it publishes, summed over the matches it lists for the pair.
      </p>
      <div className="mt-3">
        <PlayerTechPicker
          playerId={playerId}
          groups={groups}
          leagueId={leagueId}
          season={season}
        />
      </div>

      {/* The feed's own headline numbers, one plate each. */}
      <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[900px]:grid-cols-6">
        {plates.map((plate) => (
          <div key={plate.label} className={PLATE}>
            <p className={PLATE_LABEL}>
              <span className="inline-flex text-accent">{plate.icon}</span>
              {plate.label}
            </p>
            <p className={PLATE_VALUE}>{plate.value}</p>
          </div>
        ))}
      </div>

      {/* The feed's three groups of counters, each a card of tiles; the ratios it
       *  implies are the bar under the tiles they belong to. */}
      <div className="mt-4 grid items-start gap-3 min-[720px]:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className={SUB_CARD}>
            <h3 className={SUB_TITLE}>
              <span className="inline-flex text-accent">{section.icon}</span>
              {section.title}
            </h3>
            <dl className="m-0 mt-2.5 grid grid-cols-2 gap-2">
              {section.rows.map((row) => (
                <div key={row.label} className={TILE}>
                  <dt className={TILE_LABEL}>{row.label}</dt>
                  <dd className={TILE_VALUE}>{row.value}</dd>
                </div>
              ))}
            </dl>
            {section.bars.map((bar) => (
              <div key={bar.label}>
                <p className={BAR_HEAD}>
                  {bar.label}
                  <strong className="tabular-nums text-text">{bar.value}</strong>
                </p>
                <div className={BAR_TRACK}>
                  <div
                    className={BAR_FILL}
                    style={{
                      width: `${(Math.max(0, Math.min(1, bar.ratio)) * 100).toFixed(1)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** One club of a transfer — crest and name, the pair opening that club's page.
 *  These rows publish both the id and the name, so nothing has to be invented for
 *  either side; the club the player joined is the bold one. */
function ClubSide({
  id,
  name,
  logo,
  joined = false,
}: {
  id: number;
  name: string;
  logo: string;
  /** The club joined (bold) rather than the one left (muted). */
  joined?: boolean;
}) {
  const href = clubHref(id);
  const body = (
    <>
      <GoalooLogo src={logo} name={name} size="base" />
      <span
        className={`min-w-0 truncate text-[13px] ${joined ? 'font-semibold text-text' : 'text-muted'}`}
      >
        {name}
      </span>
    </>
  );
  if (!href) return <span className="flex min-w-0 items-center gap-2">{body}</span>;
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-2 transition-colors hover:text-accent"
      title={`${name} — squad, fixtures & results`}
    >
      {body}
    </Link>
  );
}

/**
 * One move: the club left, an arrow, the club joined, and — on the right — the
 * fee and the transfer type the feed published for it. Under them the window the
 * row covers, which is the spell at the club joined: the feed dates a row from
 * the day the player joined that club to the day he left it, leaves the end empty
 * while he is still there (hence "present" — only claimed when the row's
 * destination is the club this page is about), and always starts on the day after
 * the previous row's end.
 *
 * The season heads the group the row sits in, so it is not repeated here.
 */
function TransferRow({
  transfer,
  current = false,
}: {
  transfer: GoalooPlayerTransfer;
  /** The row's destination is the player's current club, so the spell is open. */
  current?: boolean;
}) {
  return (
    <li className={MOVE}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <ClubSide id={transfer.fromId} name={transfer.fromName} logo={transfer.fromLogo} />
        <span className={MOVE_ARROW} aria-hidden="true">
          <ArrowRight size={14} />
        </span>
        <ClubSide id={transfer.toId} name={transfer.toName} logo={transfer.toLogo} joined />
        <span className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {transfer.fee && (
            <span className={MOVE_FEE} title="Fee as the feed publishes it">
              {transfer.fee}
            </span>
          )}
          {transfer.type && <span className={MOVE_TYPE}>{transfer.type}</span>}
        </span>
      </div>
      <p className={MOVE_WINDOW} title={`Time at ${transfer.toName}, as the feed dates it`}>
        <CalendarDays size={12} className="shrink-0" aria-hidden="true" />
        {transfer.fromDate}
        {transfer.toDate ? ` – ${transfer.toDate}` : current ? ' – present' : ''}
      </p>
    </li>
  );
}

