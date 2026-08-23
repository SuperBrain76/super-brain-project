/**
 * POST /api/outreach/instantly?token=<INSTANTLY_WEBHOOK_TOKEN>
 *
 * Instantly pushes every outreach event here; this route is what makes the
 * CRM the single source of truth rather than a second dashboard you have to
 * remember to check.
 *
 * Instantly does not sign its webhooks, so the endpoint is protected by a
 * shared secret in the query string (their UI only lets you configure a URL).
 * Compared with a signature this is weak — so the route only ever moves a
 * venue FORWARD through the funnel and never exposes data in its response.
 *
 * Payload (per Instantly's webhook docs):
 *   { event_type, timestamp, campaign_id, campaign_name, workspace,
 *     lead_email, firstName, lastName, companyName, website, phone,
 *     step, email_account }
 *
 * Events consumed:
 *   email_sent → email_opened → email_link_clicked → reply_received
 *   email_bounced      → suppress the address, mark the venue disqualified
 *   lead_unsubscribed  → suppress the address
 */

import { NextRequest, NextResponse } from "next/server";
import { admin, advanceStatus, suppress } from "@/lib/venueDb";
import { emit, EVENT, type EventKind } from "@/lib/events";
import { INSTANTLY_EVENTS, type InstantlyEventType } from "@/lib/instantly";
import { classifyReply } from "@/lib/replyClassifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which funnel status each engagement signal implies. */
const STATUS_FOR: Record<string, "contacted" | "opened" | "replied"> = {
  email_sent:         "contacted",
  email_opened:       "opened",
  email_link_clicked: "opened",
  reply_received:     "replied",
};

/** Which venues.<column> timestamp each signal stamps, first time only. */
const FIRST_STAMP: Record<string, string> = {
  email_sent:         "first_emailed_at",
  email_opened:       "first_opened_at",
  email_link_clicked: "first_clicked_at",
  reply_received:     "replied_at",
};

export async function POST(req: NextRequest) {
  const expected = process.env.INSTANTLY_WEBHOOK_TOKEN;
  const token    = req.nextUrl.searchParams.get("token");
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const type  = String(body.event_type ?? "") as InstantlyEventType;
  const email = String(body.lead_email ?? "").toLowerCase().trim();
  const kind  = INSTANTLY_EVENTS[type] as EventKind | undefined;

  // Unknown event types are acknowledged, not retried — Instantly sends
  // meeting/interest labels we do not model, and 4xx-ing them just fills
  // their retry queue.
  if (!kind || !email) return NextResponse.json({ ok: true, ignored: true });

  const db = admin();
  const at = body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();
  const step = Number(body.step) || 1;

  const { data: venue } = await db
    .from("venues").select("id, status").ilike("contact_email", email).maybeSingle();

  // ── Suppression is unconditional and comes first ───────────
  if (type === "lead_unsubscribed" || type === "email_bounced") {
    await suppress(db, email,
      type === "email_bounced" ? "bounced" : "unsubscribed",
      body.campaign_name ?? undefined);

    if (venue) {
      await db.from("venues")
        .update({ status: "disqualified", contact_email_status: type === "email_bounced" ? "invalid" : "valid" })
        .eq("id", venue.id);
    }
    await stampMessage(db, venue?.id, body, step, type, at);
    await emit(db, kind, {
      venueId: venue?.id ?? null, source: "instantly",
      detail: { email, campaign: body.campaign_name, step },
    });
    return NextResponse.json({ ok: true });
  }

  if (!venue) {
    // A lead in Instantly with no CRM row means the sync pushed something the
    // database no longer has. Worth seeing on the dashboard, not worth failing.
    await emit(db, EVENT.SYNC_FAILED, {
      source: "instantly", severity: "warn",
      detail: { reason: "no venue for lead", email, event: type },
    });
    return NextResponse.json({ ok: true, unmatched: true });
  }

  // ── Funnel ────────────────────────────────────────────────
  const patch: Record<string, unknown> = {};
  const stampCol = FIRST_STAMP[type];
  if (stampCol) patch[stampCol] = at;              // only set when currently null, below

  // Never overwrite a FIRST_* timestamp — "first opened" must stay first.
  if (stampCol) {
    const { data: current } = await db
      .from("venues").select(stampCol).eq("id", venue.id).single();
    if ((current as any)?.[stampCol]) delete patch[stampCol];
  }
  if (type === "email_sent") {
    patch.last_emailed_at = at;
    const { data: c } = await db.from("venues").select("emails_sent").eq("id", venue.id).single();
    patch.emails_sent = (c?.emails_sent ?? 0) + 1;
  }

  const nextStatus = STATUS_FOR[type];
  if (nextStatus) await advanceStatus(db, venue.id, nextStatus, patch);
  else if (Object.keys(patch).length) await db.from("venues").update(patch).eq("id", venue.id);

  await stampMessage(db, venue.id, body, step, type, at);

  // ── Reply capture and classification ──────────────────────
  let replyVerdict: ReturnType<typeof classifyReply> | null = null;
  // Until now a reply was only a timestamp, so an interested venue looked
  // identical to a rejection. Store the reply itself and classify it; the
  // rules fail toward needs_review so a live lead is never silently binned.
  if (type === "reply_received") {
    const replyText = String(
      body.reply_text ?? body.reply_text_snippet ?? body.reply_body ??
      body.reply_html_snippet ?? body.text ?? "",
    ).trim();
    const verdict = classifyReply(replyText);

    const { error: replyErr } = await db.from("venue_replies").upsert({
      venue_id:       venue.id,
      campaign_id:    null,
      from_email:     email,
      reply_subject:  body.reply_subject ?? body.campaign_name ?? null,
      reply_text:     replyText || null,
      received_at:    at,
      classification: verdict.classification,
      reason:         verdict.reason,
      rule_matched:   verdict.rule_matched,
      confidence:     verdict.confidence,
      classified_at:  new Date().toISOString(),
      classifier:     "rules-v1",
    }, { onConflict: "venue_id,from_email,received_at" });

    // A classification failure must never lose the reply or 5xx back to
    // Instantly — the sequence has already stopped and the funnel is updated.
    if (replyErr) {
      await emit(db, EVENT.SYNC_FAILED, {
        venueId: venue.id, source: "instantly", severity: "warn",
        detail: { reason: "reply not stored", error: replyErr.message, email },
      });
    }

    // Removal requests arriving as a reply rather than an unsubscribe event
    // still have to suppress. Legally this cannot depend on Instantly's
    // event type being the tidy one.
    if (verdict.classification === "negative_unsubscribe") {
      await suppress(db, email, "unsubscribed", body.campaign_name ?? undefined);
      await db.from("venues").update({ status: "disqualified" }).eq("id", venue.id);
    }
    replyVerdict = verdict;
  }

  await emit(db, kind, {
    venueId: venue.id, source: "instantly",
    detail: {
      email, campaign: body.campaign_name, campaign_id: body.campaign_id, step,
      ...(replyVerdict
        ? { classification: replyVerdict.classification, rule: replyVerdict.rule_matched }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * Mirror the event onto the per-message row so open/reply rates can be
 * measured per campaign and per step, not just per venue.
 */
async function stampMessage(
  db: any, venueId: string | undefined, body: any,
  step: number, type: string, at: string,
) {
  if (!venueId) return;

  // Auto-register the campaign on first sight. Leaving campaign_id NULL would
  // make "top performing sequence" unanswerable — every event from a campaign
  // created in Instantly's UI (which is where they are created) would land
  // unattributed.
  const campaignKey = String(body.campaign_id ?? body.campaign_name ?? "unknown");
  let { data: campaign } = await db
    .from("outreach_campaigns").select("id").eq("key", campaignKey).maybeSingle();

  if (!campaign) {
    const { data: made } = await db.from("outreach_campaigns").upsert({
      key:          campaignKey,
      name:         body.campaign_name ?? campaignKey,
      template_key: "instantly",
      from_email:   body.email_account ?? "instantly",
      status:       "running",
    }, { onConflict: "key" }).select("id").single();
    campaign = made;
  }

  const column = {
    email_sent:         "sent_at",
    email_opened:       "opened_at",
    email_link_clicked: "clicked_at",
    reply_received:     "replied_at",
    email_bounced:      "bounced_at",
  }[type];

  const status = {
    email_sent: "sent", email_opened: "opened", email_link_clicked: "clicked",
    reply_received: "replied", email_bounced: "bounced", lead_unsubscribed: "skipped",
  }[type] ?? "sent";

  await db.from("outreach_messages").upsert({
    venue_id:    venueId,
    campaign_id: campaign?.id ?? null,
    step,
    to_email:    String(body.lead_email ?? "").toLowerCase(),
    subject:     body.campaign_name ?? "outreach",
    language:    "en",
    provider_id: body.email_account ?? null,
    status,
    ...(column ? { [column]: at } : {}),
  }, { onConflict: "venue_id,campaign_id,step" });
}
