import { supabase, isSupabaseConfigured } from "./supabase";

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
  id:          string;
  name:        string;
  code:        string;
  flagEmoji:   string | null;
  groupName:   string | null;
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
  id:           string;
  competitionId: string;
  name:         string;
  inviteCode:   string;
  createdBy:    string;
  createdAt:    string;
  memberCount?: number;
}

export interface LeaderboardRow {
  rank:        number;
  displayName: string;
  country:     string | null;
  totalPoints: number;
  predictions: number;
  exactScores: number;
  userId?:     string;  // only in league leaderboard
  isMe?:       boolean; // set client-side
}

export interface MyStats {
  totalPoints: number;
  predictions: number;
  exactScores: number;
  globalRank:  number;
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
    id:        r.id as string,
    name:      r.name as string,
    code:      r.code as string,
    flagEmoji: r.flag_emoji as string | null,
    groupName: r.group_name as string | null,
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
  return { competition: rowToCompetition(data as Record<string, unknown>), error: null };
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
  home_team:teams!home_team_id ( id, name, code, flag_emoji, group_name ),
  away_team:teams!away_team_id ( id, name, code, flag_emoji, group_name ),
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

  let q = supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .eq("competition_id", competitionId)
    .order("fixture_number", { ascending: true });

  if (stage) q = q.eq("stage", stage);

  const { data, error } = await q;

  if (error) {
    return { fixtures: [], error: `fixtures query failed: ${error.message} (code: ${error.code})` };
  }
  if (!data || data.length === 0) {
    return { fixtures: [], error: null }; // genuinely empty — seed hasn't been run or wrong comp ID
  }

  return {
    fixtures: (data as Record<string, unknown>[]).map(rowToFixture),
    error: null,
  };
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

export async function getMyLeagues(competitionId: string): Promise<PredictionLeague[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("prediction_league_members")
    .select(`
      league:prediction_leagues (
        id, competition_id, name, invite_code, created_by, created_at
      )
    `)
    .eq("user_id", user.id);

  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .map((row) => {
      const l = row.league as Record<string, unknown>;
      return {
        id:            l.id as string,
        competitionId: l.competition_id as string,
        name:          l.name as string,
        inviteCode:    l.invite_code as string,
        createdBy:     l.created_by as string,
        createdAt:     l.created_at as string,
      };
    })
    .filter((l) => l.competitionId === competitionId);
}

export async function createLeague(
  competitionId: string,
  name: string,
): Promise<{ league: PredictionLeague | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { league: null, error: "You must be signed in." };

  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length < 2)
    return { league: null, error: "League name must be at least 2 characters." };
  if (trimmedName.length > 40)
    return { league: null, error: "League name must be 40 characters or fewer." };

  const { data, error } = await supabase
    .from("prediction_leagues")
    .insert({ competition_id: competitionId, name: trimmedName, created_by: user.id })
    .select()
    .single();

  if (error || !data) return { league: null, error: "Could not create league. Try again." };

  const league = data as Record<string, unknown>;
  const newLeague: PredictionLeague = {
    id:            league.id as string,
    competitionId: league.competition_id as string,
    name:          league.name as string,
    inviteCode:    league.invite_code as string,
    createdBy:     league.created_by as string,
    createdAt:     league.created_at as string,
  };

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
    .select("id, competition_id, name, invite_code, created_by, created_at")
    .eq("invite_code", code.toUpperCase())
    .single();

  if (error || !data) return null;
  const l = data as Record<string, unknown>;
  return {
    id:            l.id as string,
    competitionId: l.competition_id as string,
    name:          l.name as string,
    inviteCode:    l.invite_code as string,
    createdBy:     l.created_by as string,
    createdAt:     l.created_at as string,
  };
}

export async function joinLeague(
  leagueId: string,
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to join a league." };

  const { error } = await supabase
    .from("prediction_league_members")
    .insert({ league_id: leagueId, user_id: user.id });

  if (error) {
    if (error.code === "23505") return { error: null }; // already a member — treat as success
    return { error: "Could not join league. Please try again." };
  }
  return { error: null };
}

export async function getLeagueMemberCount(leagueId: string): Promise<number> {
  const { count } = await supabase
    .from("prediction_league_members")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  return count ?? 0;
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
    rank:        Number(r.rank),
    displayName: r.display_name as string,
    country:     r.country as string | null,
    totalPoints: Number(r.total_points),
    predictions: Number(r.predictions),
    exactScores: Number(r.exact_scores),
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
    rank:        Number(r.rank),
    userId:      r.user_id as string,
    displayName: r.display_name as string,
    country:     r.country as string | null,
    totalPoints: Number(r.total_points),
    predictions: Number(r.predictions),
    exactScores: Number(r.exact_scores),
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
    totalPoints: Number(r.total_points),
    predictions: Number(r.predictions),
    exactScores: Number(r.exact_scores),
    globalRank:  Number(r.global_rank),
  };
}

// ── Admin tools ───────────────────────────────────────────────

/** Update fixture result. Admin only (checked on calling page). */
export async function adminSetResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("fixtures")
    .update({
      home_score:  homeScore,
      away_score:  awayScore,
      status:      "completed",
      updated_at:  new Date().toISOString(),
    })
    .eq("id", fixtureId);

  if (error) return { error: error.message };
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
