'use client';

import { useEffect, useState } from 'react';

/** Sizes the club/player pages use, in the directory's own vocabulary, plus the
 *  16px box a match card draws its competition crest in — the very size
 *  `TeamLogo`'s `league` variant uses, so a competition badge looks the same
 *  whichever vocabulary its payload speaks. */
const SIZE = {
  xs: 'h-4 w-4 text-[11px]',
  sm: 'h-6 w-6 text-[11px]',
  base: 'h-9 w-9 text-[13px]',
  lg: 'h-16 w-16 text-[22px]',
} as const;

export type GoalooLogoSize = keyof typeof SIZE;

/**
 * A crest, player photo or flag straight off the Goaloo image host.
 *
 * Deliberately not `TeamLogo`: that helper rewrites the host to the current
 * Rblink logo host, while these images live on the Goaloo CDN (the same reason
 * `CompetitionsDirectory` carries its own `Crest`). A blank or broken URL falls
 * back to the name's initial, so no row ever renders a broken image box.
 */
export function GoalooLogo({
  src,
  name,
  size = 'base',
  round = false,
}: {
  src: string;
  name: string;
  size?: GoalooLogoSize;
  /** Player photos read better as circles; crests as rounded squares. */
  round?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const shape = round ? 'rounded-full' : 'rounded-[6px]';
  if (!src || broken) {
    return (
      <span
        className={`${SIZE[size]} inline-flex shrink-0 items-center justify-center ${shape} bg-[#e8eaed] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft`}
        aria-hidden="true"
      >
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    );
  }
  return (
    <img
      className={`${SIZE[size]} shrink-0 object-contain ${shape}`}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
