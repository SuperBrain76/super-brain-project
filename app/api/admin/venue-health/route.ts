/**
 * GET /api/admin/venue-health — machine-readable health for the cron check.
 *
 * Protected by CRON_SECRET, same as the other admin routes. Deliberately tiny:
 * the nightly workflow greps `errors_24h` and fails the run if it is non-zero,
 * so problems reach an inbox without anyone opening the dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db    = admin();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [errors, recent, pending, pastDue] = await Promise.all([
    db.from("venue_events").select("id", { count: "exact", head: true })
      .eq("severity", "error").gte("created_at", since),
    db.from("venue_events").select("kind, source, detail, created_at")
      .eq("severity", "error").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(10),
    db.from("venues").select("id", { count: "exact", head: true })
      .eq("status", "prospect").is("enriched_at", null),
    db.from("venues").select("id", { count: "exact", head: true }).eq("status", "past_due"),
  ]);

  return NextResponse.json({
    errors_24h:          errors.count ?? 0,
    awaiting_enrichment: pending.count ?? 0,
    past_due:            pastDue.count ?? 0,
    recent_errors:       recent.data ?? [],
    checked_at:          new Date().toISOString(),
  });
}
