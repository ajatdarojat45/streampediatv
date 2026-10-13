'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { clubHref } from '@/lib/sports';

/** A club's crest + name, wrapped in a link to its own page.
 *
 * The Rblink feeds name a club but carry no club id of their own, so the server
 * action that decoded the payload resolves one from the published name
 * (lib/goalooTeams) and hands it over as `Team.clubId`. With an id the content
 * becomes an `<a>` into `/club/{id}`; without one — an unknown or ambiguous
 * name, or any other sport — the very same content renders as a plain `<span>`,
 * never a dead link.
 *
 * The link is lifted above whatever card it sits in (`relative z-10`) because a
 * feed row is one big click target: the row's own navigation is an absolutely
 * positioned overlay, and the club link has to stay reachable through it — the
 * pattern the club page's fixture rows already use. `className` keeps the layout
 * of the element it replaces (the chip/row span), so the tag swap changes no
 * geometry. */
export function ClubLink({
  id,
  name,
  className,
  children,
}: {
  /** Goaloo club id (`Team.clubId`); `0`/undefined renders plain content. */
  id?: number;
  /** Club name, used for the tooltip. */
  name?: string;
  className?: string;
  children: ReactNode;
}) {
  const href = clubHref(id);
  const classes = className ? `relative z-10 ${className}` : 'relative z-10';
  if (!href) return <span className={classes}>{children}</span>;
  return (
    <Link
      href={href}
      className={`${classes} transition-colors hover:text-accent`}
      title={`${name ?? 'Club'} — squad, fixtures & results`}
    >
      {children}
    </Link>
  );
}
