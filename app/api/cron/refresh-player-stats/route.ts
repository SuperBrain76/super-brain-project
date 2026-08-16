/**
 * GET /api/cron/refresh-player-stats
 *
 * Pulls top scorers/assists for each football league from football-data.org and
 * caches them in competition_settings (key "player_scorers"). The Stats tab
 * reads that cache, so pages never call the external API directly. Runs daily.
 *
 * Needs FOOTBALL_DATA_TOKEN in the environment. Protected by CRON_SECRET.
 * Add ?debug=true (no auth) to see what would be fetched without writing.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchScorers, FD_LEAGUE_CODE } from "@/lib/footballData";

export const dynamic = "force-dynamic";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug") === "true";
  if (!debug) {
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const token = process.env.FOOTBALL_DATA_TOKEN ?? "";
  if (!token) {
    return NextResponse.json({ error: "FOOTBALL_DATA_TOKEN not set" }, { status: 503 });
  }

  const db = adminDb();
  const { data: comps } = await db
    .from("competitions")
    .select("id, slug")
    .in("slug", Object.keys(FD_LEAGUE_CODE))
    .eq("status", "active");

  const result: Record<string, unknown> = {};
  for (const comp of comps ?? []) {
    try {
      const scorers = await fetchScorers(comp.slug as string, token, 20);
      if (scorers.length === 0) { result[comp.slug as string] = { scorers: 0 }; continue; }

      if (!debug) {
        await db.from("competition_settings").upsert(
          {
            competition_id: comp.id,
            key: "player_scorers",
            value: { updatedAt: new Date().toISOString(), scorers },
          },
          { onConflict: "competition_id,key" },
        );
      }
      result[comp.slug as string] = { scorers: scorers.length, top: scorers[0]?.name };
    } catch (e) {
      result[comp.slug as string] = { error: String(e) };
    }
    // Gentle spacing for the free-tier rate limit (10 req/min).
    await new Promise((r) => setTimeout(r, 6500));
  }

  return NextResponse.json({ ok: true, debug, leagues: result });
}
