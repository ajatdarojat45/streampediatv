import Link from 'next/link';
import type { Metadata } from 'next';
import { required } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Privacy Policy — StreampediaTV',
};

/** Contact address shown throughout the policy (footer reads the same variable). */
const contactEmail = required(process.env.RB_CONTACT_EMAIL, 'RB_CONTACT_EMAIL');

/** Panel card wrapper for the legal copy (`.panel`). */
const PANEL = 'rounded border border-border bg-panel p-6 shadow max-sm:p-3.5';
/** Document title (`.panel h2`). */
const H2 = 'mb-2.5 text-[19px] font-bold';
/** Numbered section heading (`.panel h3`). */
const H3 = 'mb-2 mt-[18px] text-[15px] font-bold';
/** Body copy (`.panel p`). */
const P = 'mb-2.5 text-sm leading-[1.65] text-muted last:mb-0';
/** Bullet list + item (`.panel ul` / `.panel li`). */
const UL = 'mb-2.5 list-disc pl-[22px] text-sm leading-[1.65] text-muted';
const LI = 'mb-1.5 last:mb-0';
/** Inline mailto link inside the muted body copy. */
const MAIL = 'text-accent no-underline hover:underline';

export default function PrivacyPage() {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 max-sm:gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-sm bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent no-underline transition hover:-translate-y-px hover:brightness-95"
        >
          ← Back
        </Link>
        <span className="font-mono text-xs text-muted">Privacy</span>
      </div>

      <section className={PANEL}>
        <h2 className={H2}>StreampediaTV – Privacy Policy</h2>
        <p className={P}>Effective Date: October 11, 2026</p>

        <h3 className={H3}>1. Introduction &amp; Data Controller</h3>
        <p className={P}>
          StreampediaTV (&quot;We&quot;, &quot;Us&quot;, or &quot;Our&quot;) respects your privacy
          and is committed to protecting your personal data. This Privacy Policy outlines how we
          collect, process, and safeguard your information when you use our website and services.
        </p>
        <p className={P}>Data Controller Contact:</p>
        <ul className={UL}>
          <li className={LI}>Website: StreampediaTV</li>
          <li className={LI}>
            Email:{' '}
            <a className={MAIL} href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
          </li>
        </ul>

        <h3 className={H3}>2. Information We Collect</h3>
        <p className={P}>
          We collect minimal data necessary to provide and improve our sports live-streaming,
          statistics, and interactive features:
        </p>
        <ul className={UL}>
          <li className={LI}>
            <strong>Information Provided by You:</strong> Email address (if subscribing to
            newsletters, contacting support, or registering an account).
          </li>
          <li className={LI}>
            <strong>Automated &amp; Usage Data:</strong> IP address, browser type, device
            identifiers, system logs, and interaction data collected via cookies and local
            storage.
          </li>
          <li className={LI}>
            <strong>Third-Party Logins:</strong> If you log in via third-party providers (e.g.,
            Google or Facebook), we may receive basic profile information (such as name and email)
            solely to authenticate your account and customize your experience. We do not sell,
            rent, or permanently store this data.
          </li>
          <li className={LI}>
            <strong>Data We Never Collect:</strong> We never collect sensitive personal data such
            as race, ethnic origin, political opinions, religious beliefs, biometric data, health
            information, or sexual orientation.
          </li>
        </ul>
        <h3 className={H3}>3. Cookies and Advertising (Third-Party Ad Networks)</h3>
        <ul className={UL}>
          <li className={LI}>
            <strong>Ad Networks:</strong> We partner with third-party advertising networks
            (including display and native ad providers) to display advertisements on our Website.
          </li>
          <li className={LI}>
            <strong>Cookies &amp; Identifiers:</strong> These third-party vendors may use cookies,
            device identifiers, or similar technologies to serve ads based on your visits to this
            and other websites.
          </li>
          <li className={LI}>
            <strong>Third-Party Links:</strong> Clicking on external stream links, widgets, or
            advertisements may direct you to third-party sites outside of our control. We strongly
            advise you to review the privacy policies of any third-party sites you visit.
          </li>
        </ul>

        <h3 className={H3}>4. How We Use Your Data</h3>
        <p className={P}>Your data is processed strictly for the following purposes:</p>
        <ul className={UL}>
          <li className={LI}>
            Delivering live scores, sports statistics, and video player interfaces.
          </li>
          <li className={LI}>
            Maintaining website security, preventing abuse, and troubleshooting technical issues
            via system logs.
          </li>
          <li className={LI}>
            Communicating with you regarding platform updates or support requests.
          </li>
          <li className={LI}>
            Serving contextual and relevant advertisements through authorized ad networks.
          </li>
        </ul>
        <h3 className={H3}>5. Data Retention &amp; Security</h3>
        <ul className={UL}>
          <li className={LI}>
            <strong>Security:</strong> We implement appropriate technical and organizational
            measures to prevent unauthorized access, disclosure, modification, or destruction of
            your data.
          </li>
          <li className={LI}>
            <strong>Retention:</strong> Personal data is retained only for as long as necessary to
            fulfill the purposes outlined in this policy or as required by law. System logs and
            temporary session files are periodically cleared.
          </li>
        </ul>

        <h3 className={H3}>6. Your Data Rights</h3>
        <p className={P}>
          You hold full rights regarding your personal information. Upon contacting us at{' '}
          <a className={MAIL} href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
          , you have the right to:
        </p>
        <ul className={UL}>
          <li className={LI}>Request a copy of the personal data we hold about you.</li>
          <li className={LI}>Request correction or complete deletion of your personal data.</li>
          <li className={LI}>Withdraw consent or object to data processing at any time.</li>
        </ul>
        <p className={P}>Requests will be processed free of charge within 30 days of receipt.</p>

        <h3 className={H3}>7. Updates to This Policy</h3>
        <p className={P}>
          We reserve the right to update this Privacy Policy at any time. Any changes will be
          posted on this page with an updated &quot;Effective Date&quot;. We encourage users to
          review this page periodically.
        </p>
      </section>
    </>
  );
}
