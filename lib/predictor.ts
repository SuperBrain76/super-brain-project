import { supabase, isSupabaseConfigured } from "./supabase";
import { validateLeagueName } from "./leagueName";

// ── Competition cache ─────────────────────────────────────────
// getCompetition("wc2026") is called on every /predict page load.
// Cache the result in memory so only the first call hits Supabase.
const _competitionCache = new Map<string, { competition: Competition | null; error: string | null }>();

// ── Fixtures cache ────────────────────────────────────────────
// getFixtures() fetches all 104 fixtures + RLS-filtered predictions.
// On a cold 4G mobile connection this is the single most expensive
// query. Cache it client-side with a 60 second TTL.
// Key: `${competitionId}:${stage ?? "all"}` — stage is almost always
// undefined (full list) so effectively one entry per competition.
const _fixturesTTL = 15_000; // 15 s (short so live scores refresh quickly)
const _fixturesCache = new Map<string, {
  fixtures: unknown[];   // raw pre-map Fixture objects (typed below after Fixture is declared)
  error:    string | null;
  at:       number;      // Date.now() when cached
}>();

// ── Types ─────────────────────────────────────────────────────

export interface Competition {
  id:        string;
  name:      string;
  slug:      string;
  status:    "upcoming" | "active" | "completed";
  startsAt:  string | null;
  endsAt:    string | null;
}

export interface Team {
  id:           string;
  name:         string;
  code:         string;
  flagEmoji:    string | null;
  groupName:    string | null;
  fifaRanking:  number | null;
}

export interface Fixture {
  id:           string;
  competitionId: string;
  stage:        string;
  groupName:    string | null;
  fixtureNumber: number;
  homeTeam:     Team | null;   // null for TBD knockout slots
  awayTeam:     Team | null;
  homeScore:    number | null;
  awayScore:    number | null;
  kicksOffAt:   string;        // ISO string, UTC
  venue:        string | null;
  status:       string;
  // Joined from user's own prediction (if any)
  myPrediction: {
    homeScore:    number;
    awayScore:    number;
    pointsAwarded: number | null;
  } | null;
}

export interface Prediction {
  id:           string;
  fixtureId:    string;
  homeScore:    number;
  awayScore:    number;
  pointsAwarded: number | null;
  submittedAt:  string;
}

export interface PredictionLeague {
  id:             string;
  competitionId:  string;
  name:           string;           // original display name as entered by the user
  normalizedName: string;           // lowercase, diacritics removed, whitespace collapsed
  inviteCode:     string;
  createdBy:      string;
  createdAt:      string;
  maxMembers:     number | null;    // null = unlimited; positive integer = hard cap
  memberCount?:   number;
  // Public / Featured league fields (added in migration 007)
  visibility:          "private" | "public";
  isFeatured:          boolean;
  sponsorName:         string | null;
  sponsorUrl:          string | null;
  sponsorDescription:  string | null;
  sponsorLogoUrl:      string | null;
  suspended:           boolean;
}

export interface LeagueMember {
  userId:      string;
  displayName: string;
  country:     string | null;
  joinedAt:    string | null;
  isOwner:     boolean;
}

export interface LeaderboardRow {
  rank:           number;
  displayName:    string;
  country:        string | null;
  totalPoints:    number;
  matchPoints:    number;   // match predictions only
  bonusPoints:    number;   // bonus questions only
  predictions:    number;
  exactScores:    number;
  correctGd:      number;   // 3-pt correct goal-difference predictions (tie-break col)
  correctResults: number;   // 2-pt correct result predictions (tie-break col)
  userId?:        string;   // only in league leaderboard
  isMe?:          boolean;  // set client-side
}

export interface MyStats {
  totalPoints:   number;
  matchPoints:   number;   // match predictions only
  bonusPoints:   number;   // bonus questions only
  predictions:   number;   // ALL submitted match predictions (not just scored)
  exactScores:   number;
  globalRank:    number;
  bonusAnswered: number;   // bonus questions the user has submitted
  bonusTotal:    number;   // total bonus questions in this competition
}

// ── Bonus question types ──────────────────────────────────────

export type BonusAnswerType     = "team" | "player";
export type BonusQuestionStatus = "open" | "locked" | "answered";

export interface BonusQuestion {
  id:                 string;
  competitionId:      string;
  questionKey:        string;
  questionText:       string;
  pointsValue:        number;
  answerType:         BonusAnswerType;
  status:             BonusQuestionStatus;
  locksAt:            string;         // ISO timestamp — predictions rejected after this
  correctTeamId:      string | null;
  correctAnswerText:  string | null;
  correctTeam:        Team | null;    // joined — only non-null when status='answered'
}

export interface BonusPrediction {
  id:            string;
  userId:        string;
  questionId:    string;
  answerTeamId:  string | null;
  answerText:    string | null;
  pointsAwarded: number | null;
  submittedAt:   string;
}

// ── Row mappers ───────────────────────────────────────────────

function rowToCompetition(r: Record<string, unknown>): Competition {
  return {
    id:       r.id as string,
    name:     r.name as string,
    slug:     r.slug as string,
    status:   r.status as Competition["status"],
    startsAt: r.starts_at as string | null,
    endsAt:   r.ends_at as string | null,
  };
}

function rowToTeam(r: Record<string, unknown>): Team {
  return {
    id:          r.id as string,
    name:        r.name as string,
    code:        r.code as string,
    flagEmoji:   r.flag_emoji as string | null,
    groupName:   r.group_name as string | null,
    fifaRanking: (r.fifa_ranking as number | null) ?? null,
  };
}

function rowToBonusQuestion(r: Record<string, unknown>): BonusQuestion {
  const ct = r.correct_team as Record<string, unknown> | null;
  return {
    id:                r.id as string,
    competitionId:     r.competition_id as string,
    questionKey:       r.question_key as string,
    questionText:      r.question_text as string,
    pointsValue:       Number(r.points_value),
    answerType:        r.answer_type as BonusAnswerType,
    status:            r.status as BonusQuestionStatus,
    locksAt:           r.locks_at as string,
    correctTeamId:     r.correct_team_id as string | null,
    correctAnswerText: r.correct_answer_text as string | null,
    correctTeam:       ct ? rowToTeam(ct) : null,
  };
}

function rowToFixture(r: Record<string, unknown>): Fixture {
  const ht = r.home_team as Record<string, unknown> | null;
  const at = r.away_team as Record<string, unknown> | null;
  const pred = r.predictions as Record<string, unknown>[] | null;
  const myPred = pred && pred.length > 0 ? pred[0] : null;

  return {
    id:            r.id as string,
    competitionId: r.competition_id as string,
    stage:         r.stage as string,
    groupName:     r.group_name as string | null,
    fixtureNumber: r.fixture_number as number,
    homeTeam:      ht ? rowToTeam(ht) : null,
    awayTeam:      at ? rowToTeam(at) : null,
    homeScore:     r.home_score as number | null,
    awayScore:     r.away_score as number | null,
    kicksOffAt:    r.kicks_off_at as string,
    venue:         r.venue as string | null,
    status:        r.status as string,
    myPrediction:  myPred ? {
      homeScore:     myPred.home_score as number,
      awayScore:     myPred.away_score as number,
      pointsAwarded: myPred.points_awarded as number | null,
    } : null,
  };
}

// ── Competitions ──────────────────────────────────────────────

export async function getCompetition(
  slug: string,
): Promise<{ competition: Competition | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { competition: null, error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local." };
  }

  // Return cached result if available — competition data is static for the duration of a session
  if (_competitionCache.has(slug)) {
    return _competitionCache.get(slug)!;
  }

  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    return { competition: null, error: `competitions query failed: ${error.message} (code: ${error.code})` };
  }
  if (!data) {
    return { competition: null, error: `No competition found with slug "${slug}". Run the wc2026 seed SQL.` };
  }
  const result = { competition: rowToCompetition(data as Record<string, unknown>), error: null };
  _competitionCache.set(slug, result);
  return result;
}

export async function listCompetitions(): Promise<Competition[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .order("starts_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToCompetition);
}

// ── Fixtures ──────────────────────────────────────────────────
//
// PostgREST join syntax for tables with multiple FKs to the same target:
//   alias:target_table!fk_column_name ( fields )
//
// WRONG: home_team:home_team_id(...)   — treats "home_team_id" as a table name
// RIGHT: home_team:teams!home_team_id(...) — traverses FK from home_team_id → teams.id

const FIXTURE_SELECT = `
  id, competition_id, stage, group_name, fixture_number,
  home_score, away_score, kicks_off_at, venue, status,
  home_team:teams!home_team_id ( id, name, code, flag_emoji, group_name, fifa_ranking ),
  away_team:teams!away_team_id ( id, name, code, flag_emoji, group_name, fifa_ranking ),
  predictions ( home_score, away_score, points_awarded )
`;

/** Returns fixtures for a competition, optionally filtered by stage. */
export async function getFixtures(
  competitionId: string,
  stage?: string,
): Promise<{ fixtures: Fixture[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { fixtures: [], error: "Supabase is not configured." };
  }

  // ── Client-side cache (60 s TTL) ──────────────────────────
  // Predictions are RLS-filtered per user, so a 60 s stale window is
  // acceptable and dramatically cuts cold-load time on mobile.
  const cacheKey = `${competitionId}:${stage ?? "all"}`;
  const cached   = _fixturesCache.get(cacheKey);
  if (cached && Date.now() - cached.at < _fixturesTTL) {
    return {
      fixtures: (cached.fixtures as Record<string, unknown>[]).map(rowToFixture),
      error:    cached.error,
    };
  }

  let q = supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .eq("competition_id", competitionId)
    .order("kicks_off_at", { ascending: true });

  if (stage) q = q.eq("stage", stage);

  const { data, error } = await q;

  if (error) {
    return { fixtures: [], error: `fixtures query failed: ${error.message} (code: ${error.code})` };
  }
  if (!data || data.length === 0) {
    return { fixtures: [], error: null }; // genuinely empty — seed hasn't been run or wrong comp ID
  }

  // Store raw rows (pre-map) so the cache is auth-agnostic;
  // rowToFixture is pure and applied on read.
  _fixturesCache.set(cacheKey, { fixtures: data, error: null, at: Date.now() });

  return {
    fixtures: (data as Record<string, unknown>[]).map(rowToFixture),
    error: null,
  };
}

/**
 * Invalidate the fixtures cache for a competition.
 * Call this after a prediction is saved so the next getFixtures
 * call fetches fresh data (e.g. on a hard-refresh or tab switch).
 */
export function invalidateFixturesCache(competitionId: string, stage?: string): void {
  _fixturesCache.delete(`${competitionId}:${stage ?? "all"}`);
}

export async function getFixture(fixtureId: string): Promise<Fixture | null> {
  const { data, error } = await supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .eq("id", fixtureId)
    .single();
  if (error || !data) return null;
  return rowToFixture(data as Record<string, unknown>);
}

/** Upcoming fixtures (not yet kicked off), ordered by kickoff time. */
export async function getUpcomingFixtures(
  competitionId: string,
  limit = 10,
): Promise<Fixture[]> {
  const { data, error } = await supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .eq("competition_id", competitionId)
    .eq("status", "scheduled")
    .gt("kicks_off_at", new Date().toISOString())
    .order("kicks_off_at", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToFixture);
}

// ── Predictions ───────────────────────────────────────────────

/** Upsert a prediction. Handles both first submit and update.
 *  The DB trigger will reject if kickoff has already passed. */
export async function upsertPrediction(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to predict." };

  const { error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id:    user.id,
        fixture_id: fixtureId,
        home_score: homeScore,
        away_score: awayScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,fixture_id" },
    );

  if (error) {
    // The deadline trigger raises a human-readable exception message
    return { error: error.message.includes("deadline")
      ? "Deadline passed — predictions are locked once a match kicks off."
      : "Could not save your prediction. Please try again." };
  }
  return { error: null };
}

/** Load all predictions made by the current user for a competition. */
export async function getMyPredictions(
  competitionId: string,
): Promise<Prediction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("predictions")
    .select("id, fixture_id, home_score, away_score, points_awarded, submitted_at")
    .eq("user_id", user.id)
    .in(
      "fixture_id",
      (
        await supabase
          .from("fixtures")
          .select("id")
          .eq("competition_id", competitionId)
      ).data?.map((f: { id: string }) => f.id) ?? [],
    );

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id:           r.id as string,
    fixtureId:    r.fixture_id as string,
    homeScore:    r.home_score as number,
    awayScore:    r.away_score as number,
    pointsAwarded: r.points_awarded as number | null,
    submittedAt:  r.submitted_at as string,
  }));
}

// ── Leagues ───────────────────────────────────────────────────

const LEAGUE_SELECT =
  "id, competition_id, name, normalized_name, invite_code, created_by, created_at, " +
  "max_members, visibility, is_featured, sponsor_name, sponsor_url, sponsor_description, sponsor_logo_url, suspended";

function mapLeagueRow(l: Record<string, unknown>, extra?: { memberCount?: number }): PredictionLeague {
  return {
    id:                 l.id as string,
    competitionId:      l.competition_id as string,
    name:               l.name as string,
    normalizedName:     l.normalized_name as string,
    inviteCode:         l.invite_code as string,
    createdBy:          l.created_by as string,
    createdAt:          l.created_at as string,
    maxMembers:         (l.max_members as number | null) ?? null,
    visibility:         (l.visibility as "private" | "public") ?? "private",
    isFeatured:         (l.is_featured as boolean) ?? false,
    sponsorName:        (l.sponsor_name as string | null) ?? null,
    sponsorUrl:         (l.sponsor_url as string | null) ?? null,
    sponsorDescription: (l.sponsor_description as string | null) ?? null,
    sponsorLogoUrl:     (l.sponsor_logo_url as string | null) ?? null,
    suspended:          (l.suspended as boolean) ?? false,
    ...extra,
  };
}

export async function getLeague(leagueId: string): Promise<PredictionLeague | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("prediction_leagues")
    .select(LEAGUE_SELECT)
    .eq("id", leagueId)
    .single();
  if (error || !data) return null;
  return mapLeagueRow(data as unknown as Record<string, unknown>);
}

export async function isLeagueMember(
  leagueId: string,
  userId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from("prediction_league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

/**
 * Returns leagues the current user has joined for a competition,
 * with member counts included in a single DB round-trip.
 * Takes the competition SLUG so it can be called in parallel with
 * getCompetition() — no sequential dependency.
 */
/**
 * Returns leagues the current user has joined for a competition.
 *
 * Fast path: calls get_my_leagues_with_counts RPC (migration 005b)
 * which returns leagues + member counts in a single query.
 *
 * Fallback path: if the RPC is unavailable (migration not yet run),
 * falls back to a direct table query. Member counts are not included
 * in the fallback — LeagueCard fetches them individually in that case.
 *
 * Never silently swallows errors: returns { leagues, error } so the
 * calling page can surface failures to the user.
 */
export async function getMyLeaguesBySlug(
  competitionSlug: string,
): Promise<{ leagues: PredictionLeague[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { leagues: [], error: "Supabase not configured." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { leagues: [], error: null };

  // ── Fast path: RPC with member counts ────────────────────────
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_my_leagues_with_counts",
    { p_competition_slug: competitionSlug },
  );

  if (!rpcError && rpcData !== null) {
    const leagues = (rpcData as Record<string, unknown>[]).map((r) =>
      mapLeagueRow(r, { memberCount: Number(r.member_count) }),
    );
    return { leagues, error: null };
  }

  // ── Fallback: direct table query (RPC not yet deployed) ───────
  // The RPC is created by migration 005b_get_my_leagues_rpc.sql.
  // Until that migration is run, we fall back to a direct query.
  // Member counts will be loaded per-card by LeagueCard's useEffect.
  if (rpcError) {
    console.warn(
      "[getMyLeaguesBySlug] RPC get_my_leagues_with_counts unavailable — " +
      "falling back to direct query. Run 005b_get_my_leagues_rpc.sql to fix. " +
      "Error:", rpcError.message,
    );
  }

  // Get competition UUID from slug
  const { data: compRow, error: compErr } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", competitionSlug)
    .single();

  if (compErr || !compRow) {
    const msg = compErr?.message ?? `Competition '${competitionSlug}' not found`;
    console.error("[getMyLeaguesBySlug] competition lookup failed:", msg);
    return { leagues: [], error: msg };
  }

  const competitionId = (compRow as Record<string, unknown>).id as string;
  const fallbackLeagues = await getMyLeagues(competitionId);
  return { leagues: fallbackLeagues, error: null };
}

export async function getMyLeagues(competitionId: string): Promise<PredictionLeague[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("prediction_league_members")
    .select(`league:prediction_leagues (${LEAGUE_SELECT})`)
    .eq("user_id", user.id);

  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .map((row) => mapLeagueRow(row.league as unknown as Record<string, unknown>))
    .filter((l) => l.competitionId === competitionId);
}

export async function createLeague(
  competitionId: string,
  name: string,
  visibility: "private" | "public" = "private",
): Promise<{ league: PredictionLeague | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { league: null, error: "You must be signed in." };

  // Server-side validation — same rules enforced client-side in validateLeagueName()
  const validation = validateLeagueName(name);
  if (!validation.valid) {
    return { league: null, error: validation.error! };
  }
  const trimmedName     = name.trim().replace(/\s+/g, " ");
  const normalizedName  = validation.normalizedName!;

  const { data, error } = await supabase
    .from("prediction_leagues")
    .insert({
      competition_id:  competitionId,
      name:            trimmedName,
      normalized_name: normalizedName,
      created_by:      user.id,
      visibility,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation — duplicate normalized name in this competition
    if (error.code === "23505") {
      return { league: null, error: "That league name is already taken. Try a different name." };
    }
    return { league: null, error: "Could not create league. Try again." };
  }
  if (!data) return { league: null, error: "Could not create league. Try again." };

  const newLeague = mapLeagueRow(data as unknown as Record<string, unknown>);

  // Auto-join the creator
  await supabase.from("prediction_league_members").insert({
    league_id: newLeague.id,
    user_id:   user.id,
  });

  return { league: newLeague, error: null };
}

export async function getLeagueByInviteCode(
  code: string,
): Promise<PredictionLeague | null> {
  const { data, error } = await supabase
    .from("prediction_leagues")
    .select(LEAGUE_SELECT)
    .eq("invite_code", code.toUpperCase())
    .single();

  if (error || !data) return null;
  return mapLeagueRow(data as unknown as Record<string, unknown>);
}

export interface LeagueSummary {
  memberCount:  number;
  leaderName:   string | null;
  leaderPoints: number | null;
  totalPredictions: number;
}

/**
 * Lightweight summary for the invite/join page social proof strip.
 * Runs member count + leaderboard fetch in parallel.
 * Does NOT require authentication — member count is public, leaderboard
 * may return empty for private leagues with no public rows.
 */
export async function getLeagueSummary(leagueId: string): Promise<LeagueSummary> {
  const [memberCount, leaderboard] = await Promise.all([
    getLeagueMemberCount(leagueId),
    getLeagueLeaderboard(leagueId).catch(() => []),
  ]);

  const leader = leaderboard[0] ?? null;
  const totalPredictions = leaderboard.reduce((sum, r) => sum + r.predictions, 0);

  return {
    memberCount,
    leaderName:   leader?.displayName ?? null,
    leaderPoints: leader?.totalPoints ?? null,
    totalPredictions,
  };
}

export async function joinLeague(
  leagueId: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to join a league." };

  // Enforce max 100 members (soft cap — not in DB schema)
  const count = await getLeagueMemberCount(leagueId);
  if (count >= 100) return { error: "This league is full (100 members maximum)." };

  const { error } = await supabase
    .from("prediction_league_members")
    .insert({ league_id: leagueId, user_id: user.id });

  if (error) {
    if (error.code === "23505") return { error: null }; // already a member — treat as success
    return { error: "Could not join league. Please try again." };
  }
  return { error: null };
}

/**
 * Leave a league.
 *
 * Owner protection: if the caller is the league owner AND they are the
 * only remaining member, the leave is blocked. This prevents a league from
 * becoming permanently ownerless. The caller must either delete the league
 * (future feature) or transfer ownership (future feature) first.
 *
 * For all other members (including the owner with other members present),
 * the leave succeeds and removes the membership row.
 */
export async function leaveLeague(
  leagueId: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Fetch the league to check ownership
  const league = await getLeague(leagueId);
  if (!league) return { error: "League not found." };

  const isOwner = league.createdBy === user.id;

  if (isOwner) {
    // Block only if they are the sole remaining member
    const count = await getLeagueMemberCount(leagueId);
    if (count <= 1) {
      return {
        error:
          "You're the only member and owner of this league. " +
          "Delete the league instead, or invite someone before leaving.",
      };
    }
  }

  const { error } = await supabase
    .from("prediction_league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (error) return { error: "Could not leave the league. Please try again." };
  return { error: null };
}

// ── Owner controls ────────────────────────────────────────────

/** Rename a league. Owner only — enforced by RLS (migration 015). */
/** Check if the current session user is in app_admins. */
async function isAdmin(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("app_admins")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

export async function renameLeague(
  leagueId: string,
  name: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const validation = validateLeagueName(name);
  if (!validation.valid) return { error: validation.error! };

  const trimmed    = name.trim().replace(/\s+/g, " ");
  const normalized = validation.normalizedName!;

  // First attempt: owner-scoped update (also enforced by RLS migration 016)
  const { error, data } = await supabase
    .from("prediction_leagues")
    .update({ name: trimmed, normalized_name: normalized })
    .eq("id", leagueId)
    .eq("created_by", user.id)
    .select("id");

  if (error) {
    if (error.code === "23505") return { error: "That name is already taken. Try another." };
    return { error: "Could not rename league. Please try again." };
  }

  if (data && data.length > 0) return { error: null };

  // 0 rows — either not the owner, or RLS blocked. Check admin.
  const admin = await isAdmin(user.id);
  if (!admin) return { error: "Permission denied — only the league owner can rename it." };

  // Admin retry without owner filter (RLS bypassed for admins via app_admins check)
  // Note: RLS still applies; admin must also be in the USING clause or have service-role.
  // We update by ID only — the RLS policy will block if not owner and not service-role.
  // For admin rename to work in production, add an admin bypass policy or use service-role key.
  const { error: adminErr, data: adminData } = await supabase
    .from("prediction_leagues")
    .update({ name: trimmed, normalized_name: normalized })
    .eq("id", leagueId)
    .select("id");

  if (adminErr) {
    if (adminErr.code === "23505") return { error: "That name is already taken. Try another." };
    return { error: "Could not rename league. Please try again." };
  }
  if (!adminData || adminData.length === 0) return { error: "Permission denied — only the league owner can rename it." };
  return { error: null };
}

/** Toggle a league between private and public. Owner only — enforced by RLS (migration 016). */
export async function setLeagueVisibility(
  leagueId: string,
  visibility: "private" | "public",
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error, data } = await supabase
    .from("prediction_leagues")
    .update({ visibility })
    .eq("id", leagueId)
    .eq("created_by", user.id)
    .select("id");

  if (error) return { error: "Could not update visibility. Please try again." };
  if (data && data.length > 0) return { error: null };

  // 0 rows — check admin
  const admin = await isAdmin(user.id);
  if (!admin) return { error: "Permission denied — only the league owner can change visibility." };

  const { error: adminErr, data: adminData } = await supabase
    .from("prediction_leagues")
    .update({ visibility })
    .eq("id", leagueId)
    .select("id");

  if (adminErr) return { error: "Could not update visibility. Please try again." };
  if (!adminData || adminData.length === 0) return { error: "Permission denied — only the league owner can change visibility." };
  return { error: null };
}

/** Permanently delete a league and all its members. Owner only — enforced by RLS (migration 015). */
export async function deleteLeague(
  leagueId: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("prediction_leagues")
    .delete()
    .eq("id", leagueId);

  if (error) return { error: "Could not delete league. Please try again." };
  return { error: null };
}

export async function getLeagueMemberCount(leagueId: string): Promise<number> {
  const { count } = await supabase
    .from("prediction_league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  return count ?? 0;
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  if (!isSupabaseConfigured) return [];

  // ── Step 1: get member user_ids from prediction_league_members ─
  // Always works — RLS allows any authenticated user to read this table.
  const { data: rows } = await supabase
    .from("prediction_league_members")
    .select("user_id, joined_at")
    .eq("league_id", leagueId);

  if (!rows || rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const da = ra.joined_at ? new Date(ra.joined_at as string).getTime() : 0;
    const db = rb.joined_at ? new Date(rb.joined_at as string).getTime() : 0;
    return da - db;
  });

  const userIds = sorted.map((r) => (r as Record<string, unknown>).user_id as string);

  // ── Step 2: fetch display_name + country for all member ids ───
  // Migration 010/011 added USING(true) SELECT policy to user_profiles,
  // so authenticated users can read any profile row directly — no
  // SECURITY DEFINER function needed.
  const nameMap = new Map<string, { displayName: string; country: string | null }>();

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_name, country")
    .in("id", userIds);

  if (profiles && Array.isArray(profiles)) {
    for (const p of profiles as Record<string, unknown>[]) {
      const uid = p.id as string;
      if (uid) nameMap.set(uid, {
        displayName: (p.display_name as string | null) || "Player",
        country:     (p.country as string | null) ?? null,
      });
    }
  }

  return sorted.map((row) => {
    const r    = row as Record<string, unknown>;
    const uid  = r.user_id as string;
    const info = nameMap.get(uid);
    return {
      userId:      uid,
      displayName: info?.displayName ?? "Player",
      country:     info?.country ?? null,
      joinedAt:    (r.joined_at as string | null) ?? null,
      isOwner:     false,
    };
  });
}

export async function updateLeagueAdmin(
  leagueId: string,
  fields: {
    visibility?:         "private" | "public";
    isFeatured?:         boolean;
    sponsorName?:        string | null;
    sponsorUrl?:         string | null;
    sponsorDescription?: string | null;
    sponsorLogoUrl?:     string | null;
    suspended?:          boolean;
  },
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {};
  if (fields.visibility         !== undefined) updates.visibility          = fields.visibility;
  if (fields.isFeatured         !== undefined) updates.is_featured         = fields.isFeatured;
  if (fields.sponsorName        !== undefined) updates.sponsor_name        = fields.sponsorName;
  if (fields.sponsorUrl         !== undefined) updates.sponsor_url         = fields.sponsorUrl;
  if (fields.sponsorDescription !== undefined) updates.sponsor_description = fields.sponsorDescription;
  if (fields.sponsorLogoUrl     !== undefined) updates.sponsor_logo_url    = fields.sponsorLogoUrl;
  if (fields.suspended          !== undefined) updates.suspended           = fields.suspended;

  const { error } = await supabase
    .from("prediction_leagues")
    .update(updates)
    .eq("id", leagueId);

  if (error) return { error: error.message };
  return { error: null };
}

// ── Public / Featured league discovery ───────────────────────

/**
 * Returns all public and featured leagues for a competition,
 * ordered featured-first, then by creation date ascending.
 * No auth required — respects the leagues_select_public RLS policy.
 */
export async function getPublicLeagues(
  competitionId: string,
): Promise<PredictionLeague[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("prediction_leagues")
    .select(LEAGUE_SELECT)
    .eq("competition_id", competitionId)
    .or("visibility.eq.public,is_featured.eq.true")
    .order("is_featured", { ascending: false })
    .order("created_at",  { ascending: true });

  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map((r) => mapLeagueRow(r));
}

/**
 * Joins a public or featured league directly — no invite code required.
 * Uses the league_members_insert_public RLS policy (migration 007).
 */
export async function joinPublicLeague(
  leagueId: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("prediction_league_members")
    .insert({ league_id: leagueId, user_id: user.id });

  if (error) {
    if (error.code === "23505") return { error: null }; // already a member — treat as success
    return { error: "Could not join league. Please try again." };
  }
  return { error: null };
}

// ── Leaderboards ──────────────────────────────────────────────

export async function getPredictorLeaderboard(
  competitionId: string,
): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_predictor_leaderboard", {
    p_competition_id: competitionId,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    rank:           Number(r.rank),
    userId:         r.user_id as string,
    displayName:    (r.display_name as string | null) || "Player",
    country:        r.country as string | null,
    totalPoints:    Number(r.total_points),
    matchPoints:    Number(r.match_points ?? 0),
    bonusPoints:    Number(r.bonus_points ?? 0),
    predictions:    Number(r.predictions),
    exactScores:    Number(r.exact_scores),
    correctGd:      Number(r.correct_gd ?? 0),
    correctResults: Number(r.correct_results ?? 0),
  }));
}

export async function getLeagueLeaderboard(
  leagueId: string,
): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_league_leaderboard", {
    p_league_id: leagueId,
  });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    rank:           Number(r.rank),
    userId:         r.user_id as string,
    displayName:    (r.display_name as string | null) || "Player",
    country:        r.country as string | null,
    totalPoints:    Number(r.total_points),
    matchPoints:    Number(r.match_points ?? 0),
    bonusPoints:    Number(r.bonus_points ?? 0),
    predictions:    Number(r.predictions),
    exactScores:    Number(r.exact_scores),
    correctGd:      Number(r.correct_gd ?? 0),
    correctResults: Number(r.correct_results ?? 0),
  }));
}

export async function getMyStats(
  competitionId: string,
): Promise<MyStats | null> {
  const { data, error } = await supabase.rpc("get_my_predictor_stats", {
    p_competition_id: competitionId,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  const r = data[0] as Record<string, unknown>;
  return {
    totalPoints:   Number(r.total_points),
    matchPoints:   Number(r.match_points ?? 0),
    bonusPoints:   Number(r.bonus_points ?? 0),
    predictions:   Number(r.predictions),
    exactScores:   Number(r.exact_scores),
    globalRank:    Number(r.global_rank),
    bonusAnswered: Number(r.bonus_answered ?? 0),
    bonusTotal:    Number(r.bonus_total ?? 0),
  };
}

// ── Bonus questions ───────────────────────────────────────────

export async function getTeams(competitionId: string): Promise<Team[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("teams")
    .select("id, competition_id, name, code, flag_emoji, group_name")
    .eq("competition_id", competitionId)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToTeam);
}

export async function getBonusQuestions(
  competitionId: string,
): Promise<BonusQuestion[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("bonus_questions")
    .select(`
      id, competition_id, question_key, question_text,
      points_value, answer_type, status, locks_at,
      correct_team_id, correct_answer_text,
      correct_team:teams!correct_team_id ( id, competition_id, name, code, flag_emoji, group_name )
    `)
    .eq("competition_id", competitionId)
    .order("points_value", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map(rowToBonusQuestion);
}

export async function getMyBonusPredictions(
  questionIds: string[],
): Promise<BonusPrediction[]> {
  if (!isSupabaseConfigured || questionIds.length === 0) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("bonus_predictions")
    .select("id, user_id, question_id, answer_team_id, answer_text, points_awarded, submitted_at")
    .eq("user_id", user.id)
    .in("question_id", questionIds);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id:            r.id as string,
    userId:        r.user_id as string,
    questionId:    r.question_id as string,
    answerTeamId:  r.answer_team_id as string | null,
    answerText:    r.answer_text as string | null,
    pointsAwarded: r.points_awarded as number | null,
    submittedAt:   r.submitted_at as string,
  }));
}

/** Submit or update a bonus prediction via SECURITY DEFINER RPC. */
export async function upsertBonusPrediction(
  questionId: string,
  teamId?:    string | null,
  answerText?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("upsert_bonus_prediction", {
    p_question_id: questionId,
    p_team_id:     teamId ?? null,
    p_answer_text: answerText ?? null,
  });
  if (error) {
    if (error.message.includes("no longer accepting")) {
      return { error: "This question is locked and no longer accepting predictions." };
    }
    return { error: error.message };
  }
  return { error: null };
}

/** Admin: lock a bonus question (open → locked). */
export async function adminLockBonusQuestion(
  questionId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_lock_bonus_question", {
    p_question_id: questionId,
  });
  if (error) {
    if (error.message.includes("Access denied")) return { error: "Access denied." };
    return { error: error.message };
  }
  return { error: null };
}

/** Admin: set the correct answer and score all predictions. Returns count scored. */
export async function adminSetBonusAnswer(
  questionId: string,
  teamId?:    string | null,
  answerText?: string | null,
): Promise<{ updated: number; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_set_bonus_answer", {
    p_question_id: questionId,
    p_team_id:     teamId ?? null,
    p_answer_text: answerText ?? null,
  });
  if (error) {
    if (error.message.includes("Access denied")) return { updated: 0, error: "Access denied." };
    return { updated: 0, error: error.message };
  }
  return { updated: Number(data), error: null };
}

// ── Admin tools ───────────────────────────────────────────────

/**
 * Update fixture result via SECURITY DEFINER RPC.
 * Server-side check: caller must be in app_admins table.
 * Non-admins receive "Access denied" — client-side guard is
 * a UX convenience only and cannot be relied upon for security.
 */
export async function adminSetResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_set_fixture_result", {
    p_fixture_id: fixtureId,
    p_home_score: homeScore,
    p_away_score: awayScore,
  });

  if (error) {
    if (error.message.includes("Access denied") || error.message.includes("admin privileges")) {
      return { error: "Access denied. Admin privileges required." };
    }
    if (error.message.includes("Authentication required")) {
      return { error: "You must be signed in." };
    }
    return { error: error.message };
  }
  return { error: null };
}

/** Rescore a single fixture (admin backup tool). */
export async function adminRescoreFixture(
  fixtureId: string,
): Promise<{ updated: number; error: string | null }> {
  const { data, error } = await supabase.rpc("rescore_fixture", {
    p_fixture_id: fixtureId,
  });
  if (error) return { updated: 0, error: error.message };
  return { updated: Number(data), error: null };
}

/** Rescore all completed fixtures in a competition (admin nuclear option). */
export async function adminRescoreCompetition(
  competitionId: string,
): Promise<{ updated: number; error: string | null }> {
  const { data, error } = await supabase.rpc("rescore_competition", {
    p_competition_id: competitionId,
  });
  if (error) return { updated: 0, error: error.message };
  return { updated: Number(data), error: null };
}

/** Update team assignment on a knockout fixture (admin, after groups resolve). */
export async function adminUpdateFixtureTeams(
  fixtureId: string,
  homeTeamId: string | null,
  awayTeamId: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("fixtures")
    .update({
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", fixtureId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── Public user prediction visibility ────────────────────────

/**
 * Fetch all fixtures that have already kicked off, with a target user's
 * predictions. Returns empty if RLS does not permit reading other users'
 * predictions — the admin should add a policy allowing reads on predictions
 * where fixtures.kicks_off_at < now() to enable full prediction visibility.
 */
export async function getUserPublicPredictions(
  userId: string,
  competitionId: string,
): Promise<{ fixtures: Fixture[]; error: string | null }> {
  if (!isSupabaseConfigured) return { fixtures: [], error: null };
  const now = new Date().toISOString();

  // First: get kicked-off fixtures
  const { data: fxData, error: fxErr } = await supabase
    .from("fixtures")
    .select(`
      id, competition_id, stage, group_name, fixture_number,
      home_score, away_score, kicks_off_at, venue, status,
      home_team:teams!home_team_id ( id, name, code, flag_emoji, group_name, fifa_ranking ),
      away_team:teams!away_team_id ( id, name, code, flag_emoji, group_name, fifa_ranking )
    `)
    .eq("competition_id", competitionId)
    .lt("kicks_off_at", now)
    .order("kicks_off_at", { ascending: false });

  if (fxErr || !fxData || fxData.length === 0) return { fixtures: [], error: null };

  // Use SECURITY DEFINER RPC so we can read another user's predictions
  // (RLS only allows reading own rows; the function enforces kicked-off constraint server-side)
  const { data: predData } = await supabase.rpc("get_user_public_predictions", {
    p_user_id:        userId,
    p_competition_id: competitionId,
  });

  const predMap = new Map<string, Record<string, unknown>>();
  if (predData) {
    for (const p of predData as Record<string, unknown>[]) {
      predMap.set(p.fixture_id as string, p);
    }
  }

  const fixtures = (fxData as Record<string, unknown>[]).map((r) => {
    const ht = r.home_team as Record<string, unknown> | null;
    const at = r.away_team as Record<string, unknown> | null;
    const pred = predMap.get(r.id as string);
    return {
      id:            r.id as string,
      competitionId: r.competition_id as string,
      stage:         r.stage as string,
      groupName:     r.group_name as string | null,
      fixtureNumber: r.fixture_number as number,
      homeTeam:      ht ? rowToTeam(ht) : null,
      awayTeam:      at ? rowToTeam(at) : null,
      homeScore:     r.home_score as number | null,
      awayScore:     r.away_score as number | null,
      kicksOffAt:    r.kicks_off_at as string,
      venue:         r.venue as string | null,
      status:        r.status as string,
      myPrediction:  pred ? {
        homeScore:     pred.home_score as number,
        awayScore:     pred.away_score as number,
        pointsAwarded: pred.points_awarded as number | null,
      } : null,
    } as Fixture;
  });

  return { fixtures, error: null };
}

// ── Helpers ───────────────────────────────────────────────────

/** Returns true if a fixture's prediction window is still open. */
export function isPredictionOpen(fixture: Fixture): boolean {
  return fixture.status === "scheduled" &&
    new Date(fixture.kicksOffAt) > new Date();
}

/** Format kickoff time in the user's local timezone. */
export function formatKickoff(isoString: string, opts?: { date?: boolean; time?: boolean }): string {
  const d = new Date(isoString);
  if (opts?.date && !opts?.time) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  if (opts?.time && !opts?.date) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Returns a countdown string like "2h 14m" or "Kicked off". */
export function kickoffCountdown(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "Kicked off";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Stage display name. */
export function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    group: "Group Stage",
    r32:   "Round of 32",
    r16:   "Round of 16",
    qf:    "Quarter-final",
    sf:    "Semi-final",
    "3rd": "Third Place",
    final: "Final",
  };
  return map[stage] ?? stage;
}

/** Points colour for UI. */
export function pointsColor(pts: number | null): string {
  if (pts === null) return "#4a5568";
  if (pts === 5) return "#00e676";
  if (pts === 3) return "#00d4ff";
  if (pts === 2) return "#ffab00";
  return "#ff4040";
}
