/**
 * The app's UI vocabulary.
 *
 * Every surface, pill, button, input, menu and table cell the pages share is
 * declared once here as a Tailwind class string, so the whole app renders one
 * panel, one tab row, one hover state and one radius scale instead of fourteen
 * near-copies of each. It lives in `components/` rather than `lib/` because
 * tailwind.config.js scans that folder for class names.
 *
 * House rules these strings follow — worth keeping when adding to them:
 *
 *   colour   always a token (`bg-panel`, `text-live-ink`, `border-border-hover`)
 *            so light/dark is decided by app/globals.css, never by a
 *            `[[data-theme=dark]_&]` override at the call site;
 *   radius   panels `rounded` · cards/rows `rounded-lg` · controls/menus
 *            `rounded-sm` · pills `rounded-full`;
 *   hover    interactive borders lighten to `border-border-hover`, fills to
 *            `bg-accent-soft` or `bg-surface-2`, and never jump size;
 *   motion   `transition-*` only — the app's easing comes from the Tailwind
 *            theme, so no per-class duration/easing is needed;
 *   spacing  `px-5 py-5` for panels (tightening to `px-3.5` under 640px),
 *            `gap-2` inside pill rows, `gap-4` between stacked cards.
 */

/* ------------------------------------------------------------------------- *
 * Surfaces
 * ----------------------------------------------------------------------- */

/** The card every page is built from. */
export const PANEL =
  'mb-4 rounded border border-border bg-panel px-5 py-5 max-[640px]:px-3.5 max-[640px]:py-3.5';
/** A panel that says one thing (loading / no data) instead of listing rows. */
export const PANEL_EMPTY =
  'mb-4 rounded border border-border bg-panel px-5 py-10 text-center max-[640px]:px-4 max-[640px]:py-8';
/** Panel header — title row, divider underneath (dialogs, list panels). */
export const PANEL_HEAD =
  'flex items-center justify-between gap-3 border-b border-border-soft px-5 py-3.5 max-[640px]:px-3.5';
/** Panel title. Paired with an optional 16px lucide icon via `gap-2`. */
export const PANEL_TITLE = 'm-0 flex items-center gap-2 text-[15px] font-bold';
/** The line item every list and table of the app is made of. */
export const ROW = 'rounded-lg border border-border bg-card px-3.5 py-2.5';
/** The dashed box an empty plate renders. */
export const EMPTY =
  'm-0 mt-3 rounded-sm border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted';
/** Failure notice — toasts and inline banners read exactly the same. */
export const ERROR =
  'mb-4 rounded border border-danger-border bg-danger-soft px-4 py-3 text-[13px] break-words whitespace-pre-wrap text-danger-ink';

/* ------------------------------------------------------------------------- *
 * Type
 * ----------------------------------------------------------------------- */

/** Micro label above a value or a group of rows. */
export const LABEL =
  'flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.04em] text-muted';
/** A label that opens its group (sits above the rows, spaced from them). */
export const GROUP_HEAD = `mt-3 mb-2 ${LABEL}`;
/** Table header cell. */
export const TH = 'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-muted';
/** Table body cell — numerals stay monospaced-width so columns line up. */
export const TD = 'px-2 py-2 text-[13px] tabular-nums';

/* ------------------------------------------------------------------------- *
 * Pills: tabs (page-level), chips (in-panel), badges (facts), counts
 * ----------------------------------------------------------------------- */

/** One swipeable row of pills — the app's standard horizontal scroller. */
export const PILL_ROW =
  'flex flex-nowrap gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** Page-level tab: which view of the data is on screen. */
export const TAB =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all';
export const TAB_IDLE = `${TAB} border-border bg-panel text-muted hover:border-border-hover hover:text-text`;
export const TAB_ACTIVE = `${TAB} border-accent bg-accent-soft text-accent`;

/** In-panel switch — the smaller pill a plate's own lists are switched with. */
export const CHIP =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-all';
export const CHIP_IDLE = `${CHIP} border-border bg-card text-muted hover:border-border-hover hover:text-text`;
export const CHIP_ACTIVE = `${CHIP} border-accent bg-accent-soft text-accent`;

/** Read-only fact: a hero's metadata (venue, round, kick-off date). */
export const BADGE =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted';

/** Count on a tab or chip, and the idle/active pair that goes with it. */
export const COUNT = 'min-w-5 rounded-full px-2 py-px text-center text-[11px] font-bold';
export const COUNT_IDLE = `${COUNT} bg-surface-3 text-muted`;
export const COUNT_ON = `${COUNT} bg-accent-soft text-accent`;

/* ------------------------------------------------------------------------- *
 * Buttons
 * ----------------------------------------------------------------------- */

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold no-underline transition-all disabled:cursor-not-allowed disabled:opacity-50';
/** The action a plate exists for — "Watch live", "Open the player". */
export const BTN_ACCENT = `${BTN_BASE} border-transparent bg-accent text-white hover:opacity-90`;
/** Every other action. */
export const BTN_GHOST = `${BTN_BASE} border-border bg-card text-muted hover:border-border-hover hover:text-text`;
/** Square icon button — refresh, close, expand. 38px, so it is comfortable to
 *  hit on a phone without growing the toolbar it sits in. */
export const ICON_BTN =
  'inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-sm border border-border bg-panel text-muted transition-all hover:border-border-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50';

/* ------------------------------------------------------------------------- *
 * Form controls
 * ----------------------------------------------------------------------- */

/** Search / text input. Focus is the accent ring, same as every focused link. */
export const INPUT =
  'min-w-[170px] flex-1 rounded-sm border border-border bg-panel px-3.5 py-2.5 text-sm text-text transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none';
/** Dropdown trigger (season, competition, view pickers). */
export const SELECT =
  'inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-[13px] font-semibold text-text transition-all hover:border-border-hover disabled:opacity-50';
/** Dropdown popup — floats, scrolls on its own (season lists run long). */
export const MENU =
  'absolute left-0 top-[calc(100%+6px)] z-30 max-h-[320px] w-[min(78vw,300px)] overflow-y-auto rounded-sm border border-border bg-panel p-1.5 shadow-md';
export const MENU_ITEM =
  'block w-full rounded-sm px-2.5 py-1.5 text-left text-[13px] text-text transition-colors hover:bg-accent-soft hover:text-accent';
export const MENU_ITEM_ON = `${MENU_ITEM} bg-accent-soft font-bold text-accent`;
