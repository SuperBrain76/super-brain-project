/**
 * POST /api/stripe/webhook — the money path.
 *
 * Stripe is the source of truth for billing; this route mirrors it into
 * `venue_subscriptions` and drives the venue's funnel status. It is the ONLY
 * place a league gets provisioned or suspended.
 *
 * ── Why not n8n ──────────────────────────────────────────────
 * Provisioning creates Supabase auth users and writes to four tables. Doing
 * that from n8n means service-role keys in a second system, no ordering
 * guarantees, and a failure mode where a venue has paid and nothing exists.
 * n8n is called AFTER the league is real (WhatsApp, Zoho, social) and its
 * failure cannot hurt the customer.
 *
 * ── Idempotency ──────────────────────────────────────────────
 * Stripe retries on any non-2xx and can deliver the same event twice. Every
 * event id is inserted into `stripe_events` first; a duplicate insert short
 * -circuits with 200. Provisioning is independently idempotent as well.
 *
 * ── Events handled ───────────────────────────────────────────
 *   checkout.session.completed          provision the league (Workflow 1)
 *   customer.subscription.created       mirror the subscription
 *   customer.subscription.updated       status / period / cancel changes
 *   customer.subscription.trial_will_end T-3d reminder (Workflow 2)
 *   invoice.payment_succeeded           first real payment → status active
 *   invoice.payment_failed              dunning email (Workflow 3)
 *   customer.subscription.deleted       suspend the league, mark churned
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planFromInterval, toMrrCents, SITE } from "@/lib/stripe";
import { admin, logEvent, advanceStatus } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";
import { provisionVenue, notifyN8n } from "@/lib/provisioning";
import { sendPaymentFailed } from "@/lib/venueEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Days a league stays live after a failed payment before it is suspended. */
const DUNNING_GRACE_DAYS = 7;

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig    = req.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "not configured" }, { status: 400 });
  }

  const raw = await req.text();          // signature needs the exact bytes
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e: any) {
    console.error("[stripe] bad signature", e?.message);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const db = admin();
  const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - event.created);

  // ── Idempotency gate ───────────────────────────────────────
  const { error: dupe } = await db.from("stripe_events")
    .insert({ id: event.id, type: event.type, payload: event.data.object as any });
  if (dupe) {
    if (dupe.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("[stripe] event ledger write failed", dupe.message);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(db, event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscriptionChanged(db, event.data.object as Stripe.Subscription, ageSec);
        break;

      case "customer.subscription.trial_will_end":
        await onTrialWillEnd(db, event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await onPaymentSucceeded(db, event.data.object as Stripe.Invoice, ageSec);
        break;

      case "invoice.payment_failed":
        await onPaymentFailed(db, event.data.object as Stripe.Invoice, ageSec);
        break;

      case "customer.subscription.deleted":
        await onSubscriptionDeleted(db, event.data.object as Stripe.Subscription);
        break;

      default:
        break;   // ignored, but still recorded in stripe_events
    }
  } catch (e: any) {
    // Return 500 so Stripe retries; the ledger row lets the retry re-run
    // safely because every handler below is idempotent.
    if (e instanceof DeferEvent) {
      console.warn(`[stripe] deferring ${event.type} — ${e.message}`);
    } else {
      console.error(`[stripe] handler failed for ${event.type}`, e?.message ?? e);
    }
    await db.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ══════════════════════════ HANDLERS ══════════════════════════

/** Checkout finished → build the league. This is Workflow 1, end to end. */
async function onCheckoutCompleted(db: any, s: Stripe.Checkout.Session) {
  const m = (s.metadata ?? {}) as Record<string, string>;
  const email = s.customer_details?.email ?? s.customer_email ?? "";
  if (!email) throw new Error("checkout session has no email");

  const result = await provisionVenue(db, {
    venueId:         m.venue_id || null,
    venueName:       m.venue_name || s.customer_details?.name || "Venue",
    country:         m.country || "GB",
    city:            m.city || null,
    language:        m.language || "en",
    competitionSlug: m.competition_slug || null,   // leagues activated in the wizard now
    ownerEmail:      email,
    ownerName:       m.owner_name || s.customer_details?.name || null,
    ownerPhone:      m.owner_phone || s.customer_details?.phone || null,
    website:         m.website || null,
    stripeCustomerId: String(s.customer ?? ""),
    checkoutSessionId: s.id,
  });

  // Trial starts the moment checkout completes.
  await advanceStatus(db, result.venueId, "trialing", {
    signed_up_at:     new Date().toISOString(),
    trial_started_at: new Date().toISOString(),
  });
  // Funnel: a clean "trial created" event (status/timestamps alone don't
  // produce a venue_event row).
  await emit(db, EVENT.TRIAL_CREATED, {
    venueId: result.venueId, source: "stripe",
    detail: { league_created: result.created },
  }).catch(() => {});
}

/** Mirror Stripe's subscription into venue_subscriptions. */
async function onSubscriptionChanged(db: any, sub: Stripe.Subscription, ageSec = 0) {
  const venueId = await venueForSubscription(db, sub, ageSec);
  if (!venueId) return;

  const item     = sub.items.data[0];
  const interval = item?.price?.recurring?.interval ?? "month";
  const plan     = planFromInterval(interval);
  const amount   = item?.price?.unit_amount ?? 0;
  const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end;
  // A comp (100%-off-forever) sub is £0 — never count it toward MRR.
  const isComp   = (sub.metadata ?? {}).comp === "true";

  await db.from("venue_subscriptions").upsert({
    venue_id:               venueId,
    stripe_customer_id:     String(sub.customer),
    stripe_subscription_id: sub.id,
    stripe_price_id:        item?.price?.id ?? null,
    plan,
    status:                 sub.status,
    currency:               item?.price?.currency ?? "eur",
    amount_cents:           amount,
    mrr_cents:              (!isComp && ["active", "trialing"].includes(sub.status))
                              ? toMrrCents(amount, plan) : 0,
    trial_ends_at:          sub.trial_end ? iso(sub.trial_end) : null,
    current_period_end:     periodEnd ? iso(periodEnd) : null,
    cancel_at_period_end:   sub.cancel_at_period_end,
  }, { onConflict: "stripe_subscription_id" });

  // Billing states are applied directly — they legitimately move backwards.
  if (sub.status === "past_due" || sub.status === "unpaid") {
    await db.from("venues").update({ status: "past_due" }).eq("id", venueId);
  } else if (sub.status === "active") {
    await advanceStatus(db, venueId, "active");
  } else if (sub.status === "trialing") {
    await advanceStatus(db, venueId, "trialing");
  }
}

/** T-3 days on the 7-day trial → let n8n do the nudge (Workflow 2). */
async function onTrialWillEnd(db: any, sub: Stripe.Subscription) {
  const venueId = await venueForSubscription(db, sub);
  if (!venueId) return;
  const { data: v } = await db.from("venues")
    .select("name, contact_email, language, country").eq("id", venueId).single();

  await logEvent(db, venueId, "trial_will_end", { trial_end: sub.trial_end });
  await notifyN8n({
    event: "venue.trial_will_end",
    venue_id: venueId, venue: v?.name, email: v?.contact_email,
    language: v?.language, country: v?.country,
    trial_ends_at: sub.trial_end ? iso(sub.trial_end) : null,
    days_left: 3,
    // Card-less trials mean the nudge has two completely different jobs.
    // With a card on file it is a courtesy ("you will be charged Friday").
    // Without one it is the conversion ask ("add a card or the league stops").
    // n8n cannot tell them apart without this flag.
    has_payment_method: Boolean(sub.default_payment_method),
    billing_url: `${SITE}/venues/billing?v=${venueId}`,
  });
}

/** A real invoice cleared → this venue is paying. */
async function onPaymentSucceeded(db: any, inv: Stripe.Invoice, ageSec = 0) {
  // €0 trial invoices also succeed — they are not revenue.
  if ((inv.amount_paid ?? 0) <= 0) return;

  const venueId = await venueForCustomer(db, String(inv.customer), ageSec);
  if (!venueId) return;

  const { data: v } = await db.from("venues").select("paid_at").eq("id", venueId).single();
  await advanceStatus(db, venueId, "active", v?.paid_at ? {} : { paid_at: new Date().toISOString() });
  await logEvent(db, venueId, "paid", {
    amount: inv.amount_paid, currency: inv.currency, invoice: inv.id,
  });

  // Un-suspend anything the dunning path had paused.
  await db.from("prediction_leagues").update({ suspended: false }).eq("venue_id", venueId);

  if (!v?.paid_at) {
    await notifyN8n({
      event: "venue.paid", venue_id: venueId,
      amount: inv.amount_paid, currency: inv.currency,
    });
  }
}

/** Card declined → warn, keep the league live through the grace window. */
async function onPaymentFailed(db: any, inv: Stripe.Invoice, ageSec = 0) {
  const venueId = await venueForCustomer(db, String(inv.customer), ageSec);
  if (!venueId) return;

  const { data: v } = await db.from("venues")
    .select("name, contact_email, language").eq("id", venueId).single();

  await db.from("venues").update({ status: "past_due" }).eq("id", venueId);
  await logEvent(db, venueId, "payment_failed", { invoice: inv.id, attempt: inv.attempt_count });

  if (v?.contact_email) {
    await sendPaymentFailed({
      to: v.contact_email, venueName: v.name, language: v.language ?? "en",
      updateUrl: `${SITE}/venues/billing?v=${venueId}`,
      daysLeft: DUNNING_GRACE_DAYS,
    }).catch((e) => console.error("[stripe] dunning email failed", e));
  }

  await notifyN8n({
    event: "venue.payment_failed", venue_id: venueId,
    venue: v?.name, email: v?.contact_email, attempt: inv.attempt_count,
  });
}

/** Subscription gone → suspend the league and mark the venue churned. */
async function onSubscriptionDeleted(db: any, sub: Stripe.Subscription) {
  const venueId = await venueForSubscription(db, sub);
  if (!venueId) return;

  await db.from("venue_subscriptions")
    .update({ status: "canceled", mrr_cents: 0 })
    .eq("stripe_subscription_id", sub.id);

  await db.from("prediction_leagues").update({ suspended: true }).eq("venue_id", venueId);
  await db.from("venues")
    .update({ status: "churned", churned_at: new Date().toISOString() })
    .eq("id", venueId);

  await logEvent(db, venueId, "churned", { subscription: sub.id });
  await notifyN8n({ event: "venue.churned", venue_id: venueId, subscription: sub.id });
}

// ══════════════════════════ LOOKUPS ══════════════════════════
//
// Stripe does NOT guarantee event ordering: customer.subscription.created and
// the first invoice can both arrive BEFORE checkout.session.completed has
// provisioned the venue. Returning early there would silently lose the
// subscription mirror — and with it the MRR on the dashboard.
//
// So a miss is DEFERRED, not dropped: we throw, the route answers 500, and
// Stripe redelivers with backoff for up to three days. By the second attempt
// the checkout handler has run. Past DEFER_WINDOW_SEC we stop deferring and
// give up quietly, so a Stripe object that genuinely has no venue (a manual
// test customer, say) cannot retry forever.

const DEFER_WINDOW_SEC = 60 * 60;   // 1 hour

class DeferEvent extends Error {
  constructor(what: string) { super(`venue not resolvable yet: ${what}`); }
}

/** Subscription metadata first (it survives before the mirror row exists). */
async function venueForSubscription(
  db: any, sub: Stripe.Subscription, ageSec = 0,
): Promise<string | null> {
  const fromMeta = (sub.metadata ?? {}).venue_id;
  if (fromMeta) {
    const { data } = await db.from("venues").select("id").eq("id", fromMeta).maybeSingle();
    if (data) return data.id;
  }
  const { data: row } = await db.from("venue_subscriptions")
    .select("venue_id").eq("stripe_subscription_id", sub.id).maybeSingle();
  if (row) return row.venue_id;

  return venueForCustomer(db, String(sub.customer), ageSec);
}

/**
 * Customer → venue. Tries the subscription mirror, then the customer's email
 * on the Stripe customer object (which is set before provisioning ever runs),
 * then defers.
 */
async function venueForCustomer(
  db: any, customerId: string, ageSec = 0,
): Promise<string | null> {
  const { data } = await db.from("venue_subscriptions")
    .select("venue_id").eq("stripe_customer_id", customerId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (data?.venue_id) return data.venue_id;

  // Fall back to the email on the Stripe customer — a venue we cold-emailed
  // already has a CRM row keyed on exactly that address.
  const email = await customerEmail(customerId);
  if (email) {
    const { data: v } = await db.from("venues")
      .select("id").ilike("contact_email", email).maybeSingle();
    if (v?.id) return v.id;
  }

  if (ageSec < DEFER_WINDOW_SEC) throw new DeferEvent(customerId);
  console.warn(`[stripe] no venue for customer ${customerId} after ${ageSec}s — giving up`);
  return null;
}

async function customerEmail(customerId: string): Promise<string | null> {
  try {
    const c = await getStripe().customers.retrieve(customerId);
    if (typeof c === "string" || (c as any).deleted) return null;
    return (c as Stripe.Customer).email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();
