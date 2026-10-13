'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { playerHref } from '@/lib/sports';

/** A player's photo + name, wrapped in a link to his own page.
 *
 * The Rblink feeds name a footballer but carry no player id of their own, so the
 * server action that decoded the payload resolves one from the published name —
 * inside the squad of the club the row belongs to (lib/goalooSquad) — and hands
 * it over as `Team.playerPageId`. With an id the content becomes an `<a>` into
 * `/player/{id}`; without one — an unknown or ambiguous name, a player the club
 * feed does not list, or any other sport — the very same content renders as a
 * plain `<span>`, never a dead link.
 *
 * The link is lifted above whatever card it sits in (`relative z-10`) because a
 * feed row is one big click target: the row's own navigation is an absolutely
 * positioned overlay, and the player link has to stay reachable through it — the
 * pattern {@link ClubLink} already uses. `className` keeps the layout of the
 * element it replaces (the avatar/name span), so the tag swap changes no
 * geometry. */
export function PlayerLink({
  id,
  name,
  className,
  children,
}: {
  /** Goaloo player id (`Team.playerPageId`); `0`/undefined renders plain content. */
  id?: number;
  /** Player name, used for the tooltip. */
  name?: string;
  className?: string;
  children: ReactNode;
}) {
  const href = playerHref(id);
  const classes = className ? `relative z-10 ${className}` : 'relative z-10';
  if (!href) return <span className={classes}>{children}</span>;
  return (
    <Link
      href={href}
      className={`${classes} transition-colors hover:text-accent`}
      title={`${name ?? 'Player'} — profile, stats & transfers`}
    >
      {children}
    </Link>
  );
}
