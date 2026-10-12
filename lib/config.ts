// Client-safe app defaults. Every value comes from a NEXT_PUBLIC_* variable in
// .env (see .env.example) — each is referenced statically here so Next.js can
// inline it into the browser bundle.

import { int, required } from './env';

export const DEFAULT_STREAM_ID = int(
  process.env.NEXT_PUBLIC_RB_STREAM_ID,
  'NEXT_PUBLIC_RB_STREAM_ID'
);
export const DEFAULT_CHANNEL_ID = int(
  process.env.NEXT_PUBLIC_RB_CHANNEL_ID,
  'NEXT_PUBLIC_RB_CHANNEL_ID'
);
export const DEFAULT_SITE_TYPE = int(
  process.env.NEXT_PUBLIC_RB_SITE_TYPE,
  'NEXT_PUBLIC_RB_SITE_TYPE'
);
export const DEFAULT_CONTINENT = required(
  process.env.NEXT_PUBLIC_RB_CONTINENT,
  'NEXT_PUBLIC_RB_CONTINENT'
);
export const DEFAULT_COUNTRY = required(
  process.env.NEXT_PUBLIC_RB_COUNTRY,
  'NEXT_PUBLIC_RB_COUNTRY'
);
export const DEFAULT_DEVICE_ID = required(
  process.env.NEXT_PUBLIC_RB_DEVICE_ID,
  'NEXT_PUBLIC_RB_DEVICE_ID'
);
/** Activation code may legitimately be empty. */
export const DEFAULT_ACTIVATION_CODE = process.env.NEXT_PUBLIC_RB_ACTIVATION_CODE ?? '';

/**
 * Where the tab is redirected when the devtools guard detects opened developer
 * tools (see components/DevtoolsGuard.tsx). Defaults to a truly blank page —
 * set NEXT_PUBLIC_DEVTOOLS_BLANK_PATH to a same-origin route (e.g. "/blank") if
 * you'd rather send users to an in-app empty page instead of `about:blank`.
 */
export const DEVTOOLS_BLANK_PATH =
  process.env.NEXT_PUBLIC_DEVTOOLS_BLANK_PATH || 'about:blank';

/* ------------------------------------------------------------------------- *
 * Production-only features — head ads + analytics + player ads + the devtools
 * guard.
 *
 * All of them are only armed in a production build: `next dev` sessions stay
 * free of ad tags, of analytics beacons and of the devtools redirect, so the
 * app remains debuggable locally without polluting any dashboard. The
 * NEXT_PUBLIC_* variables below are the explicit overrides, read statically so
 * Next.js can inline them into the bundle.
 * ------------------------------------------------------------------------- */

/**
 * True in a production build (`next build` → `next start` / Vercel) and false
 * while `next dev` is running. Next.js substitutes `process.env.NODE_ENV` at
 * build time in both the server and the browser bundle, so this is a constant
 * for the lifetime of a deployment.
 */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Resolve a production-only flag from an optional NEXT_PUBLIC_* variable:
 * armed in production and inert in development unless the variable opts in,
 * `"true"` arms the feature under `next dev` too (useful to test a tag
 * locally), `"false"` switches it off even in production.
 */
function productionFlag(value: string | undefined): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return IS_PRODUCTION;
}

/**
 * Head ads (app/layout.tsx) — the Monetag tag for zone 12007023, injected into
 * the document <head> of every page. Production only. Set
 * NEXT_PUBLIC_RB_HEAD_ADS="true" to load the tag under `next dev` (to watch the
 * zone fire locally), or "false" to keep it out of a production build.
 */
export const HEAD_ADS_ENABLED = productionFlag(process.env.NEXT_PUBLIC_RB_HEAD_ADS);

/**
 * Umami analytics (app/layout.tsx) — the `cloud.umami.is` tracking snippet in
 * the document <head> of every page. Production only, so `next dev` pageviews
 * never land in the dashboard. Set NEXT_PUBLIC_RB_ANALYTICS="true" to load the
 * snippet under `next dev` (to confirm local hits are recorded), or "false" to
 * keep it out of a production build.
 */
export const ANALYTICS_ENABLED = productionFlag(process.env.NEXT_PUBLIC_RB_ANALYTICS);

/**
 * Devtools guard (components/DevtoolsGuard.tsx) — arms the `disable-devtool`
 * detectors and redirects to {@link DEVTOOLS_BLANK_PATH}. Production only.
 * Set NEXT_PUBLIC_RB_DEVTOOLS_GUARD="true" to test it under `next dev`.
 */
export const DEVTOOLS_GUARD_ENABLED = productionFlag(
  process.env.NEXT_PUBLIC_RB_DEVTOOLS_GUARD
);

/**
 * Player ads (components/MonetagPopunder.tsx) — the Monetag popunder armed on
 * `/watch/[id]` player pages. Production only. Set
 * NEXT_PUBLIC_RB_PLAYER_ADS="true" to test the tag under `next dev`.
 */
export const PLAYER_ADS_ENABLED = productionFlag(process.env.NEXT_PUBLIC_RB_PLAYER_ADS);

/** Monetag zone id for the player popunder. Empty → the component default. */
export const PLAYER_AD_ZONE = process.env.NEXT_PUBLIC_RB_PLAYER_AD_ZONE || '';

/** Monetag tag URL for the player popunder. Empty → the component default. */
export const PLAYER_AD_SCRIPT_SRC = process.env.NEXT_PUBLIC_RB_PLAYER_AD_SCRIPT_SRC || '';
