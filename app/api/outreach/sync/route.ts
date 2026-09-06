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
import { pushLead, campaignFor, InstantlyError, mailboxDailyLimit, setCampaignDailyLimit, verifyEmail } from "@/lib/instantly";
import { SELECTION_ORDER, selectForOutreach } from "@/lib/outreachRanking";
import { planCapacity, followUpsDue, pendingFirstSends, SAFETY_CEILING, type FollowUpCandidate } from "@/lib/outreachCapacity";
import { SITE } from "@/lib/stripe";
import { isMockMode } from "@/lib/enrichment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MIN_FIT = Number(process.env.OUTREACH_MIN_FIT_SCORE ?? 60);

/**
 * Verify deliverability before pushing. On by default; OUTREACH_VERIFY=0 turns
 * it off, which should only ever be a deliberate, temporary choice.
 *
 * `contact_email_status = 'valid'` in this database has never meant the mailbox
 * exists — it is set when an AI fit score clears MIN_FIT, or simply when an
 * address was scraped off the venue's own website. That is why 6 of the first
 * 26 contacts bounced (23%). Verification is the gate that word was always
 * assumed to be.
 */
const VERIFY = process.env.OUTREACH_VERIFY !== "0";
/**
 * How many addresses one run may verify while looking for `limit` good ones.
 * Without this, a run that hits a run of dead chain-pub addresses would walk
 * the entire eligible pool and spend the whole credit balance in one morning.
 */
const VERIFY_BUDGET_MULTIPLE = Number(process.env.OUTREACH_VERIFY_BUDGET_MULTIPLE ?? 4);
/** A verdict older than this is re-checked; mailboxes close. */
const VERDICT_TTL_DAYS = Number(process.env.OUTREACH_VERDICT_TTL_DAYS ?? 30);

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // Fail closed while scoring is offline. Without ANTHROPIC_API_KEY every new
  // enrichment is a mock score, so a live push would be qualified on nothing.
  // `dry` is still allowed, because inspecting the pipeline is always safe.
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  if (isMockMode() && !dryRun) {
    return NextResponse.json({
      error: "Scoring is in mock mode (ANTHROPIC_API_KEY is not set). Refusing to push live leads.",
      hint: "Set ANTHROPIC_API_KEY, re-score prospects, then retry. Use ?dry=1 to inspect.",
    }, { status: 503 });
  }

  // ACCEPT EITHER SECRET — do not collapse this back to `A || B`.
  //
  // OUTREACH_SYNC_SECRET exists so a dry run can be delegated without handing
  // out CRON_SECRET, which unlocks every other admin route. But `A || B`
  // resolves to A the moment A is set, which makes B stop working rather than
  // remain a fallback. /api/cron/instantly-poll carried exactly this bug: from
  // the day OUTREACH_SYNC_SECRET was added to production, every scheduled run
  // 401'd silently and the CRM mirror froze for eleven days while Instantly
  // went on sending. This route is called by a GitHub Actions schedule that can
  // only send CRON_SECRET, so the same collapse would silently stop the entire
  // lead supply. Both are accepted; it still fails closed when neither is set.
  const accepted = [process.env.OUTREACH_SYNC_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .map((s) => `Bearer ${s}`);
  if (!accepted.length || !accepted.includes(req.headers.get("authorization") ?? "")) {
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
    .select("id, name, contact_email, contact_name, city, country, website, contact_phone, competition_slug, fit_score, shows_live_sport, enrichment")
    .eq("status", "verified")
    .eq("contact_email_status", "valid")
    .is("outreach_pushed_at", null)
    .gte("fit_score", MIN_FIT)
    // A fit_score produced by mockScore() is not a qualification. Without
    // ANTHROPIC_API_KEY, isMockMode() is true and enrichment silently falls back
    // to the offline stub, which writes enrichment.mock = true. Those rows must
    // never reach a live send whatever their score says. Rows enriched before
    // the flag existed carry no `mock` key at all, so require an explicit
    // false — unknown provenance is treated as mock.
    .eq("enrichment->>mock", "false")
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
  //
  // The list is deliberately LONGER than `limit`: verification will reject some
  // of it, and a run that verified exactly `limit` addresses would under-fill
  // the campaign by however many turned out to be dead. The loop below stops as
  // soon as `limit` good leads are pushed, so the extra rows cost nothing when
  // the pool is clean.
  const candidates = selectForOutreach(
    eligible ?? [],
    VERIFY ? limit * Math.max(1, VERIFY_BUDGET_MULTIPLE) : limit,
  );

  const result = {
    capacity: plan,
    considered: candidates?.length ?? 0,
    eligible_total: eligible?.length ?? 0,
    pushed: 0, skipped_suppressed: 0, skipped_no_campaign: 0, failed: 0,
    verified_valid: 0, suppressed_invalid: 0, skipped_risky: 0, skipped_unverifiable: 0,
    verifications_spent: 0,
    dry, min_fit_score: MIN_FIT, limit, verification: VERIFY,
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
    if (result.pushed >= limit) break;      // capacity filled; stop verifying
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

    // ── deliverability gate ────────────────────────────────────────────────
    // Runs in dry mode too. A dry run whose job is to answer "who goes out
    // tomorrow" is worthless if it names addresses that will bounce.
    if (VERIFY) {
      const cached = (v as any).enrichment?.verify;
      const fresh =
        cached?.at &&
        Date.now() - new Date(cached.at).getTime() < VERDICT_TTL_DAYS * 864e5;

      let verdict: string;
      let raw = cached?.raw_status ?? null;
      let catchAll = cached?.catch_all ?? null;

      if (fresh) {
        verdict = cached.verdict;
      } else {
        const r = await verifyEmail(v.contact_email);
        result.verifications_spent++;
        verdict = r.verdict; raw = r.raw_status; catchAll = r.catch_all;
        if (!dry) {
          await db.from("venues").update({
            enrichment: {
              ...((v as any).enrichment ?? {}),
              verify: { verdict, raw_status: raw, catch_all: catchAll, at: new Date().toISOString() },
            },
            contact_email_status:
              verdict === "valid" ? "valid" : verdict === "invalid" ? "invalid" : verdict,
          }).eq("id", v.id);
        }
      }

      if (verdict === "invalid") {
        result.suppressed_invalid++;
        if (!dry) {
          // Suppress the address, not just the venue: the same dead inbox is
          // often published for several venues in a chain.
          await db.from("email_suppressions").upsert(
            { email: v.contact_email.toLowerCase(), reason: "invalid", detail: `verifier: ${raw}` },
            { onConflict: "email" },
          );
          await db.from("venues").update({ status: "disqualified" }).eq("id", v.id);
          await emit(db, EVENT.SYNC_FAILED, {
            venueId: v.id, source: "instantly", severity: "info",
            detail: { stage: "verify", verdict, raw_status: raw, email_domain: v.contact_email.split("@")[1] },
          });
        }
        continue;
      }
      if (verdict === "risky") {
        // Catch-all domain: the server accepts everything and decides later, so
        // a send is a coin toss charged to our sending reputation. Keep the
        // venue — a better address may surface — but never send to this one.
        result.skipped_risky++;
        continue;
      }
      if (verdict === "unknown") {
        // Verifier unreachable or inconclusive. Fail closed.
        result.skipped_unverifiable++;
        continue;
      }
      result.verified_valid++;
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
