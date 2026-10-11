// Google AdSense configuration.
//
// These values are public — they appear verbatim in the rendered HTML — so they
// live here rather than in .env (which is gitignored and would not survive a
// deploy). Read them from the AdSense dashboard: Ads → By ad unit.
//
// The global loader script is injected once in `app/layout.tsx`; the individual
// ad units are rendered by components/AdBanner.tsx.

/** Publisher ID — `client=` in the loader URL, `data-ad-client` on each unit. */
export const ADSENSE_CLIENT = 'ca-pub-3053362475102454';

/** Async AdSense loader for the publisher above (injected in `app/layout.tsx`). */
export const ADSENSE_SCRIPT_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

/** Numeric `data-ad-slot` IDs, keyed by placement. */
export const AD_SLOTS = {
  /** `Sidebar_Gutter_Left` — the left gutter rail in `app/layout.tsx`. */
  sidebarGutterLeft: '2753720996',
  /** `Sidebar_Gutter_Right` — the right gutter rail in `app/layout.tsx`. */
  sidebarGutterRight: '3802158911',
  /** `Top_Leaderboard` — leaderboard above the content on every page type. */
  topLeaderboard: '4853270722',
  /** `Content_Banner_Bottom` — banner after the content on every page type. */
  contentBannerBottom: '6584409937',
} as const;
