/**
 * GET /api/admin/bracket-status
 * Shows all knockout fixtures with current scores and propagated teams.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

  const { data: comp } = await db.from("competitions").select("id").eq("slug", "wc2026").single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const { data: teams } = await db.from("teams").select("id, code, name").eq("competition_id", comp.id);
  const teamMap = new Map((teams ?? []).map((t: { id: string; code: string; name: string }) => [t.id, { code: t.code, name: t.name }]));

  const { data: fixtures } = await db
    .from("fixtures")
    .select("id, fixture_number, stage, kicks_off_at, home_team_id, away_team_id, home_score, away_score, status")
    .eq("competition_id", comp.id)
    .neq("stage", "group")
    .order("fixture_number");

  const rows = (fixtures ?? []).map((f: {
    id: string; fixture_number: number; stage: string; kicks_off_at: string;
    home_team_id: string | null; away_team_id: string | null;
    home_score: number | null; away_score: number | null; status: string;
  }) => {
    const home = f.home_team_id ? teamMap.get(f.home_team_id) : null;
    const away = f.away_team_id ? teamMap.get(f.away_team_id) : null;
    let winner = null;
    if (f.status === "completed" && f.home_score != null && f.away_score != null) {
      winner = f.home_score > f.away_score ? (home?.code ?? "home") : (away?.code ?? "away");
    }
    return {
      fixture_number: f.fixture_number,
      stage: f.stage,
      kicks_off_at: f.kicks_off_at,
      status: f.status,
      home: home?.code ?? "TBD",
      away: away?.code ?? "TBD",
      home_id: f.home_team_id,
      away_id: f.away_team_id,
      score: f.home_score != null ? `${f.home_score}-${f.away_score}` : null,
      winner,
    };
  });

  return NextResponse.json({ fixtures: rows });
}
