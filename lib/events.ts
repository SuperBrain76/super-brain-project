/**
 * lib/events.ts — the one way anything in the venue business gets logged.
 *
 * Every significant thing that happens writes a row to `venue_events` through
 * `emit()`. Nothing calls .from("venue_events").insert() directly any more,
 * because the value of an event log is that it is COMPLETE — a log with three
 * of the sixteen interesting events in it tells you nothing at 2am.
 *
 * Two properties worth keeping:
 *   • venue_id is OPTIONAL. A provisioning failure often has no venue row —
 *     that is precisely the case worth alerting on.
 *   • emit() never throws. Logging must not be able to break the thing it is
 *     logging. A failed write is reported to stderr and swallowed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENT = {
  // prospecting
  PROSPECT_IMPORTED:     "prospect_imported",
  PROSPECT_ENRICHED:     "prospect_enriched",
  EMAIL_VERIFIED:        "email_verified",
  PROSPECT_REJECTED:     "prospect_rejected",
  // outreach
  EMAIL_SENT:            "email_sent",
  EMAIL_OPENED:          "email_opened",
  LINK_CLICKED:          "link_clicked",
  REPLY_RECEIVED:        "reply_received",
  EMAIL_BOUNCED:         "email_bounced",
  UNSUBSCRIBED:          "unsubscribed",
  // billing
  TRIAL_STARTED:         "trial_started",
  TRIAL_WILL_END:        "trial_will_end",
  SUBSCRIPTION_STARTED:  "subscription_started",
  PAYMENT_SUCCEEDED:     "payment_succeeded",
  PAYMENT_FAILED:        "payment_failed",
  SUBSCRIPTION_CANCELLED:"subscription_cancelled",
  // provisioning
  VENUE_PROVISIONED:     "venue_provisioned",
  LEAGUE_CREATED:        "league_created",
  QR_GENERATED:          "qr_generated",
  WELCOME_EMAIL_SENT:    "welcome_email_sent",
  LEAGUE_SUSPENDED:      "league_suspended",
  PROVISIONING_FAILED:   "provisioning_failed",
  // funnel — top-of-funnel web beacons (see /api/venues/track)
  LANDING_VIEWED:        "landing_viewed",
  START_CLICKED:         "start_clicked",
  SIGNUP_STARTED:        "signup_started",
  CHECKOUT_OPENED:       "checkout_opened",
  // funnel — lifecycle + product engagement
  TRIAL_CREATED:         "trial_created",
  LAUNCH_PACK_GENERATED: "launch_pack_generated",
  QR_SCANNED:            "qr_scanned",
  PLAYER_JOINED:         "player_joined",
  // system
  N8N_FAILED:            "n8n_failed",
  SCRAPER_RUN:           "scraper_run",
  SYNC_FAILED:           "sync_failed",
} as const;

export type EventKind = typeof EVENT[keyof typeof EVENT];
export type Severity  = "info" | "warn" | "error";
export type Source    = "app" | "stripe" | "instantly" | "n8n" | "scraper" | "admin" | "web";

/** Severity is implied by the kind unless a caller overrides it. */
const IMPLIED: Partial<Record<EventKind, Severity>> = {
  [EVENT.EMAIL_BOUNCED]:         "warn",
  [EVENT.PAYMENT_FAILED]:        "warn",
  [EVENT.SUBSCRIPTION_CANCELLED]:"warn",
  [EVENT.LEAGUE_SUSPENDED]:      "warn",
  [EVENT.PROVISIONING_FAILED]:   "error",
  [EVENT.N8N_FAILED]:            "error",
  [EVENT.SYNC_FAILED]:           "error",
};

export interface EmitOptions {
  venueId?: string | null;
  detail?: Record<string, unknown>;
  severity?: Severity;
  source?: Source;
}

/** Write one event. Never throws — logging cannot break the caller. */
export async function emit(
  db: SupabaseClient,
  kind: EventKind,
  opts: EmitOptions = {},
): Promise<void> {
  try {
    await db.from("venue_events").insert({
      venue_id: opts.venueId ?? null,
      kind,
      detail:   opts.detail ?? {},
      severity: opts.severity ?? IMPLIED[kind] ?? "info",
      source:   opts.source ?? "app",
    });
  } catch (e: any) {
    console.error(`[events] failed to log ${kind}:`, e?.message ?? e);
  }
}

/**
 * Wrap a step so a thrown error is logged as `error` and re-thrown.
 * Used around provisioning so a failure is always visible on the dashboard
 * even when the caller (a Stripe webhook) just returns 500 and retries.
 */
export async function tracked<T>(
  db: SupabaseClient,
  kind: EventKind,
  opts: EmitOptions,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    await emit(db, kind, {
      ...opts,
      severity: "error",
      detail: { ...(opts.detail ?? {}), error: String(e?.message ?? e) },
    });
    throw e;
  }
}
