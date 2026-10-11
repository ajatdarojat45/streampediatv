'use client';

import { useEffect, useState } from 'react';
import { UTC, formatKickoffLong, formatMatchDate, kickoffISO, userTimeZone } from '@/lib/datetime';

/** Zone the viewer's browser sits in (`Asia/Jakarta`, …), or `null` until the
 *  component has mounted. Neither the server nor the first client render that
 *  has to match it can know the viewer's zone, so callers fall back to the
 *  explicit-UTC stamp while this is still `null` and swap to the local one once
 *  the effect has run — the same "stable placeholder first" trick `Countdown`
 *  uses for `Date.now()`. */
export function useUserTimeZone(): string | null {
  const [timeZone, setTimeZone] = useState<string | null>(null);
  useEffect(() => {
    setTimeZone(userTimeZone() || null);
  }, []);
  return timeZone;
}

interface LocalTimeProps {
  /** Feed kick-off: seconds or milliseconds since epoch. */
  ts?: number;
  /** `short` → "Oct 11, 07:00 PM" (match rows), `long` → "Sun, 11 Oct 2026 · 19:00 GMT+7". */
  variant?: 'short' | 'long';
  className?: string;
}

/** A kick-off rendered in the viewer's own timezone. SSR and the first client
 *  render both emit the UTC stamp, so the markup always matches, and after mount
 *  the stamp switches to the viewer's zone. `dateTime` carries the absolute
 *  instant and, for the compact variant, `title` the full local stamp. */
export function LocalTime({ ts, variant = 'short', className }: LocalTimeProps) {
  const timeZone = useUserTimeZone();
  const format = variant === 'long' ? formatKickoffLong : formatMatchDate;
  const zone = timeZone ?? UTC;
  return (
    <time
      className={className}
      dateTime={kickoffISO(ts)}
      title={variant === 'long' ? undefined : formatKickoffLong(ts, zone) || undefined}
    >
      {format(ts, zone)}
    </time>
  );
}
