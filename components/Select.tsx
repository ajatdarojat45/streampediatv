'use client';

import { useCallback, useId, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2 } from 'lucide-react';
import ReactSelect, {
  components,
  type ClassNamesConfig,
  type DropdownIndicatorProps,
  type SingleValue,
  type StylesConfig,
  type ValueContainerProps,
} from 'react-select';
import { MENU_BOX, MENU_ITEM, MENU_ITEM_FOCUS, MENU_ITEM_ON, MENU_LIST, SELECT } from '@/components/ui';
import type { NowgoalViewOption } from '@/lib/types';

/** One value as react-select carries it — the feed's own `{ key, label }`, named
 *  the way the library names it. */
interface Item {
  value: string;
  label: string;
}

/** The whole skin, in the app's own tokens (`components/ui.ts`).
 *
 *  react-select is rendered `unstyled`: it keeps the structure that makes a
 *  combobox work — the control's flex row, the value that truncates, the
 *  absolutely placed menu, the scrolling list, the search input that overlays
 *  the value — and drops every colour, radius and shadow, which is what these
 *  classes put back. Keeping the skin in Tailwind rather than in the library's
 *  runtime CSS also means the server-rendered HTML carries it, so a control
 *  never paints as a bare row of text before hydration. */
const CLASS_NAMES: ClassNamesConfig<Item, false> = {
  container: () => 'relative min-w-0',
  // `SELECT` is the same trigger the app's hand-rolled popovers use, so the two
  // read as one control; only the focus/hover state react-select reports is added.
  control: (state) =>
    `${SELECT} ${state.isFocused ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : ''} ${
      state.isDisabled ? 'opacity-60' : 'cursor-pointer'
    }`,
  valueContainer: () => 'flex min-w-0 items-center gap-2',
  singleValue: () => 'truncate text-text',
  placeholder: () => 'text-muted',
  input: () => 'text-text',
  indicatorsContainer: () => 'shrink-0',
  dropdownIndicator: () => 'flex h-3.5 w-3.5 items-center justify-center text-muted',
  indicatorSeparator: () => 'hidden',
  menu: () => MENU_BOX,
  menuList: () => MENU_LIST,
  // The open value wears the same badge the hand-rolled list gave it; the option
  // the keyboard or the pointer is on wears the list's hover colour, which JS —
  // not `:hover` — reports during an arrow-key walk.
  option: (state) =>
    state.isSelected ? MENU_ITEM_ON : state.isFocused ? `${MENU_ITEM} ${MENU_ITEM_FOCUS}` : MENU_ITEM,
  noOptionsMessage: () => 'px-2.5 py-1.5 text-[13px] text-muted',
  loadingMessage: () => 'px-2.5 py-1.5 text-[13px] text-muted',
};

/** The three things the skin's tokens cannot say, because they are geometry the
 *  library has to own: the value container reads as a row (react-select gives a
 *  single value its own grid), the selected label truncates at the width the old
 *  trigger capped it at, and the popup floats over the sticky header at the same
 *  offset and width cap the hand-rolled menus used (`min(78vw, 300px)`). */
const STYLES: StylesConfig<Item, false> = {
  valueContainer: (base) => ({ ...base, display: 'flex', gap: 6 }),
  singleValue: (base) => ({ ...base, maxWidth: 180 }),
  menu: (base) => ({ ...base, zIndex: 30, minWidth: 220, maxWidth: 'min(78vw, 300px)', margin: '6px 0' }),
};

/** One dropdown of a toolbar: a combobox carrying the current label and the
 *  other values, each of which is one query change on the page's own URL — so a
 *  value can still be linked to, reloaded and shared, and the back button still
 *  walks the values a visitor tried.
 *
 *  Built on react-select for what a `button` plus a list of links cannot do: the
 *  list is a real listbox (arrow keys, Home/End, type-to-search through a long
 *  season or year list, Escape, focus restored to the control) and the menu
 *  flips above the control when it would fall past the bottom of the window. The
 *  visible label is also the combobox's accessible name, so the control reads as
 *  "Season, 2026/2027". */
export function Select({
  value,
  options,
  hrefOf,
  label,
}: {
  /** The page's open value. */
  value: string;
  options: NowgoalViewOption[];
  hrefOf: (key: string) => string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inputId = useId();

  const items = useMemo<Item[]>(
    () => options.map((option) => ({ value: option.key, label: option.label })),
    [options],
  );
  // A value the feed no longer lists (an old season behind a shared link) still
  // has to read on the control, so it falls back to the raw key the way the
  // hand-rolled dropdown did.
  const selected = useMemo<Item>(
    () => items.find((item) => item.value === value) ?? { value, label: value },
    [items, value],
  );

  const choose = (next: SingleValue<Item>) => {
    if (!next || next.value === value) return;
    const href = hrefOf(next.value);
    startTransition(() => router.push(href, { scroll: false }));
  };

  /** Opening the menu warms the router with the same hrefs the links this
   *  replaced handed Next when they came into view, so the first pick of a
   *  freshly opened menu is as immediate as it was. */
  const warm = useCallback(() => {
    for (const item of items) router.prefetch(hrefOf(item.value));
  }, [items, hrefOf, router]);

  // Memoised so the slot identities survive react-select's re-render on every
  // keystroke — a new component type per render would remount the search input
  // and drop its focus.
  const slots = useMemo(
    () => ({
      /** The label sits inside the control, ahead of the value — the shape the
       *  hand-rolled trigger had ("Season 2026/2027 ⌄"). */
      ValueContainer: (props: ValueContainerProps<Item, false>) => (
        <components.ValueContainer {...props}>
          <span className="text-muted">{label}</span>
          {props.children}
        </components.ValueContainer>
      ),
      /** A navigation in flight is reported in the control itself: the chevron
       *  becomes the app's spinner until the new page renders. */
      DropdownIndicator: (props: DropdownIndicatorProps<Item, false>) =>
        pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden="true" />
        ) : (
          <components.DropdownIndicator {...props}>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </components.DropdownIndicator>
        ),
    }),
    [label, pending],
  );

  return (
    <ReactSelect<Item, false>
      inputId={inputId}
      // react-select numbers itself from a module counter that only ever grows,
      // so the ids it stamps on its live region (`react-select-N-live-region`)
      // differ between the server render and hydration and React reports the
      // mismatched attribute. Handing it a frame-stable id from `useId` — the
      // same value on both sides — keeps the name and the markup in step.
      instanceId={inputId}
      aria-label={label}
      unstyled
      classNames={CLASS_NAMES}
      styles={STYLES}
      components={slots}
      options={items}
      value={selected}
      onChange={choose}
      onMenuOpen={warm}
      isDisabled={pending}
      // Short lists (a two-season cup, a total/home/away view) open straight to
      // their values; a long one gets the search box a season or year list
      // deserves.
      isSearchable={items.length > 6}
      menuPlacement="auto"
      maxMenuHeight={320}
      noOptionsMessage={() => 'No other values'}
      formatOptionLabel={(option) => <span className="block truncate">{option.label}</span>}
    />
  );
}
