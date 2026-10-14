'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { GoalooLogo } from '@/components/GoalooLogo';
import { leagueHref } from '@/lib/sports';

/** The player feed is a football feed — every competition link built here is
 *  football. */
const FOOTBALL = 1;

/** One competition in the Tech Stats picker, with the seasons the feed lists for
 *  it — newest first, the order the feed's own dropdowns use — plus the
 *  catalogue's own reference to it: the crest to draw beside the name and the
 *  Rblink league that streams it, which is what makes the caption's name a link
 *  into `/competition/{id}`. */
export interface PlayerTechGroup {
  leagueId: number;
  competition: string;
  /** Competition crest URL (Goaloo CDN, absolute); "" when there is none. */
  logo: string;
  /** Rblink leagueId for `/competition/{id}`; 0 = no stream for the pair. */
  streamId: number;
  seasons: string[];
}

/** The same select chrome the competition page's season picker uses. */
const SELECT =
  'cursor-pointer appearance-none rounded-full border border-border bg-panel py-2 pl-3.5 pr-9 text-[13px] font-semibold text-text outline-none transition-colors hover:border-[#c7ccd2] focus:border-accent';

/**
 * The Tech Stats competition × season picker — the feed's two dropdowns, in the
 * same order and with the same default (the player's own competition, its newest
 * season). The choice is local state so the selects answer instantly, and the URL
 * is rewritten behind it (`?tab=stats&league=…&season=…`, no scroll jump) so the
 * view stays shareable and reloadable; the panels themselves are rendered from
 * the URL by the server component that owns them.
 *
 * A dropdown with a single option is not drawn at all — the caption names the
 * pair either way, with the competition's own crest beside it and its name a link
 * into `/competition/{id}` whenever the stream catalogue pairs a stream with it.
 */
export function PlayerTechPicker({
  playerId,
  groups,
  leagueId,
  season,
}: {
  playerId: number;
  groups: PlayerTechGroup[];
  leagueId: number;
  season: string;
}) {
  const router = useRouter();
  const [pick, setPick] = useState({ leagueId, season });

  const active = groups.find((group) => group.leagueId === pick.leagueId);
  const seasons = active?.seasons ?? [];

  /** Switch competition or season: the selects update at once, the URL follows. */
  const open = (next: { leagueId: number; season: string }): void => {
    setPick(next);
    const q = new URLSearchParams({
      tab: 'stats',
      league: String(next.leagueId),
      season: next.season,
    });
    router.replace(`/player/${playerId}?${q}`, { scroll: false });
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      {groups.length > 1 && (
        <>
          <label htmlFor="player-tech-league" className="text-[13px] font-semibold text-muted">
            Competition
          </label>
          <span className="relative inline-flex">
            <select
              id="player-tech-league"
              value={pick.leagueId}
              onChange={(e) => {
                const leagueId = Number(e.target.value);
                const first = groups.find((group) => group.leagueId === leagueId)?.seasons[0] ?? '';
                open({ leagueId, season: first });
              }}
              className={SELECT}
            >
              {groups.map((group) => (
                <option key={group.leagueId} value={group.leagueId}>
                  {group.competition}
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
      )}
      {seasons.length > 1 && (
        <>
          <label htmlFor="player-tech-season" className="text-[13px] font-semibold text-muted">
            Season
          </label>
          <span className="relative inline-flex">
            <select
              id="player-tech-season"
              value={pick.season}
              onChange={(e) => open({ leagueId: pick.leagueId, season: e.target.value })}
              className={SELECT}
            >
              {seasons.map((option) => (
                <option key={option} value={option}>
                  {option}
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
      )}
      {active && (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <GoalooLogo src={active.logo} name={active.competition} size="xs" />
          <span>
            Showing{' '}
            {active.streamId > 0 ? (
              <Link
                href={leagueHref(active.streamId, FOOTBALL)}
                title={`${active.competition} — fixtures, results & standings`}
                className="font-bold text-text no-underline transition-colors hover:text-accent hover:underline"
              >
                {active.competition}
              </Link>
            ) : (
              <strong className="text-text">{active.competition}</strong>
            )}{' '}
            · <strong className="text-text">{pick.season}</strong>
          </span>
        </span>
      )}
    </div>
  );
}
