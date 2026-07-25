/**
 * lib/competitionEngine.ts — Competition Engine V2
 *
 * The competition-agnostic layer. Everything that used to be a constant
 * ("wc2026", `league=1&season=2026`, "does this competition have a
 * bracket?") is resolved here, from the database.
 *
 * Companion to lib/predictor.ts, which keeps all prediction, league and
 * leaderboard data access. This module deliberately does NOT re-export or
 * wrap those — nothing in the existing predictor path changes.
 *
 * Backed by migrations 040 (stages), 041 (seasons), 042 (rounds),
 * 043 (settings), 045 (sports).
 */

import { supabase, isSupabaseConfigured } from "./supabase";

// ── Types ─────────────────────────────────────────────────────

export interface CompetitionSettings {
  provider:            string;
  providerLeagueId:    number | null;
  providerSeason:      number | null;
  ingestEnabled:       boolean;
  ingestPollMinutes:   number;

  hasKnockout:         boolean;
  hasGroupStage:       boolean;
  hasStandingsTable:   boolean;
  hasChallenges:       boolean;
  hasLegacyBonus:      boolean;
  roundLabel:          string;
  roundLabelPlural:    string;

  leaderboardWindows:  LeaderboardWindow[];
  leaderboardPageSize: number;

  economyMultiplier:   number;
  economyEnabled:      boolean;

  visible:             boolean;
  isDefault:           boolean;
  displayOrder:        number;
  timezone:            string;

  /**
   * Which home screen to render.
   *   'classic'   — the World Cup hub (fixture list + tabs). The default, so
   *                 the World Cup is untouched.
   *   'matchweek' — the living CompetitionHome dashboard (Premier League).
   */
  homeStyle:           "classic" | "matchweek";

  /**
   * Operational lifecycle (migration 051).
   *   draft/internal — admins only · public — the active competition ·
   *   archived — read-only, listed under Past Competitions.
   */
  lifecycle:           Lifecycle;
}

export type Lifecycle = "draft" | "internal" | "public" | "archived";

/** Is this competition read-only? (archived) */
export function isArchived(s: CompetitionSettings): boolean {
  return s.lifecycle === "archived";
}
/** Is it the active, publicly-live competition? */
export function isPublicLive(s: CompetitionSettings): boolean {
  return s.lifecycle === "public";
}
/** Only admins may see it (draft / internal). */
export function isAdminOnly(s: CompetitionSettings): boolean {
  return s.lifecycle === "draft" || s.lifecycle === "internal";
}
/** Anyone may open it (public or archived). */
export function isPubliclyListed(s: CompetitionSettings): boolean {
  return s.lifecycle === "public" || s.lifecycle === "archived";
}

/**
 * "Weekly" means MATCHWEEK, by decision (24 Jul 2026). Premier League
 * matchweeks do not align with calendar weeks — MW12 may run Friday to
 * Monday, and international breaks leave calendar weeks with no football
 * at all. A calendar-week leaderboard would show empty weeks and split
 * matchweeks across two boards.
 */
export type LeaderboardWindow = "round" | "month" | "season";

export interface CompetitionStage {
  id:         string;
  code:       string;
  label:      string;
  sortOrder:  number;
  hasTable:   boolean;
  isKnockout: boolean;
}

export interface Season {
  id:        string;
  slug:      string;
  label:     string;
  status:    "upcoming" | "active" | "completed" | "archived";
  isCurrent: boolean;
  startsAt:  string | null;
  endsAt:    string | null;
}

export type RoundKind = "matchweek" | "stage" | "group" | "knockout" | "other";

export interface Round {
  id:           string;
  seasonId:     string;
  code:         string;
  label:        string;
  shortLabel:   string | null;
  sortOrder:    number;
  kind:         RoundKind;
  startsAt:     string | null;
  endsAt:       string | null;
  locksAt:      string | null;
  lockIsPinned: boolean;
  status:       "upcoming" | "open" | "locked" | "completed";
}

// ── Defaults ──────────────────────────────────────────────────
// Mirror competition_setting_defs.default_value. Duplicated here on
// purpose: the app must render correctly even if the settings RPC fails
// or migration 043 has not been applied yet. These are the same values,
// and tests/competition-settings.test.ts asserts the two agree.

export const DEFAULT_SETTINGS: CompetitionSettings = {
  provider:            "api-football",
  providerLeagueId:    null,
  providerSeason:      null,
  ingestEnabled:       true,
  ingestPollMinutes:   5,

  hasKnockout:         false,
  hasGroupStage:       false,
  hasStandingsTable:   true,
  hasChallenges:       false,
  hasLegacyBonus:      false,
  roundLabel:          "Round",
  roundLabelPlural:    "Rounds",

  leaderboardWindows:  ["round", "month", "season"],
  leaderboardPageSize: 100,

  economyMultiplier:   1,
  economyEnabled:      true,

  visible:             false,
  isDefault:           false,
  displayOrder:        100,
  timezone:            "UTC",
  homeStyle:           "classic",
  lifecycle:           "draft",
};

/**
 * Last-resort competition slug.
 *
 * Only used when the database cannot tell us which competition is default
 * — i.e. Supabase is unconfigured, or migration 043 has not run. Once
 * `is_default` is set, this constant is never consulted.
 *
 * This is the ONLY place "wc2026" appears outside seeds, historical repair
 * scripts and the World Cup's own settings row.
 */
export const FALLBACK_COMPETITION_SLUG = "wc2026";

// ── Caching ───────────────────────────────────────────────────
// Settings and stages are effectively static for a session. Same pattern
// and rationale as the competition cache in lib/predictor.ts.

const _settingsCache = new Map<string, CompetitionSettings>();
const _stagesCache   = new Map<string, CompetitionStage[]>();
const _roundsCache   = new Map<string, Round[]>();
let   _defaultSlug: string | null = null;

/** Clear every engine cache. Call after an admin edits settings. */
export function invalidateEngineCache(competitionId?: string): void {
  if (competitionId) {
    _settingsCache.delete(competitionId);
    _stagesCache.delete(competitionId);
  } else {
    _settingsCache.clear();
    _stagesCache.clear();
    _roundsCache.clear();
  }
  _defaultSlug = null;
  _listCache   = null;
}

// ── Settings ──────────────────────────────────────────────────

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export function parseSettings(raw: Record<string, unknown> | null): CompetitionSettings {
  const r = raw ?? {};
  const windows = Array.isArray(r.leaderboard_windows)
    ? (r.leaderboard_windows as unknown[]).filter(
        (w): w is LeaderboardWindow => w === "round" || w === "month" || w === "season",
      )
    : DEFAULT_SETTINGS.leaderboardWindows;

  return {
    provider:            str(r.provider,            DEFAULT_SETTINGS.provider),
    providerLeagueId:    r.provider_league_id == null ? null : num(r.provider_league_id, 0),
    providerSeason:      r.provider_season    == null ? null : num(r.provider_season, 0),
    ingestEnabled:       bool(r.ingest_enabled,     DEFAULT_SETTINGS.ingestEnabled),
    ingestPollMinutes:   num(r.ingest_poll_minutes, DEFAULT_SETTINGS.ingestPollMinutes),

    hasKnockout:         bool(r.has_knockout,        DEFAULT_SETTINGS.hasKnockout),
    hasGroupStage:       bool(r.has_group_stage,     DEFAULT_SETTINGS.hasGroupStage),
    hasStandingsTable:   bool(r.has_standings_table, DEFAULT_SETTINGS.hasStandingsTable),
    hasChallenges:       bool(r.has_challenges,      DEFAULT_SETTINGS.hasChallenges),
    hasLegacyBonus:      bool(r.has_legacy_bonus,    DEFAULT_SETTINGS.hasLegacyBonus),
    roundLabel:          str(r.round_label,          DEFAULT_SETTINGS.roundLabel),
    roundLabelPlural:    str(r.round_label_plural,   DEFAULT_SETTINGS.roundLabelPlural),

    leaderboardWindows:  windows.length ? windows : DEFAULT_SETTINGS.leaderboardWindows,
    leaderboardPageSize: num(r.leaderboard_page_size, DEFAULT_SETTINGS.leaderboardPageSize),

    economyMultiplier:   num(r.economy_multiplier, DEFAULT_SETTINGS.economyMultiplier),
    economyEnabled:      bool(r.economy_enabled,   DEFAULT_SETTINGS.economyEnabled),

    visible:             bool(r.visible,       DEFAULT_SETTINGS.visible),
    isDefault:           bool(r.is_default,    DEFAULT_SETTINGS.isDefault),
    displayOrder:        num(r.display_order,  DEFAULT_SETTINGS.displayOrder),
    timezone:            str(r.timezone,       DEFAULT_SETTINGS.timezone),
    homeStyle:           r.home_style === "matchweek" ? "matchweek" : "classic",
    lifecycle:           parseLifecycle(r.lifecycle, r.visible),
  };
}

function parseLifecycle(raw: unknown, visible: unknown): Lifecycle {
  if (raw === "draft" || raw === "internal" || raw === "public" || raw === "archived") return raw;
  // Legacy fallback: visible → public, else draft. (competition_lifecycle()
  // does the richer derivation server-side; this mirrors it for the client.)
  return visible === true ? "public" : "draft";
}

export async function getCompetitionSettings(competitionId: string): Promise<CompetitionSettings> {
  if (!isSupabaseConfigured) return DEFAULT_SETTINGS;
  if (_settingsCache.has(competitionId)) return _settingsCache.get(competitionId)!;

  const { data, error } = await supabase.rpc("get_competition_settings", {
    p_competition_id: competitionId,
  });

  // Deliberately fall back to defaults rather than throwing. A competition
  // that has never been configured must still render — that is what makes
  // "create a competition and go" possible before anyone opens settings.
  const settings = parseSettings(
    error || !data ? null : (data as Record<string, unknown>),
  );

  _settingsCache.set(competitionId, settings);
  return settings;
}

// ── Default competition ───────────────────────────────────────

/**
 * The competition slug to show when the URL does not name one.
 *
 * Resolution order: the active (public) competition with the lowest display
 * order → the `is_default` setting → FALLBACK_COMPETITION_SLUG. The active
 * competition wins so that, once the Premier League is public, /predict and
 * the homepage point at it — never at the archived World Cup.
 */
export async function getDefaultCompetitionSlug(): Promise<string> {
  if (!isSupabaseConfigured) return FALLBACK_COMPETITION_SLUG;
  if (_defaultSlug) return _defaultSlug;

  // Prefer the active competition.
  const active = await listActiveCompetitions().catch(() => []);
  if (active.length > 0) {
    _defaultSlug = active[0].slug;
    return _defaultSlug;
  }

  const { data, error } = await supabase
    .from("competition_settings")
    .select("competition_id, competitions!inner(slug)")
    .eq("key", "is_default")
    .eq("value", true)
    .limit(1);

  if (!error && data && data.length > 0) {
    const row = data[0] as unknown as { competitions?: { slug?: string } };
    const slug = row.competitions?.slug;
    if (slug) {
      _defaultSlug = slug;
      return slug;
    }
  }

  _defaultSlug = FALLBACK_COMPETITION_SLUG;
  return _defaultSlug;
}

// ── Competition list ──────────────────────────────────────────

export interface CompetitionSummary {
  id:           string;
  slug:         string;
  name:         string;
  sportCode:    string;
  status:       string;
  displayOrder: number;
  lifecycle:    Lifecycle;
}

let _listCache: CompetitionSummary[] | null = null;
let _listInFlight: Promise<CompetitionSummary[]> | null = null;

/**
 * Competitions the current viewer may see, ordered for the switcher.
 *
 * Visibility is enforced by the RLS policy on `competition_settings` plus
 * the `visible` flag — an unlaunched competition is simply absent rather
 * than filtered client-side, so probing cannot reveal it.
 *
 * Cached for the session and de-duplicated across concurrent callers: the
 * navigation, the switcher and the hub can all ask at once on first paint.
 */
export async function listVisibleCompetitions(): Promise<CompetitionSummary[]> {
  if (_listCache) return _listCache;
  if (!isSupabaseConfigured) return [];

  if (!_listInFlight) {
    _listInFlight = (async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("id, slug, name, sport_code, status");

      if (error || !data) return [];

      const rows = data as Record<string, unknown>[];

      // Resolve lifecycle + ordering per competition. Small N (a handful of
      // competitions), and every call is a settings cache hit after the first.
      const withSettings = await Promise.all(
        rows.map(async (r) => {
          const s = await getCompetitionSettings(r.id as string);
          return {
            id:           r.id as string,
            slug:         r.slug as string,
            name:         r.name as string,
            sportCode:    (r.sport_code as string) ?? "football",
            status:       r.status as string,
            displayOrder: s.displayOrder,
            lifecycle:    s.lifecycle,
          } as CompetitionSummary;
        }),
      );

      // Public + archived are viewable by anyone. Draft/internal are admin-only
      // and excluded here (the shell still gates them per-viewer).
      const listed = withSettings
        .filter((x) => x.lifecycle === "public" || x.lifecycle === "archived")
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

      _listCache = listed;
      return listed;
    })().finally(() => { _listInFlight = null; });
  }

  return _listInFlight;
}

/** The active (public-live) competitions — the ones a homepage should hero. */
export async function listActiveCompetitions(): Promise<CompetitionSummary[]> {
  return (await listVisibleCompetitions()).filter((c) => c.lifecycle === "public");
}

/** The archived competitions — "Past Competitions". */
export async function listArchivedCompetitions(): Promise<CompetitionSummary[]> {
  return (await listVisibleCompetitions()).filter((c) => c.lifecycle === "archived");
}

// ── Stages ────────────────────────────────────────────────────

export async function getStages(competitionId: string): Promise<CompetitionStage[]> {
  if (!isSupabaseConfigured) return [];
  if (_stagesCache.has(competitionId)) return _stagesCache.get(competitionId)!;

  const { data, error } = await supabase
    .from("competition_stages")
    .select("id, code, label, sort_order, has_table, is_knockout")
    .eq("competition_id", competitionId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  const stages: CompetitionStage[] = (data as Record<string, unknown>[]).map((r) => ({
    id:         r.id as string,
    code:       r.code as string,
    label:      r.label as string,
    sortOrder:  r.sort_order as number,
    hasTable:   r.has_table as boolean,
    isKnockout: r.is_knockout as boolean,
  }));

  _stagesCache.set(competitionId, stages);
  return stages;
}

/**
 * Stage display name, from the database.
 *
 * Replaces the hardcoded 7-entry map in lib/predictor.ts stageLabel().
 * Falls back to that map's behaviour (return the code) when the stage is
 * unknown, so nothing renders blank.
 */
export function stageLabelFrom(stages: CompetitionStage[], code: string): string {
  return stages.find((s) => s.code === code)?.label ?? code;
}

/** Stages that feed a standings table — replaces `stage === "group"`. */
export function tableStages(stages: CompetitionStage[]): string[] {
  return stages.filter((s) => s.hasTable).map((s) => s.code);
}

// ── Seasons ───────────────────────────────────────────────────

function rowToSeason(r: Record<string, unknown>): Season {
  return {
    id:        r.id as string,
    slug:      r.slug as string,
    label:     r.label as string,
    status:    r.status as Season["status"],
    isCurrent: r.is_current as boolean,
    startsAt:  (r.starts_at as string) ?? null,
    endsAt:    (r.ends_at as string) ?? null,
  };
}

export async function getSeasons(competitionId: string): Promise<Season[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("seasons")
    .select("id, slug, label, status, is_current, starts_at, ends_at")
    .eq("competition_id", competitionId)
    .order("starts_at", { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToSeason);
}

/**
 * The season to show for a competition.
 *
 * `is_current` when one is flagged; otherwise the most recent by start
 * date — so a finished competition (the World Cup, whose season is
 * `completed` and not current) still resolves to its own season rather
 * than to nothing.
 */
export async function getCurrentSeason(competitionId: string): Promise<Season | null> {
  const seasons = await getSeasons(competitionId);
  if (seasons.length === 0) return null;
  return seasons.find((s) => s.isCurrent) ?? seasons[0];
}

// ── Rounds ────────────────────────────────────────────────────

function rowToRound(r: Record<string, unknown>): Round {
  return {
    id:           r.id as string,
    seasonId:     r.season_id as string,
    code:         r.code as string,
    label:        r.label as string,
    shortLabel:   (r.short_label as string) ?? null,
    sortOrder:    r.sort_order as number,
    kind:         r.kind as RoundKind,
    startsAt:     (r.starts_at as string) ?? null,
    endsAt:       (r.ends_at as string) ?? null,
    locksAt:      (r.locks_at as string) ?? null,
    lockIsPinned: r.lock_is_pinned as boolean,
    status:       r.status as Round["status"],
  };
}

export async function getRounds(seasonId: string): Promise<Round[]> {
  if (!isSupabaseConfigured) return [];
  if (_roundsCache.has(seasonId)) return _roundsCache.get(seasonId)!;

  const { data, error } = await supabase
    .from("rounds")
    .select("id, season_id, code, label, short_label, sort_order, kind, starts_at, ends_at, locks_at, lock_is_pinned, status")
    .eq("season_id", seasonId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  const rounds = (data as Record<string, unknown>[]).map(rowToRound);
  _roundsCache.set(seasonId, rounds);
  return rounds;
}

/**
 * The round a user should land on.
 *
 * The first round that has not finished, else the last. "Not finished"
 * uses `ends_at` (the last kickoff) plus a 3-hour tail so a round stays
 * current while its final match is still being played.
 */
export function pickCurrentRound(rounds: Round[], nowMs: number = Date.now()): Round | null {
  if (rounds.length === 0) return null;
  const TAIL_MS = 3 * 60 * 60 * 1000;
  const live = rounds.find((r) => {
    if (!r.endsAt) return false;
    return new Date(r.endsAt).getTime() + TAIL_MS > nowMs;
  });
  return live ?? rounds[rounds.length - 1];
}

/**
 * Whether a round's CHALLENGES are locked.
 *
 * Match predictions are NOT governed by this — they lock at their own
 * kickoff, enforced in Postgres by enforce_prediction_deadline. This
 * governs matchday challenges only.
 */
export function isRoundLocked(round: Round, nowMs: number = Date.now()): boolean {
  if (round.status === "locked" || round.status === "completed") return true;
  if (!round.locksAt) return false;
  return nowMs >= new Date(round.locksAt).getTime();
}

/** Rounds a user may still answer challenges for. */
export function openRounds(rounds: Round[], nowMs: number = Date.now()): Round[] {
  return rounds.filter((r) => !isRoundLocked(r, nowMs));
}

// ── Fixtures by round ─────────────────────────────────────────

/**
 * Fixtures for one round, with the caller's own prediction joined.
 *
 * This is the round-scoped load that replaces "fetch all 380 fixtures".
 * Reuses the predictor's FIXTURE_SELECT semantics via a thin query so the
 * `myPrediction` RLS join behaves identically.
 */
export async function getRoundFixtures(roundId: string) {
  const { getFixturesByRound } = await import("./predictor");
  return getFixturesByRound(roundId);
}

/**
 * Everything the Competition Home needs, in one place.
 *
 * Resolves the current season, its current round, that round's fixtures, and
 * the neighbouring round's start (to tell BREAK from a normal gap). Returns
 * nulls rather than throwing so the dashboard always renders something.
 */
export async function getCurrentRoundContext(competitionId: string): Promise<{
  season:            Season | null;
  round:             Round | null;
  nextRoundStartsMs: number | null;
}> {
  const season = await getCurrentSeason(competitionId);
  if (!season) return { season: null, round: null, nextRoundStartsMs: null };

  const rounds = await getRounds(season.id);
  if (rounds.length === 0) return { season, round: null, nextRoundStartsMs: null };

  const round = pickCurrentRound(rounds);
  const idx   = rounds.findIndex((r) => r.id === round?.id);
  const next  = idx >= 0 && idx + 1 < rounds.length ? rounds[idx + 1] : null;

  return {
    season,
    round,
    nextRoundStartsMs: next?.startsAt ? new Date(next.startsAt).getTime() : null,
  };
}

// ── Monthly window ────────────────────────────────────────────

/**
 * UTC month bounds for the monthly leaderboard.
 *
 * ⚠️ Uses UTC, not the competition's `timezone` setting. Doing this
 * correctly for an arbitrary IANA zone needs a real timezone library, and
 * adding one is not justified by a boundary that affects only fixtures
 * kicking off within hours of midnight on the 1st. The setting is stored
 * and is honoured by the SQL side; this client helper is documented as UTC
 * so nobody assumes otherwise.
 */
export function monthWindow(year: number, month1to12: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0));
  const to   = new Date(Date.UTC(year, month1to12,     1, 0, 0, 0));
  return { from: from.toISOString(), to: to.toISOString() };
}
