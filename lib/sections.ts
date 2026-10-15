/**
 * The app's two halves, as routes.
 *
 * The split the navigation and the data layer share (components/SectionSwitch,
 * components/SportNav):
 *
 *   LIVE         `/`, `/sports/{slug}`, `/watch/{id}` — everything built on the
 *                Rblink stream catalogue: the live scores, the category lists
 *                and the player.
 *   COMPETITIONS `/competitions`, `/competition/{id}`, `/club/{id}`,
 *                `/player/{id}` — everything built on the Goaloo publisher: the
 *                worldwide directory, a competition's fixtures and standings, a
 *                club's squad and a player's profile.
 *
 * `/watch/{id}` is where the two meet and is filed under LIVE, because that is
 * what it opens with — the stream (see components/GoalooPanels.tsx for the
 * Goaloo half that joins it there, and lib/goalooLiveJoin.ts for the join).
 */
export const COMPETITION_SECTION = ['/competitions', '/competition/', '/club/', '/player/'];

/** Is this pathname inside the competition half? The directory is matched by
 *  equality (`/competitions`), its three detail routes by prefix, so
 *  `/competition/4356` and `/club/109` are inside and `/competitionsfoo` is
 *  not. */
export function inCompetitionSection(pathname: string | null | undefined): boolean {
  const path = pathname ?? '/';
  return COMPETITION_SECTION.some((prefix) =>
    prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix
  );
}
