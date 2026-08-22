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

  // Comp mode: a secret link (…/venues/start?comp=<VENUE_COMP_SECRET>) gives a
  // hand-picked venue free access with NO card. Gated by a server-only secret,
  // so a guessed ?comp= just falls through to the normal paid checkout.
  const isComp = !!process.env.VENUE_COMP_SECRET
    && !!process.env.STRIPE_COMP_COUPON
    && String(body.comp ?? "") === process.env.VENUE_COMP_SECRET;

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
    comp:             isComp ? "true" : "",
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId(plan, currency), quantity: 1 }],
      customer_email: email,
      locale: checkoutLocale(language),
      // EU B2B: let a VAT-registered venue enter its number so the invoice
      // reverse-charges correctly instead of us eating the VAT.
      tax_id_collection: { enabled: true },
      ...(process.env.STRIPE_TAX_ENABLED === "true"
        ? { automatic_tax: { enabled: true } }
        : {}),
      ...(isComp
        // 100%-forever coupon + no card ever + no trial → £0 today and forever.
        // (discounts and allow_promotion_codes are mutually exclusive.)
        ? {
            discounts: [{ coupon: process.env.STRIPE_COMP_COUPON! }],
            payment_method_collection: "if_required" as const,
          }
        : {
            allow_promotion_codes: true,
            // Card-less trial. Cold prospects will not hand over a card before
            // they have seen the product working in their own venue, and the
            // real activation gate is whether they put the QR poster on tables,
            // which a card does not predict. Stripe still owns the trial clock:
            // with no payment method at trial end the subscription cancels,
            // which fires customer.subscription.deleted and suspends the league
            // through the existing webhook path. Flip VENUE_REQUIRE_CARD=true
            // to go back to card-up-front without a code change.
            ...(process.env.VENUE_REQUIRE_CARD === "true"
              ? {}
              : { payment_method_collection: "if_required" as const }),
          }),
      subscription_data: {
        metadata,
        ...(isComp
          ? {}
          : {
              trial_period_days: TRIAL_DAYS,
              trial_settings: {
                // If the card fails when the trial ends, cancel rather than
                // leaving an unpaid subscription hanging around forever.
                end_behavior: { missing_payment_method: "cancel" as const },
              },
            }),
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
