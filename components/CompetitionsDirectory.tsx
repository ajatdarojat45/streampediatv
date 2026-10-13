'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Flame, Play, Trophy } from 'lucide-react';
import { EmptyMatches } from '@/components/EmptyMatches';
import { LocalTime } from '@/components/LocalTime';
import { leagueHref } from '@/lib/sports';
import type {
  CompetitionDirectory,
  CompetitionDirectoryRow,
  CompetitionHighlight,
} from '@/lib/types';

/** The Rblink catalogue behind the join was scanned with `sportType=1`
 *  (football) only — see tools/gen-rblink-leagues.mjs — so every stream link
 *  built here is a football competition link. */
const FOOTBALL = 1;

/** Surface panel (`.panel`) — the same card the competition page uses. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Filter pills (the competition page's active/idle tab pair). */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
const TAB_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const TAB_COUNT_IDLE = `${TAB_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const TAB_COUNT_ACTIVE = `${TAB_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;
/** Row chrome — a link when the competition streams, a plain row when not. */
const ROW = 'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px]';
const ROW_IDLE = `${ROW} text-muted`;
const ROW_LINK = `${ROW} text-text transition-colors hover:bg-card`;
const BADGE =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** The one accent-coloured pill: this competition has a stream behind it. */
const WATCH_BADGE =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent';
const HOT = 'h-3.5 w-3.5 shrink-0 text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]';
/** Country block header — the toggle that collapses one block. */
const SECTION_HEAD =
  'flex w-full items-center gap-2.5 border-b border-border-soft bg-transparent px-2.5 pb-2 pt-3 text-left';

/** Crest of a headline card. Deliberately not `TeamLogo`: that helper rewrites
 *  the host to the current Rblink logo host, while these crests live on the
 *  Goaloo CDN (`goalooCompetitionLogoUrl`), so they have to load as they are.
 *  A blank or broken one falls back to the competition's initial. */
function Crest({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const size = 'h-8 w-8 shrink-0 rounded-lg text-[15px]';
  if (!src || broken) {
    return (
      <span
        className={`${size} inline-flex items-center justify-center bg-[#e8eaed] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft`}
        aria-hidden="true"
      >
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      className={`${size} object-contain`}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

/** One directory row. A streamed competition links to its competition page —
 *  a league owns a season of fixtures, not a single match id, so the
 *  `/watch/{matchId}?sport=football` deep-link is one hop further on, from the
 *  fixture rows that page renders. */
function Row({ row }: { row: CompetitionDirectoryRow }) {
  const content = (
    <>
      <span className={`min-w-0 flex-1 truncate ${row.streamId > 0 ? 'font-semibold' : ''}`}>
        {row.name}
      </span>
      {row.hot && <Flame className={HOT} aria-label="Trending competition" />}
      {row.streamId > 0 && !row.fixtures && (
        <span className="shrink-0 text-[12px] text-muted max-[640px]:hidden">No fixtures now</span>
      )}
      {row.streamId > 0 ? (
        <span className={WATCH_BADGE}>
          <Play size={11} aria-hidden="true" />
          Watch
        </span>
      ) : (
        <span className={BADGE}>No stream</span>
      )}
    </>
  );
  return (
    <li className="m-0 list-none">
      {row.streamId > 0 ? (
        <Link
          href={leagueHref(row.streamId, FOOTBALL)}
          className={ROW_LINK}
          title={`${row.name} — fixtures, results & live streams`}
        >
          {content}
        </Link>
      ) : (
        <span className={ROW_IDLE}>{content}</span>
      )}
    </li>
  );
}

/** Headline card — one featured competition, its crest and its country. */
function HighlightCard({ item }: { item: CompetitionHighlight }) {
  return (
    <Link
      href={leagueHref(item.streamId, FOOTBALL)}
      className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card px-3.5 py-3 transition-all hover:border-[#c7ccd2]"
      title={`${item.name} — fixtures, results & live streams`}
    >
      <Crest src={item.logo} name={item.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-text">{item.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
          {item.country && <span className="truncate">{item.country}</span>}
        </span>
      </span>
      <span className={WATCH_BADGE}>
        <Play size={11} aria-hidden="true" />
        Watch
      </span>
    </Link>
  );
}

/** The `/competitions` directory: the whole Goaloo catalogue, grouped by
 *  country, with each competition the matcher could pair to a Rblink league
 *  linking out to its competition page. Search matches a competition name or
 *  the country block it sits in; the pill switches between the streamable
 *  subset and the full catalogue. */
export function CompetitionsDirectory({ directory }: { directory: CompetitionDirectory }) {
  const [query, setQuery] = useState('');
  const [streamsOnly, setStreamsOnly] = useState(false);
  const { totals, highlights, generatedAt } = directory;

  /** One pass per keystroke. Rows are references, never copies, and empty
   *  blocks drop out, so the filtered view costs a scan and nothing else. */
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory.sections
      .map((s) => {
        const countryHit = q ? s.country.toLowerCase().includes(q) : false;
        const rows = s.rows.filter(
          (r) => (!streamsOnly || r.streamId > 0) && (!q || countryHit || r.name.toLowerCase().includes(q)),
        );
        return { ...s, rows };
      })
      .filter((s) => s.rows.length > 0);
  }, [directory.sections, query, streamsOnly]);

  const searching = query.trim().length > 0;
  const shown = sections.reduce((n, s) => n + s.rows.length, 0);
  const scan = Date.parse(generatedAt);

  return (
    <>
      <section className={PANEL}>
        <span className="font-mono text-xs text-muted">Directory</span>
        <h1 className="m-0 mt-1 flex items-center gap-2 text-[22px] font-extrabold leading-tight">
          <Trophy className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          Competitions
        </h1>
        <p className="m-0 mt-1.5 max-w-[760px] text-[13px] leading-[1.65] text-muted">
          <strong className="text-text">{totals.competitions}</strong> competitions from{' '}
          <strong className="text-text">{totals.countries}</strong> countries —{' '}
          <strong className="text-text">{totals.streamed}</strong> of them with live streams, plus
          fixtures, results and standings.
        </p>

        {/* Search + filter pills — the same swipeable row the feed uses, so the
         *  input and the pills stay reachable on a narrow screen. */}
        <div className="mt-3 flex flex-nowrap items-center gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <input
            className="min-w-[170px] flex-1 rounded-xl border border-border bg-panel px-4 py-[11px] text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
            type="search"
            placeholder="Search competitions or countries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="flex shrink-0 gap-2.5 whitespace-nowrap">
            <button
              type="button"
              className={streamsOnly ? TAB_ACTIVE : TAB_IDLE}
              onClick={() => setStreamsOnly(true)}
              aria-pressed={streamsOnly}
            >
              <Play size={13} aria-hidden="true" />
              With streams
              <span className={streamsOnly ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>
                {totals.streamed}
              </span>
            </button>
            <button
              type="button"
              className={streamsOnly ? TAB_IDLE : TAB_ACTIVE}
              onClick={() => setStreamsOnly(false)}
              aria-pressed={!streamsOnly}
            >
              All competitions
              <span className={streamsOnly ? TAB_COUNT_IDLE : TAB_COUNT_ACTIVE}>
                {totals.competitions}
              </span>
            </button>
          </span>
        </div>

        <p className="m-0 mt-2 text-[12px] leading-[1.6] text-muted">
          A competition is only marked <em>Watch</em> when the Goaloo catalogue and the Rblink
          stream catalogue agree on its name and country. Stream list scanned{' '}
          {scan ? <LocalTime ts={scan} variant="long" /> : 'recently'}.
        </p>
      </section>

      {highlights.length > 0 && !searching && (
        <section className={PANEL}>
          <h2 className="m-0 mb-3 text-[15px] font-bold">Headline competitions</h2>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
            {highlights.map((h) => (
              <HighlightCard key={h.key} item={h} />
            ))}
          </div>
        </section>
      )}

      {shown > 0 && (
        <section className={PANEL}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-bold">All competitions</h2>
            <span className="text-[12px] text-muted">
              {shown} of {totals.competitions} shown
              {searching ? ` for “${query.trim()}”` : ''}
              {streamsOnly ? ' · streams only' : ''}
            </span>
          </div>
          <ul className="m-0 list-none p-0">
            {sections.map((s) => (
              <CountryBlock
                key={s.country}
                country={s.country}
                rows={s.rows}
                streamed={s.streamed}
                searching={searching}
              />
            ))}
          </ul>
        </section>
      )}

      {shown === 0 && (
        <EmptyMatches
          kind={searching ? 'search' : 'filter'}
          title={searching ? 'No competitions found' : 'No streams in this view'}
          desc={
            searching
              ? `No competition matches “${query.trim()}”. Try another keyword, or clear the search.`
              : 'No competition here has a stream right now. Switch to All competitions for the full catalogue.'
          }
          onClear={searching ? () => setQuery('') : undefined}
        />
      )}
    </>
  );
}

/** One country block. Open by default — this is a directory, so the entries
 *  should be readable without a click — and forced open while a search runs,
 *  so a hit can never hide behind a collapsed block. */
function CountryBlock({
  country,
  rows,
  streamed,
  searching,
}: {
  country: string;
  rows: CompetitionDirectoryRow[];
  streamed: number;
  searching: boolean;
}) {
  const [open, setOpen] = useState(true);
  const expanded = open || searching;
  return (
    <li className="m-0 list-none">
      <button
        type="button"
        className={SECTION_HEAD}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${expanded ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
        <span className="text-[14px] font-bold text-text">{country}</span>
        <span className={BADGE}>{rows.length}</span>
        {streamed > 0 && streamed < rows.length && (
          <span className={WATCH_BADGE}>
            <Play size={11} aria-hidden="true" />
            {streamed} streams
          </span>
        )}
      </button>
      {expanded && (
        <ul className="m-0 list-none p-0">
          {rows.map((r) => (
            <Row key={r.key} row={r} />
          ))}
        </ul>
      )}
    </li>
  );
}
