/**
 * Server-side PostHog — the money path.
 *
 * The browser SDK cannot see billing. Stripe webhooks arrive server-to-server,
 * usually with no browser session anywhere near them, so trial→paid conversion
 * and churn are invisible to client-side analytics no matter how well the app is
 * instrumented. This module is the only place billing events reach PostHog.
 *
 * ── Identity ─────────────────────────────────────────────────
 * Events are attributed to the venue owner's Supabase auth user id
 * (`venues.owner_user_id`) — the SAME id the browser sends via identifyUser().
 * That is what makes a venue's billing history and its in-app behaviour resolve
 * to one person in PostHog rather than two disconnected ones.
 *
 * Where the owner id cannot be resolved we fall back to a deterministic
 * `venue_<uuid>` id rather than dropping the event. Deterministic matters: a
 * random id per attempt would create a new person on every Stripe retry.
 * `identity_source` records which path was used, so the join rate is itself
 * measurable.
 *
 * ── Privacy ──────────────────────────────────────────────────
 * Never sent: email, name, phone, card or payment-method details, addresses,
 * raw Stripe objects, and Stripe identifiers (customer / subscription / invoice
 * ids). Only the internal venue id, the shape of the plan, and money amounts.
 * Reconciliation back to Stripe runs venue_id → `venue_subscriptions` in
 * Supabase, which keeps Stripe ids out of PostHog altogether.
 *
 * ── Idempotency ──────────────────────────────────────────────
 * Stripe retries on any non-2xx, and this webhook deliberately returns 500 so it
 * *will* retry. Three independent layers stop a retry double-counting:
 *
 *   1. `stripe_events` ledger in the route — blocks most redeliveries outright.
 *   2. Business state — `venues.paid_at` gates converted_to_paid to the first
 *      real payment ever, so it cannot fire twice even if everything else fails.
 *   3. This module — every event carries `$insert_id` derived from the Stripe
 *      event id, and a `timestamp` taken from Stripe's `event.created` rather
 *      than the wall clock. PostHog de-duplicates on that tuple, and because
 *      both inputs are fixed properties of the Stripe event, a retry produces a
 *      byte-identical tuple and collapses server-side.
 *
 * Layer 3 is why `timestamp` must never be `new Date()`: a wall-clock timestamp
 * differs on every retry and would defeat the de-duplication entirely.
 */

import { PostHog } from "posthog-node";

const KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY  ?? "";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/** Billing events. Kept deliberately small — one event per commercial fact. */
export const BILLING = {
  TRIAL_STARTED:         "trial_started",
  SUBSCRIPTION_STARTED:  "subscription_started",
  CONVERTED_TO_PAID:     "converted_to_paid",
  PAYMENT_SUCCEEDED:     "payment_succeeded",
  PAYMENT_FAILED:        "payment_failed",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  SUBSCRIPTION_ENDED:    "subscription_ended",
} as const;

export type BillingEvent = (typeof BILLING)[keyof typeof BILLING];

let client: PostHog | null = null;

function phServer(): PostHog | null {
  if (!KEY) return null;
  if (!client) {
    // flushAt/flushInterval: a serverless function is frozen the moment it
    // responds, so there is no background window for a batch to drain in.
    // Send on every call and flush explicitly before returning.
    client = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });
  }
  return client;
}

/**
 * Resolve the PostHog distinct id for a venue.
 *
 * Prefers the owner's Supabase auth user id so server-side billing joins to the
 * same person the browser identifies. Falls back to a deterministic venue id.
 */
export async function venueDistinctId(
  db: any, venueId: string,
): Promise<{ distinctId: string; identitySource: "supabase_user" | "venue_fallback" }> {
  try {
    const { data } = await db.from("venues")
      .select("owner_user_id").eq("id", venueId).maybeSingle();
    if (data?.owner_user_id) {
      return { distinctId: String(data.owner_user_id), identitySource: "supabase_user" };
    }
  } catch {
    // fall through — analytics must never break the money path
  }
  return { distinctId: `venue_${venueId}`, identitySource: "venue_fallback" };
}

export interface BillingCapture {
  event:      BillingEvent;
  distinctId: string;
  /** Stripe's event id — the de-duplication key. */
  stripeEventId: string;
  /** Stripe's `event.created`. MUST be the Stripe timestamp, not the wall clock. */
  occurredAt: Date;
  properties?: Record<string, unknown>;
}

/**
 * Queue one billing event. Never throws — a broken analytics call must not make
 * the webhook return 500, because that would make Stripe redeliver and re-run
 * provisioning, emails and suspension logic for the sake of a metric.
 */
export function captureBilling(c: BillingCapture): void {
  const ph = phServer();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: c.distinctId,
      event:      c.event,
      timestamp:  c.occurredAt,
      properties: {
        ...c.properties,
        product: "venue",
        // Scoped by event name so one Stripe event can legitimately produce two
        // PostHog events (e.g. payment_succeeded + converted_to_paid) without
        // the second being de-duplicated away as a copy of the first.
        $insert_id: `${c.stripeEventId}:${c.event}`,
      },
    });
  } catch (e: any) {
    console.error("[posthog] capture failed", c.event, e?.message ?? e);
  }
}

/**
 * Drain the queue. Must be awaited before the route responds or the function is
 * frozen with events still in memory. Swallows its own failures for the same
 * reason captureBilling() does.
 */
export async function flushBilling(): Promise<void> {
  if (!client) return;
  try {
    await client.flush();
  } catch (e: any) {
    console.error("[posthog] flush failed", e?.message ?? e);
  }
}
