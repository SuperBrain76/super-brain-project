/**
 * lib/competitionAdmin.ts — Competition Engine V2
 *
 * Typed wrappers around the wizard RPCs from migration 049.
 *
 * Every function here calls a SECURITY DEFINER function that checks
 * `app_admins` server-side. The client-side admin checks in the UI are for
 * navigation only — they are not the security boundary and must never be
 * treated as one.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { invalidateEngineCache, type Lifecycle } from "./competitionEngine";

// ── Lifecycle ─────────────────────────────────────────────────
// The one operational control: move a competition through
// draft → internal → public → archived with a single write. No deployment.
//
// Writes both the `lifecycle` setting AND the derived `visible` flag (public
// and archived are viewable; draft/internal are not), plus reflects the
// competition-row status, so every existing consumer stays consistent.

export async function setLifecycle(
  competitionId: string,
  lifecycle: Lifecycle,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: "Supabase is not configured." };

  const visible = lifecycle === "public" || lifecycle === "archived";
  const status  = lifecycle === "archived" ? "completed"
                : lifecycle === "public"   ? "active"
                : "upcoming";

  const rows = [
    { competition_id: competitionId, key: "lifecycle", value: `"${lifecycle}"` },
    { competition_id: competitionId, key: "visible",   value: JSON.stringify(visible) },
  ];

  const { error: sErr } = await supabase
    .from("competition_settings")
    .upsert(rows, { onConflict: "competition_id,key" });
  if (sErr) return { error: sErr.message };

  const { error: cErr } = await supabase
    .from("competitions").update({ status }).eq("id", competitionId);
  // A failed status update is non-fatal — lifecycle is the source of truth.
  if (cErr) console.warn("[setLifecycle] competitions.status update failed:", cErr.message);

  invalidateEngineCache();
  return { error: null };
}

// ── Types ─────────────────────────────────────────────────────

export interface CompetitionTemplate {
  code:        string;
  name:        string;
  sportCode:   string;
  description: string | null;
  stages:      StageSpec[];
  roundConfig: RoundConfig;
  settings:    Record<string, unknown>;
  scoring:     ScoringSpec;
  sortOrder:   number;
}

export interface StageSpec {
  code:        string;
  label:       string;
  sort_order:  number;
  has_table:   boolean;
  is_knockout: boolean;
}

export interface RoundConfig {
  kind?:          string;
  count?:         number;
  label_pattern?: string;
  short_pattern?: string;
}

export interface ScoringSpec {
  exact:  number;
  gd:     number;
  result: number;
  wrong:  number;
}

export interface Sport {
  code: string;
  name: string;
  icon: string | null;
}

export interface CreateCompetitionInput {
  slug:       string;
  name:       string;
  sportCode:  string;
  template?:  string;
  season:     { slug: string; label: string; startsAt?: string; endsAt?: string };
  stages?:    StageSpec[];
  rounds?:    RoundConfig;
  scoring?:   ScoringSpec;
  settings?:  Record<string, unknown>;
  economy?:   Record<string, { multiplier?: number; amount_map?: Record<string, number>; enabled?: boolean }>;
}

export interface CreateCompetitionResult {
  competitionId:   string;
  competitionSlug: string;
  seasonId:        string;
  stagesCreated:   number;
  roundsCreated:   number;
  url:             string;
  nextStep:        string;
}

export interface ReadinessReport {
  ready:       boolean;
  competition: string;
  problems:    string[];
  warnings:    string[];
}

export interface ImportFixtureRow {
  round:                number;
  home:                 string;
  away:                 string;
  home_name?:           string;
  away_name?:           string;
  kicks_off_at:         string;
  venue?:               string;
  stage?:               string;
  provider_fixture_id?: string;
}

export interface ImportResult {
  dryRun:           boolean;
  fixturesCreated:  number;
  teamsCreated:     number;
  errors:           { index: number; error: string }[];
}

// ── Reference data ────────────────────────────────────────────

export async function listTemplates(): Promise<CompetitionTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("competition_templates")
    .select("code, name, sport_code, description, stages, round_config, settings, scoring, sort_order")
    .eq("active", true)
    .order("sort_order");

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((r) => ({
    code:        r.code as string,
    name:        r.name as string,
    sportCode:   r.sport_code as string,
    description: (r.description as string) ?? null,
    stages:      (r.stages as StageSpec[]) ?? [],
    roundConfig: (r.round_config as RoundConfig) ?? {},
    settings:    (r.settings as Record<string, unknown>) ?? {},
    scoring:     (r.scoring as ScoringSpec) ?? { exact: 5, gd: 3, result: 2, wrong: 0 },
    sortOrder:   r.sort_order as number,
  }));
}

export async function listSports(): Promise<Sport[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("sports").select("code, name, icon").order("name");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    code: r.code as string,
    name: r.name as string,
    icon: (r.icon as string) ?? null,
  }));
}

export interface SettingDef {
  key:          string;
  valueType:    "string" | "number" | "boolean" | "json" | "array";
  defaultValue: unknown;
  label:        string;
  description:  string | null;
  groupName:    string;
  sortOrder:    number;
  required:     boolean;
}

/**
 * The settings schema, from the database.
 *
 * This is what lets the wizard render its own configuration step. Adding a
 * setting is a row in `competition_setting_defs` — the form picks it up with
 * no code change, which is the whole point of the defs table existing
 * separately from the values table.
 */
export async function listSettingDefs(): Promise<SettingDef[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("competition_setting_defs")
    .select("key, value_type, default_value, label, description, group_name, sort_order, required")
    .eq("is_secret", false)
    .order("group_name")
    .order("sort_order");

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((r) => ({
    key:          r.key as string,
    valueType:    r.value_type as SettingDef["valueType"],
    defaultValue: r.default_value,
    label:        r.label as string,
    description:  (r.description as string) ?? null,
    groupName:    r.group_name as string,
    sortOrder:    r.sort_order as number,
    required:     r.required as boolean,
  }));
}

// ── Create ────────────────────────────────────────────────────

export async function createCompetition(
  input: CreateCompetitionInput,
): Promise<{ result: CreateCompetitionResult | null; error: string | null }> {
  if (!isSupabaseConfigured) return { result: null, error: "Supabase is not configured." };

  const payload: Record<string, unknown> = {
    slug:       input.slug,
    name:       input.name,
    sport_code: input.sportCode,
    template:   input.template,
    season: {
      slug:       input.season.slug,
      label:      input.season.label,
      starts_at:  input.season.startsAt ?? null,
      ends_at:    input.season.endsAt ?? null,
    },
  };

  if (input.stages?.length) payload.stages   = input.stages;
  if (input.rounds)         payload.rounds   = input.rounds;
  if (input.scoring)        payload.scoring  = input.scoring;
  if (input.settings)       payload.settings = input.settings;
  if (input.economy)        payload.economy  = input.economy;

  const { data, error } = await supabase.rpc("admin_create_competition", { p_payload: payload });

  if (error) return { result: null, error: error.message };

  const r = data as Record<string, unknown>;
  invalidateEngineCache();

  return {
    result: {
      competitionId:   r.competition_id as string,
      competitionSlug: r.competition_slug as string,
      seasonId:        r.season_id as string,
      stagesCreated:   (r.stages_created as number) ?? 0,
      roundsCreated:   (r.rounds_created as number) ?? 0,
      url:             r.url as string,
      nextStep:        r.next_step as string,
    },
    error: null,
  };
}

// ── Fixture import ────────────────────────────────────────────

/**
 * Import fixtures. `commit = false` performs a full dry run.
 *
 * ⚠️ The dry run deliberately RAISES from Postgres with a `DRY_RUN_RESULT:`
 * payload — that exception is how the transaction rolls back, so the teams
 * it created while resolving codes do not persist. A thrown error here is
 * the SUCCESS path for a dry run, and is parsed rather than reported.
 */
export async function importFixtures(
  seasonId: string,
  rows:     ImportFixtureRow[],
  commit:   boolean,
): Promise<{ result: ImportResult | null; error: string | null }> {
  if (!isSupabaseConfigured) return { result: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("admin_import_fixtures", {
    p_season_id: seasonId,
    p_fixtures:  rows,
    p_commit:    commit,
  });

  if (error) {
    const marker = "DRY_RUN_RESULT:";
    const idx = error.message.indexOf(marker);
    if (idx !== -1) {
      try {
        const parsed = JSON.parse(error.message.slice(idx + marker.length));
        return {
          result: {
            dryRun:          true,
            fixturesCreated: parsed.would_create_fixtures ?? 0,
            teamsCreated:    parsed.would_create_teams ?? 0,
            errors:          parsed.errors ?? [],
          },
          error: null,
        };
      } catch {
        return { result: null, error: "Could not read the dry-run result." };
      }
    }
    return { result: null, error: error.message };
  }

  const r = data as Record<string, unknown>;
  return {
    result: {
      dryRun:          false,
      fixturesCreated: (r.fixtures_created as number) ?? 0,
      teamsCreated:    (r.teams_created as number) ?? 0,
      errors:          (r.errors as { index: number; error: string }[]) ?? [],
    },
    error: null,
  };
}

/**
 * Parse the wizard's fixture CSV.
 *
 *   round,home,away,kicks_off_at,venue,provider_fixture_id
 *   1,ARS,BUR,2026-08-15T14:00:00Z,Emirates Stadium,1035432
 *
 * Header row required; column order free. Returns per-row errors rather
 * than throwing, so one bad line does not discard a 380-row paste.
 */
export function parseFixtureCsv(
  csv: string,
): { rows: ImportFixtureRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows:   ImportFixtureRow[] = [];

  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { rows: [], errors: ["Needs a header row and at least one fixture."] };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const need   = ["round", "home", "away", "kicks_off_at"];
  const missing = need.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
  }

  const col = (name: string) => header.indexOf(name);

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const round = parseInt(cells[col("round")] ?? "", 10);

    if (isNaN(round)) { errors.push(`Line ${i + 1}: round is not a number`); continue; }

    const home = cells[col("home")];
    const away = cells[col("away")];
    const koRaw = cells[col("kicks_off_at")];

    if (!home || !away) { errors.push(`Line ${i + 1}: home and away are required`); continue; }
    if (!koRaw)         { errors.push(`Line ${i + 1}: kicks_off_at is required`);   continue; }

    const ko = new Date(koRaw);
    if (isNaN(ko.getTime())) {
      errors.push(`Line ${i + 1}: "${koRaw}" is not a valid date — use ISO 8601, e.g. 2026-08-15T14:00:00Z`);
      continue;
    }

    const row: ImportFixtureRow = {
      round,
      home: home.toUpperCase(),
      away: away.toUpperCase(),
      kicks_off_at: ko.toISOString(),
    };

    const optional = (name: string, key: keyof ImportFixtureRow) => {
      const i2 = col(name);
      if (i2 !== -1 && cells[i2]) {
        (row as unknown as Record<string, unknown>)[key] = cells[i2];
      }
    };
    optional("venue", "venue");
    optional("stage", "stage");
    optional("home_name", "home_name");
    optional("away_name", "away_name");
    optional("provider_fixture_id", "provider_fixture_id");

    rows.push(row);
  }

  return { rows, errors };
}

// ── Readiness and launch ──────────────────────────────────────

export async function checkReadiness(
  competitionId: string,
): Promise<{ report: ReadinessReport | null; error: string | null }> {
  if (!isSupabaseConfigured) return { report: null, error: "Supabase is not configured." };

  const { data, error } = await supabase.rpc("admin_competition_readiness", {
    p_competition_id: competitionId,
  });

  if (error) return { report: null, error: error.message };

  const r = data as Record<string, unknown>;
  if (r.error) return { report: null, error: r.error as string };

  return {
    report: {
      ready:       (r.ready as boolean) ?? false,
      competition: (r.competition as string) ?? "",
      problems:    (r.problems as string[]) ?? [],
      warnings:    (r.warnings as string[]) ?? [],
    },
    error: null,
  };
}

export async function launchCompetition(
  competitionId: string,
  force = false,
): Promise<{ launched: boolean; problems: string[]; warnings: string[]; url?: string; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { launched: false, problems: [], warnings: [], error: "Supabase is not configured." };
  }

  const { data, error } = await supabase.rpc("admin_launch_competition", {
    p_competition_id: competitionId,
    p_force:          force,
  });

  if (error) return { launched: false, problems: [], warnings: [], error: error.message };

  const r = data as Record<string, unknown>;
  invalidateEngineCache();

  return {
    launched: (r.launched as boolean) ?? false,
    problems: (r.problems as string[]) ?? [],
    warnings: (r.warnings as string[]) ?? [],
    url:      r.url as string | undefined,
    error:    null,
  };
}
