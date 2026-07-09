/**
 * GET /api/cron/advance-knockout
 *
 * Propagates knockout match winners into the next round automatically.
 * Runs every 5 minutes via the ingest-results GitHub Actions workflow.
 *
 * Only does winner/loser propagation — R32 teams are managed via
 * /api/admin/set-knockout-teams. Safe to re-run.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

// Penalty shootout overrides: fixture_number → "home" | "away"
// When a knockout match ends level (score-based logic can't determine winner),
// manually specify which side won on penalties.
const PENALTY_WINNER: Record<number, "home" | "away"> = {
  74: "away",  // GER 1-1 PAR → Paraguay won on penalties
  75: "away",  // NED 1-1 MAR → Morocco won on penalties
  82: "home",  // BEL 2-2 SEN → Belgium won on penalties
  86: "home",  // ARG 1-1 CPV → Argentina won on penalties
  88: "away",  // AUS 1-1 EGY → Egypt won on penalties
  96: "home",  // SUI 0-0 COL → Switzerland won on penalties
};

// winner of fixture N → fills a slot in a later fixture
// "L" prefix = loser (3rd place play-off only)
const PROPAGATION: Record<number, { home: string; away: string }> = {
  // R16 — winners of R32 pairs
  89:  { home: "W74", away: "W77" },
  90:  { home: "W73", away: "W75" },
  91:  { home: "W76", away: "W78" },
  92:  { home: "W79", away: "W80" },
  93:  { home: "W83", away: "W84" },
  94:  { home: "W82", away: "W81" },
  95:  { home: "W86", away: "W88" },  // ARG/CPV winner vs AUS/EGY winner
  96:  { home: "W85", away: "W87" },  // SUI/ALG winner vs COL/GHA winner
  // QF — winners of R16
  97:  { home: "W89", away: "W90" },
  98:  { home: "W91", away: "W92" },
  99:  { home: "W93", away: "W94" },
  100: { home: "W95", away: "W96" },
  // SF — winners of QF
  101: { home: "W97",  away: "W98"  },
  102: { home: "W99",  away: "W100" },
  // 3rd place — losers of SF
  103: { home: "L101", away: "L102" },
  // Final — winners of SF
  104: { home: "W101", away: "W102" },
};

export async function GET(req: NextRequest) {
  const supabase = db();
  const log: string[] = [];

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: comp } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", "wc2026")
    .single();
  if (!comp) return NextResponse.json({ error: "competition not found" }, { status: 500 });

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, fixture_number, home_team_id, away_team_id, home_score, away_score, status")
    .eq("competition_id", comp.id)
    .neq("stage", "group")
    .order("fixture_number");
  if (!fixtures) return NextResponse.json({ error: "fixtures not found" }, { status: 500 });

  const byNum = new Map(
    (fixtures as { id: string; fixture_number: number; home_team_id: string | null; away_team_id: string | null; home_score: number | null; away_score: number | null; status: string }[])
      .map((f) => [f.fixture_number, f])
  );

  for (const [destNum, seeds] of Object.entries(PROPAGATION)) {
    const dest = byNum.get(Number(destNum));
    if (!dest) continue;

    for (const side of ["home", "away"] as const) {
      const already = side === "home" ? dest.home_team_id : dest.away_team_id;
      if (already) continue;

      const seed = seeds[side]; // e.g. "W73" or "L101"
      const isLoser = seed.startsWith("L");
      const srcNum = Number(seed.slice(1));
      const src = byNum.get(srcNum);

      if (!src || src.status !== "completed") continue;
      if (src.home_score == null || src.away_score == null) continue;
      if (!src.home_team_id || !src.away_team_id) continue;

      // For drawn matches, check penalty override; fall back to score comparison
      const penaltyWinner = PENALTY_WINNER[srcNum];
      const homeWon = penaltyWinner
        ? penaltyWinner === "home"
        : src.home_score > src.away_score;
      const teamId = isLoser
        ? (homeWon ? src.away_team_id : src.home_team_id)
        : (homeWon ? src.home_team_id : src.away_team_id);

      const update = side === "home" ? { home_team_id: teamId } : { away_team_id: teamId };
      await supabase.from("fixtures").update(update).eq("id", dest.id);
      Object.assign(dest, update);
      log.push(`fixture ${destNum} ${side} ← ${seed}`);
    }
  }

  return NextResponse.json({ ok: true, changes: log });
}
