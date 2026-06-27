/**
 * GET /api/cron/advance-knockout
 *
 * Automatically fills in knockout fixture team_ids as teams qualify.
 * Runs every 5 minutes alongside ingest-results.
 *
 * Logic:
 *  1. For each group where all 3 matches are complete, calculate standings
 *     and set home/away_team_id on the R32 fixtures for 1X and 2X seeds.
 *  2. Once ALL 12 groups are done, pick the 8 best 3rd-place teams and
 *     assign them to the correct 3XY R32 slots.
 *  3. For every completed knockout match, propagate the winner (and loser
 *     for the 3rd-place play-off) to the downstream fixture.
 *
 * Safe to re-run — only writes when a fixture's team_id is still NULL
 * or when it can now be resolved.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ── Supabase admin client ────────────────────────────────────────

function db(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

// ── Types ────────────────────────────────────────────────────────

interface TeamRow {
  id: string;
  code: string;
  name: string;
  group_name: string;
}

interface FixtureRow {
  id: string;
  fixture_number: number;
  stage: string;
  group_name: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
}

interface Standing {
  teamId: string;
  code: string;
  group: string;
  pts: number;
  gd: number;
  gf: number;
  rank: number; // within group: 1, 2, 3, 4
}

// ── R32 seed → fixture number mapping ───────────────────────────
// Source: lib/knockoutSeeds.ts (fixture numbers 73–88)

const R32: Record<number, { home: string; away: string }> = {
  73:  { home: "1E",   away: "3ABCD" },
  74:  { home: "1D",   away: "2F"    },
  75:  { home: "1C",   away: "3ABDE" },
  76:  { home: "1B",   away: "2D"    },
  77:  { home: "1A",   away: "3BCDF" },
  78:  { home: "2E",   away: "2C"    },
  79:  { home: "1F",   away: "3ACDE" },
  80:  { home: "2A",   away: "2B"    },
  81:  { home: "1I",   away: "3GHIL" },
  82:  { home: "1H",   away: "2J"    },
  83:  { home: "1G",   away: "3HIJK" },
  84:  { home: "1J",   away: "2H"    },
  85:  { home: "1K",   away: "3GHIJ" },
  86:  { home: "2G",   away: "2I"    },
  87:  { home: "1L",   away: "3IJKL" },
  88:  { home: "2K",   away: "2L"    },
};

// Later rounds: WN = winner of fixture N
const LATER_ROUNDS: Record<number, { home: string; away: string }> = {
  89:  { home: "W73", away: "W74" },
  90:  { home: "W75", away: "W76" },
  91:  { home: "W77", away: "W78" },
  92:  { home: "W79", away: "W80" },
  93:  { home: "W81", away: "W82" },
  94:  { home: "W83", away: "W84" },
  95:  { home: "W85", away: "W86" },
  96:  { home: "W87", away: "W88" },
  97:  { home: "W89", away: "W90" },
  98:  { home: "W91", away: "W92" },
  99:  { home: "W93", away: "W94" },
  100: { home: "W95", away: "W96" },
  101: { home: "W97", away: "W98"  },
  102: { home: "W99", away: "W100" },
  103: { home: "L101", away: "L102" }, // 3rd place play-off (losers)
  104: { home: "W101", away: "W102" },
};

// ── Helpers ──────────────────────────────────────────────────────

/** Calculate group standings from completed fixtures for one group. */
function calcStandings(
  groupCode: string,
  teams: TeamRow[],
  fixtures: FixtureRow[],
): Standing[] {
  const groupTeams = teams.filter((t) => t.group_name === groupCode);
  const groupFixtures = fixtures.filter(
    (f) => f.group_name === groupCode && f.status === "completed",
  );

  const stats: Record<string, { pts: number; gd: number; gf: number }> = {};
  for (const t of groupTeams) {
    stats[t.id] = { pts: 0, gd: 0, gf: 0 };
  }

  for (const f of groupFixtures) {
    if (f.home_score == null || f.away_score == null) continue;
    const h = f.home_team_id!;
    const a = f.away_team_id!;
    const hs = f.home_score;
    const as_ = f.away_score;

    stats[h].gf += hs;
    stats[h].gd += hs - as_;
    stats[a].gf += as_;
    stats[a].gd += as_ - hs;

    if (hs > as_)       { stats[h].pts += 3; }
    else if (hs === as_) { stats[h].pts += 1; stats[a].pts += 1; }
    else                { stats[a].pts += 3; }
  }

  const sorted = groupTeams
    .map((t) => ({ teamId: t.id, code: t.code, group: groupCode, ...stats[t.id], rank: 0 }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

  return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
}

/** Parse a seed label like "1E", "2F", "3ABCD", "W73", "L101". */
function parseSeed(seed: string): { type: "group1" | "group2" | "third" | "winner" | "loser"; value: string } {
  if (seed.startsWith("W")) return { type: "winner", value: seed.slice(1) };
  if (seed.startsWith("L")) return { type: "loser",  value: seed.slice(1) };
  if (seed.startsWith("1")) return { type: "group1", value: seed.slice(1) };
  if (seed.startsWith("2")) return { type: "group2", value: seed.slice(1) };
  if (seed.startsWith("3")) return { type: "third",  value: seed.slice(1) };
  return { type: "winner", value: seed };
}

export async function GET(req: NextRequest) {
  const supabase = db();
  const log: string[] = [];
  const reset = req.nextUrl.searchParams.get("reset") === "true";

  // Auth open only when reset=true (one-time fix for bad data from buggy run).
  // Normal cron calls always require CRON_SECRET.
  const auth = req.headers.get("authorization") ?? "";
  if (!reset && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Load all WC2026 data ─────────────────────────────────────

  const { data: comp } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  // Reset all knockout team assignments so the corrected logic re-fills them cleanly.
  if (reset) {
    await supabase
      .from("fixtures")
      .update({ home_team_id: null, away_team_id: null })
      .eq("competition_id", comp.id)
      .neq("stage", "group");
    log.push("reset: cleared all knockout team_ids");
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("id, code, name, group_name")
    .eq("competition_id", comp.id);
  if (!teams) return NextResponse.json({ error: "teams not found" }, { status: 500 });

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, fixture_number, stage, group_name, home_team_id, away_team_id, home_score, away_score, status")
    .eq("competition_id", comp.id)
    .order("fixture_number");
  if (!fixtures) return NextResponse.json({ error: "fixtures not found" }, { status: 500 });

  // Index for fast lookup
  const fixtureByNumber = new Map<number, FixtureRow>(
    (fixtures as FixtureRow[]).map((f) => [f.fixture_number, f])
  );

  // ── Step 1: Group standings → fill 1X / 2X seeds ─────────────

  const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
  const allStandings: Standing[] = [];
  const completedGroups = new Set<string>();

  for (const g of GROUPS) {
    const groupFixtures = (fixtures as FixtureRow[]).filter(
      (f) => f.group_name === g && f.stage === "group"
    );
    const completedCount = groupFixtures.filter((f) => f.status === "completed").length;

    // Each group of 4 teams plays 6 matches (4C2 = 6). All must be complete.
    if (completedCount < 6) continue;
    completedGroups.add(g);

    const standings = calcStandings(g, teams as TeamRow[], fixtures as FixtureRow[]);
    allStandings.push(...standings);

    const winner    = standings.find((s) => s.rank === 1);
    const runnerUp  = standings.find((s) => s.rank === 2);
    if (!winner || !runnerUp) continue;

    // Update R32 fixtures that reference 1G or 2G
    for (const [fixtureNum, seeds] of Object.entries(R32)) {
      const fnum = Number(fixtureNum);
      const fixture = fixtureByNumber.get(fnum);
      if (!fixture) continue;

      const updates: Partial<{ home_team_id: string; away_team_id: string }> = {};

      if (seeds.home === `1${g}` && !fixture.home_team_id) {
        updates.home_team_id = winner.teamId;
        log.push(`fixture ${fnum} home → 1${g} = ${winner.code}`);
      }
      if (seeds.home === `2${g}` && !fixture.home_team_id) {
        updates.home_team_id = runnerUp.teamId;
        log.push(`fixture ${fnum} home → 2${g} = ${runnerUp.code}`);
      }
      if (seeds.away === `1${g}` && !fixture.away_team_id) {
        updates.away_team_id = winner.teamId;
        log.push(`fixture ${fnum} away → 1${g} = ${winner.code}`);
      }
      if (seeds.away === `2${g}` && !fixture.away_team_id) {
        updates.away_team_id = runnerUp.teamId;
        log.push(`fixture ${fnum} away → 2${g} = ${runnerUp.code}`);
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("fixtures").update(updates).eq("id", fixture.id);
        // Update local cache so later steps see the change
        Object.assign(fixture, updates);
      }
    }
  }

  // ── Step 2: Best 8 third-place teams (once ALL 12 groups done) ──

  if (completedGroups.size === 12) {
    const thirdPlace = allStandings.filter((s) => s.rank === 3);

    // Rank all 12 third-place teams: pts → GD → GF
    const ranked3rd = [...thirdPlace].sort(
      (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
    );
    const qualified3rd = ranked3rd.slice(0, 8); // best 8 advance

    log.push(`3rd-place qualifiers: ${qualified3rd.map((s) => `${s.code}(${s.group})`).join(", ")}`);

    // Map group → qualifying 3rd-place team
    const qual3rdByGroup = new Map<string, Standing>(
      qualified3rd.map((s) => [s.group, s])
    );

    // Each qualifying 3rd-place team must fill exactly ONE slot.
    // Track assigned teams so a team whose group letter appears in multiple
    // "3XY" seed patterns (e.g. Group A appears in 3ABCD, 3ABDE, 3ACDE)
    // is only assigned to the first matching slot.
    const assigned3rd = new Set<string>();

    // For each R32 slot with a "3XY..." seed, find the matching qualifier
    for (const [fixtureNum, seeds] of Object.entries(R32)) {
      const fnum = Number(fixtureNum);
      const fixture = fixtureByNumber.get(fnum);
      if (!fixture) continue;

      for (const side of ["home", "away"] as const) {
        const seed = seeds[side];
        if (!seed.startsWith("3")) continue;

        const already = side === "home" ? fixture.home_team_id : fixture.away_team_id;
        if (already) continue; // already set

        const groupSet = seed.slice(1).split(""); // "3ABCD" → ["A","B","C","D"]
        // Find first qualifying team from this group set not yet assigned
        const match = groupSet
          .map((g) => qual3rdByGroup.get(g))
          .find((s) => s && !assigned3rd.has(s.teamId));

        if (match) {
          assigned3rd.add(match.teamId);
          const update = side === "home"
            ? { home_team_id: match.teamId }
            : { away_team_id: match.teamId };
          await supabase.from("fixtures").update(update).eq("id", fixture.id);
          Object.assign(fixture, update);
          log.push(`fixture ${fnum} ${side} → ${seed} = ${match.code}(${match.group})`);
        }
      }
    }
  }

  // ── Step 3: Propagate knockout winners to later rounds ──────────

  for (const [fixtureNum, seeds] of Object.entries(LATER_ROUNDS)) {
    const fnum = Number(fixtureNum);
    const fixture = fixtureByNumber.get(fnum);
    if (!fixture) continue;

    for (const side of ["home", "away"] as const) {
      const seed = seeds[side];
      const already = side === "home" ? fixture.home_team_id : fixture.away_team_id;
      if (already) continue;

      const parsed = parseSeed(seed);
      if (parsed.type !== "winner" && parsed.type !== "loser") continue;

      const sourceFixtureNum = Number(parsed.value);
      const sourceFixture = fixtureByNumber.get(sourceFixtureNum);
      if (!sourceFixture || sourceFixture.status !== "completed") continue;
      if (sourceFixture.home_score == null || sourceFixture.away_score == null) continue;
      if (!sourceFixture.home_team_id || !sourceFixture.away_team_id) continue;

      let teamId: string;
      const homeWon = sourceFixture.home_score > sourceFixture.away_score;

      if (parsed.type === "winner") {
        teamId = homeWon ? sourceFixture.home_team_id : sourceFixture.away_team_id;
      } else {
        // loser — for 3rd place play-off
        teamId = homeWon ? sourceFixture.away_team_id : sourceFixture.home_team_id;
      }

      const update = side === "home" ? { home_team_id: teamId } : { away_team_id: teamId };
      await supabase.from("fixtures").update(update).eq("id", fixture.id);
      Object.assign(fixture, update);

      const teamCode = (teams as TeamRow[]).find((t) => t.id === teamId)?.code ?? teamId;
      log.push(`fixture ${fnum} ${side} → ${seed} = ${teamCode}`);
    }
  }

  return NextResponse.json({ ok: true, completedGroups: completedGroups.size, changes: log });
}
