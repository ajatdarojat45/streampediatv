import Link from 'next/link';
import type { Metadata } from 'next';
import { PANEL } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Terms of Service — StreampediaTV',
};

/** Document title (`.panel h2`). */
const H2 = 'mb-2.5 text-[19px] font-bold';
/** Numbered section heading (`.panel h3`). */
const H3 = 'mb-2 mt-[18px] text-[15px] font-bold';
/** Body copy (`.panel p`). */
const P = 'mb-2.5 text-sm leading-[1.65] text-muted last:mb-0';
/** Bullet list + item (`.panel ul` / `.panel li`). */
const UL = 'mb-2.5 list-disc pl-[22px] text-sm leading-[1.65] text-muted';
const LI = 'mb-1.5 last:mb-0';

export default function TermsPage() {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 max-sm:gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-sm bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent no-underline transition hover:-translate-y-px hover:brightness-95"
        >
          ← Back
        </Link>
        <span className="font-mono text-xs text-muted">Terms</span>
      </div>

      <section className={PANEL}>
        <h2 className={H2}>StreampediaTV – Terms of Service</h2>
        <p className={P}>Effective Date: October 11, 2026</p>

        <h3 className={H3}>1. Acceptance of Terms</h3>
        <p className={P}>
          StreampediaTV (&quot;Us&quot;, &quot;We&quot;, or &quot;Our&quot;) provides the website
          and related sports data and media services (collectively, the &quot;Website&quot;) to
          you, the User, subject to your compliance with all terms, conditions, and notices
          contained herein (the &quot;Terms of Service&quot;). By accessing or using this Website,
          you agree to be bound by these Terms of Service.
        </p>

        <h3 className={H3}>2. Modifications to Services and Terms</h3>
        <p className={P}>
          We reserve the right to modify or update these Terms of Service or discontinue any
          feature of the Website at any time without prior notice. Your continued use of the
          Website following any changes constitutes your acceptance of the revised Terms.
        </p>

        <h3 className={H3}>3. User Conduct and Restrictions</h3>
        <p className={P}>
          Your use of the Website is subject to all applicable laws and regulations. You agree
          not to:
        </p>
        <ul className={UL}>
          <li className={LI}>
            Upload, share, or distribute any content that is unlawful, abusive, defamatory,
            deceptive, or invasive of another’s privacy.
          </li>
          <li className={LI}>
            Infringe upon any patent, trademark, trade secret, copyright, or other proprietary
            rights of any party.
          </li>
          <li className={LI}>
            Transmit viruses, malware, or any code designed to disrupt, damage, or limit the
            functionality of any software or hardware.
          </li>
          <li className={LI}>
            Engage in unauthorized scraping, automated data collection, or spamming.
          </li>
        </ul>

        <h3 className={H3}>4. Third-Party Content and External Embeds</h3>
        <p className={P}>
          <strong>Third-Party Links &amp; Streams:</strong> The Website contains links, embedded
          video players, and real-time statistics provided by third-party external services. We
          do not host, store, or control these third-party materials.
        </p>
        <p className={P}>
          <strong>Disclaimer:</strong> We are not responsible for the accuracy, legality,
          copyright compliance, or decency of content hosted on third-party servers. Accessing
          third-party links is done entirely at your own risk.
        </p>

        <h3 className={H3}>5. Intellectual Property</h3>
        <p className={P}>
          All custom graphics, logos, brand names, icons, and layout designs specific to
          StreampediaTV are the property of StreampediaTV. All other team logos, league
          trademarks, and media assets belong to their respective copyright owners and are used
          strictly for informational and editorial purposes.
        </p>

        <h3 className={H3}>6. Advertisements and External Services</h3>
        <p className={P}>
          The Website displays third-party advertisements (including banners and sponsored
          links). StreampediaTV does not endorse and is not responsible for the products,
          services, or content offered through third-party ad networks. Any interactions or
          transactions with advertisers are strictly between you and the advertiser.
        </p>

        <h3 className={H3}>7. Disclaimer of Warranties</h3>
        <p className={P}>
          All services and content on StreampediaTV are provided on an &quot;AS IS&quot; and
          &quot;AS AVAILABLE&quot; basis without warranties of any kind, either express or
          implied. Temporary service disruptions, video buffering, or data updates delay may
          occur naturally beyond our control.
        </p>

        <h3 className={H3}>8. Limitation of Liability &amp; Termination</h3>
        <p className={P}>
          We reserve the right to suspend or terminate your access to the Website at our sole
          discretion, without prior notice, for conduct that violates these Terms of Service or
          is harmful to other users or the Website. Under no circumstances shall StreampediaTV
          be liable for any direct, indirect, or consequential damages resulting from your use
          of the Website.
        </p>

        <h3 className={H3}>9. Governing Law</h3>
        <p className={P}>
          These Terms of Service shall be governed by and construed in accordance with
          international legal principles without giving effect to conflict of law provisions.
        </p>
      </section>
    </>
  );
}
