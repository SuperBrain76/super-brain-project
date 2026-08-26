/**
 * GET|POST /api/outreach/sync — push qualified prospects into Instantly.
 *
 * Runs daily from GitHub Actions (same pattern as the fixture crons):
 *   curl -H "Authorization: Bearer $CRON_SECRET" .../api/outreach/sync
 *
 * This is the ONLY path from the CRM into a live send, and it is deliberately
 * conservative. A venue is pushed only when ALL of these hold:
 *
 *   status               = 'verified'      (we found a real contact)
 *   contact_email_status = 'valid'         (it passed verification)
 *   outreach_pushed_at   is null           (never pushed before)
 *   fit_score           >= OUTREACH_MIN_FIT_SCORE   (it is actually a sports venue)
 *   country not in (DE, AT)                (UWG §7 — see lib/instantly.ts)
 *   email not in email_suppressions        (bounced / unsubscribed / complained)
 *
 * ?limit= caps the run. Default comes from OUTREACH_DAILY_CAP and exists to
 * enforce the warmup ramp: a new sending domain that pushes 5,000 leads on day
 * one is a burned domain. Start at 200/day and climb.
 *
 * ?dry=1 reports exactly who WOULD be pushed without touching Instantly.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin, isSuppressed } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { pushLead, campaignFor, InstantlyError, mailboxDailyLimit, setCampaignDailyLimit } from "@/lib/instantly";
import { SELECTION_ORDER, selectForOutreach } from "@/lib/outreachRanking";
import { planCapacity, followUpsDue, pendingFirstSends, SAFETY_CEILING, type FollowUpCandidate } from "@/lib/outreachCapacity";
import { SITE } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_FIT = Number(process.env.OUTREACH_MIN_FIT_SCORE ?? 60);

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // Prefers its own secret so a dry run can be delegated without handing out
  // CRON_SECRET, which unlocks every other admin route. Scoped to this route
  // alone — nothing else reads OUTREACH_SYNC_SECRET. Falls back to CRON_SECRET
  // so existing callers are unaffected, and still fails closed when neither
  // is set. Same pattern as /api/admin/venue-state.
  const secret = (process.env.OUTREACH_SYNC_SECRET || process.env.CRON_SECRET) ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dry   = req.nextUrl.searchParams.get("dry") === "1";
  // ?venues=N is the real control: N NEW venues. ?limit is kept for existing
  // callers and means the same thing, but the name lied - Instantly's daily
  // limit counts EMAILS, and a two-step sequence spends two of them per venue.
  const wantVenues = Math.min(
    2000,
    Number(req.nextUrl.searchParams.get("venues"))
      || Number(req.nextUrl.searchParams.get("limit"))
      || Number(process.env.OUTREACH_DAILY_CAP ?? 200),
  );

  const db = admin();

  // ── capacity ───────────────────────────────────────────────────────────
  // Emails needed today = new venues + follow-ups genuinely due. Computed from
  // our own message history, so it does not depend on Instantly agreeing.
  const GAP_DAYS = Number(process.env.OUTREACH_FOLLOWUP_GAP_DAYS ?? 4);
  let plan;
  try {
    const { data: inFlight, error: flightErr } = await db
      .from("venues")
      .select("id, status, first_emailed_at, emails_sent, contact_email")
      .not("outreach_pushed_at", "is", null);
    if (flightErr) throw new Error(`in-flight lookup failed: ${flightErr.message}`);

    const { data: suppressed } = await db.from("email_suppressions").select("email");
    const stopList = new Set((suppressed ?? []).map(x => String(x.email).toLowerCase()));
    const STOPPED = new Set(["replied", "disqualified", "signed_up", "trialing", "active", "past_due", "churned", "suspended"]);

    const candidates: FollowUpCandidate[] = (inFlight ?? []).map(v => ({
      venue_id: v.id,
      first_sent_at: v.first_emailed_at as string | null,
      steps_sent: Number(v.emails_sent ?? 0),
      sequence_stopped:
        STOPPED.has(String(v.status)) || stopList.has(String(v.contact_email ?? "").toLowerCase()),
    }));

    const due = followUpsDue(candidates, new Date(), GAP_DAYS);
    const pending = pendingFirstSends(candidates);
    const acct = await mailboxDailyLimit();      // throws if unknown -> fail closed
    plan = planCapacity({
      newVenues: wantVenues, followUpsDue: due, pendingFirstSends: pending,
      ceiling: SAFETY_CEILING, accountLimit: acct,
    });
  } catch (e: any) {
    // Fail closed: without a trustworthy capacity number we neither send nor guess.
    await emit(db, EVENT.SYNC_FAILED, {
      source: "instantly", detail: { stage: "capacity", error: String(e?.message ?? e).slice(0, 300) },
    });
    return NextResponse.json(
      { error: "capacity could not be determined", detail: String(e?.message ?? e).slice(0, 300) },
      { status: 503 },
    );
  }

  const limit = plan.new_venues_released;

  // Fetch the whole eligible set, then rank it in JS. Slicing to `limit` in SQL
  // while tied on fit_score is what let the dry run and the real push disagree:
  // the database chose which of the tied rows to return, and it did not choose
  // the same ones twice.
  let query = db
    .from("venues")
    .select("id, name, contact_email, contact_name, city, country, website, contact_phone, competition_slug, fit_score, shows_live_sport")
    .eq("status", "verified")
    .eq("contact_email_status", "valid")
    .is("outreach_pushed_at", null)
    .gte("fit_score", MIN_FIT)
    .not("country", "in", "(DE,AT)");
  for (const o of SELECTION_ORDER) query = query.order(o.column, { ascending: o.ascending });
  const { data: eligible, error } = await query.limit(5000);

  if (error) {
    await emit(db, EVENT.SYNC_FAILED, {
      source: "instantly", detail: { stage: "select", error: error.message },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ONE ordering path. `dry` only decides whether pushLead() runs further down —
  // it never changes who is selected.
  const candidates = selectForOutreach(eligible ?? [], limit);

  const result = {
    capacity: plan,
    considered: candidates?.length ?? 0,
    eligible_total: eligible?.length ?? 0,
    pushed: 0, skipped_suppressed: 0, skipped_no_campaign: 0, failed: 0,
    dry, min_fit_score: MIN_FIT, limit,
    failures: [] as Array<{ venue: string; error: string }>,
  };

  // Raise Instantly's cap to cover this tranche BEFORE pushing, or the leads
  // land in a campaign that cannot send them all today.
  if (!dry) {
    try { await setCampaignDailyLimit(plan.daily_limit); }
    catch (e: any) {
      await emit(db, EVENT.SYNC_FAILED, {
        source: "instantly", detail: { stage: "set_daily_limit", error: String(e?.message ?? e).slice(0, 300) },
      });
      return NextResponse.json({ error: "could not set campaign daily limit", capacity: plan }, { status: 503 });
    }
  }

  for (const v of candidates ?? []) {
    if (!v.contact_email) continue;

    if (await isSuppressed(db, v.contact_email)) {
      result.skipped_suppressed++;
      if (!dry) {
        await db.from("venues").update({ status: "disqualified" }).eq("id", v.id);
      }
      continue;
    }

    if (!campaignFor(v.country)) {
      result.skipped_no_campaign++;
      continue;
    }

    if (dry) { result.pushed++; continue; }

    try {
      await pushLead({
        venueId: v.id,
        email: v.contact_email,
        venueName: v.name,
        contactName: v.contact_name,
        city: v.city,
        country: v.country,
        website: v.website,
        phone: v.contact_phone,
        competitionSlug: v.competition_slug,
        siteUrl: SITE,
      });

      await db.from("venues")
        .update({ outreach_pushed_at: new Date().toISOString() })
        .eq("id", v.id);

      result.pushed++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ venue: v.name, error: String(e?.message ?? e).slice(0, 200) });

      await emit(db, EVENT.SYNC_FAILED, {
        venueId: v.id, source: "instantly",
        detail: { error: String(e?.message ?? e).slice(0, 500), country: v.country },
      });

      // An auth failure or a rate limit will hit every remaining row the same
      // way — stop rather than burn the whole batch producing identical errors.
      if (e instanceof InstantlyError && (e.status === 401 || e.status === 403 || e.status === 429)) {
        result.failures.push({ venue: "—", error: `aborting run on ${e.status}` });
        break;
      }
    }
  }

  await emit(db, EVENT.SCRAPER_RUN, {
    source: "instantly",
    severity: result.failed > 0 ? "warn" : "info",
    detail: { job: "outreach-sync", ...result, failures: undefined },
  });

  return NextResponse.json(result);
}
