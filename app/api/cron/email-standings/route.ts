import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DEPRECATED — standings/results emails are now handled per-league by
// /api/cron/email-weekly (with a player-count gate). This endpoint never sends;
// it exists only so any old scheduled or manual trigger safely no-ops.
export async function GET() {
  return NextResponse.json({ skipped: true, reason: "deprecated — replaced by email-weekly" });
}
