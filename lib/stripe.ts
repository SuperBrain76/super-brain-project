/**
 * lib/stripe.ts — billing for venue-branded leagues.
 *
 * Two plans, one trial:
 *   monthly  €99 / month
 *   annual   €990 / year  (two months free)
 *   trial    7 days, CARD REQUIRED — Stripe collects the card at checkout and
 *            converts automatically on day 7. That means Stripe itself owns
 *            the trial reminders (see TRIAL_REMINDERS below), so there is no
 *            hand-rolled reminder scheduler to drift out of sync.
 *
 * UK venues are billed in GBP when a GBP price id is configured; everything
 * else falls back to EUR. MRR is always normalised to cents-per-month so the
 * growth dashboard can sum one column.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY missing");
    _stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });
  }
  return _stripe;
}

export const TRIAL_DAYS = 7;

/**
 * Stripe emits `customer.subscription.trial_will_end` 3 days before the trial
 * converts. That single event drives the whole trial-reminder sequence — we
 * do not schedule our own. Day 7 conversion is Stripe's own billing cycle.
 */
export const TRIAL_REMINDERS = "stripe:customer.subscription.trial_will_end (T-3d)";

export type Plan = "monthly" | "annual";

/** Price id for a plan, preferring the venue's local currency. */
export function priceId(plan: Plan, currency: "eur" | "gbp"): string {
  const env = (k: string) => process.env[k] || "";
  const local =
    plan === "monthly"
      ? env(`STRIPE_PRICE_MONTHLY_${currency.toUpperCase()}`)
      : env(`STRIPE_PRICE_ANNUAL_${currency.toUpperCase()}`);
  const fallback =
    plan === "monthly" ? env("STRIPE_PRICE_MONTHLY") : env("STRIPE_PRICE_ANNUAL");
  const id = local || fallback;
  if (!id) throw new Error(`No Stripe price configured for ${plan}/${currency}`);
  return id;
}

/** UK bills in GBP when configured; the rest of Europe in EUR. */
export function currencyFor(country: string): "eur" | "gbp" {
  return country?.toUpperCase() === "GB" ? "gbp" : "eur";
}

/**
 * Monthly-normalised revenue in cents, so `sum(mrr_cents)` is a true MRR
 * regardless of billing interval. An annual €990 subscription is €82.50/mo.
 */
export function toMrrCents(amountCents: number, plan: Plan): number {
  return plan === "annual" ? Math.round(amountCents / 12) : amountCents;
}

/** Map a Stripe subscription's interval back to our plan name. */
export function planFromInterval(interval?: string | null): Plan {
  return interval === "year" ? "annual" : "monthly";
}

/** Stripe locale for the checkout page, by venue language. */
export function checkoutLocale(language: string): Stripe.Checkout.SessionCreateParams.Locale {
  const map: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = {
    en: "en", de: "de", es: "es", fr: "fr", it: "it",
  };
  return map[language] ?? "en";
}

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.superbrain.social";
