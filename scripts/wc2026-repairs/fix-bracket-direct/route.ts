/**
 * GET /api/admin/fix-bracket-direct
 * Writes correct team UUIDs directly to fixtures — no propagation logic.
 * UUIDs verified from bracket-status on 2026-07-11.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const dynamic = "force-dynamic";

// UUID constants verified from /api/admin/bracket-status
const ARG = "3ff65f4e-e893-4f23-b001-06bf3bcba5ab";
const SUI = "deef62fa-41e6-48e1-bf03-2254c5749780";
const ESP = "d0cc59ee-f1b3-4eeb-91d8-ed7d4ea9ad50";
const BEL = "b3c7b880-8c97-48aa-a677-649abad47f95";
const NOR = "c1e7a2e1-1401-4ce5-a58b-7fda912e9f6a";
const ENG = "ca9b4754-abad-4076-b7b3-9b38ac9477e8";

// Correct R16/QF team assignments
const FIXES: Record<number, { home_team_id?: string; away_team_id?: string }> = {
  95:  { home_team_id: ARG },            // ARG vs EGY
  96:  { home_team_id: SUI },            // SUI vs COL
  98:  { home_team_id: ESP, away_team_id: BEL },  // ESP vs BEL
  99:  { home_team_id: NOR, away_team_id: ENG },  // NOR vs ENG
};

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );

  const { data: comp } = await db.from("competitions").select("id").eq("slug", "wc2026").single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const fixtureNumbers = Object.keys(FIXES).map(Number);
  const { data: fixtures } = await db
    .from("fixtures")
    .select("id, fixture_number, home_team_id, away_team_id")
    .eq("competition_id", comp.id)
    .in("fixture_number", fixtureNumbers);

  if (!fixtures) return NextResponse.json({ error: "no fixtures found" }, { status: 500 });

  const log: string[] = [];
  const now = new Date().toISOString();

  for (const fix of fixtures as { id: string; fixture_number: number; home_team_id: string; away_team_id: string }[]) {
    const updates = FIXES[fix.fixture_number];
    if (!updates) continue;

    const payload = { ...updates, updated_at: now };
    const { error } = await db.from("fixtures").update(payload).eq("id", fix.id);

    if (error) {
      log.push(`fixture ${fix.fixture_number}: ERROR ${error.message}`);
    } else {
      log.push(`fixture ${fix.fixture_number}: updated → ${JSON.stringify(updates)}`);
    }
  }

  // Read back to confirm
  const { data: verify } = await db
    .from("fixtures")
    .select("fixture_number, home_team_id, away_team_id")
    .eq("competition_id", comp.id)
    .in("fixture_number", fixtureNumbers);

  return NextResponse.json({ ok: true, changes: log, verify });
}
