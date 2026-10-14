'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { ClubLeagueOption, ClubTab } from '@/lib/types';

/** The select chrome the competition page's season picker and the player page's
 *  Tech Stats picker both use. */
const SELECT =
  'cursor-pointer appearance-none rounded-full border border-border bg-panel py-2 pl-3.5 pr-9 text-[13px] font-semibold text-text outline-none transition-colors hover:border-[#c7ccd2] focus:border-accent';
const LABEL = 'text-[13px] font-semibold text-muted';

/**
 * The club page's own filter row: every select below rewrites the club URL with
 * the one key it owns, keeping the panel (`tab`) and every other key it does not
 * touch. The panels themselves stay server-rendered from the URL — the same
 * arrangement the player page uses for its tab, its match-log page and its Tech
 * Stats pair (components/PlayerTechPicker.tsx) — so a filtered view is always a
 * linkable, reloadable URL and the fetch happens on the server.
 */
function usePick(clubId: number) {
  const router = useRouter();
  const params = useSearchParams();
  return (change: { tab: ClubTab } & Record<string, string | null>): void => {
    const q = new URLSearchParams(params.toString());
    q.set('tab', change.tab);
    for (const [key, value] of Object.entries(change)) {
      if (key === 'tab') continue;
      if (value === null || value === '') q.delete(key);
      else q.set(key, value);
    }
    const qs = q.toString();
    router.replace(qs ? `/club/${clubId}?${qs}` : `/club/${clubId}`, { scroll: false });
  };
}

/** One labelled select in the row. */
function Picker({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <span className="relative inline-flex">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </span>
    </>
  );
}

/** The Schedule panel's competition filter — every competition the club feed
 *  lists, plus "All competitions". A new competition starts at its first page,
 *  so the page key is dropped with it. */
export function ClubCompetitionFilter({
  clubId,
  options,
  value,
}: {
  clubId: number;
  options: { id: number; name: string }[];
  /** The selected Goaloo competition id as a string; "" = all competitions. */
  value: string;
}) {
  const pick = usePick(clubId);
  if (options.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <Picker
        id="club-schedule-competition"
        label="Competition"
        value={value}
        onChange={(next) => pick({ tab: 'schedule', comp: next, page: null })}
        options={[
          { value: '', label: 'All competitions' },
          ...options.map((option) => ({ value: String(option.id), label: option.name })),
        ]}
      />
    </div>
  );
}

/** The Transfers panel's year filter — the years the feed publishes transfers
 *  for, newest first. */
export function ClubYearFilter({
  clubId,
  years,
  value,
}: {
  clubId: number;
  years: string[];
  value: string;
}) {
  const pick = usePick(clubId);
  if (years.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <Picker
        id="club-transfer-year"
        label="Year"
        value={value}
        onChange={(next) => pick({ tab: 'transfers', year: next })}
        options={years.map((year) => ({ value: year, label: year }))}
      />
    </div>
  );
}

/**
 * The competition × season pair the Standing and Player data panels read their
 * table from: the competitions this club plays in that the stream catalogue also
 * pairs with a league, and the seasons that league publishes.
 *
 * Switching competition drops the season, so the panel opens on that
 * competition's CURRENT season instead of carrying a season id across leagues.
 * A dropdown with nothing to choose (one competition, one season) is not drawn
 * at all; the panel's caption names the pair either way.
 */
export function ClubLeagueSeasonPicker({
  clubId,
  tab,
  options,
  leagueId,
  seasons,
  season,
}: {
  clubId: number;
  /** The panel the pick belongs to (`standing` or `players`). */
  tab: ClubTab;
  options: ClubLeagueOption[];
  /** The selected Rblink leagueId. */
  leagueId: number;
  /** The league's seasons, newest first. */
  seasons: { id: string; label: string }[];
  /** The selected season id as a string; "" = the competition's current season. */
  season: string;
}) {
  const pick = usePick(clubId);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      {options.length > 1 && (
        <Picker
          id="club-panel-league"
          label="Competition"
          value={String(leagueId)}
          onChange={(next) => pick({ tab, league: next, season: null })}
          options={options.map((option) => ({
            value: String(option.streamId),
            label: option.name,
          }))}
        />
      )}
      {seasons.length > 1 && (
        <Picker
          id="club-panel-season"
          label="Season"
          value={season}
          onChange={(next) => pick({ tab, season: next })}
          options={seasons.map((entry) => ({ value: entry.id, label: entry.label }))}
        />
      )}
    </div>
  );
}
