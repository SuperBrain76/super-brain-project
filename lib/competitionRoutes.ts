/**
 * lib/competitionRoutes.ts — Competition Engine V2
 *
 * Every competition-scoped URL is built here.
 *
 * ────────────────────────────────────────────────────────────
 * THE URL SHAPE
 * ────────────────────────────────────────────────────────────
 *   /premier-league                      hub — fixtures for the current round
 *   /premier-league/leaderboard          global standings
 *   /premier-league/standings            league / group table
 *   /premier-league/leagues              private leagues
 *   /premier-league/leagues/<id>         one private league
 *   /premier-league/fixture/<id>         one fixture
 *   /premier-league/bracket              knockout bracket (has_knockout only)
 *   /premier-league/rules                scoring rules
 *
 * The competition slug is the FIRST path segment — no `/predict` prefix.
 * That makes a competition a first-class place on the platform rather than
 * a parameter of one, and it is why RESERVED_SLUGS below matters: a
 * competition slug shares a namespace with every top-level app route.
 *
 * ⚠️ RESERVED_SLUGS is duplicated in migration 049's admin_create_competition.
 *    Both must be updated together — the database check is the real guard
 *    (it runs even for a competition created by hand in SQL); this copy
 *    gives the wizard an instant client-side answer. Kept in sync by
 *    tests/competition-routes.test.ts.
 */

/**
 * Top-level paths that belong to the application, not to a competition.
 *
 * A competition slug that collided with one of these would be permanently
 * unreachable — Next.js resolves static segments before dynamic ones, so
 * the app route would always win and the competition would 404 silently.
 */
export const RESERVED_SLUGS: readonly string[] = [
  "admin", "api", "auth", "login", "logout", "signup", "settings", "profile", "u",
  "tests", "test", "battle", "economy", "iq", "network", "achievements", "leaderboard",
  "results", "share", "challenge", "welcome", "predict", "privacy", "terms", "contact",
  "disclaimer", "forgot-password", "reset-password", "_next", "static", "favicon.ico",
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

/** Valid competition slug: lowercase, digits, single hyphens, not reserved. */
export function isValidCompetitionSlug(slug: string): boolean {
  if (!slug) return false;
  if (isReservedSlug(slug)) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** Turn a competition name into a candidate slug. Used by the wizard. */
export function slugifyCompetitionName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// ── Path builders ─────────────────────────────────────────────

/**
 * The legacy prefix. `/predict/...` URLs are still live — they are in
 * shared WhatsApp links, sent emails, OG cards and the App Store listing —
 * and are redirected by app/predict/[[...rest]]/page.tsx.
 */
export const LEGACY_PREFIX = "/predict";

function join(slug: string, sub?: string): string {
  if (!sub) return `/${slug}`;
  return `/${slug}/${sub.replace(/^\/+/, "")}`;
}

export const competitionPath = {
  hub:         (slug: string) => join(slug),
  leaderboard: (slug: string) => join(slug, "leaderboard"),
  standings:   (slug: string) => join(slug, "standings"),
  bracket:     (slug: string) => join(slug, "bracket"),
  rules:       (slug: string) => join(slug, "rules"),
  prize:       (slug: string) => join(slug, "prize"),
  bonus:       (slug: string) => join(slug, "bonus"),
  leagues:     (slug: string) => join(slug, "leagues"),
  league:      (slug: string, leagueId: string) => join(slug, `leagues/${leagueId}`),
  leaguesDiscover: (slug: string) => join(slug, "leagues/discover"),
  leaguesJoin: (slug: string) => join(slug, "leagues/join"),
  fixture:     (slug: string, fixtureId: string) => join(slug, `fixture/${fixtureId}`),
  user:        (slug: string, userId: string) => join(slug, `user/${userId}`),
  round:       (slug: string, roundCode: string) => `${join(slug)}?round=${encodeURIComponent(roundCode)}`,
};

/**
 * Translate a legacy `/predict/...` path into the new shape.
 *
 * The one non-mechanical case is the fixture route: `/predict/<uuid>` had
 * the id directly under the prefix, which would now be ambiguous with
 * `/premier-league/leaderboard`. Fixtures moved to an explicit
 * `/fixture/<uuid>` segment, so a bare UUID is detected and re-nested.
 *
 * Returns null when the path has no competition-scoped equivalent.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function legacyPathToCompetitionPath(
  slug: string,
  segments: string[],
): string {
  if (segments.length === 0) return competitionPath.hub(slug);

  // /predict/<uuid> → /<slug>/fixture/<uuid>
  if (segments.length === 1 && UUID_RE.test(segments[0])) {
    return competitionPath.fixture(slug, segments[0]);
  }

  // Everything else maps one-to-one.
  return join(slug, segments.join("/"));
}
