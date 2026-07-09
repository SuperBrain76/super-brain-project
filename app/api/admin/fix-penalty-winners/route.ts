/**
 * GET /api/admin/fix-penalty-winners
 *
 * Corrects R16 team assignments for matches decided on penalties.
 * Reads the winner directly from the R32 fixture's home/away team IDs
 * based on the known penalty results, bypassing score comparison.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// fixture_number → which side won on penalties
const PENALTY_RESULTS: Record<number, "home" | "away"> = {
  74: "away",  // GER 1-1 PAR → Paraguay won
  75: "away",  // NED 1-1 MAR → Morocco won
  82: "home",  // BEL 2-2 SEN → Belgium won
  86: "home",  // ARG 1-1 CPV → Argentina won
  88: "away",  // AUS 1-1 EGY → Egypt won
  96: "home",  // SUI 0-0 COL → Switzerland won
};

// R16 fixture → which R32 fixture feeds which side
const ALL_FEEDS: Record<number, { home: number; away: number }> = {
  // R16
  89: { home: 74, away: 77 },
  90: { home: 73, away: 75 },
  91: { home: 76, away: 78 },
  92: { home: 79, away: 80 },
  93: { home: 83, away: 84 },
  94: { home: 82, away: 81 },
  95: { home: 86, away: 88 },
  96: { home: 85, away: 87 },
  // QF
  97: { home: 89, away: 90 },
  98: { home: 91, away: 92 },
  99: { home: 93, away: 94 },
  100: { home: 95, away: 96 },
};

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

  const { data: comp } = await db.from("competitions").select("id").eq("slug", "wc2026").single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const { data: fixtures } = await db
    .from("fixtures")
    .select("id, fixture_number, home_team_id, away_team_id, home_score, away_score, status")
    .eq("competition_id", comp.id)
    .neq("stage", "group")
    .order("fixture_number");

  if (!fixtures) return NextResponse.json({ error: "no fixtures" }, { status: 500 });

  const byNum = new Map(fixtures.map((f: { fixture_number: number; id: string; home_team_id: string | null; away_team_id: string | null; home_score: number | null; away_score: number | null; status: string }) => [f.fixture_number, f]));

  const log: string[] = [];

  for (const [r16Num, feeds] of Object.entries(ALL_FEEDS)) {
    const dest = byNum.get(Number(r16Num));
    if (!dest) continue;

    for (const side of ["home", "away"] as const) {
      const already = side === "home" ? dest.home_team_id : dest.away_team_id;

      const srcNum = feeds[side];
      const src = byNum.get(srcNum);
      if (!src || src.status !== "completed") continue;
      if (!src.home_team_id || !src.away_team_id) continue;

      // Determine winner: use penalty override if available, else score
      const penaltyWinner = PENALTY_RESULTS[srcNum];
      const homeWon = penaltyWinner
        ? penaltyWinner === "home"
        : (src.home_score ?? 0) > (src.away_score ?? 0);
      const correctTeamId = homeWon ? src.home_team_id : src.away_team_id;

      // Skip if already correct
      if (already === correctTeamId) {
        log.push(`fixture ${r16Num} ${side}: already correct`);
        continue;
      }

      const update = side === "home" ? { home_team_id: correctTeamId } : { away_team_id: correctTeamId };
      const { error } = await db.from("fixtures").update(update).eq("id", dest.id);
      if (error) {
        log.push(`fixture ${r16Num} ${side}: ERROR ${error.message}`);
      } else {
        Object.assign(dest, update);
        log.push(`fixture ${r16Num} ${side}: set from fixture ${srcNum} (${penaltyWinner ? "penalties" : "score"})`);
      }
    }
  }

  return NextResponse.json({ ok: true, changes: log });
}
