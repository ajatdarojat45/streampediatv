'use client';

import { useState } from 'react';
import { playerAvatarUrl } from '@/lib/logos';

/** Player avatar with an initials fallback (the lineup panel's pattern) so a
 *  rotated/blocked avatar host never leaves a broken image in a list.
 *  `sm` = leaderboard rows (28px), `md` = table rows (32px). */
export function PlayerAvatar({
  path,
  name,
  sportType,
  size = 'md',
}: {
  /** Raw or already-expanded avatar path (the URL helper is idempotent). */
  path?: string;
  name: string;
  sportType: number;
  size?: 'sm' | 'md';
}) {
  const [broken, setBroken] = useState(false);
  const src = path ? playerAvatarUrl(sportType, path) : '';
  const box = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-[12px]';
  if (!src || broken) {
    return (
      <span
        className={`inline-flex ${box} shrink-0 items-center justify-center rounded-full bg-[#e8eaed] font-bold text-muted [[data-theme=dark]_&]:bg-border-soft`}
      >
        {(name.trim().charAt(0) || '?').toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`${box} shrink-0 rounded-full bg-[#f1f3f5] object-cover [[data-theme=dark]_&]:bg-border-soft`}
    />
  );
}
