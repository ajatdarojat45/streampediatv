'use client';

import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { statusLabel, isLiveStatus, isStarted, matchLabel } from '@/lib/matchProto';
import { LocalTime } from '@/components/LocalTime';
import { ClubLink } from '@/components/ClubLink';
import { countryLogoUrl, teamLogoUrl } from '@/lib/logos';
import { sportColor, sportLabel, sportIsScoring, leagueHref } from '@/lib/sports';
import type { Match, Team } from '@/lib/types';
/* ------------------------------------------------------------------------- *
 * Shared Tailwind class strings — replacements for the retired custom CSS
 * component classes (see `@layer components` in app/globals.css).
 * ------------------------------------------------------------------------- */

/** Logo box sizes: `.logo` was 22px/6px radius; contexts override it. */
type LogoSize = 'base' | 'league' | 'rowTeam' | 'head' | 'detailTeam';
const LOGO_SIZE: Record<LogoSize, string> = {
  base: 'h-[22px] w-[22px] rounded-md text-[11px]',
  league: 'h-4 w-4 rounded-[4px] text-[11px]',
  rowTeam: 'h-6 w-6 rounded-md text-[11px]',
  head: 'h-[34px] w-[34px] rounded-lg text-[15px]',
  detailTeam:
    'h-10 w-10 rounded-lg text-[16px] max-[640px]:h-8 max-[640px]:w-8 max-[640px]:text-[14px]',
};
/** `.logo` — the `<img>` variant. */
const LOGO_IMG = 'shrink-0 object-contain';
/** `.logo-empty` — the initial-letter placeholder variant. */
const LOGO_EMPTY =
  'inline-flex shrink-0 items-center justify-center bg-[#e8eaed] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft';

/** `.row-team-side` (+ `.row-team > span` / `.detail-team > span` ellipsis). */
const TEAM_SIDE =
  'inline-flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis';
/** `.row-team-member` */
const TEAM_MEMBER = 'inline-flex min-w-0 items-center gap-1.5';
/** `.row-team-name` — typography (14px/semibold) matches the H2H `TeamChip`. */
const TEAM_NAME =
  'min-w-0 overflow-hidden whitespace-nowrap text-ellipsis text-[14px] font-semibold';

/** `.status` pill (shared base). */
const STATUS =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-1 text-[11px] font-semibold';
/** `.status` — idle. */
const STATUS_IDLE = `${STATUS} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)]`;
/** `.status.status-live` */
const STATUS_LIVE = `${STATUS} bg-[var(--live-soft)] text-[#d93025] [[data-theme=dark]_&]:bg-[rgba(255,255,255,0.08)] [[data-theme=dark]_&]:text-[#f87171]`;
/** `.status-live .dot` (blinking live indicator) */
const STATUS_DOT =
  'h-[7px] w-[7px] shrink-0 rounded-full bg-current animate-[blink_1.2s_infinite]';
/** Inline `LIVE` tag shown next to the league name on live match cards —
 *  reuses the live red so it matches the status badge + live phase text. */
const LIVE_LABEL =
  'inline-flex shrink-0 items-center gap-1 rounded bg-[#d93025] px-1.5 py-px text-[10px] font-extrabold uppercase tracking-[0.06em] text-white [[data-theme=dark]_&]:bg-[#f87171] [[data-theme=dark]_&]:text-[#1a1a1a]';

/** Blinking `Live` tag sitting next to the league name — same in every card. */
function LiveLabel() {
  return (
    <span className={LIVE_LABEL}>
      <span className="h-1 w-1 rounded-full bg-current animate-[blink_1.2s_infinite]" />
      Live
    </span>
  );
}

/** The `sport · league` line of a card. When `href` is set (only the watch-page
 *  head passes one — see `CardContent`) the line is a link into the competition
 *  page, so a match can be traced back up to its league/standings. List rows
 *  keep it plain text: the row already navigates to the match itself, and the
 *  league's own link sits on the group header above the cards. */
function LeagueLine({
  href,
  name,
  className,
  children,
}: {
  href: string;
  name: string;
  className: string;
  children: ReactNode;
}) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link
      href={href}
      title={`${name} — fixtures, results & standings`}
      className={`${className} no-underline transition-colors hover:text-accent hover:underline`}
    >
      {children}
    </Link>
  );
}

/** Card chrome shared by every match card — list rows (`MatchRow`) and the
 *  watch-page head (`MatchHead`): single-column card, all info lives in the
 *  centred content (the side icon columns were removed as duplicates of the
 *  centre). Chrome (radius/padding) and typography mirror the H2H `MeetingRow`. */
const CARD_CHROME =
  'w-full rounded-lg border border-l-[3px] bg-card px-3.5 py-2.5 max-[1024px]:px-3.5';
/** `.match-row` base — the interactive variant: lift + shadow on hover. */
const ROW_BASE =
  `${CARD_CHROME} block text-left transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow`;
/** `.match-row` (upcoming/idle) — sport-coloured left accent only. */
const ROW = `${ROW_BASE} border-border border-l-[color:var(--sport-color,transparent)] hover:border-[#c7ccd2]`;
/** `.match-row.is-live` — live is the exception: the whole border (all sides)
 *  turns red, not just the left accent. */
const ROW_LIVE = `${ROW_BASE} border-[color:var(--live)]`;
/** `.match-row.finished` — muted gray left accent only (other sides normal). */
const ROW_FINISHED = `${ROW_BASE} border-border border-l-[#9ca3af]`;
/** The row's own click target: an invisible overlay covering the card. The row
 *  must host links of its own (each club's crest + name), and an anchor may
 *  never wrap another link, so the row-wide navigation cannot be the card's
 *  root element any more — it sits on top of the card instead, exactly like the
 *  club page's fixture rows (`ROW_OVERLAY` in ClubPageContent). The club links
 *  are lifted above it with `relative z-10` (see `ClubLink`). */
const ROW_OVERLAY = 'absolute inset-0 cursor-pointer rounded-lg';

/** `MatchHead` (watch page) — the same three states, but read-only: no hover
 *  lift/border-highlight because the card is not clickable. */
const HEAD = `${CARD_CHROME} block border-border border-l-[color:var(--sport-color,transparent)]`;
const HEAD_LIVE = `${CARD_CHROME} block border-[color:var(--live)]`;
const HEAD_FINISHED = `${CARD_CHROME} block border-border border-l-[#9ca3af]`;

/** `.sk` shimmer block (pseudo-element rendered via `after:` utilities). */
const SK =
  'relative overflow-hidden rounded-lg bg-[#e8eaed] after:absolute after:inset-0 after:content-[""] after:animate-[shimmer_1.4s_infinite] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] [[data-theme=dark]_&]:bg-border-soft [[data-theme=dark]_&]:after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]';

/** `.detail-countdown` inside `.player-placeholder` (48px, 32px ≤640). */
const COUNTDOWN =
  'whitespace-nowrap text-[48px] font-extrabold tabular-nums tracking-[0.01em] text-[#f3f4f6] max-[640px]:text-[32px]';
/** `.detail-countdown.is-done` inside `.player-placeholder` (22px, 18px ≤640). */
const COUNTDOWN_DONE =
  'whitespace-nowrap text-[22px] font-bold tabular-nums tracking-[0.01em] text-[#9ca3af] max-[640px]:text-[18px]';

export function TeamLogo({
  path,
  name,
  sportType,
  kind = 'team',
  size = 'base',
}: {
  path?: string;
  name?: string;
  sportType?: number;
  kind?: 'team' | 'league';
  size?: LogoSize;
}) {
  const [broken, setBroken] = useState(false);
  // Server actions already expand raw filenames, but cached payloads may
  // still carry a bare filename — resolve client-side as a safety net.
  const src = kind === 'league' ? countryLogoUrl(path) : teamLogoUrl(sportType, path);
  useEffect(() => { setBroken(false); }, [src]);
  if (!src || broken) {
    const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return <span className={`${LOGO_EMPTY} ${LOGO_SIZE[size]}`} aria-hidden="true">{initial}</span>;
  }
  // Logo hostnames change/expire often and may not resolve from the server
  // network — load straight from upstream in the browser. onError falls back
  // to the initial-letter placeholder, never a broken image.
  return <img className={`${LOGO_IMG} ${LOGO_SIZE[size]}`} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}

/** One side of a versus matchup. Singles render one logo+name; doubles
 * (tennis/badminton ganda) stack every player/team with their logo, matching
 * the app's "name[0] / name[2]" vs "name[1] / name[3]" pairing.
 *
 * `align` mirrors the H2H `TeamChip`: the home side is reversed
 * (`flex-row-reverse`) so the home logo sits on the outer edge — to the right
 * of the home name, away from the centre score. The away side keeps its logo
 * on the inner edge (left of the away name, next to the score). */
function TeamSide({
  teams,
  sportType,
  size = 'rowTeam',
  align = 'away',
}: {
  teams?: Team[];
  sportType?: number;
  size?: LogoSize;
  align?: 'home' | 'away';
}) {
  const list = teams?.length ? teams : [];
  if (!list.length) return <span className={TEAM_NAME}>{'?'}</span>;
  return (
    <span
      className={`${TEAM_SIDE} ${
        align === 'home' ? 'flex-row-reverse text-right' : ''
      }`}
    >
      {list.map((t, i) => (
        <span className={TEAM_MEMBER} key={t.teamId ?? t.playerId ?? i}>
          {i > 0 && <span className="mr-1.5 font-bold opacity-60">/</span>}
          {/* Crest and name travel together into the club's own page. The link
              keeps the member's flex order, and a team whose name the index
              could not resolve (or any other sport) renders exactly the same
              content as plain text — see ClubLink. */}
          <ClubLink id={t.clubId} name={t.name} className={TEAM_MEMBER}>
            {align === 'home' ? (
              <>
                <span className={TEAM_NAME}>{t.name || '?'}</span>
                <TeamLogo path={t.logo} name={t.name} sportType={sportType} size={size} />
              </>
            ) : (
              <>
                <TeamLogo path={t.logo} name={t.name} sportType={sportType} size={size} />
                <span className={TEAM_NAME}>{t.name || '?'}</span>
              </>
            )}
          </ClubLink>
        </span>
      ))}
    </span>
  );
}

export function StatusBadge({ status, className }: { status?: number; className?: string }) {
  const live = isLiveStatus(status);
  return (
    <span className={`${live ? STATUS_LIVE : STATUS_IDLE}${className ? ` ${className}` : ''}`}>
      {live && <span className={STATUS_DOT} />}
      {statusLabel(status)}
    </span>
  );
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Live countdown to a kickoff timestamp (ms since epoch), ticking every second.
 *  Renders a stable placeholder during SSR/hydration — `Date.now()` differs
 *  between server and client, which would cause a hydration mismatch. */
export function Countdown({ targetMs }: { targetMs: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now === null) {
    return <div className={COUNTDOWN} role="timer" suppressHydrationWarning>--:--:--</div>;
  }

  const diff = targetMs - now;
  if (diff <= 0) {
    return <div className={COUNTDOWN_DONE} role="timer">Starting…</div>;
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const clock =
    days > 0
      ? `${days}d ${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`
      : `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;

  return <div className={COUNTDOWN} role="timer">{clock}</div>;
}

export function MatchRowSkeleton() {
  return (
    <div className={ROW}>
      <div className={`${SK} mx-auto h-3 w-1/2`} />
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <div className={`${SK} h-3 w-full`} />
        <div className={`${SK} h-[18px] w-11 rounded-md`} />
        <div className={`${SK} h-3 w-full`} />
      </div>
      <div className={`${SK} mx-auto mt-2 h-3 w-1/4`} />
    </div>
  );
}

interface MatchRowProps {
  match: Match;
  onClick: () => void;
}

interface MatchHeadProps {
  match: Match;
  /** Extra card rows — the watch page adds fact chips and a description. */
  children?: ReactNode;
  className?: string;
}

/** Card body shared by the list rows (`MatchRow`) and the watch-page head
 *  (`MatchHead`): league line, versus grid and the state/date line.
 *  `heading` swaps the wrappers to `div`/`h1`, because the watch page promotes
 *  the versus grid to the page `<h1>`, while a row lives inside a `<button>`
 *  (phrasing content only, hence `span`). */
function CardContent({ match, heading = false }: { match: Match; heading?: boolean }) {
  const live = isLiveStatus(match.status);
  // Live/finished → missing score shown as 0; upcoming → shown as "-".
  const started = isStarted(match.status);
  const score = (v?: number): number | string => (v ?? (started ? 0 : '-'));
  const league = match.league?.name || match.name || match.title || '—';
  const eventName = match.title || match.name || match.league?.name || '—';
  const sportName = sportLabel(match.sportType);
  const scoring = sportIsScoring(match.sportType);
  /** Competition page for this match — only on the watch-page head (`heading`),
   *  which is a read-only `div` card. A list row can't host it (nested link). */
  const compHref = heading ? leagueHref(match.league?.leagueId, match.sportType) : '';
  const Box = heading ? 'div' : 'span';
  const Grid = heading ? 'h1' : 'span';
  /** Explicit `m-0` on the `<h1>` variants, mirroring the h1 resets used
   *  elsewhere in the app (Tailwind preflight already zeroes it). */
  const reset = heading ? 'm-0 ' : '';
  return (
    <Box className="block min-w-0">
      {scoring ? (
        <Box className="flex min-w-0 flex-col">
          {/* League row lives OUTSIDE the team grid (full-width, centred) so
              its text length never changes the centre-column width — the team
              logo/name positions stay fixed. Only the score sets the centre
              width (with a min-width so "VS" / short scores align too).
              Always shown so each card stays self-explanatory even when the
              league group header is scrolled off-screen. */}
          <Box className="mb-2 flex items-center justify-center gap-1 text-[11px] leading-tight text-muted">
              {match.hot && <Flame className="h-3.5 w-3.5 shrink-0 text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]" />}
              <TeamLogo path={match.league?.logo} name={league} kind="league" size="league" />
              <LeagueLine
                href={compHref}
                name={league}
                className="min-w-0 max-w-[260px] truncate"
              >
                {sportName}
                {' · '}
                {league}
              </LeagueLine>
              {live && <LiveLabel />}
          </Box>
          <Grid className={`${reset}grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2.5`}>
            <span className="flex min-w-0 justify-end">
              <TeamSide teams={match.homeTeams?.length ? match.homeTeams : match.home ? [match.home] : []} sportType={match.sportType} align="home" />
            </span>
            <span className="flex min-w-[72px] items-center justify-center px-1">
              {started ? (
                <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums">{score(match.homeScore)} : {score(match.awayScore)}</span>
              ) : (
                <span className="whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.08em] text-muted">VS</span>
              )}
            </span>
            <span className="flex min-w-0">
              <TeamSide teams={match.awayTeams?.length ? match.awayTeams : match.away ? [match.away] : []} sportType={match.sportType} align="away" />
            </span>
          </Grid>
          <span className="mt-2 flex justify-center">
            {live ? (
              <span className="whitespace-nowrap text-[11px] font-semibold text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]">{statusLabel(match.status)}</span>
            ) : (
              <span className="text-[11px] text-muted"><LocalTime ts={match.matchDate} /></span>
            )}
          </span>
        </Box>
      ) : (
        <Box className="flex min-w-0 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted">
            <TeamLogo path={match.league?.logo} name={league} kind="league" size="league" />
            <LeagueLine href={compHref} name={league} className="truncate">
              {sportName}
              {' · '}
              {league}
            </LeagueLine>
            {live && <LiveLabel />}
          </span>
          <Grid className={`${reset}truncate text-[15px] font-bold`} title={eventName}>{eventName}</Grid>
          {live ? (
            <span className="whitespace-nowrap text-[11px] font-semibold text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]">{statusLabel(match.status)}</span>
          ) : (
            <span className="text-[11px] text-muted"><LocalTime ts={match.matchDate} /></span>
          )}
        </Box>
      )}
    </Box>
  );
}

export function MatchRow({ match, onClick }: MatchRowProps) {
  const live = isLiveStatus(match.status);
  /** Finished / cancelled / cut → muted gray border instead of the sport accent. */
  const finished = (match.status ?? 0) >= 10000;
  const color = sportColor(match.sportType);
  // The card's clubs are links of their own now, so the row's own navigation is
  // an overlay button that names itself: the fixture, plus its competition.
  const label = matchLabel(match);
  return (
    <div
      className={`relative ${live ? ROW_LIVE : finished ? ROW_FINISHED : ROW}`}
      style={{ '--sport-color': color } as CSSProperties}
    >
      <CardContent match={match} />
      <button type="button" className={ROW_OVERLAY} onClick={onClick} aria-label={label} />
    </div>
  );
}

/** Watch-page head — the list-item card (`MatchRow` content, chrome and order)
 *  sitting above the player, minus the click affordances. `children` append
 *  card rows: the watch page passes its fact chips and the description. */
export function MatchHead({ match, children, className }: MatchHeadProps) {
  const live = isLiveStatus(match.status);
  const finished = (match.status ?? 0) >= 10000;
  const color = sportColor(match.sportType);
  const card = live ? HEAD_LIVE : finished ? HEAD_FINISHED : HEAD;
  return (
    <div
      className={`${card}${className ? ` ${className}` : ''}`}
      style={{ '--sport-color': color } as CSSProperties}
    >
      <CardContent match={match} heading />
      {children}
    </div>
  );
}
