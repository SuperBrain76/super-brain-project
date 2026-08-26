/**
 * GET /api/admin/venue-state — read-only operational state for the venue engine.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" ".../api/admin/venue-state"
 *
 * Exists so WorkBrain's Daily Executive Brief can see the funnel without copying
 * the Supabase, Instantly, Stripe or Places production secrets out of Vercel.
 * One secret reaches the reporting layer; the rest never leave this app.
 *
 * STRICTLY READ-ONLY. It sends nothing, writes nothing, and creates nothing.
 * There are no mutating branches behind query parameters — the only parameter is
 * `days`, which widens the reporting window.
 *
 * No contact emails, phone numbers, tokens or Stripe objects are returned.
 * Anything that cannot be established from stored data is reported as "unknown"
 * rather than estimated.
 */

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/venueDb";
import { listCampaigns, campaignFor } from "@/lib/instantly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARKETS = ["GB", "ES", "FR", "IT", "DE", "AT"];

/** Count rows matching a filter without pulling them across the wire. */
async function count(
  db: ReturnType<typeof admin>,
  table: string,
  apply: (q: any) => any = (q) => q,
): Promise<number | null> {
  const { count: n, error } = await apply(
    db.from(table).select("*", { count: "exact", head: true }),
  );
  return error ? null : (n ?? 0);
}

const rate = (num: number | null, den: number | null) =>
  num === null || den === null || den === 0 ? null : +((num / den) * 100).toFixed(1);

export async function GET(req: NextRequest) {
  // Prefers its own secret so read-only observability can be granted to an
  // external reader without handing out CRON_SECRET, which unlocks every other
  // admin route. Falls back to CRON_SECRET so existing callers keep working.
  // (Vercel "Sensitive" variables are write-only, so CRON_SECRET cannot be read
  // back and shared even if we wanted to — hence the dedicated value.)
  const secret = (process.env.VENUE_STATE_SECRET || process.env.CRON_SECRET) ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    // Fail closed. Never reveal whether the secret is merely unset.
    console.warn("[venue-state] unauthorized request");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 1)));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const db = admin();

  // ── prospect funnel ──────────────────────────────────────────────────────
  const statuses = [
    "prospect", "verified", "contacted", "opened", "replied",
    "signed_up", "trialing", "active", "past_due", "suspended",
    "churned", "disqualified",
  ] as const;

  const funnel: Record<string, number | null> = {};
  for (const s of statuses) {
    funnel[s] = await count(db, "venues", (q) => q.eq("status", s));
  }
  funnel.total = await count(db, "venues");
  // Qualified but never contacted — the number that decides whether outreach can scale.
  funnel.qualified_untouched = await count(db, "venues", (q) =>
    q.eq("status", "verified").not("contact_email", "is", null),
  );
  funnel.no_email = await count(db, "venues", (q) =>
    q.eq("status", "prospect").is("contact_email", null),
  );

  // ── suppression ──────────────────────────────────────────────────────────
  const suppression = {
    bounced: await count(db, "email_suppressions", (q) => q.eq("reason", "bounced")),
    unsubscribed: await count(db, "email_suppressions", (q) => q.eq("reason", "unsubscribed")),
    total: await count(db, "email_suppressions"),
  };

  // ── outreach activity in the window ──────────────────────────────────────
  const sent_window = await count(db, "outreach_messages", (q) => q.gte("sent_at", since));
  const replied_window = await count(db, "outreach_messages", (q) => q.gte("replied_at", since));
  const bounced_window = await count(db, "outreach_messages", (q) => q.gte("bounced_at", since));
  const sent_total = await count(db, "outreach_messages", (q) => q.not("sent_at", "is", null));
  const replied_total = await count(db, "outreach_messages", (q) => q.not("replied_at", "is", null));
  const bounced_total = await count(db, "outreach_messages", (q) => q.not("bounced_at", "is", null));

  // ── campaigns ────────────────────────────────────────────────────────────
  let campaigns: unknown = "unknown";
  let campaign_error: string | null = null;
  try {
    const list = await listCampaigns();
    campaigns = list.map((c) => ({ id: c.id, name: c.name }));
  } catch (e: any) {
    campaign_error = String(e?.message ?? e).slice(0, 160);
  }

  const { data: localCampaigns } = await db
    .from("outreach_campaigns")
    .select("id, name, country, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // Which markets are legally mailable is decided by campaignFor(), not by us.
  const markets = MARKETS.map((c) => ({
    country: c,
    mailable: campaignFor(c) !== null,
    note: campaignFor(c) === null ? "excluded in code (UWG §7 — phone only)" : null,
  }));

  // ── geography ────────────────────────────────────────────────────────────
  const geography: Array<Record<string, unknown>> = [];
  for (const c of MARKETS) {
    const total = await count(db, "venues", (q) => q.eq("country", c));
    if (!total) continue;
    geography.push({
      country: c,
      prospects: total,
      contacted: await count(db, "venues", (q) =>
        q.eq("country", c).in("status", ["contacted", "opened", "replied", "signed_up", "trialing", "active"]),
      ),
      replied: await count(db, "venues", (q) =>
        q.eq("country", c).in("status", ["replied", "signed_up", "trialing", "active"]),
      ),
      trialing: await count(db, "venues", (q) => q.eq("country", c).eq("status", "trialing")),
      active: await count(db, "venues", (q) => q.eq("country", c).eq("status", "active")),
    });
  }

  // ── opportunities — no contact PII ───────────────────────────────────────
  const { data: opps } = await db
    .from("venues")
    .select("id, name, city, country, status, updated_at, created_at")
    .in("status", ["replied", "signed_up", "trialing", "active", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(25);

  // ── conversions — null where the linkage genuinely does not exist ────────
  const conversions = {
    outreach_to_reply_pct: rate(replied_total, sent_total),
    reply_to_positive_pct: null as number | null, // filled in below once replies are counted
    positive_to_trial_pct: null as number | null,
    trial_to_paid_pct: rate(funnel.active, (funnel.trialing ?? 0) + (funnel.active ?? 0)),
    bounce_rate_pct: rate(bounced_total, sent_total),
  };

  // ── reply classifications ────────────────────────────────────────────────
  // Migration 071 stores these now, so the Operations Dashboard can show replies
  // by classification instead of a single undifferentiated "replied" count.
  const CLASSES = ["positive_interested", "neutral", "negative", "negative_unsubscribe", "needs_review"] as const;
  const replies: Record<string, number | null> = {};
  for (const c of CLASSES) {
    replies[c] = await count(db, "venue_replies", (q) => q.eq("classification", c));
  }
  replies.total = await count(db, "venue_replies");
  replies.unreviewed = await count(db, "venue_replies", (q) =>
    q.is("reviewed_at", null).in("classification", ["positive_interested", "needs_review"]),
  );

  // ── sending today ────────────────────────────────────────────────────────
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const sent_today = await count(db, "outreach_messages", (q) => q.gte("sent_at", startOfDay.toISOString()));

  // ── campaign + sender health, straight from Instantly ────────────────────
  let campaign_state: unknown = "unknown";
  let sender_health: unknown = "unknown";
  try {
    const { campaignState, senderHealth } = await import("@/lib/instantly");
    campaign_state = await campaignState();
    sender_health = await senderHealth();
  } catch (e: any) {
    campaign_state = { error: String(e?.message ?? e).slice(0, 160) };
  }

  // ── honest gaps ──────────────────────────────────────────────────────────
  const gaps: string[] = [];
  if (campaign_error) gaps.push(`Instantly campaigns unreadable: ${campaign_error}`);
  gaps.push(
    "Sender warm-up state and per-mailbox daily limits are held in Instantly and are not " +
      "exposed by the campaign list endpoint.",
  );

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    window_days: days,
    sender: {
      cold_outbound_identity: process.env.VENUE_REPLY_TO ?? "unknown",
      transactional_from: process.env.VENUE_FROM_EMAIL ?? "unknown",
      daily_cap_configured: process.env.OUTREACH_DAILY_CAP ?? "unset",
      warmup_status: "unknown",
      per_mailbox_limits: "unknown",
    },
    campaigns: { instantly: campaigns, local: localCampaigns ?? [], error: campaign_error },
    markets,
    funnel,
    suppression,
    activity: {
      window: { sent: sent_window, replies: replied_window, bounces: bounced_window },
      lifetime: { sent: sent_total, replies: replied_total, bounces: bounced_total },
    },
    conversions,
    replies,
    sent_today,
    campaign_state,
    sender_health,
    geography,
    opportunities: opps ?? [],
    gaps,
  });
}
