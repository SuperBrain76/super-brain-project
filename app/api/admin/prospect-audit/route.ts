/**
 * GET /api/admin/prospect-audit — provenance and score distribution.
 *
 * Read-only. Exists because "how many prospects can we actually email" turned
 * out to be unanswerable: ANTHROPIC_API_KEY was unset, so every enrichment fell
 * back to mockScore() and wrote enrichment.mock = true, while the outreach gate
 * still qualified on fit_score alone.
 *
 * `realEligible` is the only number that should ever drive a sending decision.
 * Rows with no `mock` key predate the flag, so their provenance is unknown and
 * they are counted as mock — unknown is not the same as clean.
 *
 * Auth: Bearer MARKETING_API_SECRET, falling back to CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";

export const dynamic = "force-dynamic";

const BANDS = [0, 20, 40, 60, 70, 80, 90, 101];

export async function GET(req: NextRequest) {
  // Accept either — `A || B` makes B stop working the day A is set, which is
  // how /api/cron/instantly-poll silently 401'd for eleven days.
  const accepted = [process.env.MARKETING_API_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .map((s) => `Bearer ${s}`);
  if (!accepted.length || !accepted.includes(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Was building its own client; that one read through Next's fetch cache and
  // served a 90-minute-old snapshot. admin() pins cache: "no-store".
  let db;
  try { db = admin(); }
  catch { return NextResponse.json({ error: "Supabase not configured" }, { status: 500 }); }
  const MIN_FIT = Number(process.env.OUTREACH_MIN_FIT_SCORE ?? 60);

  const { data: rows, error } = await db
    .from("venues")
    .select("id, status, country, fit_score, contact_email_status, outreach_pushed_at, enrichment")
    .limit(50000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = rows ?? [];
  // Explicit false only. A missing key means the row predates the flag and its
  // provenance cannot be established, which is not the same as being clean.
  const isReal = (v: any) => v?.enrichment?.mock === false;
  const isMock = (v: any) => !isReal(v);

  const gate = (v: any) =>
    v.status === "verified" &&
    v.contact_email_status === "valid" &&
    !v.outreach_pushed_at &&
    Number(v.fit_score ?? 0) >= MIN_FIT &&
    !["DE", "AT"].includes(String(v.country ?? "").toUpperCase());

  const scored = all.filter((v) => v.fit_score !== null && v.fit_score !== undefined);
  const dist = (subset: any[]) => {
    const out: Record<string, number> = {};
    for (let i = 0; i < BANDS.length - 1; i++) {
      const lo = BANDS[i], hi = BANDS[i + 1];
      out[`${lo}-${hi - 1}`] = subset.filter(
        (v) => Number(v.fit_score) >= lo && Number(v.fit_score) < hi).length;
    }
    return out;
  };

  const passGate = all.filter(gate);
  const realEligible = passGate.filter(isReal);
  const mockEligible = passGate.filter(isMock);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    minFitScore: MIN_FIT,
    scoringMode: process.env.ANTHROPIC_API_KEY ? "live" : "MOCK (ANTHROPIC_API_KEY unset)",
    totals: {
      prospects: all.length,
      scored: scored.length,
      unscored: all.length - scored.length,
      realScores: all.filter(isReal).length,
      mockOrUnknownScores: all.filter(isMock).length,
    },
    eligibleForSending: {
      passingAllGatesIgnoringProvenance: passGate.length,
      realAndEligible: realEligible.length,
      mockAndWouldHaveBeenSent: mockEligible.length,
      note: "realAndEligible is the only number safe to scale on. mockAndWouldHaveBeenSent is what the old gate would have emailed.",
    },
    scoreDistribution: { real: dist(all.filter(isReal)), mockOrUnknown: dist(all.filter(isMock)) },
    alreadyPushed: {
      total: all.filter((v) => v.outreach_pushed_at).length,
      pushedOnMockScore: all.filter((v) => v.outreach_pushed_at && isMock(v)).length,
    },
    byStatus: all.reduce((acc: Record<string, number>, v) => {
      acc[String(v.status ?? "null")] = (acc[String(v.status ?? "null")] ?? 0) + 1;
      return acc;
    }, {}),
  });
}
