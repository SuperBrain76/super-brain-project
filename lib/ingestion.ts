/**
 * Automated match result ingestion — Competition Engine
 *
 * Provider: API-Football (v3). Competition-agnostic: every competition-
 * specific value now comes from `competition_settings`, not from a constant
 * in this file.
 *
 * Design principles:
 *   1. DB-first: always check our own fixtures table before touching the
 *      external API. Skip the API call entirely if no match is active or
 *      imminent. This is the primary request-saving mechanism.
 *
 *   2. Ingestion window is DERIVED FROM FIXTURES, not from hardcoded dates.
 *      (Previously `isTournamentWindow()` hardcoded the WC2026 calendar,
 *      which silently disabled all ingestion after 20 July 2026.)
 *
 *   3. Fixture identity comes from the PROVIDER'S OWN FIXTURE ID.
 *      Kickoff-time matching is used for one purpose only — the one-off
 *      backfill that populates those ids — and never to route a result.
 *      See docs/FIXTURE_IDENTITY_RISK.md.
 *
 *   4. 90-minute result only: even for AET/PEN matches we write
 *      score.fulltime (not goals, not penalty totals) as required by rules.
 *
 *   5. Idempotent: every update is guarded by a diff — unchanged fixtures
 *      are skipped silently with no DB write.
 */

// ── Competition configuration ────────────────────────────────
// Resolved from competition_settings at request time. Nothing about a
// specific competition is compiled into this module.

export interface CompetitionIngestConfig {
  competitionId:    string;
  slug:             string;
  provider:         string;   // 'api-football'
  providerLeagueId: number;
  providerSeason:   number;
  ingestEnabled:    boolean;
  hasKnockout:      boolean;
}

/** Provider query fragment for a competition. Replaces the old `WC2026` constant. */
export function providerQuery(cfg: CompetitionIngestConfig): string {
  return `league=${cfg.providerLeagueId}&season=${cfg.providerSeason}`;
}

// ── DB fixture type (what the route loads from Supabase) ─────

export interface DbFixture {
  id:                   string;
  kicks_off_at:         string;
  home_score:           number | null;
  away_score:           number | null;
  status:               string;
  provider_fixture_id?: string | null;
  home_team_id?:        string | null;
  away_team_id?:        string | null;
}

// ── Match-window decision ────────────────────────────────────
//
// Given today's DB fixtures, decide whether an API call is warranted.
// Returns null if no API call is needed (saves a request quota).

export type PollReason =
  | "live_match"           // DB shows status='live'
  | "match_in_progress"    // Started within last 3h, not yet completed
  | "kickoff_imminent"     // Kicks off within next 30 min
  | null;                  // No active window — skip API call

export function getPollReason(
  dbFixtures: DbFixture[],
  nowMs: number = Date.now(),
): PollReason {
  for (const f of dbFixtures) {
    // Already marked live in our DB
    if (f.status === "live") return "live_match";

    const kickoffMs = new Date(f.kicks_off_at).getTime();
    const msSinceKickoff = nowMs - kickoffMs;
    const msUntilKickoff = kickoffMs - nowMs;

    // Match started in the last 3 hours and isn't completed/postponed
    // (covers matches in progress where our DB status is stale)
    if (
      msSinceKickoff > 0 &&
      msSinceKickoff < 3 * 60 * 60 * 1000 &&
      f.status !== "completed" &&
      f.status !== "postponed"
    ) {
      return "match_in_progress";
    }

    // Kickoff within the next 30 minutes
    if (msUntilKickoff > 0 && msUntilKickoff < 30 * 60 * 1000) {
      return "kickoff_imminent";
    }
  }

  return null; // Nothing active or imminent
}

// ── API-Football response types ───────────────────────────────

export interface ApiFootballFixture {
  fixture: {
    id:     number;
    date:   string;           // ISO UTC e.g. "2026-06-11T19:00:00+00:00"
    status: { short: string }; // NS | 1H | HT | 2H | FT | AET | PEN …
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null }; // FT + ET, no penalties
  score: {
    fulltime:  { home: number | null; away: number | null }; // 90-min result
    extratime: { home: number | null; away: number | null }; // ET goals only
    penalty:   { home: number | null; away: number | null }; // Shootout only
  };
}

export interface QuotaMeta {
  requestsLimit:     number | null; // daily limit, e.g. 7500
  requestsRemaining: number | null; // remaining today
  requestsUsed:      number | null; // derived: limit - remaining
}

export interface ApiFootballResponse {
  fixtures:     ApiFootballFixture[];
  quota:        QuotaMeta;
  apiCallsMade: number; // how many HTTP requests this invocation made
}

// ── Status mapping ────────────────────────────────────────────
// API-Football short codes → SuperBrain DB status values
// DB CHECK constraint: 'scheduled' | 'live' | 'completed' | 'postponed'

const STATUS_MAP: Record<string, string> = {
  // Not started
  NS:   "scheduled",
  TBD:  "scheduled",
  // Live — all phases
  "1H": "live",
  HT:   "live",
  "2H": "live",
  ET:   "live",    // Extra time
  BT:   "live",    // Break between ET halves
  P:    "live",    // Penalty in progress
  SUSP: "live",    // Suspended
  INT:  "live",    // Interrupted
  LIVE: "live",    // Generic live
  // Final — triggers auto_score_predictions when scores written
  FT:   "completed",
  AET:  "completed", // After extra time (fulltime = pre-ET draw)
  PEN:  "completed", // After penalties (fulltime = pre-ET draw)
  AWD:  "completed", // Awarded
  WO:   "completed", // Walkover
  // Not happening
  PST:  "postponed",
  CANC: "postponed",
  ABD:  "postponed",
};

export function mapStatus(apiShortStatus: string): string {
  return STATUS_MAP[apiShortStatus] ?? "scheduled";
}

// ── Score extraction ──────────────────────────────────────────
//
// BEHAVIOUR (corrected documentation — the code below is unchanged):
//
//   Final statuses (FT/AET/PEN/AWD/WO) → score.fulltime, the official
//     90-minute result. AET: fulltime is the 90-min draw. PEN: fulltime is
//     the 90+ET draw; shootout goals live in score.penalty and are NEVER
//     stored. Predictions are scored on the 90-minute result per the rules.
//
//   Live statuses (1H/HT/2H/ET/BT/P/SUSP/INT/LIVE) → goals.home/away, the
//     RUNNING score. These ARE written to the database so that points move
//     during a match.
//
// ⚠️ Earlier revisions of this file claimed live scores were never written.
// That has not been true since live scoring was enabled during the World
// Cup, and the comment was left stale. Writing live scores means
// auto_score_predictions fires on every score change rather than once per
// fixture. That is SAFE — economy_award_fixture writes reconciling deltas
// and rescoring is idempotent — but it is a real cost multiplier: ten
// simultaneous Premier League matches produce roughly ten times the trigger
// volume the World Cup ever generated. Load-test before launch.

export interface IngestedScore {
  homeScore: number | null;
  awayScore: number | null;
}

export function extractScore(fixture: ApiFootballFixture): IngestedScore {
  const short = fixture.fixture.status.short;

  const isFinal = ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
  const isLive  = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(short);

  if (isFinal) {
    // Use score.fulltime for the official 90-min result
    const home = fixture.score.fulltime.home;
    const away = fixture.score.fulltime.away;
    if (home === null || away === null) return { homeScore: null, awayScore: null };
    return { homeScore: home, awayScore: away };
  }

  if (isLive) {
    // Use goals.home/away — the running live score updated by API-Football
    const home = fixture.goals.home;
    const away = fixture.goals.away;
    if (home === null || away === null) return { homeScore: null, awayScore: null };
    return { homeScore: home, awayScore: away };
  }

  // Not started / postponed — no score
  return { homeScore: null, awayScore: null };
}

// ── Fixture identity ──────────────────────────────────────────
//
// THE rule: a result is routed to a fixture by the provider's own fixture
// id, or it is not routed at all.
//
// This replaces kickoff-proximity matching, which was safe only because
// World Cup matches are >=3 hours apart. Ten Premier League matches kick
// off at 15:00 on a Saturday; a ±90-minute window makes all ten candidates
// and `Array.prototype.find` silently returns the first.

export function findDbFixtureByProviderId(
  providerFixtureId: number | string,
  dbFixtures:        DbFixture[],
): DbFixture | undefined {
  const needle = String(providerFixtureId);
  return dbFixtures.find((f) => f.provider_fixture_id === needle);
}

export type MatchOutcome =
  | { kind: "matched";     fixture: DbFixture }
  | { kind: "unmapped";    reason: string }   // fixture exists but has no provider id
  | { kind: "not_ours";    reason: string };  // provider fixture we do not track

/**
 * Route one provider fixture to one DB fixture.
 *
 * Never guesses. An unmatched fixture returns a typed outcome that the
 * caller logs — it never falls back to "closest kickoff", which is how a
 * result lands on the wrong match.
 */
export function matchProviderFixture(
  apiFixtureId: number | string,
  dbFixtures:   DbFixture[],
): MatchOutcome {
  const hit = findDbFixtureByProviderId(apiFixtureId, dbFixtures);
  if (hit) return { kind: "matched", fixture: hit };

  const anyMapped = dbFixtures.some((f) => f.provider_fixture_id);
  if (!anyMapped) {
    return {
      kind: "unmapped",
      reason:
        `No fixture in this window carries a provider id. Run the ` +
        `provider-id backfill before enabling ingestion (migration 039).`,
    };
  }

  return {
    kind: "not_ours",
    reason: `Provider fixture ${apiFixtureId} is not tracked in this window.`,
  };
}

// ── Backfill-only matching ────────────────────────────────────
//
// ⚠️ DEPRECATED FOR INGESTION. Retained for exactly one purpose: the
// one-off backfill that assigns provider ids to fixtures seeded before
// migration 039. Never call this from the result path.
//
// Unlike the old `findDbFixtureByKickoff`, this requires BOTH team names to
// match as well as the kickoff window, and it returns undefined when the
// candidate set is ambiguous rather than picking the first.

const TEAM_ALIASES: Record<string, string> = {
  "czechia":                    "czechrepublic",
  "turkiye":                    "turkey",
  // "Côte d'Ivoire" folds to "cotedivoire" (the d of d'Ivoire survives).
  // The original map keyed this as "coteivoire", which nothing could ever
  // produce — a second dead alias. Both spellings are mapped now.
  "cotedivoire":                "ivorycoast",
  "coteivoire":                 "ivorycoast",
  "congodr":                    "drcongo",
  "democraticrepublicofcongo":  "drcongo",
  "northmacedonia":             "macedonia",
  "bosniaandherzegovina":       "bosniaherzegovina",
};

/**
 * Canonical form of a team name for comparison.
 *
 * ⚠️ BUG FIX (Competition Engine V2): the previous implementation was
 *
 *     const raw = name.toLowerCase().replace(/[^a-z]/g, "");
 *     return TEAM_ALIASES[raw] ?? raw;
 *
 * which stripped every non-ASCII letter BEFORE the alias lookup. "Türkiye"
 * therefore became "trkiye" — matching neither the "türkiye" nor the
 * "turkiye" key, so that alias could never fire. Same class of failure for
 * any accented name. Diacritics are now folded to their ASCII base first
 * (NFD + strip combining marks), so "Türkiye" → "turkiye" → "turkey".
 *
 * Covered by tests/ingestion-identity.test.ts.
 */
export function normalizeTeamName(name: string): string {
  const raw = name
    .normalize("NFD")               // decompose: "ü" → "u" + combining diaeresis
    .replace(/[̀-ͯ]/g, "") // drop the combining marks
    .toLowerCase()
    .replace(/[^a-z]/g, "");        // then strip everything still non-alphabetic
  return TEAM_ALIASES[raw] ?? raw;
}

export interface BackfillCandidate extends DbFixture {
  home_team_name?: string | null;
  away_team_name?: string | null;
}

export function findFixtureForBackfill(
  api: { kickoffIso: string; homeName: string; awayName: string },
  dbFixtures: BackfillCandidate[],
  toleranceMs = 90 * 60 * 1000,
): { fixture: BackfillCandidate } | { fixture: null; reason: string } {
  const apiMs   = new Date(api.kickoffIso).getTime();
  const apiHome = normalizeTeamName(api.homeName);
  const apiAway = normalizeTeamName(api.awayName);

  const candidates = dbFixtures.filter((f) => {
    if (Math.abs(new Date(f.kicks_off_at).getTime() - apiMs) > toleranceMs) return false;
    const home = normalizeTeamName(f.home_team_name ?? "");
    const away = normalizeTeamName(f.away_team_name ?? "");
    // BOTH teams must match — in either orientation, since providers
    // occasionally list the fixture the other way round.
    return (home === apiHome && away === apiAway)
        || (home === apiAway && away === apiHome);
  });

  if (candidates.length === 1) return { fixture: candidates[0] };
  if (candidates.length === 0) {
    return { fixture: null, reason: `no fixture matches ${api.homeName} v ${api.awayName} near ${api.kickoffIso}` };
  }
  return {
    fixture: null,
    reason: `AMBIGUOUS: ${candidates.length} fixtures match ${api.homeName} v ${api.awayName} near ${api.kickoffIso} — resolve by hand, never guess`,
  };
}

/**
 * True when the provider lists this fixture with home/away reversed
 * relative to our database, meaning the scores must be swapped before
 * writing.
 */
export function isReversed(
  apiHomeName: string,
  dbHomeName:  string | null | undefined,
): boolean {
  if (!dbHomeName) return false;
  return normalizeTeamName(dbHomeName) !== normalizeTeamName(apiHomeName);
}

// ── Ingestion window, derived ─────────────────────────────────
//
// Replaces the hardcoded TOURNAMENT_START_MS / TOURNAMENT_END_MS.
//
// The old constants meant ingestion silently became a permanent no-op on
// 20 July 2026 and would never have restarted for any competition. The
// window is now a property of the data: if a competition has a fixture
// near now, it is in season.

export function isInIngestWindow(
  dbFixtures: DbFixture[],
  nowMs: number = Date.now(),
  windowMs: number = 3 * 60 * 60 * 1000,
): boolean {
  return dbFixtures.some((f) => {
    const delta = Math.abs(new Date(f.kicks_off_at).getTime() - nowMs);
    return delta <= windowMs;
  });
}

// ── API client ────────────────────────────────────────────────

const API_BASE = "https://v3.football.api-sports.io";

function parseQuota(headers: Headers): QuotaMeta {
  const limit     = parseInt(headers.get("x-ratelimit-requests-limit")     ?? "", 10);
  const remaining = parseInt(headers.get("x-ratelimit-requests-remaining") ?? "", 10);
  return {
    requestsLimit:     isNaN(limit)     ? null : limit,
    requestsRemaining: isNaN(remaining) ? null : remaining,
    requestsUsed:      (!isNaN(limit) && !isNaN(remaining)) ? limit - remaining : null,
  };
}

async function apiFetch(
  path:   string,
  apiKey: string,
): Promise<{ fixtures: ApiFootballFixture[]; quota: QuotaMeta }> {
  const res = await fetch(`${API_BASE}/${path}`, {
    headers: {
      // Direct API-Sports endpoint requires x-apisports-key.
      // x-rapidapi-* headers are only for the RapidAPI proxy (different host).
      "x-apisports-key": apiKey,
    },
    cache: "no-store",
  });

  const quota = parseQuota(res.headers);

  if (res.status === 429) {
    // Rate limit hit — not a crash, caller handles gracefully
    const err = new RateLimitError("API-Football rate limit reached (429)");
    (err as RateLimitError).quota = quota;
    throw err;
  }

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();

  // API-Football surfaces errors in the body even on 200
  if (json.errors && Object.keys(json.errors).length > 0) {
    const msg = JSON.stringify(json.errors);
    // Auth errors
    if (msg.includes("token") || msg.includes("key") || msg.includes("auth")) {
      throw new AuthError(`API-Football auth error: ${msg}`);
    }
    throw new Error(`API-Football response error: ${msg}`);
  }

  return {
    fixtures: (json.response as ApiFootballFixture[]) ?? [],
    quota,
  };
}

// Custom error classes for typed catch handling

export class RateLimitError extends Error {
  quota?: QuotaMeta;
  constructor(message: string) { super(message); this.name = "RateLimitError"; }
}

export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = "AuthError"; }
}

/**
 * Fetch currently live fixtures for one competition.
 * Returns an empty fixtures array (not an error) when nothing is live.
 */
export async function fetchLiveFixtures(
  apiKey: string,
  cfg:    CompetitionIngestConfig,
): Promise<ApiFootballResponse> {
  const { fixtures, quota } = await apiFetch(
    `fixtures?${providerQuery(cfg)}&live=all`,
    apiKey,
  );
  return { fixtures, quota, apiCallsMade: 1 };
}

/** Fetch one competition's fixtures for a given UTC date (YYYY-MM-DD). */
export async function fetchFixturesByDate(
  apiKey: string,
  cfg:    CompetitionIngestConfig,
  date:   string,
): Promise<ApiFootballResponse> {
  const { fixtures, quota } = await apiFetch(
    `fixtures?${providerQuery(cfg)}&date=${date}`,
    apiKey,
  );
  return { fixtures, quota, apiCallsMade: 1 };
}

/**
 * Fetch a competition's complete schedule in one request.
 * Used by the provider-id backfill and the kickoff-time sync endpoint.
 */
export async function fetchAllFixtures(
  apiKey: string,
  cfg:    CompetitionIngestConfig,
): Promise<ApiFootballResponse> {
  const { fixtures, quota } = await apiFetch(
    `fixtures?${providerQuery(cfg)}`,
    apiKey,
  );
  return { fixtures, quota, apiCallsMade: 1 };
}
