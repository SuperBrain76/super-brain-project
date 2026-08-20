/**
 * POST /api/venues/checkout — start a venue subscription.
 *
 * Body: { venueName, country, city?, competitionSlug, language?, plan?,
 *         email, ownerName?, phone?, website?, venueId? }
 *
 * Returns { url } — the Stripe Checkout page to redirect to.
 *
 * The card is collected up front and the 7-day trial runs inside Stripe, so
 * Stripe owns conversion and the reminder event. Nothing is provisioned here:
 * the webhook is the single provisioning path, which means a venue that
 * closes the tab mid-checkout leaves no half-built league behind.
 *
 * `venueId` is carried through from the outreach link (…/venues/start?v=<id>)
 * so a venue we cold-emailed keeps ONE CRM row from prospect to customer and
 * the funnel attribution survives.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe, priceId, currencyFor, checkoutLocale, SITE, TRIAL_DAYS, type Plan } from "@/lib/stripe";
import { admin } from "@/lib/venueDb";
import { emit, EVENT } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGS = ["en", "de", "es", "fr", "it"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const venueName = String(body.venueName ?? "").trim();
  const email     = String(body.email ?? "").trim().toLowerCase();
  const country   = String(body.country ?? "").trim().toUpperCase();
  const plan: Plan = body.plan === "annual" ? "annual" : "monthly";
  const language  = LANGS.includes(body.language) ? body.language : "en";

  // No competition is chosen at signup any more — the subscription includes
  // every competition and leagues are activated in the onboarding wizard.
  if (!venueName || !email || !country) {
    return NextResponse.json(
      { error: "venueName, email and country are required" },
      { status: 400 },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const currency = currencyFor(country);
  const stripe   = getStripe();

  // Metadata rides on BOTH the session and the subscription: the session so
  // checkout.session.completed can provision, the subscription so later
  // billing events can still find the venue without a database join.
  const metadata: Record<string, string> = {
    venue_id:         String(body.venueId ?? ""),
    venue_name:       venueName,
    country,
    city:             String(body.city ?? ""),
    language,
    owner_name:       String(body.ownerName ?? ""),
    owner_phone:      String(body.phone ?? ""),
    website:          String(body.website ?? ""),
    plan,
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId(plan, currency), quantity: 1 }],
      customer_email: email,
      locale: checkoutLocale(language),
      allow_promotion_codes: true,
      // EU B2B: let a VAT-registered venue enter its number so the invoice
      // reverse-charges correctly instead of us eating the VAT.
      tax_id_collection: { enabled: true },
      ...(process.env.STRIPE_TAX_ENABLED === "true"
        ? { automatic_tax: { enabled: true } }
        : {}),
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata,
        trial_settings: {
          // If the card fails when the trial ends, cancel rather than leaving
          // an unpaid subscription hanging around forever.
          end_behavior: { missing_payment_method: "cancel" },
        },
      },
      metadata,
      success_url: `${SITE}/venues/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE}/venues?checkout=cancelled`,
    });

    // Funnel: the venue reached Stripe. Attribute to the lead when we have one.
    if (UUID.test(String(body.venueId ?? ""))) {
      await emit(admin(), EVENT.CHECKOUT_OPENED, {
        venueId: String(body.venueId), source: "web",
        detail: { plan, currency },
      }).catch(() => {});
    }

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[venues/checkout]", e?.message ?? e);
    return NextResponse.json({ error: "could not start checkout" }, { status: 500 });
  }
}
