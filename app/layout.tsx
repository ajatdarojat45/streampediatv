import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Link from 'next/link';
import { Play } from 'lucide-react';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';
import { RBProvider } from '@/components/RBProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FooterCategories } from '@/components/FooterCategories';
import { SportNav } from '@/components/SportNav';
import { LazyGutterAd } from '@/components/LazyGutterAd';
import { DevtoolsGuard } from '@/components/DevtoolsGuard';
import { required } from '@/lib/env';
import { ANALYTICS_ENABLED, HEAD_ADS_ENABLED } from '@/lib/config';
import { ADSENSE_CLIENT, ADSENSE_SCRIPT_SRC, AD_SLOTS } from '@/lib/ads';

const contactEmail = required(process.env.RB_CONTACT_EMAIL, 'RB_CONTACT_EMAIL');

export const metadata: Metadata = {
  title: 'StreampediaTV — Live Sports',
  description: 'Live sports streaming',
  // The tab icon (favicon) is `app/icon.svg` — the same rounded gradient
  // square + play mark as the header logo below. Next.js serves that file and
  // links it in the document <head> on its own (`<link rel="icon"
  // href="/icon.svg" type="image/svg+xml">`), so declaring `icons` here would
  // only duplicate the tag.
};

/**
 * Monetag ad tag (zone 12007023) — the snippet exactly as issued by the
 * Monetag dashboard, injected verbatim into the document <head> below so the
 * zone is armed on every page of the site:
 *
 *   <script>(function(s){s.dataset.zone='12007023',
 *     s.src='https://al5sm.com/tag.min.js'})
 *     ([document.documentElement, document.body].filter(Boolean).pop()
 *       .appendChild(document.createElement('script')))</script>
 *
 * The snippet is a self-invoking IIFE that builds the tag element
 * (`<script data-zone="12007023" src="https://al5sm.com/tag.min.js">`) and
 * appends it to <body>, falling back to <html>. `data-zone` is the attribute
 * the tag reads to pick its zone, so it has to stay verbatim.
 *
 * Living in the root layout makes this the single, site-wide instance of the
 * zone — `/watch/[id]` included, which is why the player page no longer mounts
 * components/MonetagPopunder.tsx: that component arms the very same zone, and
 * loading both would arm zone 12007023 twice on player pages.
 *
 * Production only — the tag is skipped whenever HEAD_ADS_ENABLED is false (see
 * lib/config.ts), i.e. during `next dev`, so development page views are never
 * counted as real ad traffic. NEXT_PUBLIC_RB_HEAD_ADS="true" arms it locally.
 */
const MONETAG_TAG_SNIPPET =
  "(function(s){s.dataset.zone='12007023',s.src='https://al5sm.com/tag.min.js'})" +
  "([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))";

/**
 * Umami analytics — the snippet exactly as issued by the dashboard, injected
 * into the document <head> below:
 *
 *   <script defer src="https://cloud.umami.is/script.js"
 *     data-website-id="e8d15974-fdcb-4b6f-8ef8-608582e1e2fe"></script>
 *
 * `defer` keeps the request off the critical path (it runs after parsing, i.e.
 * roughly `afterInteractive`), and the script beacons its pageviews back to the
 * same `cloud.umami.is` origin, so no extra configuration is needed here. The
 * website id is public by design (it is visible in the page source of any site
 * running Umami Cloud).
 *
 * Production only — see ANALYTICS_ENABLED in lib/config.ts: `next dev` renders
 * an untracked <head>, so local pageviews never reach the dashboard. Set
 * NEXT_PUBLIC_RB_ANALYTICS="true" to test the snippet locally.
 */
const ANALYTICS_SCRIPT_SRC = 'https://cloud.umami.is/script.js';
const ANALYTICS_WEBSITE_ID = 'e8d15974-fdcb-4b6f-8ef8-608582e1e2fe';

export default function RootLayout({ children }: { children: ReactNode }) {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('rb-theme') : null;
  const initialTheme: string = stored || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  return (
    <html lang="en" data-theme={initialTheme} cz-shortcut-listen="true">
      {/* Document head — third-party tags land here, exactly where each
          dashboard snippet says to paste it. Both are production-only:
          `next dev` ships an untracked, ad-free <head>. */}
      <head>
        {/* Monetag ad tag (zone 12007023) — HEAD_ADS_ENABLED. */}
        {HEAD_ADS_ENABLED && (
          <script dangerouslySetInnerHTML={{ __html: MONETAG_TAG_SNIPPET }} />
        )}
        {/* Umami analytics — ANALYTICS_ENABLED. */}
        {ANALYTICS_ENABLED && (
          <script defer src={ANALYTICS_SCRIPT_SRC} data-website-id={ANALYTICS_WEBSITE_ID} />
        )}
      </head>
      <body>
        {/* Client-only guard: redirects to a blank page if devtools is opened. */}
        <DevtoolsGuard />
        <QueryProvider>
          <RBProvider>
            <div className="mx-auto max-w-[1000px] px-4 pb-16 min-[1025px]:max-w-[calc(60%_+_400px)] max-[640px]:px-3 max-[640px]:pb-12">
              <div className="flex gap-5">
                <aside className="hidden w-40 min-w-0 shrink-0 basis-40 min-[768px]:block" aria-label="Advertisement">
                  <div className="sticky top-5">
                    <LazyGutterAd slotId={AD_SLOTS.sidebarGutterLeft} client={ADSENSE_CLIENT} />
                  </div>
                </aside>
                <div className="min-h-[60vh] min-w-0 flex-1">
                  {/* Sticky app bar — one hairline, one blur, no drop-shadow
                   *  tricks: the page content is the only thing that moves. */}
                  <header className="sticky top-0 z-20 mb-5 flex items-center justify-between gap-3 border-b border-border-soft bg-glass py-3 backdrop-blur-md max-[640px]:mb-4 max-[640px]:py-2.5">
                    <Link href="/" className="group flex min-w-0 items-center gap-2.5 no-underline">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm [background:var(--grad)]">
                        <Play size={18} />
                      </span>
                      <span className="min-w-0">
                        <h1 className="m-0 truncate text-[17px] font-bold leading-tight tracking-[-0.01em] transition-colors group-hover:text-accent">StreampediaTV</h1>
                        <p className="m-0 truncate text-[11px] leading-tight text-muted">Live Sports Streaming</p>
                      </span>
                    </Link>
                    <div className="inline-flex shrink-0 items-center gap-2">
                      {/* Site-wide live indicator, hidden on the narrowest
                       *  screens where the sport tabs need the room. */}
                      <span className="hidden items-center gap-1.5 rounded-full border border-live-border bg-live-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-live-ink min-[420px]:inline-flex">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current animate-blink" />
                        Live
                      </span>
                      <ThemeToggle />
                    </div>
                  </header>
                  <SportNav />
                  <main>{children}</main>
                  <footer className="mt-10 border-t border-border-soft pt-5 text-[12px] text-muted">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-6 pb-5 max-[640px]:grid-cols-[1fr] max-[640px]:gap-5">
                      <div className="min-w-0 text-left">
                        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text">Categories</h3>
                        <FooterCategories />
                      </div>
                      <div className="min-w-0 text-center max-[640px]:text-left">
                        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text">Contact Us</h3>
                        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                          <li>
                            <a href={`mailto:${contactEmail}`} className="text-muted no-underline transition-colors hover:text-accent">
                              {contactEmail}
                            </a>
                          </li>
                        </ul>
                      </div>
                      <div className="min-w-0 text-right max-[640px]:text-left">
                        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-text">Terms</h3>
                        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                          <li>
                            <Link href="/privacy" className="text-muted no-underline transition-colors hover:text-accent">Privacy Policy</Link>
                          </li>
                          <li>
                            <Link href="/terms" className="text-muted no-underline transition-colors hover:text-accent">Terms of Service</Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <p className="m-0 border-t border-border-soft pt-4 text-[11px]">StreampediaTV @ 2026</p>
                  </footer>
                </div>
                <aside className="hidden w-40 min-w-0 shrink-0 basis-40 min-[768px]:block" aria-label="Advertisement">
                  <div className="sticky top-5">
                    <LazyGutterAd slotId={AD_SLOTS.sidebarGutterRight} client={ADSENSE_CLIENT} />
                  </div>
                </aside>
              </div>
            </div>
          </RBProvider>
        </QueryProvider>
        {/* Vercel Analytics + Speed Insights — auto page views and Core Web
            Vitals; both no-op in development and on non-Vercel hosts. Enable
            them for the project in the Vercel dashboard. */}
        <Analytics />
        <SpeedInsights />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var stored = localStorage.getItem('rb-theme');
                var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
        {/* Google AdSense loader — injected once for the whole app. Individual
            ad units queue into `window.adsbygoogle` until it arrives (see
            components/AdBanner.tsx). */}
        <Script
          async
          id="adsbygoogle-init"
          src={ADSENSE_SCRIPT_SRC}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

