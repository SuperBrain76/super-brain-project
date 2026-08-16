import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// DEPRECATED — the daily combined "matches today" email is replaced by the
// per-league weekly engine at /api/cron/email-weekly. This endpoint never sends;
// it exists only so any old scheduled or manual trigger safely no-ops.
export async function GET() {
  return NextResponse.json({ skipped: true, reason: "deprecated — replaced by email-weekly" });
}
