'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Globe, Loader2, RefreshCw, Search, Trophy } from 'lucide-react';
import { refreshCompetitionCatalogue } from '@/app/competitions/actions';
import type {
  NowgoalCatalogue,
  NowgoalCompetitionEntry,
  NowgoalFederationEntry,
} from '@/lib/types';

/** Surface panel (`.panel`) — the same card the rest of the app renders. */
const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** Continent pills (the feed's own active/idle tab pair). */
const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-[#c7ccd2] hover:text-text`;
const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;
const TAB_COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
const TAB_COUNT_IDLE = `${TAB_COUNT} bg-[#f1f3f4] text-muted [[data-theme=dark]_&]:bg-border-soft`;
const TAB_COUNT_ACTIVE = `${TAB_COUNT} bg-[rgba(26,115,232,0.2)] text-accent`;
/** Continent tab row — one swipeable line on a narrow screen. */
const TAB_ROW =
  'flex flex-nowrap gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
/** Refresh button — the 38px icon button the sport pages already carry (see
 *  components/SportCategoryMatches.tsx). The page is served from a half-day
 *  cache, so this is how a visitor asks for the list as it stands right now. */
const REFRESH_BUTTON =
  'inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-panel text-base text-muted transition-all hover:border-[#c7ccd2] hover:text-text disabled:cursor-not-allowed disabled:opacity-50';
/** Note a failed refresh leaves behind: the grid below keeps the previous list,
 *  so the page never claims a read it did not get. */
const REFRESH_FAILED = 'Could not refresh just now — the list below is the last one we read.';
const REFRESH_NOTE = 'm-0 mt-2 text-[12px] leading-[1.6] text-[#d93025] [[data-theme=dark]_&]:text-[#f87171]';
/** Competition-count chip on a card and on a headline tile. */
const BADGE =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';
/** Federation card: the hover/focus target whose panel lists the competitions
 *  it runs. The open state borrows the pill pair's active colours, so "this one
 *  is open" reads the same on a card as on a tab. */
const CARD =
  'flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-3 text-center transition-all';
const CARD_IDLE = `${CARD} border-border bg-card hover:border-[#c7ccd2] hover:bg-accent-soft`;
const CARD_OPEN = `${CARD} border-accent bg-accent-soft`;
/** Badge box of a card: a fixed square, so the wide country flags and the
 *  publisher's own region badges (Europe, International) share a baseline. */
const CARD_BADGE = 'flex h-10 w-full items-center justify-center';
/** Federation panel. It floats, so opening one never pushes the grid out from
 *  under the pointer — a panel that moved the rows down would drag the card
 *  away from the cursor and flicker. The card swaps `left-0`/`right-0` when a
 *  full-width panel would run past the viewport. */
const MENU =
  'absolute top-[calc(100%+6px)] z-30 w-[min(88vw,640px)] rounded-[var(--radius-sm)] border border-border bg-panel p-3 shadow-[0_12px_32px_rgba(0,0,0,0.16)]';
const MENU_HEAD =
  'm-0 mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border-soft pb-2 text-[12px] text-muted';
const MENU_LIST = 'm-0 list-none columns-2 gap-x-4 min-[560px]:columns-3 min-[900px]:columns-4';
const MENU_ITEM = 'mb-1 break-inside-avoid text-[12.5px] leading-[1.55]';
/** Panel entry link: the feed's short code is the label — that is how the feed
 *  itself names a competition in a compact grid — and the full name rides along
 *  as the tooltip and the accessible name, so "ENG LCH" is never a guess. */
const MENU_LINK =
  'font-semibold text-text underline decoration-dotted underline-offset-2 transition-colors hover:text-accent';

/** Initial a badge/crest box falls back to — the same fallback the rest of the
 *  app's logos use (see components/Match.tsx). */
function initial(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

/** Federation badge — the country flag the feed publishes, or the publisher's
 *  own region badge for the buckets it files the UEFA/world competitions under.
 *  A flag is wide, not square, so the image only gets a max height and the box
 *  centres it. A badge that never loads (or that the feed does not publish)
 *  falls back to the federation's initial. */
function FederationBadge({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8eaed] text-[15px] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft"
        aria-hidden="true"
      >
        {initial(name)}
      </span>
    );
  }
  return (
    // The host is the publisher's own image CDN, so the Next image optimizer is
    // not in the path: these are plain `<img>`s, lazy and without a referrer,
    // exactly like the Goaloo crests elsewhere in the app.
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

/** Competition crest — `/mini/fbleague/{id}.png` on the same image CDN, drawn
 *  square so a wide federation flag and a round cup crest share a baseline. */
function CompetitionCrest({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const size = 'h-8 w-8 shrink-0 rounded-lg text-[15px]';
  if (!src || broken) {
    return (
      <span
        className={`${size} inline-flex items-center justify-center bg-[#e8eaed] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft`}
        aria-hidden="true"
      >
        {initial(name)}
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

/** One competition inside a federation panel. The entry is this app's own page
 *  for that competition (`/competitions/{id}`), so it opens in the same tab —
 *  the panel closes on navigation, which is the only state it holds. */
function FederationEntry({ item }: { item: NowgoalCompetitionEntry }) {
  const title = `${item.name} — fixtures, results & standings`;
  return (
    <li className={MENU_ITEM}>
      <Link className={MENU_LINK} href={item.href} title={title} aria-label={title}>
        {item.name}
      </Link>
      {item.season && (
        <span className="ml-1.5 whitespace-nowrap text-[11px] text-muted">{item.season}</span>
      )}
    </li>
  );
}

/** One federation card: badge, name and how many competitions it runs — plus
 *  the panel listing them, which is what the card exists for.
 *
 *  Opens on hover and on focus, so a pointer and a keyboard both reach it, and a
 *  click toggles it as well, which is all a touch screen has (there is no hover
 *  there). The panel is rendered only while open — 127 federations therefore
 *  cost 127 cards and no hidden menus — and every entry in it is a link to that
 *  competition's own page. */
function FederationCard({
  federation,
  open,
  align,
  onOpen,
  onClose,
}: {
  federation: NowgoalFederationEntry;
  open: boolean;
  align: 'start' | 'end';
  onOpen: (card: HTMLLIElement | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { name, badge, continent, competitions } = federation;
  /** "1 competition" / "3 competitions" — a federation running a single
   *  competition is common in this catalogue (Angola, Guam), and both the
   *  card's accessible name and its panel head quote it. */
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
        aria-label={`${name} — ${count}`}
        onClick={() => (open ? onClose() : onOpen(ref.current))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <span className={CARD_BADGE}>
          <FederationBadge src={badge} name={name} />
        </span>
        <span className="flex w-full items-center justify-center gap-1">
          <span className="min-w-0 truncate text-[13px] font-semibold text-text">{name}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180 text-accent' : 'text-muted'}`}
            aria-hidden="true"
          />
        </span>
        <span className={BADGE}>{competitions.length}</span>
      </button>

      {open && (
        <div
          className={`${MENU} ${align === 'end' ? 'right-0' : 'left-0'}`}
          role="group"
          aria-label={`${name} competitions`}
        >
          <p className={MENU_HEAD}>
            <span className="text-[13px] font-bold text-text">{name}</span>
            <span>
              {continent} · {count}
            </span>
          </p>
          <ul className={MENU_LIST}>
            {competitions.map((c) => (
              <FederationEntry key={c.id} item={c} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/** Headline tile — one top-flight league, its crest, the country it belongs to
 *  and the season its rows carry. The tier badge is the feed's own `topTier`
 *  flag, not a guess about which leagues matter. */
function TopFlightTile({
  competition,
  federation,
}: {
  competition: NowgoalCompetitionEntry;
  federation: string;
}) {
  const title = `${competition.name} — ${federation}, ${competition.season}`;
  return (
    <Link
      href={competition.href}
      className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card px-3.5 py-3 no-underline transition-all hover:border-[#c7ccd2]"
      title={title}
      aria-label={title}
    >
      <CompetitionCrest src={competition.crest} name={competition.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-text">{competition.name}</span>
        <span className="mt-0.5 block truncate text-[12px] text-muted">
          {federation}
          {competition.season ? ` · ${competition.season}` : ''}
        </span>
      </span>
    </Link>
  );
}

/** The `/competitions` directory: a hero with the catalogue totals and its
 *  search box, the top-flight strip, then the federation grid.
 *
 *  The grid is browsed by continent and by federation — pick a continent tab,
 *  hover (or focus, or tap) a federation and its panel lists every competition
 *  it runs, each entry a link to that competition's own page.
 *
 *  The tab and the search box compose: the tab picks the region and the query
 *  narrows both the federations and the competitions inside their panels — a
 *  federation whose every competition drops out leaves the grid with it. The tab
 *  counts are read off the filtered set itself, so a pill never promises a card
 *  the grid cannot draw.
 *
 *  The hero carries a refresh button: the page itself is served from a half-day
 *  cache, so that is how a visitor asks for the list as it stands right now. */
export function CompetitionsDirectory({ catalogue: initial }: { catalogue: NowgoalCatalogue }) {
  /** The list on screen: the server's catalogue to begin with, replaced by a
   *  freshly read one on refresh — every count (hero totals, tabs, cards) reads
   *  off this, so one read moves the whole page together. */
  const [catalogue, setCatalogue] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  /** Set only by a failed refresh — see `REFRESH_FAILED`. */
  const [refreshError, setRefreshError] = useState('');
  const [query, setQuery] = useState('');
  /** `'all'` rather than an area id, because `'0'` is the publisher's own
   *  intercontinental bucket — a numeric sentinel would collide with a tab. */
  const [tab, setTab] = useState<'all' | string>('all');
  /** The open federation, by feed id — one at a time, so the grid can never end
   *  up with two panels fighting for the pointer. */
  const [openId, setOpenId] = useState('');
  /** Which edge the open panel hangs from: a card in the right-hand columns
   *  would push a full-width panel past the viewport, so it flips. */
  const [panelEdge, setPanelEdge] = useState<'start' | 'end'>('start');
  const { totals, continents } = catalogue;

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  /** One pass per keystroke. A query matches a federation by its own name — in
   *  which case all of its competitions stay — or by the name of a competition,
   *  and a federation left without a match drops out of the grid. */
  const matched = useMemo(
    () =>
      catalogue.federations
        .map((f) => ({
          ...f,
          competitions: f.competitions.filter(
            (c) => !q || f.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
          ),
        }))
        .filter((f) => f.competitions.length > 0),
    [catalogue.federations, q],
  );

  /** Tab counts, read off the same set: a pill's number is exactly what the grid
   *  shows once that pill is picked. */
  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of matched) counts.set(f.area, (counts.get(f.area) ?? 0) + 1);
    return { all: matched.length, counts };
  }, [matched]);

  const federations = useMemo(
    () => (tab === 'all' ? matched : matched.filter((f) => f.area === tab)),
    [matched, tab],
  );
  const activeContinent = tab === 'all' ? undefined : continents.find((c) => c.key === tab);
  const gridCompetitions = federations.reduce((n, f) => n + f.competitions.length, 0);

  /** The feed's own `topTier` rows — the 20-odd top flights in the current feed:
   *  a direct way into the leagues a visitor is most likely after. */
  const topFlights = useMemo(
    () =>
      catalogue.federations.flatMap((f) =>
        f.competitions.filter((c) => c.topTier).map((c) => ({ competition: c, federation: f.name })),
      ),
    [catalogue.federations],
  );

  /** Open a federation's panel, flipping it against whichever viewport edge the
   *  card sits closer to. The measured width mirrors the panel's own
   *  `w-[min(88vw,640px)]`. */
  const openFederation = (id: string, card: HTMLLIElement | null) => {
    if (card) {
      const width = Math.min(640, window.innerWidth * 0.88);
      setPanelEdge(
        card.getBoundingClientRect().left + width > window.innerWidth - 8 ? 'end' : 'start',
      );
    }
    setOpenId(id);
  };
  const closeFederation = () => setOpenId('');

  /** Any change of view closes the open panel: its entries are the old set. */
  const pickTab = (next: 'all' | string) => {
    setTab(next);
    closeFederation();
  };
  const pickQuery = (next: string) => {
    setQuery(next);
    closeFederation();
  };

  /** Re-read the catalogue on demand. The grid keeps the list it has while the
   *  read is in flight — nothing is cleared — and a failed read only leaves a
   *  note behind, so the page a visitor is already browsing stays intact. */
  const refresh = async () => {
    setRefreshing(true);
    setRefreshError('');
    try {
      const res = await refreshCompetitionCatalogue();
      if (res.ok) {
        setCatalogue(res.data);
        // The open panel belongs to the list being replaced.
        closeFederation();
      } else {
        setRefreshError(REFRESH_FAILED);
      }
    } catch {
      setRefreshError(REFRESH_FAILED);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs text-muted">Directory</span>
            <h1 className="m-0 mt-1 flex items-center gap-2 text-[22px] font-extrabold leading-tight">
              <Trophy className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              Competitions
            </h1>
          </div>
          <button
            type="button"
            className={REFRESH_BUTTON}
            onClick={() => void refresh()}
            disabled={refreshing}
            title="Refresh"
            aria-label="Refresh competitions"
          >
            {refreshing ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <RefreshCw size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="m-0 mt-1.5 max-w-[760px] text-[13px] leading-[1.65] text-muted">
          <strong className="text-text">{totals.competitions}</strong> competitions from{' '}
          <strong className="text-text">{totals.federations}</strong> federations —{' '}
          <strong className="text-text">{totals.leagues}</strong> leagues and{' '}
          <strong className="text-text">{totals.cups}</strong> cups, grouped under the country or
          region that runs them.
        </p>

        {/* The catalogue-wide search — the only control this page needs besides
         *  the continent tabs: it narrows the grid below, panels included. */}
        <label className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-[11px] transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Search competitions or countries</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            type="search"
            placeholder="Search competitions or countries…"
            value={query}
            onChange={(e) => pickQuery(e.target.value)}
          />
        </label>

        {/* A refresh that failed is the only notable thing the hero ever says. */}
        {refreshError ? <p className={REFRESH_NOTE}>{refreshError}</p> : null}
      </section>

      {/* Top flights, straight from the feed's own `topTier` rows. The strip
       *  rides on the unfiltered view only: a continent tab has federations of
       *  its own to browse, and a search has its own results. */}
      {topFlights.length > 0 && !searching && tab === 'all' && (
        <section className={PANEL}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="m-0 text-[15px] font-bold">Top-flight leagues</h2>
            <span className="text-[12px] text-muted">{topFlights.length} competitions</span>
          </div>
          <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
            {topFlights.map((t) => (
              <TopFlightTile
                key={t.competition.id}
                competition={t.competition}
                federation={t.federation}
              />
            ))}
          </div>
        </section>
      )}

      {/* Browse by continent, then by federation: the tab picks the region, the
       *  cards are that region's federations, and opening one lists every
       *  competition it runs. */}
      <section className={PANEL}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
            <Globe className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Browse by federation
          </h2>
          <span className="text-[12px] text-muted">
            {federations.length} federations · {gridCompetitions} competitions
            {activeContinent ? ` · ${activeContinent.label}` : ''}
          </span>
        </div>
        <p className="m-0 mt-1.5 max-w-[760px] text-[13px] leading-[1.65] text-muted">
          {searching ? (
            <>
              Competitions matching &ldquo;{query.trim()}&rdquo;. Hover or tap a federation to see
              every competition it runs.
            </>
          ) : (
            <>
              Pick a continent, then hover a federation to see every competition it runs — each
              entry opens that competition&apos;s own page of fixtures, results and standings.
            </>
          )}
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
          {continents.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={tab === c.key}
              className={tab === c.key ? TAB_ACTIVE : TAB_IDLE}
              onClick={() => pickTab(c.key)}
              title={`${c.competitions} competitions in ${c.federations} federations`}
            >
              {c.label}
              <span className={tab === c.key ? TAB_COUNT_ACTIVE : TAB_COUNT_IDLE}>
                {tabs.counts.get(c.key) ?? 0}
              </span>
            </button>
          ))}
        </div>

        {federations.length > 0 ? (
          <ul className="m-0 mt-1 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {federations.map((f) => (
              <FederationCard
                key={f.id}
                federation={f}
                open={openId === f.id}
                align={panelEdge}
                onOpen={(card) => openFederation(f.id, card)}
                onClose={closeFederation}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-2 rounded-[var(--radius-sm)] border border-dashed border-border px-4 py-8 text-center">
            <p className="m-0 text-[13px] text-muted">No federation in this view.</p>
            <button
              type="button"
              className={`mt-3 ${TAB_IDLE}`}
              onClick={() => (searching ? pickQuery('') : pickTab('all'))}
            >
              {searching ? 'Clear search' : 'All continents'}
            </button>
          </div>
        )}
      </section>
    </>
  );
}



