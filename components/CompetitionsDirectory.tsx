'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Flame, Globe, Play, Trophy } from 'lucide-react';
import { LocalTime } from '@/components/LocalTime';
import { leagueHref } from '@/lib/sports';
import type {
  CompetitionDirectory,
  CompetitionFederation,
  CompetitionHighlight,
  FederationCompetition,
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
const BADGE =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** The one accent-coloured pill: this competition has a stream behind it. */
const WATCH_BADGE =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent';
const HOT = 'h-3.5 w-3.5 shrink-0 text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]';
/** Continent tab row — the same swipeable pill row the feed uses, so the tabs
 *  stay on one line and can be swiped into view on a narrow screen. */
const TAB_ROW =
  'flex flex-nowrap gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/** Federation card: the hover/focus target whose panel lists the federation's
 *  competitions. The open state borrows the tab pair's active colours, so "this
 *  one is open" reads the same on a card as on a pill. */
const CARD =
  'flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-3 text-center transition-all';
const CARD_IDLE = `${CARD} border-border bg-card hover:border-[#c7ccd2] hover:bg-accent-soft`;
const CARD_OPEN = `${CARD} border-accent bg-accent-soft`;
/** Badge box of a card: a fixed square, so the wide country flags and the
 *  publisher's round region badges (Europe, International) share a baseline. */
const CARD_BADGE = 'flex h-10 w-full items-center justify-center';
/** Federation panel. It floats, so opening one never moves the grid out from
 *  under the pointer — a panel that pushed the rows down would drag the card
 *  away from the cursor and flicker. The card swaps `left-0`/`right-0` when a
 *  full-width panel would run past the viewport. */
const MENU =
  'absolute top-[calc(100%+6px)] z-30 w-[min(88vw,640px)] rounded-[var(--radius-sm)] border border-border bg-panel p-3 shadow-[0_12px_32px_rgba(0,0,0,0.16)]';
const MENU_HEAD =
  'm-0 mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border-soft pb-2 text-[12px] text-muted';
const MENU_LIST = 'm-0 list-none columns-2 gap-x-4 min-[560px]:columns-3 min-[900px]:columns-4';
const MENU_ITEM = 'mb-1 break-inside-avoid text-[12.5px] leading-[1.55]';
const MENU_LINK = `${MENU_ITEM} font-semibold text-text underline decoration-dotted underline-offset-2 transition-colors hover:text-accent`;
const MENU_PLAIN = `${MENU_ITEM} text-muted`;

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

/** Federation badge — the country badge the app already draws beside a league
 *  row (the scan's own `flag` column), or the publisher's region badge for the
 *  buckets it files the UEFA/world competitions under. Unlike the competition
 *  crest above it is not square (flags are wide), so it only gets a max height
 *  and lets the box centre it. A federation the scan does not list, or one
 *  whose image fails to load, falls back to its initial. */
function FederationBadge({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8eaed] text-[15px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft"
        aria-hidden="true"
      >
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      className="max-h-10 max-w-full object-contain"
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

/** One competition inside a federation panel. The feed's short code is the
 *  label — that is how the feed itself names a competition in a compact grid —
 *  with the long name as the tooltip and the accessible name, so a screen
 *  reader never has to guess what "ENG LCH" is. A competition the matcher could
 *  not pair with a stream stays plain text, exactly like a row of the list. */
function FederationEntry({ item }: { item: FederationCompetition }) {
  const content = (
    <>
      {item.short}
      {item.hot && <Flame className={`${HOT} ml-1 inline-block align-[-2px]`} aria-label="Headline competition" />}
    </>
  );
  if (item.streamId <= 0) {
    return (
      <li className={MENU_PLAIN} title={`${item.name} — no stream`}>
        {content}
      </li>
    );
  }
  return (
    <li className={MENU_ITEM}>
      <Link
        href={leagueHref(item.streamId, FOOTBALL)}
        className="font-semibold text-text underline decoration-dotted underline-offset-2 transition-colors hover:text-accent"
        title={`${item.name} — fixtures, results & live streams`}
        aria-label={item.name}
      >
        {content}
      </Link>
    </li>
  );
}

/** One federation card: badge, name, and how many competitions it runs — plus
 *  the panel listing them, which is what the card exists for.
 *
 *  Opens on hover and on focus, so a pointer and a keyboard both reach it, and
 *  a click toggles it as well, which is what a touch screen has (there is no
 *  hover there). The panel is rendered only while open — 128 federations
 *  therefore cost 128 cards and no hidden menus — and the crawlable copy of
 *  every competition lives in the country list below, so nothing here has to
 *  carry SEO weight. */
function FederationCard({
  federation,
  open,
  align,
  onOpen,
  onClose,
}: {
  federation: CompetitionFederation;
  open: boolean;
  align: 'start' | 'end';
  onOpen: (card: HTMLLIElement | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { country, areaLabel, logo, competitions, streamed } = federation;
  /** "1 competition" / "3 competitions" — a federation with a single
   *  competition is common in this catalogue (Angola, Guam), and the card's
   *  accessible name and its panel head both quote it. */
  const count = `${competitions.length} ${competitions.length === 1 ? 'competition' : 'competitions'}`;
  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={() => onOpen(ref.current)}
      onMouseLeave={onClose}
      onFocusCapture={() => onOpen(ref.current)}
      onBlurCapture={(e) => {
        // Focus moving *inside* the card (into the panel's links) keeps it open;
        // only a blur that leaves the card closes it.
        if (!ref.current?.contains(e.relatedTarget as Node | null)) onClose();
      }}
    >
      <button
        type="button"
        className={open ? CARD_OPEN : CARD_IDLE}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${country} — ${count}${streamed > 0 ? `, ${streamed} with streams` : ''}`}
        onClick={() => (open ? onClose() : onOpen(ref.current))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <span className={CARD_BADGE}>
          <FederationBadge src={logo} name={country} />
        </span>
        <span className="flex w-full items-center justify-center gap-1">
          <span className="min-w-0 truncate text-[13px] font-semibold text-text">{country}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180 text-accent' : 'text-muted'}`}
            aria-hidden="true"
          />
        </span>
        <span className="flex items-center gap-1.5">
          <span className={BADGE}>{competitions.length}</span>
          {streamed > 0 && (
            <span className={WATCH_BADGE}>
              <Play size={10} aria-hidden="true" />
              {streamed}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className={`${MENU} ${align === 'end' ? 'right-0' : 'left-0'}`}>
          <p className={MENU_HEAD}>
            <span className="text-[13px] font-bold text-text">{country}</span>
            <span>
              {areaLabel} · {count}
              {streamed > 0 ? ` · ${streamed} with streams` : ''}
            </span>
          </p>
          <ul className={MENU_LIST}>
            {competitions.map((c) => (
              <FederationEntry key={c.key} item={c} />
            ))}
          </ul>
        </div>
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

/** The `/competitions` directory: the headline strip on top, then the federation
 *  grid.
 *
 *  The grid is browsed by continent and federation — pick a continent tab,
 *  hover a federation and its panel lists every competition it runs, each entry
 *  a link to its competition page.
 *
 *  A continent tab and the search box compose: the tab picks the region and the
 *  query narrows the federations and their panels — a federation whose every
 *  competition drops out leaves the grid with it. The tab counts are read off
 *  the filtered set itself, so a pill never promises a card the grid cannot
 *  draw. */
export function CompetitionsDirectory({ directory }: { directory: CompetitionDirectory }) {
  const [query, setQuery] = useState('');
  /** `'all'` rather than an area id: 0 is the publisher's own world bucket, so
   *  a numeric sentinel would collide with a real tab. */
  const [tab, setTab] = useState<'all' | number>('all');
  /** The federation whose panel is open, by country — one at a time, so the
   *  grid can never end up with two panels fighting for the pointer. */
  const [openCountry, setOpenCountry] = useState('');
  /** Which edge the open panel hangs from: a card in the right-hand columns
   *  would push a full-width panel past the viewport, so it flips. */
  const [panelEdge, setPanelEdge] = useState<'start' | 'end'>('start');
  const { totals, highlights, areas, generatedAt } = directory;

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  /** One pass per keystroke. Federations and entries are references, never
   *  copies, and a federation left without a match drops out, so a query costs
   *  a scan and nothing else. */
  const matched = useMemo(
    () =>
      directory.federations
        .map((f) => {
          const countryHit = q ? f.country.toLowerCase().includes(q) : false;
          const competitions = f.competitions.filter(
            (c) => !q || countryHit || c.name.toLowerCase().includes(q),
          );
          return { ...f, competitions, streamed: competitions.filter((c) => c.streamId > 0).length };
        })
        .filter((f) => f.competitions.length > 0),
    [directory.federations, q],
  );

  /** Tab counts, read off the same set: a pill's number is exactly what the
   *  grid shows once that pill is picked. */
  const tabs = useMemo(() => {
    const counts = new Map<number, number>();
    for (const f of matched) counts.set(f.area, (counts.get(f.area) ?? 0) + 1);
    return { all: matched.length, counts };
  }, [matched]);

  const federations = useMemo(
    () => (tab === 'all' ? matched : matched.filter((f) => f.area === tab)),
    [matched, tab],
  );
  const activeArea = tab === 'all' ? undefined : areas.find((a) => a.area === tab);
  const gridCompetitions = federations.reduce((n, f) => n + f.competitions.length, 0);

  /** Open a federation's panel, flipping it against whichever viewport edge the
   *  card is closer to. The measured width mirrors the panel's own
   *  `w-[min(88vw,640px)]`. */
  const openFederation = (country: string, card: HTMLLIElement | null) => {
    if (card) {
      const width = Math.min(640, window.innerWidth * 0.88);
      setPanelEdge(card.getBoundingClientRect().left + width > window.innerWidth - 8 ? 'end' : 'start');
    }
    setOpenCountry(country);
  };
  const closeFederation = () => setOpenCountry('');

  /** Any change of view closes the open panel: its entries are the old set. */
  const pickTab = (next: 'all' | number) => {
    setTab(next);
    closeFederation();
  };
  const pickQuery = (next: string) => {
    setQuery(next);
    closeFederation();
  };

  /** When the scan behind the join last ran — the hero's provenance line. */
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

        {/* The catalogue-wide search — the only control this page needs now: it
         *  narrows the grid below, panels included, so the row carries no filter
         *  pills of its own. */}
        <input
          className="mt-3 w-full rounded-xl border border-border bg-panel px-4 py-[11px] text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none"
          type="search"
          placeholder="Search competitions or countries…"
          value={query}
          onChange={(e) => pickQuery(e.target.value)}
        />

        <p className="m-0 mt-2 text-[12px] leading-[1.6] text-muted">
          A competition is only marked <em>Watch</em> when the Goaloo catalogue and the Rblink
          stream catalogue agree on its name and country. Stream list scanned{' '}
          {scan ? <LocalTime ts={scan} variant="long" /> : 'recently'}.
        </p>
      </section>

      {/* The headline strip — a way into the most-watched competitions, right
       *  under the directory hero. It rides on the unfiltered view only: a
       *  continent tab has its own federations to browse, and a search has its
       *  own results. */}
      {highlights.length > 0 && !searching && tab === 'all' && (
        <section className={PANEL}>
          <h2 className="m-0 mb-3 text-[15px] font-bold">Headline competitions</h2>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
            {highlights.map((h) => (
              <HighlightCard key={h.key} item={h} />
            ))}
          </div>
        </section>
      )}

      {/* Browse by continent, then by federation: the tab picks the region, the
       *  cards are that region's federations, and opening one lists the
       *  competitions it runs. */}
      <section className={PANEL}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
            <Globe className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Browse by federation
          </h2>
          <span className="text-[12px] text-muted">
            {federations.length} federations · {gridCompetitions} competitions
            {activeArea ? ` · ${activeArea.label}` : ''}
          </span>
        </div>
        <p className="m-0 mt-1.5 max-w-[760px] text-[13px] leading-[1.65] text-muted">
          Pick a continent, then hover a federation to see every competition it runs — the ones with a
          stream open their competition page, the rest are listed for reference.
        </p>

        <div className={`mt-3 ${TAB_ROW}`} role="tablist" aria-label="Continents">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            className={tab === 'all' ? TAB_ACTIVE : TAB_IDLE}
            onClick={() => pickTab('all')}
          >
            All
            <span className={tab === 'all' ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>{tabs.all}</span>
          </button>
          {areas.map((a) => (
            <button
              key={a.area}
              type="button"
              role="tab"
              aria-selected={tab === a.area}
              className={tab === a.area ? TAB_ACTIVE : TAB_IDLE}
              onClick={() => pickTab(a.area)}
              title={`${a.competitions} competitions in ${a.federations} federations`}
            >
              {a.label}
              <span className={tab === a.area ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>
                {tabs.counts.get(a.area) ?? 0}
              </span>
            </button>
          ))}
        </div>

        {federations.length > 0 ? (
          <ul className="m-0 mt-1 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {federations.map((f) => (
              <FederationCard
                key={f.country}
                federation={f}
                open={openCountry === f.country}
                align={panelEdge}
                onOpen={(card) => openFederation(f.country, card)}
                onClose={closeFederation}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-2 rounded-[var(--radius-sm)] border border-dashed border-border px-4 py-8 text-center">
            <p className="m-0 text-[13px] text-muted">
              No federation{activeArea ? ` in ${activeArea.label}` : ''} matches this view.
            </p>
            {searching && (
              <button type="button" className={`mt-3 ${TAB_IDLE}`} onClick={() => pickQuery('')}>
                Clear search
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
