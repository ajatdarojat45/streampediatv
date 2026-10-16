import Link from 'next/link';
import { Compass } from 'lucide-react';
import { PANEL_EMPTY } from '@/components/ui';

export default function NotFound() {
  return (
    <section className={`${PANEL_EMPTY} flex flex-col items-center`}>
      <Compass className="h-9 w-9 text-muted" />
      <h2 className="m-0 mt-2 mb-1.5 text-[17px] font-bold">Page not found</h2>
      <p className="m-0 mb-3.5 text-[13px] text-muted">The address you're looking for is not available.</p>
      <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent no-underline hover:underline">← Back to matches</Link>
    </section>
  );
}
