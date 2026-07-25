/**
 * GET /api/admin/audit-duplicates
 * Checks for duplicate fixture rows (same fixture_number, same competition).
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

  const { data: fixtures } = await db
    .from("fixtures")
    .select("id, fixture_number, stage, home_team_id, away_team_id, status")
    .eq("competition_id", comp.id)
    .order("fixture_number");

  if (!fixtures) return NextResponse.json({ error: "no fixtures" }, { status: 500 });

  type FixRow = { id: string; fixture_number: number; stage: string; home_team_id: string | null; away_team_id: string | null; status: string };
  const rows = fixtures as FixRow[];

  // Find duplicate fixture_numbers
  const counts: Record<number, FixRow[]> = {};
  for (const f of rows) {
    if (!counts[f.fixture_number]) counts[f.fixture_number] = [];
    counts[f.fixture_number].push(f);
  }

  const duplicates = Object.entries(counts)
    .filter(([, dupeRows]) => dupeRows.length > 1)
    .map(([num, dupeRows]) => ({ fixture_number: Number(num), count: dupeRows.length, rows: dupeRows }));

  return NextResponse.json({
    comp_id: comp.id,
    total_fixtures: fixtures.length,
    duplicates,
    duplicate_count: duplicates.length,
  });
}
