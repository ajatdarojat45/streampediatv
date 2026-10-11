import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// `utc` gives us fixed-offset UTC handling and `timezone` adds IANA zone
// conversion — `.tz('Asia/Jakarta')`, `.offsetName('short')` and
// `dayjs.tz.guess()`. Together they let a kick-off be rendered in the zone the
// viewer actually sits in instead of the feed's UTC stamp.
dayjs.extend(utc);
dayjs.extend(timezone);

/** Zone used by the deterministic formats: the server-side SEO metadata (a
 *  crawler has no viewer zone) and the pre-hydration placeholder in
 *  `LocalTime`. Always spelled out in the string, so it is never ambiguous. */
export const UTC = 'UTC';

/** matchDate can be seconds or milliseconds — normalize to ms. */
export function matchDateMs(matchDate?: number): number | null {
  if (!matchDate) return null;
  return matchDate < 1e12 ? matchDate * 1000 : matchDate;
}

/** Zone the *runtime* sits in — in the browser this is the viewer's own zone
 *  (`Asia/Jakarta`, `Europe/Berlin`, …). Note that on the server this resolves
 *  to the server's zone, so components rendering on both sides must read it
 *  through `useUserTimeZone` instead of calling this during render. */
export function userTimeZone(): string {
  return dayjs.tz.guess();
}

/** Kick-off as a `dayjs` instance: pinned to `timeZone` when one is given, and
 *  left in the runtime's local zone otherwise (i.e. the viewer's, in the
 *  browser). `null` for a missing timestamp. */
function kickoff(matchDate?: number, timeZone?: string): dayjs.Dayjs | null {
  const ms = matchDateMs(matchDate);
  if (ms === null) return null;
  const d = dayjs(ms);
  return timeZone ? d.tz(timeZone) : d;
}

/** Zone suffix — "UTC", "GMT+7", "CEST" — resolved through `Intl` by the
 *  timezone plugin, so a stamp is unambiguous even across the midnight the
 *  conversion can move a match to. Engines whose `Intl` reports no zone name
 *  fall back to the numeric offset dayjs always knows ("+07:00"). */
function zoneLabel(d: dayjs.Dayjs): string {
  return d.offsetName('short') ?? d.format('Z');
}

/** Compact stamp under a match row / H2H result — "Oct 11, 2026, 07:00 PM".
 *  `timeZone` defaults to the runtime's local zone, so a browser render already
 *  follows the viewer's clock. The year is always part of the stamp so a
 *  fixture never reads as ambiguous across seasons. */
export function formatMatchDate(matchDate?: number, timeZone?: string): string {
  const d = kickoff(matchDate, timeZone);
  return d ? d.format('MMM DD, YYYY, hh:mm A') : '-';
}

/** Longer kick-off stamp for the match header, the page description and the SEO
 *  metadata — "Sun, 11 Oct 2026 · 19:00 GMT+7". The zone is part of the string
 *  because the local conversion can move a late kick-off to the next day. */
export function formatKickoffLong(matchDate?: number, timeZone?: string): string {
  const d = kickoff(matchDate, timeZone);
  return d ? `${d.format('ddd, DD MMM YYYY · HH:mm')} ${zoneLabel(d)}` : '';
}

/** Machine-readable absolute instant (`<time dateTime>`), independent of any
 *  zone so it stays correct before and after the local-time upgrade. */
export function kickoffISO(matchDate?: number): string | undefined {
  const ms = matchDateMs(matchDate);
  return ms === null ? undefined : dayjs(ms).toISOString();
}
