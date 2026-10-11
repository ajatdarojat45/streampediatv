'use client';

import { useEffect } from 'react';
import DisableDevtool from 'disable-devtool';
import { DEVTOOLS_BLANK_PATH } from '@/lib/config';

/**
 * Redirects the current tab to the configured blank page. `location.replace`
 * avoids leaving the inspected page in the browser history; the `href`
 * assignment is a fallback for engines that reject `about:` via `replace`.
 */
function redirectToBlank(): void {
  try {
    window.location.replace(DEVTOOLS_BLANK_PATH);
  } catch {
    window.location.href = DEVTOOLS_BLANK_PATH;
  }
}

/**
 * Arms the `disable-devtool` guard in the browser. It blocks F12 / Ctrl+Shift+I,
 * the right-click "Inspect" menu and detects devtools opened any other way
 * (browser menu, eruda/vConsole, ...). When a detector fires, the tab is
 * redirected to a blank page so the page can no longer be inspected.
 *
 * `disable-devtool` touches `window`/`document`, so it is only ever called from
 * an effect — it never runs during the server render.
 */
export function DevtoolsGuard() {
  useEffect(() => {
    const { success, reason } = DisableDevtool({
      // Fired whenever a detector notices opened devtools. We deliberately do
      // not call `next()` (which closes the window) and instead redirect to a
      // blank page ourselves so the behaviour is predictable across browsers.
      ondevtoolopen() {
        redirectToBlank();
      },
      // Fallback the library navigates to if its own page-close attempt times
      // out (e.g. the tab cannot self-close because it was not script-opened).
      timeOutUrl: DEVTOOLS_BLANK_PATH,
    });

    if (!success && process.env.NODE_ENV !== 'production') {
      console.warn(`[DevtoolsGuard] disable-devtool did not start: ${reason}`);
    }

    // The guard runs inert listeners/interval timers for the lifetime of the
    // document and has no teardown API — the page is redirected rather than
    // unmounted when devtools is detected, so there is nothing to clean up.
  }, []);

  return null;
}
