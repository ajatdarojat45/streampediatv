'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link, { useLinkStatus } from 'next/link';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shirt,
  UserRound,
} from 'lucide-react';
import { LocalTime } from '@/components/LocalTime';
import type {
  NowgoalPlayerAttribute,
  NowgoalPlayerMatch,
  NowgoalPlayerSeasonStats,
  NowgoalPlayerTransfer,
  NowgoalPlayerView,
  NowgoalViewOption,
} from '@/lib/types';

/** Surface panel (`class="panel"`), the card every page of the app renders. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Tab pair — the same pill pair the sport pages and the directory use. */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
/** Dropdown button — the control the toolbar row is made of. */
const SELECT =
  'inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-[13px] font-semibold text-text transition-all hover:border-[#c7ccd2] disabled:opacity-50';
/** Dropdown popup, floating above the content and scrolling on its own — a
 *  competition list runs to a dozen entries. */
const MENU =
  'absolute left-0 top-[calc(100%+6px)] z-30 max-h-[320px] w-[min(78vw,300px)] overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-panel p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)]';
const MENU_ITEM =
  'block w-full rounded px-2.5 py-1.5 text-left text-[13px] text-text transition-colors hover:bg-accent-soft hover:text-accent';
const MENU_ITEM_ON = `${MENU_ITEM} bg-accent-soft font-bold text-accent`;
/** Tab row — one swipeable line on a narrow screen, like the directory's. */
const TAB_ROW =
  'flex flex-nowrap gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/** Fact chip of the hero. */
const CHIP =
  'inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** A group header inside the match log. */
const GROUP_HEAD =
  'mt-3 mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.04em] text-muted';

/** Badge/crest with the app's usual initial fallback (`components/Match.tsx`). */
function Crest({ src, name, size = 'h-6 w-6' }: { src: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-md bg-[#e8eaed] text-[11px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft`}
        aria-hidden="true"
      >
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`${size} shrink-0 object-contain`}
    />
  );
}

/** The player's own photo, with the icon fallback these come off the publisher's
 *  CDN with. */
function Avatar({ src, size = 'h-14 w-14' }: { src: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-[#e8eaed] text-muted [[data-theme=dark]_&]:bg-border-soft`}
        aria-hidden="true"
      >
        <UserRound className="h-1/2 w-1/2" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`${size} shrink-0 rounded-full bg-[#f1f3f4] object-cover [[data-theme=dark]_&]:bg-border-soft`}
    />
  );
}

/** Spinner for a navigation that is still in flight — Next's own `useLinkStatus`
 *  reports it, so this sits inside the link it belongs to. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null;
}

/** The empty state every plate shares — the same dashed box the club page
 *  renders when a file has nothing for the view. */
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mt-3 rounded-[var(--radius-sm)] border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
      {children}
    </p>
  );
}


/** Value of one fact chip of the info tab. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <li className="rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2">
      <span className="block text-[11px] uppercase tracking-[0.04em] text-muted">{label}</span>
      <span className="mt-0.5 block text-[13px] font-semibold text-text">{value}</span>
    </li>
  );
}

/** One dropdown of the toolbar: a button carrying the current label and a list
 *  of the other values, each a plain link to the same page with one query
 *  changed — so a dropdown value can be copied, shared and opened in a new tab
 *  like any other URL. Picking one closes the list and lets the link navigate. */
function Select({
  value,
  options,
  hrefOf,
  label,
}: {
  value: string;
  options: NowgoalViewOption[];
  hrefOf: (key: string) => string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const current = options.find((option) => option.key === value)?.label ?? value;

  // Close on an outside click or Escape — the same behaviour the club page's own
  // dropdowns have.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className={SELECT}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="text-muted">{label}</span>
        <span className="max-w-[180px] truncate">{current}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className={MENU} role="listbox" aria-label={label}>
          {options.map((option) => (
            <Link
              key={option.key}
              href={hrefOf(option.key)}
              scroll={false}
              role="option"
              aria-selected={option.key === value}
              className={option.key === value ? MENU_ITEM_ON : MENU_ITEM}
              onClick={() => setOpen(false)}
            >
              {option.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Prev/next of the match log: a career runs to a hundred matches, so one page
 *  is rendered — and only that page is ever sent to the client. */
function Pager({
  page,
  pageCount,
  hrefOf,
}: {
  page: number;
  pageCount: number;
  hrefOf: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const step =
    'inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2 text-[12px]';
  const idle = `${step} cursor-not-allowed border-dashed opacity-50`;
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-muted">
      {page > 1 ? (
        <Link href={hrefOf(page - 1)} scroll={false} className={`${step} bg-card text-text`}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Prev
          <Pending />
        </Link>
      ) : (
        <span className={idle} aria-disabled="true">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Prev
        </span>
      )}
      <span>
        Page <strong className="text-text">{page}</strong> of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefOf(page + 1)} scroll={false} className={`${step} bg-card text-text`}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Pending />
        </Link>
      ) : (
        <span className={idle} aria-disabled="true">
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}


/** The player's own attributes, as the publisher's own radar draws them: the six
 *  it publishes, on its own 0–100 scale (`max:100` of that chart). The bars are
 *  those six numbers in its own order, labelled with its own abbreviations —
 *  `PAC`, `SHO`, `PHY`, `PAS`, `DEF` and `DRI`, or the keeper's `DIV`, `HAN`,
 *  `POS`, `KIC`, `SPD` and `REF`. It publishes no longer name for any of them, so
 *  none is invented here. */
function AttributeBars({ attributes }: { attributes: NowgoalPlayerAttribute[] }) {
  return (
    <ul className="m-0 mt-2 grid list-none gap-1.5 p-0 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
      {attributes.map((attribute) => {
        const value = Math.max(0, Math.min(100, attribute.value));
        return (
          <li
            key={attribute.key}
            className="rounded-[var(--radius-sm)] border border-border bg-card px-2.5 py-2"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-bold tracking-[0.04em] text-muted">
                {attribute.key}
              </span>
              <span className="text-[12.5px] font-extrabold tabular-nums">{attribute.value}</span>
            </span>
            <span
              className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-border-soft"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${value}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The player's own statistics plate for the open competition and season: the
 *  publisher's own headline block, then its three breakdowns — the same labels
 *  and the same numbers, added up off his own match log (see
 *  lib/nowgoalPlayer.ts). */
function StatPlate({ stats }: { stats: NowgoalPlayerSeasonStats }) {
  const [headline, ...blocks] = stats.blocks;
  return (
    <>
      {headline ? (
        <ul className="m-0 mt-3 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]">
          {headline.facts.map((fact) => (
            <li
              key={fact.label}
              className="rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2 text-center"
            >
              <span className="block text-[19px] font-extrabold tabular-nums">{fact.value}</span>
              <span className="mt-0.5 block text-[11px] uppercase tracking-[0.04em] text-muted">
                {fact.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
        {blocks.map((block) => (
          <div
            key={block.label}
            className="rounded-[var(--radius-sm)] border border-border bg-card px-3 py-2.5"
          >
            <h3 className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
              {block.label}
            </h3>
            <ul className="m-0 list-none p-0">
              {block.facts.map((fact) => (
                <li
                  key={fact.label}
                  className="flex items-baseline justify-between gap-3 border-b border-border-soft py-1 last:border-b-0"
                >
                  <span className="text-[12.5px] text-muted">{fact.label}</span>
                  <span className="text-[13px] font-semibold tabular-nums">{fact.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/** The publisher's own rating bands (`getRatingLevel` of its page): the highest
 *  band first, and the sixth for anything under 5.1. */
const RATING_BANDS: readonly { min: number; className: string; title: string }[] = [
  {
    min: 9.1,
    title: 'rating 9.1 and up',
    className:
      'bg-[#e6f4ea] text-[#137333] [[data-theme=dark]_&]:bg-[#17351f] [[data-theme=dark]_&]:text-[#6ee7a0]',
  },
  {
    min: 8,
    title: 'rating 8.0 – 9.1',
    className:
      'bg-[#e6f4ea] text-[#137333] [[data-theme=dark]_&]:bg-[#17351f] [[data-theme=dark]_&]:text-[#6ee7a0]',
  },
  { min: 7.1, title: 'rating 7.1 – 8.0', className: 'bg-accent-soft text-accent' },
  {
    min: 6.1,
    title: 'rating 6.1 – 7.1',
    className: 'bg-[#eef0f2] text-muted [[data-theme=dark]_&]:bg-border-soft',
  },
  {
    min: 5.1,
    title: 'rating 5.1 – 6.1',
    className:
      'bg-[#fce8e6] text-[#c5221f] [[data-theme=dark]_&]:bg-[#3a1a17] [[data-theme=dark]_&]:text-[#f87171]',
  },
  {
    min: 0,
    title: 'rating under 5.1',
    className:
      'bg-[#fce8e6] text-[#c5221f] [[data-theme=dark]_&]:bg-[#3a1a17] [[data-theme=dark]_&]:text-[#f87171]',
  },
];

/** The band one rating falls in. */
function ratingBand(rating: number) {
  return RATING_BANDS.find((band) => rating > band.min || band.min === 0) ?? RATING_BANDS[5];
}

/** One mark of a match row — a goal, an assist, a card — with its count when the
 *  player did it more than once, which is how the publisher's own row reads it
 *  (`i.goal > 1 ? … : ''` of its `renderSchedule`). */
function Mark({ text, title, className }: { text: string; title: string; className: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${className}`}
    >
      {text}
    </span>
  );
}

/** The four tones the marks of a row are drawn in. */
const GOAL_TONE =
  'border-[#c7e3cd] bg-[#e6f4ea] text-[#137333] [[data-theme=dark]_&]:border-border [[data-theme=dark]_&]:bg-[#17351f] [[data-theme=dark]_&]:text-[#6ee7a0]';
const ASSIST_TONE = 'border-border bg-accent-soft text-accent';
const YELLOW_TONE =
  'border-[#f0dfa8] bg-[#fdf6dd] text-[#8a6d1f] [[data-theme=dark]_&]:border-border [[data-theme=dark]_&]:bg-[#2f2a17] [[data-theme=dark]_&]:text-[#e8cf78]';
const RED_TONE =
  'border-[#f3c9c6] bg-[#fce8e6] text-[#c5221f] [[data-theme=dark]_&]:border-border [[data-theme=dark]_&]:bg-[#3a1a17] [[data-theme=dark]_&]:text-[#f87171]';

/** What the player did in one match: his goals, his assists, his cards — read
 *  off the row of his own log. */
function MatchMarks({ match }: { match: NowgoalPlayerMatch }) {
  const { stats } = match;
  return (
    <>
      {stats.goals > 0 ? (
        <Mark
          text={`G${stats.goals > 1 ? ` ${stats.goals}` : ''}`}
          title={`${stats.goals} goal${stats.goals > 1 ? 's' : ''}`}
          className={GOAL_TONE}
        />
      ) : null}
      {stats.assists > 0 ? (
        <Mark
          text={`A${stats.assists > 1 ? ` ${stats.assists}` : ''}`}
          title={`${stats.assists} assist${stats.assists > 1 ? 's' : ''}`}
          className={ASSIST_TONE}
        />
      ) : null}
      {stats.yellow > 0 ? (
        <Mark
          text={`Y${stats.yellow > 1 ? ` ${stats.yellow}` : ''}`}
          title={`${stats.yellow} yellow card${stats.yellow > 1 ? 's' : ''}`}
          className={YELLOW_TONE}
        />
      ) : null}
      {stats.red > 0 && !stats.twoYellow ? (
        <Mark text="R" title="sent off" className={RED_TONE} />
      ) : null}
      {stats.twoYellow > 0 ? <Mark text="2Y" title="second yellow" className={RED_TONE} /> : null}
    </>
  );
}

/** Millions of pounds, trimmed — the publisher files these in £10k units, so
 *  `750` is £7.5M and `500` is £5M. */
function money(millions: number | null): string {
  if (millions === null) return '—';
  return `£${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2).replace(/0$/, '')}M`;
}


/** One match of the player's own log: when it was played, both sides, the score,
 *  and what he did in it — the row the publisher's own page prints, plus the
 *  minutes and rating it files per match. Both clubs link to their own pages,
 *  which is what the publisher's row does too, and the row's `Match` link opens
 *  the tie's own page (`/matches/{id}` — the log files the match id itself). */
function MatchRow({ match: m }: { match: NowgoalPlayerMatch }) {
  const band = m.stats.rating === null ? null : ratingBand(m.stats.rating);
  return (
    <li className="mb-2 grid grid-cols-[124px_1fr_auto_1fr_auto] items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 max-[860px]:grid-cols-[96px_1fr_auto_1fr] max-[860px]:gap-1.5">
      <span className="text-[11px] leading-[1.35] text-muted">
        {m.kickoffMs ? <LocalTime ts={m.kickoffMs} /> : '—'}
      </span>
      {[m.home, m.away].map((side, index) => (
        <span key={`${side.id}-${index}`} className="contents">
          {index === 1 ? (
            <span className="min-w-[52px] text-center text-[13px] font-extrabold tabular-nums">
              {m.score.replace('-', ' - ')}
            </span>
          ) : null}
          <span
            className={`flex min-w-0 items-center gap-2 ${index === 0 ? 'justify-end text-right' : ''}`}
          >
            {index === 1 ? <Crest src={side.crest} name={side.name} size="h-5 w-5" /> : null}
            <Link
              href={`/teams/${side.id}`}
              scroll={false}
              className="min-w-0 truncate text-[13.5px] font-semibold text-text no-underline hover:text-accent max-[860px]:text-[12.5px]"
            >
              {side.name}
            </Link>
            {index === 0 ? <Crest src={side.crest} name={side.name} size="h-5 w-5" /> : null}
          </span>
        </span>
      ))}
      <span className="flex flex-wrap items-center justify-end gap-1.5 max-[860px]:col-span-4 max-[860px]:justify-start">
        <MatchMarks match={m} />
        {m.stats.minutes > 0 ? (
          <span className="text-[11.5px] tabular-nums text-muted">{m.stats.minutes}&#39;</span>
        ) : null}
        {band && m.stats.rating !== null ? (
          <span
            title={band.title}
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums ${band.className}`}
          >
            {m.stats.rating.toFixed(2)}
          </span>
        ) : null}
        {m.highlights.startsWith('http') ? (
          <a
            href={m.highlights}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] font-semibold text-accent no-underline hover:underline"
          >
            Highlights
          </a>
        ) : null}
        {m.id ? (
          <Link
            href={`/matches/${m.id}`}
            scroll={false}
            className="text-[11px] font-semibold text-accent no-underline hover:underline"
          >
            Match
          </Link>
        ) : null}
      </span>
    </li>
  );
}

/** One page of the player's log, grouped by the competition each match is filed
 *  under — the same grouping the publisher's own page prints, flag and all. The
 *  competition links to its own page. */
function MatchLog({ matches }: { matches: NowgoalPlayerMatch[] }) {
  const groups: { match: NowgoalPlayerMatch; rows: NowgoalPlayerMatch[] }[] = [];
  for (const match of matches) {
    const last = groups[groups.length - 1];
    if (last && last.match.competitionId === match.competitionId) last.rows.push(match);
    else groups.push({ match, rows: [match] });
  }
  return (
    <>
      {groups.map((group) => (
        <div key={`${group.match.competitionId}-${group.match.id}`} className="mt-4 mb-2 first:mt-0">
          <h3 className={GROUP_HEAD}>
            {group.match.countryFlag ? (
              <img
                src={group.match.countryFlag}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-3 w-4 object-cover"
              />
            ) : null}
            <Link
              href={`/competitions/${group.match.competitionId}`}
              scroll={false}
              className="no-underline hover:text-accent"
            >
              {group.match.competition}
            </Link>
          </h3>
          <ul className="m-0 list-none p-0">
            {group.rows.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** The player's career: one row per move, newest first. The publisher's own list
 *  prints only where he went; both ends of a move are published by its file, so
 *  both are shown here — and both link to the club's own page. */
function TransferList({ transfers }: { transfers: NowgoalPlayerTransfer[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {transfers.map((transfer, index) => (
        <li
          key={`${transfer.date}-${transfer.fromTeamId}-${transfer.teamId}-${index}`}
          className="mb-2 grid grid-cols-[112px_1fr_120px] items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 max-[720px]:grid-cols-[1fr_auto]"
        >
          <span className="text-[12.5px] tabular-nums text-muted max-[720px]:col-start-1 max-[720px]:row-start-2">
            {transfer.date || '—'}
            {transfer.season ? (
              <span className="ml-1.5 text-[11px] max-[720px]:hidden">{transfer.season}</span>
            ) : null}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-[13px] max-[720px]:col-span-2 max-[720px]:row-start-1">
            <Link
              href={`/teams/${transfer.fromTeamId}`}
              scroll={false}
              className="flex min-w-0 items-center gap-1.5 text-muted no-underline hover:text-accent"
            >
              <Crest src={transfer.fromTeamCrest} name={transfer.fromTeamName} size="h-5 w-5" />
              <span className="min-w-0 truncate">{transfer.fromTeamName}</span>
            </Link>
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            <Link
              href={`/teams/${transfer.teamId}`}
              scroll={false}
              className="flex min-w-0 items-center gap-1.5 font-semibold text-text no-underline hover:text-accent"
            >
              <Crest src={transfer.teamCrest} name={transfer.teamName} size="h-5 w-5" />
              <span className="min-w-0 truncate">{transfer.teamName}</span>
            </Link>
          </span>
          <span className="text-right text-[12.5px] max-[720px]:col-start-2 max-[720px]:row-start-2">
            <span className="block font-semibold tabular-nums">{money(transfer.feeMillions)}</span>
            <span className="block text-[11px] text-muted">{transfer.type || 'Transfer'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}


/** The `/players/[id]` page body: a hero with the player, a toolbar of the
 *  controls the open tab needs, and the tab itself.
 *
 *  Every control is a link carrying the same query with one value changed, and
 *  the server renders only rows that query asks for — so the URL always says
 *  what is on screen, any view can be shared or opened in a new tab, and neither
 *  the player's whole career log nor a season of it reaches the browser. */
export function PlayerDetail({ view }: { view: NowgoalPlayerView }) {
  const { info } = view;
  /** The query of a view with `overrides` applied. Only the open tab's own
   *  values are written, so switching tabs never drops the season and switching
   *  a competition never drops the tab. A key sent as `''` is left out, which is
   *  how a control resets another one to that tab's own default. */
  const query = (
    overrides: Partial<Record<'tab' | 'scomp' | 'sseason' | 'mpage', string | number>>,
  ): string => {
    const next = {
      tab: view.tab as string,
      scomp: view.statCompetition,
      sseason: view.statSeason,
      mpage: view.matchPage,
      ...overrides,
    };
    const params = new URLSearchParams();
    // The tab the page opens on is left out, so the shortest link is the one a
    // visitor lands on.
    if (next.tab !== 'info') params.set('tab', String(next.tab));
    if (next.tab === 'stats') {
      if (next.scomp) params.set('scomp', String(next.scomp));
      if (next.sseason) params.set('sseason', String(next.sseason));
    }
    if (next.tab === 'matches' && Number(next.mpage) > 1) {
      params.set('mpage', String(next.mpage));
    }
    const search = params.toString();
    return `/players/${info.id}${search ? `?${search}` : ''}`;
  };

  /** The href of the same view with `overrides` applied (the query above, named
   *  the way every control of the page passes it one value). */
  const href = (
    overrides: Partial<Record<'tab' | 'scomp' | 'sseason' | 'mpage', string | number>>,
  ): string => query(overrides);

  /** Whether the open tab has controls at all — the statistics plate's two
   *  dropdowns are the only ones. */
  const hasControls = view.tab === 'stats' && view.statCompetitions.length > 1;

  return (
    <>
      {/* Who is in view: the player, whose he is, and the facts his own file
       *  publishes about him. */}
      <section className={PANEL}>
        <div className="flex min-w-0 items-start gap-3">
          <Avatar src={info.photo} />
          <div className="min-w-0">
            <span className="font-mono text-xs text-muted">
              Player
              {info.country ? ` · ${info.country}` : ''}
            </span>
            <h1 className="m-0 mt-1 flex items-center gap-2 text-[22px] font-extrabold leading-tight">
              <UserRound className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              {info.name}
            </h1>
            <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
              {info.teamName ? (
                <span className={CHIP}>
                  <Crest src={info.teamCrest} name={info.teamName} size="h-3.5 w-3.5" />
                  <Link href={`/teams/${info.teamId}`} className="no-underline text-muted">
                    {info.teamName}
                  </Link>
                </span>
              ) : null}
              {info.number ? (
                <span className={CHIP}>
                  <Shirt className="h-3 w-3" aria-hidden="true" />#{info.number}
                </span>
              ) : null}
              {view.matchCount ? <span>{view.matchCount} matches</span> : null}
              {info.valueMillions !== null ? <span>Value {money(info.valueMillions)}</span> : null}
              {info.age !== null ? <span>Age {info.age}</span> : null}
              {info.updatedMs ? (
                <span>
                  Updated <LocalTime ts={info.updatedMs} />
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className={`mt-3 ${TAB_ROW}`} role="tablist" aria-label="Player sections">
          {view.tabs.map((tab) => (
            <Link
              key={tab.key}
              href={href({ tab: tab.key })}
              scroll={false}
              role="tab"
              aria-selected={tab.key === view.tab}
              className={`no-underline ${tab.key === view.tab ? TAB_ACTIVE : TAB_IDLE}`}
            >
              {tab.label}
              <Pending />
            </Link>
          ))}
        </div>
      </section>

      {/* The controls the open tab needs — the same URL with one value changed,
       *  so the state of the page is always the URL a visitor can share. */}
      {hasControls ? (
        <section className={PANEL}>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              label="Competition"
              value={view.statCompetition}
              options={view.statCompetitions}
              // A competition's seasons are its own, so switching the competition
              // resets the season to that competition's own default.
              hrefOf={(scomp) => href({ scomp, sseason: '' })}
            />
            {view.statSeasons.length > 1 ? (
              <Select
                label="Season"
                value={view.statSeason}
                options={view.statSeasons}
                hrefOf={(sseason) => href({ sseason })}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* The open tab. */}
      <section className={PANEL}>
        {view.tab === 'info' ? (
          <>
            <h2 className="m-0 text-[15px] font-bold">Profile</h2>
            <ul className="m-0 mt-3 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
              <Fact
                label="Club"
                value={
                  info.teamName ? (
                    <Link
                      href={`/teams/${info.teamId}`}
                      scroll={false}
                      className="flex items-center gap-1.5 no-underline text-text"
                    >
                      <Crest src={info.teamCrest} name={info.teamName} size="h-4 w-4" />
                      <span className="min-w-0 truncate">{info.teamName}</span>
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Fact label="Estimated value" value={money(info.valueMillions)} />
              <Fact label="Contract expiry" value={info.contractExpiry || '—'} />
              <Fact
                label="Age"
                value={
                  info.age !== null
                    ? `${info.age}${info.birthday ? ` (${info.birthday})` : ''}`
                    : info.birthday || '—'
                }
              />
              <Fact
                label="Height"
                value={info.heightCm !== null ? `${info.heightCm} cm` : '—'}
              />
              <Fact
                label="Weight"
                value={info.weightKg !== null ? `${info.weightKg} kg` : '—'}
              />
              <Fact label="Preferred foot" value={info.foot || '—'} />
              <Fact
                label="Country"
                value={
                  info.country ? (
                    <span className="flex items-center gap-1.5">
                      {info.countryFlag ? (
                        <img
                          src={info.countryFlag}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-3 w-4 object-cover"
                        />
                      ) : null}
                      {info.country}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <Fact
                label="Competition"
                value={
                  info.competitionId ? (
                    <Link
                      href={`/competitions/${info.competitionId}`}
                      scroll={false}
                      className="flex items-center gap-1.5 no-underline text-text"
                    >
                      <Crest src={info.competitionCrest} name={info.competitionId} size="h-4 w-4" />
                      <span className="min-w-0 truncate">
                        {view.statCompetitions.find((option) => option.key === info.competitionId)
                          ?.label ?? `Competition ${info.competitionId}`}
                      </span>
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Fact label="Matches" value={String(view.matchCount)} />
              {info.updatedMs ? (
                <Fact label="Last updated" value={<LocalTime ts={info.updatedMs} />} />
              ) : null}
            </ul>

            {info.attributes.length ? (
              <>
                <h3 className="m-0 mb-1 mt-4 border-t border-border-soft pt-3 text-[14px] font-bold">
                  Attributes
                </h3>
                <p className="m-0 text-[11.5px] text-muted">
                  The publisher's own six attributes, on its own 0–100 scale.
                </p>
                <AttributeBars attributes={info.attributes} />
              </>
            ) : null}
          </>
        ) : null}

        {view.tab === 'stats' ? (
          view.stats ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="m-0 text-[15px] font-bold">
                  {view.stats.competition} · {view.stats.season}
                </h2>
                <span className="text-[12px] text-muted">
                  {view.stats.matches} matches counted
                </span>
              </div>
              <StatPlate stats={view.stats} />
            </>
          ) : (
            <Empty>
              No match of his is filed under that competition and season — his own log names the
              ones he played in.
            </Empty>
          )
        ) : null}

        {view.tab === 'matches' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">Match log</h2>
              <span className="text-[12px] text-muted">
                {view.matchCount} matches · page {view.matchPage} of {view.matchPageCount}
              </span>
            </div>
            {view.matches.length ? (
              <div className="mt-3">
                <MatchLog matches={view.matches} />
              </div>
            ) : (
              <Empty>The publisher files no match for this player.</Empty>
            )}
            <Pager
              page={view.matchPage}
              pageCount={view.matchPageCount}
              hrefOf={(mpage) => href({ mpage })}
            />
          </>
        ) : null}

        {view.tab === 'transfer' ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="m-0 text-[15px] font-bold">Transfers</h2>
              <span className="text-[12px] text-muted">
                {view.transfers.length} {view.transfers.length === 1 ? 'move' : 'moves'}
              </span>
            </div>
            {view.transfers.length ? (
              <div className="mt-3">
                <TransferList transfers={view.transfers} />
              </div>
            ) : (
              <Empty>The publisher files no move for this player.</Empty>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}

