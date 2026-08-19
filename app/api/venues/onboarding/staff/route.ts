/**
 * POST /api/venues/onboarding/staff — record the team who'll run the league.
 *
 * Body: { session_id, emails: string[] }. Optional step. We store the list on
 * the venue so the owner (and later, an invite flow) can reach the bar staff;
 * nothing is emailed from here — capturing the team is the point of the step.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVenueBySession } from "@/lib/venueSession";
import { logEvent } from "@/lib/venueDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const r = await resolveVenueBySession(body.session_id);
  if (!r) return NextResponse.json({ error: "session not recognised" }, { status: 403 });

  const rawEmails: string[] = (Array.isArray(body.emails) ? body.emails : [])
    .map((e: unknown) => String(e ?? "").trim().toLowerCase())
    .filter((e: string) => EMAIL.test(e));
  const emails = Array.from(new Set(rawEmails)).slice(0, 25);

  const { error } = await r.db.from("venues")
    .update({ staff_emails: emails, onboarding_step: "staff" }).eq("id", r.venueId);
  if (error) {
    console.error("[onboarding/staff]", error.message);
    return NextResponse.json({ error: "could not save staff" }, { status: 500 });
  }
  await logEvent(r.db, r.venueId, "staff_saved", { count: emails.length });

  return NextResponse.json({ ok: true, count: emails.length });
}
