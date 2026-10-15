/**
 * The competition page the directory's own rows open — `/competition/{s|c<id>}`,
 * i.e. one of the 989 competitions in the Goaloo catalogue
 * (data/competitions.json), drawn from the Goaloo competition-season feed.
 *
 * Why this page exists at all: `/competitions` lists every competition the app
 * knows (and `/competition/{id}` draws the 454 of them that the stream join
 * paired with an Rblink league, which is where the streams are). The rest have
 * no Rblink payload whatsoever, so their rows used to be inert. They are now
 * links into HERE, and this page is what the Goaloo feed itself publishes about
 * the competition: its blurb, its clubs, every fixture grouped by the stage the
 * feed filed it under and — for cups — the published tables. Nothing is
 * invented: a panel the feed leaves empty says so instead of drawing a blank
 * table.
 *
 * The stream is what the app is for, so where the competition IS paired the page
 * says so and points at it: a "Live stream" chip in the header into
 * `/competition/{streamLeagueId}`, the fixture rows the join resolved open their
 * own `/watch/{id}`, and the Standings panel falls back to the stream
 * catalogue's own table (the feed publishes tables for cups only). Every row is
 * therefore either a real live page or a real detail page — never a dead link.
 *
 * A server component: the whole page is one feed read, so it renders on the
 * server and hands the shared match card client islands of plain data
 * (`MatchLinkCard`), exactly as the club page does.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, History, Play, Trophy, Users } from 'lucide-react';
import { ClubLink } from '@/components/ClubLink';
import { ClubStandingsTable } from '@/components/ClubStandingsTable';
import { GoalooLogo } from '@/components/GoalooLogo';
import { MatchLinkCard } from '@/components/Match';
import { goalooAreaLabel, goalooCompetitionLogoUrl } from '@/lib/goaloo';
import { matchLabel } from '@/lib/matchProto';
import { leagueHref, watchHref } from '@/lib/sports';
import type {
  CatalogueTab,
  GoalooCompetition,
  GoalooCompetitionDetail,
  GoalooFixture,
  GoalooStandingsGroup,
  LeagueStandings,
  Match,
} from '@/lib/types';

/** The Goaloo catalogue is a football catalogue. */
const FOOTBALL = 1;

/** How many fixtures the Overview's two lists show before the tab has them all. */
const OVERVIEW = 3;

/** Surface panel (`.panel`) — the card every page in the app is built from. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Fact chip (the club page's CHIP shape). */
const CHIP =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted [&_strong]:font-semibold [&_strong]:text-text';
/** A list of match cards — one card per row, as every list in the app draws them. */
const CARD_LIST = 'm-0 flex list-none flex-col gap-2 p-0';
/** Panel tab pills — the same active/idle pair the club and competition pages draw. */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
const TAB_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const TAB_COUNT_IDLE = `${TAB_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const TAB_COUNT_ACTIVE = `${TAB_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;
/** What a panel says when the feed has nothing for it. */
const NOTICE =
  'm-0 rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted';
/** Table chrome — the club page's table metrics, so the two read as one. */
const HEAD = 'px-1.5 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted';
const CELL = 'px-1.5 py-1.5 text-center tabular-nums';

/** A club in the Teams panel — its crest and name, linked into its own page. */
const CLUB_TILE =
  'flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2';

/**
 * Everything about the open panel that the ROUTE resolved — the URL's tab and
 * stage, the stream join's answer and the stream catalogue's own table when the
 * panel asked for one (app/competition/[id]/page.tsx).
 */
export interface CataloguePanel {
  tab: CatalogueTab;
  /** The stage the Fixtures panel shows — always a key `detail.stages` carries. */
  stage: string;
  /** Goaloo fixture id → Rblink match id, for the rows the stream join paired.
   *  A fixture the join left out has no stream and no entry here. */
  streams: Map<number, number>;
  /** The Rblink league this competition's streams belong to (the catalogue row's
   *  `streamId`); `0` when no stream pairs with this competition at all. */
  streamLeagueId: number;
  /** The stream catalogue's own table for that league — read only for the
   *  Standings panel, and `null` when the competition is unpaired or the feed
   *  did not answer. The Goaloo feed publishes tables for cups only, so this is
   *  the only table a league has. */
  leagueStandings: LeagueStandings | null;
  /** The season that table was read from, for its caption. */
  leagueSeason: string;
  /** Why the open panel has nothing to show, when the app knows. */
  error: string;
}

/** The directory's own URL into this page — the tab and the stage ride in the
 *  query string, so every panel is linkable, reloadable and server-rendered
 *  (the club page's tabs use the same arrangement). The default panel needs no
 *  key at all. */
function catalogueHref(path: string, tab: CatalogueTab, stage?: string): string {
  if (tab === 'overview' && !stage) return `/competition/${path}`;
  const q = new URLSearchParams({ tab });
  if (stage) q.set('stage', stage);
  return `/competition/${path}?${q}`;
}

/** One fixture as the shared match card. The card's own status vocabulary is
 *  lib/matchProto's (10000 = finished, 100 = the generic football LIVE marker),
 *  NOT the feed's codes: the feed counts live periods rather than minutes, so a
 *  minute is never invented. `leagueId` is the RBLINK league id, which is what
 *  makes the card's competition badge a link (and leaves it plain text for a
 *  competition with no stream). */
function matchCardOf(
  fixture: GoalooFixture,
  comp: GoalooCompetition,
  streamLeagueId: number
): Match {
  return {
    matchId: fixture.matchId,
    sportType: FOOTBALL,
    matchDate: fixture.kickoff,
    status: cardStatus(fixture),
    league: {
      sportType: FOOTBALL,
      leagueId: streamLeagueId || undefined,
      name: comp.name,
      // The Goaloo catalogue path; the card resolves it with
      // goalooCompetitionLogoUrl under `crest="goaloo"`.
      logo: comp.logo,
    },
    home: { teamId: fixture.home.id, clubId: fixture.home.id, name: fixture.home.name },
    away: { teamId: fixture.away.id, clubId: fixture.away.id, name: fixture.away.name },
    homeScore: fixture.score?.home,
    awayScore: fixture.score?.away,
  };
}

/** See {@link matchCardOf}. In play wins over everything the feed published, a
 *  finished row is the app's gray accent, and a score the feed published for a
 *  kickoff already gone is read as finished — never as a live match. */
function cardStatus(fixture: GoalooFixture): number {
  if (fixture.statusKind === 'live') return 100;
  if (fixture.statusKind === 'finished') return 10000;
  return fixture.score && fixture.kickoff < Date.now() ? 10000 : 0;
}

/** The extra card row: the tie a two-legged fixture belongs to (its leg and the
 *  aggregate the feed published) and the stage the fixture was filed under. */
function fixtureNote(fixture: GoalooFixture, stageLabel: string): string {
  const parts: string[] = [];
  if (fixture.legLabel) parts.push(fixture.legLabel);
  const tie = fixture.tie;
  if (tie && tie.aggHome !== undefined && tie.aggAway !== undefined) {
    parts.push(`Aggregate ${tie.aggHome}-${tie.aggAway}`);
  }
  if (stageLabel) parts.push(stageLabel);
  return parts.join(' · ');
}


/** One fixture row of any list on this page — the shared match card, opening the
 *  live stream when the join paired the fixture and naming itself as a real link
 *  either way. Its two clubs stay links into their own pages. */
function FixtureCard({
  fixture,
  comp,
  stageLabel,
  streamLeagueId,
  streamMatchId,
}: {
  fixture: GoalooFixture;
  comp: GoalooCompetition;
  stageLabel: string;
  streamLeagueId: number;
  /** Rblink match id; `0` when the stream join did not resolve this fixture. */
  streamMatchId: number;
}) {
  const card = matchCardOf(fixture, comp, streamLeagueId);
  const label = matchLabel(card);
  const href = streamMatchId > 0 ? watchHref(streamMatchId, FOOTBALL) : '';
  const note = fixtureNote(fixture, stageLabel);
  return (
    <li className="m-0 list-none">
      <MatchLinkCard
        match={card}
        href={href}
        label={href ? `${label} — live stream` : label}
        crest="goaloo"
      >
        {note && <div className="mt-1.5 truncate text-[12px] text-muted">{note}</div>}
      </MatchLinkCard>
    </li>
  );
}

/** A panel's own heading, with an optional "see all" link into another panel. */
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

/** What a panel says when the feed has no rows for it. */
function PanelNotice({ children }: { children: ReactNode }) {
  return <p className={NOTICE}>{children}</p>;
}

/** What a panel says when the read behind it failed. */
function PanelError({ message }: { message: string }) {
  return (
    <p className="m-0 mb-3 rounded-xl border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.12)] px-4 py-3 text-[13px] break-words text-[#c5221f] [[data-theme=dark]_&]:text-[#fca5a5]">
      {message}
    </p>
  );
}


/** One panel tab, as a link — the tab rides in the URL (see {@link catalogueHref}). */
function TabLink({
  path,
  tab,
  active,
  count,
  children,
}: {
  path: string;
  tab: CatalogueTab;
  active: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={catalogueHref(path, tab)}
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

/** One stage pill of the Fixtures panel — a league matchday, a cup round or a cup
 *  group — carrying how many fixtures the feed filed under it. */
function StageLink({
  path,
  stage,
  label,
  count,
  active,
}: {
  path: string;
  stage: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={catalogueHref(path, 'fixtures', stage)}
      className={active ? TAB_ACTIVE : TAB_IDLE}
      aria-current={active ? 'page' : undefined}
      scroll={false}
    >
      {label}
      <span className={active ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>{count}</span>
    </Link>
  );
}

/** One published table (a cup stage or group). Drawn with the club page's table
 *  metrics — the rank, then P/W/D/L/GF/GA/GD/Pts — and only what the feed
 *  published: a counter the row omits reads as 0, never as a plausible number.
 *  Every row's crest and name lead into that club's page, as everywhere else. */
function StandingsGroupTable({ group }: { group: GoalooStandingsGroup }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">
        {group.name}
      </h3>
      <div className="overflow-x-auto">
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
            {group.rows.map((row) => (
              <tr
                key={row.team.id}
                className="border-b border-border-soft last:border-0 hover:bg-border-soft/40"
              >
                <td className={`${CELL} text-left font-bold text-muted`}>{row.rank}</td>
                <td className="px-1.5 py-1.5">
                  <ClubLink
                    id={row.team.id}
                    name={row.team.name}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <GoalooLogo src={row.team.logo} name={row.team.name} size="sm" />
                    <span className="min-w-0 truncate font-semibold">{row.team.name}</span>
                  </ClubLink>
                </td>
                <td className={CELL}>{row.played}</td>
                <td className={CELL}>{row.won}</td>
                <td className={CELL}>{row.drawn}</td>
                <td className={CELL}>{row.lost}</td>
                <td className={CELL}>{row.goalsFor}</td>
                <td className={CELL}>{row.goalsAgainst}</td>
                <td className={CELL}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                <td className={`${CELL} font-bold text-text`}>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The competition page itself. Everything it draws comes from the feed read the
 * route performed (`detail`) plus the answers the route resolved about the stream
 * (`panel`) — this component does no I/O of its own, so a page view is exactly
 * one feed read.
 */
export function GoalooCompetitionPage({
  detail,
  panel,
}: {
  detail: GoalooCompetitionDetail;
  panel: CataloguePanel;
}) {
  const { comp, about, teams, stages, standings } = detail;
  const crest = goalooCompetitionLogoUrl(comp.logo);
  /** Every fixture of the season, in the feed's own order (its stages are
   *  chronological: a league round 1 → round 38, a cup the first round → final). */
  const fixtures = stages.flatMap((stage) => stage.items);
  const stageLabels = new Map(stages.map((stage) => [stage.key, stage.label]));
  const labelOf = (fixture: GoalooFixture): string => stageLabels.get(fixture.stageKey) ?? '';
  const now = Date.now();
  /** In play first, then the next kickoffs — read off the same rule the cards use
   *  (see {@link cardStatus}), so a row can never be in two lists at once. */
  const nextUp = [
    ...fixtures.filter((f) => cardStatus(f) === 100),
    ...fixtures.filter((f) => cardStatus(f) === 0 && f.kickoff >= now),
  ].slice(0, OVERVIEW);
  /** Newest first — the feed lists a season oldest first. */
  const latest = fixtures
    .filter((f) => cardStatus(f) === 10000)
    .slice(-OVERVIEW)
    .reverse();
  const streamed = fixtures.filter((f) => panel.streams.has(f.matchId)).length;
  /** The streamed competition page — and only when a stream sits behind it: the
   *  id is 0 for a competition the scan did not pair, and `leagueHref` would
   *  build `/competition/0` out of it. */
  const streamHref = panel.streamLeagueId > 0 ? leagueHref(panel.streamLeagueId, FOOTBALL) : '';
  const standingsCount =
    standings.length > 0
      ? standings.reduce((total, group) => total + group.rows.length, 0)
      : (panel.leagueStandings?.rows.length ?? 0);
  /** The rounds still to play — in play first, then the coming kickoffs, the same
   *  rule the Overview's "Next up" list and the cards use ({@link cardStatus}). */
  const nextRound = stages.find((stage) =>
    stage.items.some((fixture) => cardStatus(fixture) === 100 || fixture.kickoff >= now)
  );
  /** The round the Fixtures panel opens on: the one the URL names, else the next
   *  round with a fixture to play — so the panel opens on the matches a visitor
   *  came for, not on the season's first matchday — else the last round filed. */
  const open = stages.find((stage) => stage.key === panel.stage) ?? nextRound ?? stages[stages.length - 1];
  const fixturesHref = open
    ? catalogueHref(comp.path, 'fixtures', open.key)
    : catalogueHref(comp.path, 'fixtures');
  /** One list of fixture cards — the Overview's two lists and the Fixtures panel
   *  draw exactly these rows, with the stream the join resolved on each. */
  const rows = (list: GoalooFixture[]) => (
    <ul className={`${CARD_LIST} mt-3`}>
      {list.map((fixture) => (
        <FixtureCard
          key={fixture.matchId}
          fixture={fixture}
          comp={comp}
          stageLabel={labelOf(fixture)}
          streamLeagueId={panel.streamLeagueId}
          streamMatchId={panel.streams.get(fixture.matchId) ?? 0}
        />
      ))}
    </ul>
  );
  return (
    <>
      {/* 1. The competition itself: crest, name, where it is played, and what the
             catalogue and the stream both know about it. */}
      <section className={PANEL}>
        <div className="flex items-start gap-4 max-[640px]:gap-3">
          <GoalooLogo src={crest} name={comp.name} size="lg" />
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
              {comp.type === 2 ? 'Cup competition' : 'League competition'}
            </span>
            <h1 className="m-0 mt-1 text-[22px] leading-tight font-extrabold max-[640px]:text-[19px]">
              {comp.name}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {comp.country && <span className={CHIP}>{comp.country}</span>}
              <span className={CHIP}>{goalooAreaLabel(comp.area)}</span>
              {comp.season && (
                <span className={CHIP}>
                  Season <strong>{comp.season}</strong>
                </span>
              )}
              {teams.length > 0 && (
                <span className={CHIP}>
                  Clubs <strong>{teams.length}</strong>
                </span>
              )}
              {fixtures.length > 0 && (
                <span className={CHIP}>
                  Fixtures <strong>{fixtures.length}</strong>
                </span>
              )}
              {stages.length > 0 && (
                <span className={CHIP}>
                  Rounds <strong>{stages.length}</strong>
                </span>
              )}
              {/* The one thing the app adds to the publisher's own catalogue: this
                  competition's streams, when the stream catalogue carries them. */}
              {streamHref && (
                <Link
                  href={streamHref}
                  className={`${CHIP} no-underline hover:border-[#c7ccd2] hover:text-text`}
                  title={`${comp.name} — live streams, fixtures & standings`}
                >
                  <Play size={12} className="shrink-0 text-accent" aria-hidden="true" />
                  Live streams
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. The panel strip. Every panel is a URL, so a tab can be shared and
             reloaded, and the server renders the panel that was asked for. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <section
          className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Competition panels"
        >
          <TabLink path={comp.path} tab="overview" active={panel.tab === 'overview'}>
            Overview
          </TabLink>
          <TabLink
            path={comp.path}
            tab="fixtures"
            active={panel.tab === 'fixtures'}
            count={fixtures.length}
          >
            Fixtures
          </TabLink>
          <TabLink
            path={comp.path}
            tab="standings"
            active={panel.tab === 'standings'}
            count={standingsCount}
          >
            Standings
          </TabLink>
          <TabLink path={comp.path} tab="teams" active={panel.tab === 'teams'} count={teams.length}>
            Teams
          </TabLink>
        </section>
        <span className="ml-auto shrink-0 text-[12px] text-muted max-[640px]:hidden">
          Goaloo catalogue · {comp.path}
        </span>
      </div>

      {/* 3. The Overview panel — the season as the catalogue filed it: what is on
             next, what has just been played, and what the file says about the
             competition (including how much of it the app can stream). */}
      {panel.tab === 'overview' && (
        <>
          <section className={PANEL}>
            <SectionHead
              icon={<CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              title="Next up"
              href={fixturesHref}
              linkLabel="All fixtures"
            />
            {nextUp.length > 0 ? (
              rows(nextUp)
            ) : (
              <PanelNotice>
                The catalogue publishes no fixture ahead for this season.
              </PanelNotice>
            )}
          </section>

          <section className={PANEL}>
            <SectionHead
              icon={<History className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              title="Latest results"
              href={catalogueHref(comp.path, 'fixtures')}
              linkLabel="All results"
            />
            {latest.length > 0 ? (
              rows(latest)
            ) : (
              <PanelNotice>No match of this season has been played yet.</PanelNotice>
            )}
          </section>

          <section className={PANEL}>
            <SectionHead
              icon={<Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
              title="About this competition"
            />
            <p className="m-0 text-[13px] leading-[1.7] text-muted">
              {about || 'The catalogue publishes no description of this competition.'}
            </p>
            <p className="m-0 mt-3 text-[12px] leading-[1.6] text-muted">
              This page is the Goaloo catalogue&rsquo;s own file for{' '}
              <strong className="text-text">{comp.name}</strong>
              {comp.season ? ` · ${comp.season}` : ''}.{' '}
              {streamed > 0 ? (
                <>
                  <strong className="text-text">{streamed}</strong> of its{' '}
                  <strong className="text-text">{fixtures.length}</strong> fixtures are in the stream
                  catalogue, and each of those opens its own live stream.{' '}
                </>
              ) : (
                fixtures.length > 0 &&
                'No fixture of this season is in the stream catalogue yet. '
              )}
              {streamHref && (
                <>
                  The streams this competition has live on the{' '}
                  <Link
                    href={streamHref}
                    className="font-semibold text-accent no-underline hover:underline"
                  >
                    streamed competition page
                  </Link>
                  .
                </>
              )}
            </p>
          </section>
        </>
      )}

      {/* 4. The Fixtures panel — the season round by round, in the order the
             catalogue filed the rounds, with the round the URL names open. */}
      {panel.tab === 'fixtures' && (
        <section className={PANEL}>
          <SectionHead
            icon={<CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            title={open ? `${comp.name} · ${open.label}` : `${comp.name} · fixtures`}
          />
          {!open ? (
            <PanelNotice>
              The catalogue has not published this season&rsquo;s schedule yet.
            </PanelNotice>
          ) : (
            <>
              {stages.length > 1 && (
                <div
                  className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="tablist"
                  aria-label="Rounds"
                >
                  {stages.map((stage) => (
                    <StageLink
                      key={stage.key}
                      path={comp.path}
                      stage={stage.key}
                      label={stage.label}
                      count={stage.items.length}
                      active={stage.key === open.key}
                    />
                  ))}
                </div>
              )}
              {rows(open.items)}
            </>
          )}
        </section>
      )}

      {/* 5. The Standings panel. A cup's table is the catalogue's own; a league's
             comes from the stream catalogue (the one place a league table
             exists), and a competition neither feed tabulates says so. */}
      {panel.tab === 'standings' && (
        <section className={PANEL}>
          <SectionHead
            icon={<Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            title="Standings"
          />
          {panel.error && <PanelError message={panel.error} />}
          {standings.length > 0 ? (
            standings.map((group) => <StandingsGroupTable key={group.key} group={group} />)
          ) : panel.leagueStandings && panel.leagueStandings.rows.length > 0 ? (
            <>
              <p className="m-0 mb-3 text-[12px] leading-[1.6] text-muted">
                The catalogue publishes tables for cups only, so this is the stream catalogue&rsquo;s
                own table for <strong className="text-text">{comp.name}</strong>
                {panel.leagueSeason ? (
                  <>
                    {' '}
                    · <strong className="text-text">{panel.leagueSeason}</strong>
                  </>
                ) : null}
                .
              </p>
              <ClubStandingsTable standings={panel.leagueStandings} highlightClubId={0} />
            </>
          ) : (
            !panel.error && (
              <PanelNotice>
                Neither catalogue publishes a table for this competition.
              </PanelNotice>
            )
          )}
        </section>
      )}

      {/* 6. The Teams panel — every club this season names, each into its own
             page (the club id the catalogue publishes IS the page's id). */}
      {panel.tab === 'teams' && (
        <section className={PANEL}>
          <SectionHead
            icon={<Users className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            title={`Clubs · ${comp.season || 'this season'}`}
          />
          {teams.length === 0 ? (
            <PanelNotice>The catalogue names no club for this season yet.</PanelNotice>
          ) : (
            <ul className="m-0 mt-3 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
              {teams.map((team) => (
                <li key={team.id} className="m-0 list-none">
                  <ClubLink id={team.id} name={team.name} className={CLUB_TILE}>
                    <GoalooLogo src={team.logo} name={team.name} size="sm" />
                    <span className="min-w-0 truncate text-[13px] font-semibold">
                      {team.name}
                    </span>
                  </ClubLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

