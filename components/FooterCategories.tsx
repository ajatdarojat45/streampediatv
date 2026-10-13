import Link from 'next/link';
import { SPORTS } from '@/lib/sports';

/** Footer category links — route to the dedicated /sports/[slug] pages. */
export function FooterCategories() {
  return (
    <ul className="flex flex-row flex-wrap gap-1.5 gap-x-3.5 gap-y-1.5 list-none m-0 p-0 text-[13px]">
      {SPORTS.map((s) => (
        <li key={s.value}>
          <Link href={`/sports/${s.slug}`} className="text-muted transition-colors hover:text-accent">{s.label}</Link>
        </li>
      ))}
    </ul>
  );
}