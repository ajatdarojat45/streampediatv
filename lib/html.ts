// A tag-level reader for the publisher's own pages.
//
// NowGoal's match pages (`/detail/{id}`, `/analysis/{id}` — see
// lib/nowgoalMatch.ts) are server-rendered HTML: the timeline, the events, the
// lineup with its formation and the last-matches tables are markup, not a file
// behind it. The publisher's own scripts read them with jQuery; this module is
// what lets the readers here do the same without pulling a DOM into the app.
//
// It deliberately stops short of being a DOM. There is no tree, no selector
// engine and no rendering: it walks the tags and answers the four questions the
// match readers ask — *where does this element start and end*, *what does it
// carry*, *what are its children* and *what does it say* — over the exact markup
// the publisher answered. Every lookup returns the element's own outer HTML, so
// a caller can hand a fragment back to the same functions to walk deeper.
//
// Two habits of these pages are handled explicitly, because a naive `<`-scan
// gets both wrong. A `<script>`/`<style>` body is raw text — the publisher's
// inline JS is full of `i<n` and `a&b` — so its contents are never read as
// tags; and a void element (`<img>`, `<br>`, …) never nests, so it cannot
// swallow the rest of the page while a caller looks for its close.

/** One element of the markup: its tags, its own attributes and its insides. */
export interface HtmlElement {
  /** Lower-cased tag name (`div`, `tr`, …). */
  tag: string;
  /** Every attribute of the open tag, values whitespace-collapsed. */
  attrs: Record<string, string>;
  /** The whole element, open tag through close tag. */
  outer: string;
  /** What sits between the tags (`''` for a void element like `<img>`). */
  inner: string;
  /** Index just past the element in the markup it was read from. */
  end: number;
}

/** What to look for: an open tag matches when every field given agrees with it.
 *  An `attrs` value is exact, and `'*'` means the attribute only has to be
 *  there — which is how the publisher's own hooks are addressed (`index`,
 *  `playerid`, `txt`, `techWinId`). */
export interface HtmlSelector {
  tag?: string;
  id?: string;
  class?: string;
  attrs?: Record<string, string>;
}

/** Tags that never hold anything (`<img>`, `<br>`, `<input>`, …). */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
/** Tags whose body is text rather than markup. */
const RAW_TAGS = new Set(['script', 'style']);
/** HTML's optional end tags, which the publisher's own rows lean on heavily:
 *  `<td>8 <td>Corner Kicks <td>2` is a row of three cells, with no `</td>` in
 *  sight. Reading a `td` as if it ran to the end of the table is what would
 *  collapse a last-matches row into one cell, so the opening of a sibling — or
 *  the close of an ancestor — ends it instead. */
const AUTO_CLOSE: Record<string, Set<string>> = {
  td: new Set(['td', 'th', 'tr', 'tbody', 'thead', 'tfoot', 'table']),
  th: new Set(['td', 'th', 'tr', 'tbody', 'thead', 'tfoot', 'table']),
  tr: new Set(['tr', 'tbody', 'thead', 'tfoot', 'table']),
  li: new Set(['li', 'ul', 'ol']),
  option: new Set(['option', 'optgroup', 'select']),
  p: new Set(['p', 'div', 'ul', 'ol', 'table', 'li', 'tr', 'td']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
};

/** One tag, as the scan found it. */
interface TagToken {
  name: string;
  closing: boolean;
  /** Index of the `<`. */
  start: number;
  /** Index just past the `>`. */
  end: number;
  selfClosing: boolean;
  attrs: Record<string, string>;
}

/** The tag name at `index`, or `null` when the `<` there does not open one (a
 *  loose `<` in text, a `<=` in a script, a comment marker). */
function tagNameAt(markup: string, index: number): string | null {
  const match = /^<(\/?)([A-Za-z][A-Za-z0-9:._-]*)/.exec(markup.slice(index, index + 96));
  return match ? match[2].toLowerCase() : null;
}

/** `name="value"`, `name='value'` and bare `name` — the publisher's rows mix all
 *  three. Values keep their inner spacing (a `style` attribute) but not their
 *  runs of whitespace. */
function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const value = match[2];
    attrs[match[1].toLowerCase()] =
      value === undefined ? '' : value.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ');
  }
  return attrs;
}

/** Index of the `</name` that closes a raw-text element opened before `from`
 *  (`<script>` cannot nest, so its first close tag is its own). */
function rawBodyEnd(markup: string, name: string, from: number): number {
  const close = markup.toLowerCase().indexOf(`</${name}`, from);
  return close < 0 ? markup.length : close;
}

/** The next tag at or after `from`, or `null` at the end of the markup. */
function nextTag(markup: string, from: number): TagToken | null {
  let index = markup.indexOf('<', from);
  while (index >= 0) {
    if (markup.startsWith('<!--', index)) {
      const close = markup.indexOf('-->', index + 4);
      index = markup.indexOf('<', close < 0 ? markup.length : close + 3);
      continue;
    }
    const name = tagNameAt(markup, index);
    if (!name) {
      index = markup.indexOf('<', index + 1);
      continue;
    }
    const closing = markup[index + 1] === '/';
    const attrsFrom = index + 1 + (closing ? 1 : 0) + name.length;
    let cursor = attrsFrom;
    let quote = '';
    while (cursor < markup.length) {
      const char = markup[cursor];
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
      cursor += 1;
    }
    if (cursor >= markup.length) return null;
    return {
      name,
      closing,
      start: index,
      end: cursor + 1,
      selfClosing: markup[cursor - 1] === '/',
      attrs: parseAttrs(markup.slice(attrsFrom, markup[cursor - 1] === '/' ? cursor - 1 : cursor)),
    };
  }
  return null;
}

/** Where the scan continues after a token: past its `>`, or past the raw body
 *  of a `<script>`/`<style>` so the code inside is never read as markup. */
function advance(markup: string, token: TagToken): number {
  if (!token.closing && RAW_TAGS.has(token.name)) return rawBodyEnd(markup, token.name, token.end);
  return token.end;
}

/** Whether an open tag satisfies a selector. */
function matches(
  el: { tag: string; attrs: Record<string, string> },
  selector: HtmlSelector,
): boolean {
  if (selector.tag && selector.tag.toLowerCase() !== el.tag) return false;
  if (selector.id && el.attrs.id !== selector.id) return false;
  if (selector.class && !(el.attrs.class ?? '').split(/\s+/).includes(selector.class)) return false;
  for (const [name, value] of Object.entries(selector.attrs ?? {})) {
    const found = el.attrs[name.toLowerCase()];
    if (found === undefined) return false;
    if (value !== '*' && found !== value) return false;
  }
  return true;
}

/** The element a token opens, walked to its own close tag. A void tag (and a
 *  self-closed one) ends where it starts; a tag the page never closes reads to
 *  the end of the markup rather than failing. */
function readElement(markup: string, open: TagToken): HtmlElement {
  if (VOID_TAGS.has(open.name) || open.selfClosing) {
    return {
      tag: open.name,
      attrs: open.attrs,
      outer: markup.slice(open.start, open.end),
      inner: '',
      end: open.end,
    };
  }
  let depth = 1;
  let cursor = advance(markup, open);
  const closers = AUTO_CLOSE[open.name];
  for (;;) {
    const token = nextTag(markup, cursor);
    if (!token) {
      return {
        tag: open.name,
        attrs: open.attrs,
        outer: markup.slice(open.start),
        inner: markup.slice(open.end),
        end: markup.length,
      };
    }
    if (closers && closers.has(token.name) && !(token.closing && token.name === open.name)) {
      // An optional end tag: a sibling cell/row/option ends this one, and an
      // ancestor's close ends it too. A sibling is not consumed (the caller has
      // to see it), an ancestor's close is.
      return {
        tag: open.name,
        attrs: open.attrs,
        outer: markup.slice(open.start, token.closing ? token.end : token.start),
        inner: markup.slice(open.end, token.start),
        end: token.closing ? token.end : token.start,
      };
    }
    if (token.name === open.name) {
      if (token.closing) {
        depth -= 1;
        if (depth === 0) {
          return {
            tag: open.name,
            attrs: open.attrs,
            outer: markup.slice(open.start, token.end),
            inner: markup.slice(open.end, token.start),
            end: token.end,
          };
        }
      } else if (!VOID_TAGS.has(token.name) && !token.selfClosing) {
        depth += 1;
      }
    }
    cursor = advance(markup, token);
  }
}

/** The first element inside `markup` that the selector matches, or `null`. */
export function findElement(markup: string, selector: HtmlSelector, from = 0): HtmlElement | null {
  let cursor = from;
  for (;;) {
    const token = nextTag(markup, cursor);
    if (!token) return null;
    if (!token.closing && matches({ tag: token.name, attrs: token.attrs }, selector)) {
      return readElement(markup, token);
    }
    cursor = advance(markup, token);
  }
}

/** Every element the selector matches, in document order. An element inside a
 *  match already returned is not returned again — the publisher's own rows are
 *  siblings, so one pass over each level is what every reader here wants. */
export function findElements(markup: string, selector: HtmlSelector, from = 0): HtmlElement[] {
  const found: HtmlElement[] = [];
  let cursor = from;
  for (;;) {
    const token = nextTag(markup, cursor);
    if (!token) return found;
    if (!token.closing && matches({ tag: token.name, attrs: token.attrs }, selector)) {
      const el = readElement(markup, token);
      found.push(el);
      cursor = el.end;
      continue;
    }
    cursor = advance(markup, token);
  }
}

/** Every element the selector matches that sits directly inside `markup` — the
 *  same walk as {@link findElements}, except that a match's own insides are
 *  skipped. That is what keeps a nested table's rows from passing as the outer
 *  table's rows, and a player's event icons from passing as his team's. */
export function childElements(markup: string, selector: HtmlSelector, from = 0): HtmlElement[] {
  const found: HtmlElement[] = [];
  let depth = 0;
  let cursor = from;
  for (;;) {
    const token = nextTag(markup, cursor);
    if (!token) return found;
    if (token.closing) {
      depth -= 1;
      cursor = advance(markup, token);
      continue;
    }
    if (depth === 0 && matches({ tag: token.name, attrs: token.attrs }, selector)) {
      const el = readElement(markup, token);
      found.push(el);
      cursor = el.end;
      continue;
    }
    if (!VOID_TAGS.has(token.name) && !token.selfClosing) depth += 1;
    cursor = advance(markup, token);
  }
}

/** An attribute of an element, `''` when it does not carry one. */
export function attr(element: HtmlElement | null | undefined, name: string): string {
  return element?.attrs[name.toLowerCase()] ?? '';
}

/** Whether an element carries a class. */
export function hasClass(element: HtmlElement | null | undefined, name: string): boolean {
  return (element?.attrs.class ?? '').split(/\s+/).includes(name);
}

/** The publisher's own HTML entities as text: the handful of named ones its
 *  pages use plus the numeric forms (`&#39;`, `&#x27;`) its rows are full of. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_all, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_all, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/** What a fragment says: its tags dropped (`<script>`/`<style>` bodies with
 *  them), its entities decoded, its runs of whitespace collapsed. */
export function textOf(markup: string): string {
  let text = '';
  let cursor = 0;
  for (;;) {
    const token = nextTag(markup, cursor);
    if (!token) break;
    text += markup.slice(cursor, token.start);
    cursor = advance(markup, token);
  }
  return decodeEntities(text + markup.slice(cursor)).replace(/\s+/g, ' ').trim();
}

