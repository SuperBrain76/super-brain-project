/**
 * GET /api/cron/instantly-poll — pull outreach activity from Instantly.
 *
 * Instantly's UI gates webhooks behind Hyper Growth, so nothing here depends on
 * them. The v2 API on the Growth plan exposes everything the CRM needs, and this
 * route pulls it on a schedule instead:
 *
 *   /emails?email_type=received   → replies      → venue_replies + classification
 *   /emails (bounce markers)      → bounces      → email_suppressions + disqualify
 *   /leads/list                   → lead state   → unsubscribes, funnel position
 *
 * It writes to the SAME tables through the SAME classifier as the (now dormant)
 * webhook route — one ingestion architecture, two possible transports.
 *
 * Idempotent. Replies dedupe on the (venue_id, from_email, received_at) unique
 * index, and a venue's status only ever moves forward, so re-running is safe and
 * repeated alerts are impossible.
 *
 * Auth: OUTREACH_SYNC_SECRET, falling back to CRON_SECRET. Fails closed.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin, advanceStatus, suppress, isSuppressed } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { classifyReply } from "@/lib/replyClassifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://api.instantly.ai/api/v2";

async function api(path: string) {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) throw new Error("INSTANTLY_API_KEY missing");
  const r = await fetch(BASE + path, {
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** Follow pagination, but never spin: the volume here is tiny. */
async function pageAll(path: string, cap = 10): Promise<any[]> {
  const out: any[] = [];
  let cursor = "";
  for (let i = 0; i < cap; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await api(`${path}${sep}limit=100${cursor ? `&starting_after=${cursor}` : ""}`);
    const items = r.items ?? [];
    out.push(...items);
    if (!r.next_starting_after || items.length === 0) break;
    cursor = r.next_starting_after;
  }
  return out;
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();

export async function GET(req: NextRequest) {
  // ACCEPT EITHER SECRET — do not collapse this back to `A || B`.
  //
  // Vercel Cron always sends `Bearer $CRON_SECRET`; it cannot be told to send
  // anything else. The previous form resolved to OUTREACH_SYNC_SECRET the
  // moment that variable existed, so from the day it was added (24 Aug 2026)
  // every scheduled invocation 401'd silently: no writes, no error, and a CRM
  // mirror that froze while Instantly kept sending. Two weeks of sends went
  // unrecorded and the daily brief reported "no emails sent".
  //
  // prospect-buffer and venue-state already accept a LIST of valid secrets.
  // This route is the one that didn't. Same pattern now.
  const accepted = [process.env.OUTREACH_SYNC_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .map((s) => `Bearer ${s}`);
  if (!accepted.length || !accepted.includes(req.headers.get("authorization") ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const campaign = process.env.INSTANTLY_CAMPAIGN_DEFAULT;
  if (!campaign) return NextResponse.json({ error: "INSTANTLY_CAMPAIGN_DEFAULT missing" }, { status: 500 });

  const db = admin();
  const result = {
    sent_seen: 0, sent_new: 0,
    replies_seen: 0, replies_new: 0, unmatched: 0,
    bounces: 0, unsubscribes: 0, suppressed: 0,
    needs_attention: [] as Array<{ venue: string; classification: string }>,
    errors: [] as string[],
  };

  // ── sent emails ────────────────────────────────────────────────────────
  // Without this the CRM never learned anything was sent: emails_sent stayed 0
  // and first_emailed_at stayed null while five emails were actually out, so the
  // funnel understated reality. Idempotent on (venue_id, campaign_id, step).
  try {
    const sent = await pageAll(`/emails?campaign_id=${encodeURIComponent(campaign)}&email_type=sent`);
    result.sent_seen = sent.length;

    // Register the campaign once so per-step attribution is possible.
    let { data: camp } = await db.from("outreach_campaigns").select("id").eq("key", campaign).maybeSingle();
    if (!camp) {
      const { data: made } = await db.from("outreach_campaigns").upsert({
        key: campaign, name: "SuperBrain Venue — cold outreach",
        template_key: "instantly", from_email: "alex@superbrain.bar", status: "running",
      }, { onConflict: "key" }).select("id").single();
      camp = made;
    }

    // Decide "is this new?" from ONE snapshot taken before the loop. Doing it
    // per row entangled the check with the insert, so the counters re-reported
    // the same five sends on every poll even though the upsert never duplicated.
    const { data: known } = await db.from("outreach_messages")
      .select("venue_id, step, sent_at").eq("campaign_id", camp?.id ?? "");
    const alreadySent = new Set(
      (known ?? []).filter(k => k.sent_at).map(k => `${k.venue_id}|${k.step}`),
    );
    const touched = new Set<string>();

    for (const e of sent) {
      const to = norm(
        Array.isArray(e.to_address_email_list) ? e.to_address_email_list[0]
          : (e.to_address_email_list ?? e.lead ?? e.to_address),
      ).split(",")[0].trim();
      const atRaw = e.timestamp_created ?? e.timestamp_email ?? e.created_at;
      if (!to || !atRaw) continue;
      const at = new Date(atRaw).toISOString();

      // Instantly reports step as "0_0_0" / "0_1_0" — the middle field is the
      // zero-based step index within the sequence.
      const parts = String(e.step ?? "").split("_");
      const step = parts.length >= 2 ? Number(parts[1]) + 1 : 1;

      const { data: venue } = await db
        .from("venues").select("id, emails_sent, first_emailed_at").ilike("contact_email", to).maybeSingle();
      if (!venue) { result.unmatched++; continue; }

      touched.add(venue.id);
      const isNew = !alreadySent.has(`${venue.id}|${step}`);

      const { error: msgErr } = await db.from("outreach_messages").upsert({
        venue_id: venue.id, campaign_id: camp?.id ?? null, step,
        to_email: to, subject: e.subject ?? "outreach", language: "en",
        provider_id: "alex@superbrain.bar", status: "sent", sent_at: at,
      }, { onConflict: "venue_id,campaign_id,step" });
      if (msgErr) { result.errors.push(`sent ${to} step ${step}: ${msgErr.message}`); continue; }
      if (isNew) result.sent_new++;
    }

    // Recount per venue AFTER every message is in, so a venue with two steps
    // ends on 2 rather than on whatever the last row it happened to see was.
    // One fetch, grouped in JS. Per-venue count filters were returning a stale
    // number, and the exact cause sat in PostgREST's filter semantics rather
    // than in the data - which is not a thing to guess at when it decides what
    // the funnel reports.
    const { data: allMsgs } = await db.from("outreach_messages")
      .select("venue_id, sent_at").eq("campaign_id", camp?.id ?? "");
    const byVenue = new Map<string, string[]>();
    for (const m of allMsgs ?? []) {
      if (!m.sent_at) continue;
      const list = byVenue.get(m.venue_id) ?? [];
      list.push(m.sent_at as string);
      byVenue.set(m.venue_id, list);
    }
    for (const venueId of touched) {
      const stamps = (byVenue.get(venueId) ?? []).sort();
      const count = stamps.length;
      const first = stamps[0] ?? null;
      const last  = stamps[stamps.length - 1] ?? null;
      await db.from("venues").update({
        emails_sent: count,
        ...(first ? { first_emailed_at: first } : {}),
        ...(last ? { last_emailed_at: last } : {}),
      }).eq("id", venueId);
      await advanceStatus(db, venueId, "contacted", {});
    }
  } catch (e: any) {
    result.errors.push(`sent: ${String(e?.message ?? e).slice(0, 160)}`);
  }

  // ── replies ────────────────────────────────────────────────────────────
  try {
    const received = await pageAll(`/emails?campaign_id=${encodeURIComponent(campaign)}&email_type=received`);
    result.replies_seen = received.length;

    // Same snapshot-first approach as sends: an .eq() on a timestamptz never
    // matched, so every poll re-reported the same reply as new.
    const { data: knownReplies } = await db.from("venue_replies").select("from_email, received_at");
    const seenReplies = new Set(
      (knownReplies ?? []).map(r => `${String(r.from_email).toLowerCase()}|${new Date(r.received_at as string).toISOString()}`),
    );

    for (const e of received) {
      const from = norm(e.from_address_email ?? e.lead ?? e.from_address);
      const atRaw = e.timestamp_created ?? e.timestamp_email ?? e.created_at;
      if (!from || !atRaw) continue;
      const at = new Date(atRaw).toISOString();
      const text = String(e.body?.text ?? e.body_text ?? "").trim();

      const { data: venue } = await db
        .from("venues").select("id, name, status").ilike("contact_email", from).maybeSingle();
      if (!venue) { result.unmatched++; continue; }

      // The unique index keeps the WRITE idempotent; this keeps the counter and
      // the alert list honest, so a poll cannot re-raise a reply already seen.
      if (seenReplies.has(`${from}|${at}`)) continue;

      const verdict = classifyReply(text);
      const { error } = await db.from("venue_replies").upsert({
        venue_id: venue.id, campaign_id: null, from_email: from,
        reply_subject: e.subject ?? null, reply_text: text || null, received_at: at,
        classification: verdict.classification, reason: verdict.reason,
        rule_matched: verdict.rule_matched, confidence: verdict.confidence,
        classified_at: new Date().toISOString(), classifier: "rules-v1",
      }, { onConflict: "venue_id,from_email,received_at" });
      if (error) { result.errors.push(`reply ${from}: ${error.message}`); continue; }

      result.replies_new++;
      await advanceStatus(db, venue.id, "replied", { replied_at: at });

      // A removal request arriving as a reply must still suppress — this cannot
      // depend on Instantly classifying it as an unsubscribe.
      if (verdict.classification === "negative_unsubscribe") {
        await suppress(db, from, "unsubscribed", "poll: reply");
        await db.from("venues").update({ status: "disqualified" }).eq("id", venue.id);
        result.suppressed++;
      }
      if (verdict.classification === "positive_interested" || verdict.classification === "needs_review") {
        result.needs_attention.push({ venue: venue.name, classification: verdict.classification });
      }
    }
  } catch (e: any) {
    result.errors.push(`replies: ${String(e?.message ?? e).slice(0, 160)}`);
  }

  // ── bounces and unsubscribes, from lead state ──────────────────────────
  try {
    const leads = await pageAll(`/leads/list`, 5).catch(() => []);
    const scoped = leads.length ? leads : (await (async () => {
      const key = process.env.INSTANTLY_API_KEY!;
      const r = await fetch(`${BASE}/leads/list`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ campaign_id: campaign, limit: 100 }),
      });
      return r.ok ? ((await r.json()).items ?? []) : [];
    })());

    for (const l of scoped) {
      const email = norm(l.email);
      if (!email) continue;
      // Instantly's /leads/list payload carries NEITHER `email_bounced_count`
      // NOR a textual status — `status` is a number, and a bounced lead is -1
      // (-2 unsubscribed, -3 skipped). Both original tests were therefore
      // permanently false, and this loop suppressed nothing: 6 addresses
      // bounced between 31 Aug and 1 Sep and only the 2 inserted by hand ever
      // reached email_suppressions. The numeric check is the real signal; the
      // other two are kept as fallbacks in case the payload shape changes.
      const st = Number(l.status);
      const bounced = st === -1 || Number(l.email_bounced_count ?? 0) > 0 || norm(l.status) === "bounced";
      const unsub = st === -2 || l.is_unsubscribed === true || norm(l.status) === "unsubscribed";
      if (!bounced && !unsub) continue;

      if (await isSuppressed(db, email)) continue;      // already handled
      await suppress(db, email, bounced ? "bounced" : "unsubscribed", "poll: lead state");
      result.suppressed++;
      if (bounced) result.bounces++; else result.unsubscribes++;

      const { data: v } = await db.from("venues").select("id").ilike("contact_email", email).maybeSingle();
      if (v) {
        await db.from("venues").update({
          status: "disqualified",
          ...(bounced ? { contact_email_status: "invalid" } : {}),
        }).eq("id", v.id);
      }
    }
  } catch (e: any) {
    result.errors.push(`leads: ${String(e?.message ?? e).slice(0, 160)}`);
  }

  if (result.errors.length) {
    await emit(db, EVENT.SYNC_FAILED, {
      source: "instantly", severity: "warn", detail: { via: "poll", errors: result.errors },
    });
  }
  return NextResponse.json({ ok: true, ...result });
}
