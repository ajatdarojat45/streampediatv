'use client';

import { useEffect } from 'react';
import { PLAYER_ADS_ENABLED, PLAYER_AD_SCRIPT_SRC, PLAYER_AD_ZONE } from '@/lib/config';

/** Monetag zone id for this site's player-area popunder (env override:
 *  NEXT_PUBLIC_RB_PLAYER_AD_ZONE). */
export const MONETAG_ZONE = '12007023';

/** Monetag tag URL — the zone itself travels in the `data-zone` attribute
 *  (env override: NEXT_PUBLIC_RB_PLAYER_AD_SCRIPT_SRC). */
export const MONETAG_SCRIPT_SRC = 'https://al5sm.com/tag.min.js';

/** Marks the <script> we inject, so duplicate mounts can be detected. */
const ZONE_ATTR = 'data-monetag-zone';

export interface MonetagPopunderProps {
  /** Monetag zone id (defaults to NEXT_PUBLIC_RB_PLAYER_AD_ZONE, or
   *  `MONETAG_ZONE` while that variable is empty). */
  zone?: string;
  /** Tag URL (defaults to NEXT_PUBLIC_RB_PLAYER_AD_SCRIPT_SRC, or
   *  `MONETAG_SCRIPT_SRC` while that variable is empty). */
  src?: string;
}

/**
 * Monetag popunder ("Onclick") — armed on player pages only.
 *
 * Monetag ships a self-invoking snippet that appends a script node carrying
 * `data-zone` to the end of the document:
 *
 *   <script>(function(s){s.dataset.zone='12007023',
 *     s.src='https://al5sm.com/tag.min.js'})
 *     ([document.documentElement, document.body].filter(Boolean).pop()
 *       .appendChild(document.createElement('script')))</script>
 *
 * This component performs the identical injection, but from an effect:
 *
 * - **Hydration-safe by construction.** It renders `null`, so there is no
 *   server markup for the client tree to disagree with and nothing is
 *   serialised into the prerendered HTML. (`next/script` would emit a real
 *   <script> node and run it during prerender, which is exactly what a
 *   click-driven popunder tag must not do.)
 * - `document` is only touched in the browser, after hydration.
 * - `data-zone` is set verbatim — that attribute is how the tag picks its zone.
 *
 * Scoping: the tag exists only while a player page is mounted; unmounting drops
 * it again, so it can never stay armed while the visitor browses the rest of
 * the site. Everything after that (which click opens a tab, the frequency cap)
 * is Monetag's own logic.
 *
 * Layout impact: none. A popunder opens behind the current page and paints no
 * box, frame or overlay, so it can never cover the player. The player surface is
 * intentionally free of any "Advertisement" frame — see the note in
 * components/WatchPageContent.tsx.
 *
 * **Production only.** The tag is never armed while `next dev` runs (see
 * `PLAYER_ADS_ENABLED` in lib/config.ts), so development sessions are never
 * interrupted by ad tabs; set NEXT_PUBLIC_RB_PLAYER_ADS="true" to load it under
 * `next dev` as well.
 */
export function MonetagPopunder({
  zone = PLAYER_AD_ZONE || MONETAG_ZONE,
  src = PLAYER_AD_SCRIPT_SRC || MONETAG_SCRIPT_SRC,
}: MonetagPopunderProps) {
  useEffect(() => {
    // Development build (and the flag not explicitly opted in): never inject the
    // tag. Read once per mount; the value is a build-time constant, so it never
    // changes for a running deployment.
    if (!PLAYER_ADS_ENABLED) return;

    // Already armed: React strict-mode's double effect, a second instance on
    // the page, or client-side navigation back to a player page.
    if (document.querySelector(`script[${ZONE_ATTR}="${zone}"]`)) return;

    const script = document.createElement('script');
    script.dataset.zone = zone; // → data-zone="12007023"
    script.src = src;
    script.setAttribute(ZONE_ATTR, zone);

    // Same anchor Monetag picks: <body> when present, otherwise <html>.
    (document.body ?? document.documentElement).appendChild(script);

    return () => {
      // Leaving the player route — unload the tag so the popunder cannot fire
      // from other pages. The next player page arms a fresh copy.
      script.remove();
    };
  }, [zone, src]);

  // Popunders are invisible by design: no DOM, no placeholder, no overlay.
  return null;
}
