/**
 * Which competitions a club page offers, and what one of them is called.
 *
 * The club feed lists the competitions a club plays in — its schedule ajax's
 * `SclassList` ("Spanish La Liga", "UEFA Europa League", …) — as a Goaloo id
 * plus a name, and the club header names the one the club itself plays in. That
 * list is what the Schedule panel's competition filter offers, because that
 * filter only ever narrows a list the same feed publishes.
 *
 * The Standing and Player data panels need more than a name: their tables come
 * from the app's own league endpoints (app/actions.ts), which are keyed by an
 * Rblink leagueId. An entry therefore reaches those two dropdowns only when the
 * stream catalogue pairs the competition with an Rblink league — the same
 * pairing the club header's own competition chip uses (lib/goalooJoin) — and the
 * pair is what the panel then reads its table from. A competition the catalogue
 * cannot pair is not offered there at all, rather than offered and then answered
 * with an empty table.
 *
 * Naming rule, as everywhere in this app: the feed's own name wins, the static
 * catalogue (lib/competitions) is the fallback, and nothing is invented.
 */
import { findCompetition } from './competitions';
import { goalooCompetitionLogoUrl } from './goaloo';
import { rblinkLeagueIdForCompetition } from './goalooJoin';
import type { ClubLeagueOption, GoalooClub, LeagueSeason } from './types';

/** One competition the club feed lists: the Goaloo id and the feed's own name. */
export interface ClubCompetitionRef {
  id: number;
  name: string;
}

/** The feed's own name for one competition of this club — the schedule ajax's
 *  `SclassList` name, then the club header's own competition name, then the
 *  catalogue's. "" when none of them names it. */
export function clubCompetitionName(club: GoalooClub, id: number): string {
  const listed = club.competitions.find((c) => c.id === id)?.name;
  if (listed) return listed;
  if (id === club.leagueId && club.leagueName) return club.leagueName;
  const comp = findCompetition(`s${id}`) || findCompetition(`c${id}`);
  return comp?.name ?? '';
}

/**
 * The catalogue's own reference to ONE competition the club page names: the
 * crest it lists for that competition and the Rblink league it streams as.
 *
 * Those are the two things a match row on the club page needs — the league badge
 * on the card, and the `/competition/{id}` that badge links into — because the
 * club feed publishes a competition as a bare Goaloo id and a name only. Neither
 * is invented: a competition the catalogue does not list keeps `logo: ""` and
 * `streamId: 0`, which draws the badge as plain text instead of a dead link.
 *
 * Both lookups read build-time data, so the answer is remembered per Goaloo id:
 * one club page repeats the same handful of competitions on every match row.
 */
export interface ClubCompetitionRefs {
  /** Name the catalogue lists for the competition — "" when it lists none. */
  name: string;
  /** Absolute crest URL on the Goaloo CDN; "" when there is no crest to draw. */
  logo: string;
  /** Rblink leagueId for `/competition/{id}`; 0 = no stream paired with it. */
  streamId: number;
}

const COMPETITION_REFS = new Map<number, ClubCompetitionRefs>();

/** The catalogue's reference to one Goaloo competition id — see
 *  {@link ClubCompetitionRefs}. */
export function clubCompetitionRefs(goalooId: number): ClubCompetitionRefs {
  const cached = COMPETITION_REFS.get(goalooId);
  if (cached) return cached;
  const comp = findCompetition(`s${goalooId}`) || findCompetition(`c${goalooId}`);
  const refs: ClubCompetitionRefs = {
    name: comp?.name ?? '',
    logo: goalooCompetitionLogoUrl(comp?.logo),
    streamId: rblinkLeagueIdForCompetition(goalooId),
  };
  COMPETITION_REFS.set(goalooId, refs);
  return refs;
}

/** Every competition the club is known to play in — the club's own competition
 *  first (the one its header names), then the rest in the feed's own order, each
 *  id once. */
export function clubCompetitionList(club: GoalooClub): ClubCompetitionRef[] {
  const out: ClubCompetitionRef[] = [];
  const seen = new Set<number>();
  const add = (id: number, name: string): void => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: name || clubCompetitionName(club, id) });
  };
  add(club.leagueId, club.leagueName);
  for (const comp of club.competitions) add(comp.id, comp.name);
  return out;
}

/** The competitions the Standing and Player data panels can read: those the club
 *  plays in AND the stream catalogue pairs with a league. The club's own
 *  competition stays first, so both dropdowns open on the competition this club
 *  is actually in. */
export function clubLeagueOptions(club: GoalooClub): ClubLeagueOption[] {
  const out: ClubLeagueOption[] = [];
  for (const comp of clubCompetitionList(club)) {
    const refs = clubCompetitionRefs(comp.id);
    if (!refs.streamId) continue;
    out.push({
      goalooId: comp.id,
      name: comp.name || refs.name || `Competition ${comp.id}`,
      logo: refs.logo,
      streamId: refs.streamId,
    });
  }
  return out;
}

/** A season's display name — the API localises `name` for language 0 and also
 *  ships the plain slug ("26-27") as a fallback. */
export function leagueSeasonLabel(season: LeagueSeason): string {
  return season.name || season.extraName || String(season.seasonId ?? '');
}
