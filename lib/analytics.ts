import posthog from "posthog-js";

const KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY  ?? "";
// EU, not US: the SuperBrain PostHog project lives on EU Cloud and production
// sets NEXT_PUBLIC_POSTHOG_HOST explicitly. The old US default only ever applied
// when the env var was missing, and silently pointed at the wrong region.
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

// ── Sensitive routes ──────────────────────────────────────────
//
// Routes that render credentials, billing or other people's data. On these we
// turn session replay OFF entirely and stop autocapture, rather than relying on
// masking alone. Masking is a filter; not recording is a guarantee.
//
// Mirror this list in PostHog → Settings → Session Replay → URL blocklist, so
// the protection survives a bug in this file. Two independent controls, because
// one of them will eventually be wrong.
const SENSITIVE_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/settings",        // includes /settings/profile — password change lives here
  "/admin",           // renders other users' emails
  "/venues/billing",  // Stripe portal handoff, carries a bearer token
  "/delete-account",
  "/contact",
];

/** True when replay and autocapture must be suppressed on this path. */
export function isSensitiveRoute(pathname: string): boolean {
  return SENSITIVE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

// ── Forced-replay routes ──────────────────────────────────────
//
// The venue onboarding flow, recorded at 100% while everything else stays at the
// project's 10% sample.
//
// Why an override rather than raising the global rate: sampling is per-project,
// so the only way to see the venue funnel reliably is to raise the rate for
// everyone — consumer traffic is the volume, and that is the expensive half. At
// current venue numbers a 10% sample could plausibly capture ZERO complete wizard
// sessions, which makes the wizard-abandonment question unanswerable exactly
// where it matters most commercially.
//
// /venues/start is the pre-checkout signup form and /venues/welcome is the 5-step
// wizard. Both are the same funnel question ("where do venues fall out of setup"),
// neither renders credentials, billing or anyone else's data.
const FORCE_REPLAY_ROUTES = [
  "/venues/start",
  "/venues/welcome",
];

/**
 * True when this path should be recorded regardless of the project sample rate.
 *
 * Guarded against SENSITIVE_ROUTES so that adding an entry above can never
 * accidentally force recording of a page we decided not to record. Exclusion
 * always wins over forcing.
 */
export function isForcedReplayRoute(pathname: string): boolean {
  if (isSensitiveRoute(pathname)) return false;
  return FORCE_REPLAY_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

// Autocapture matches against the full URL, so anchor each route to the path.
const SENSITIVE_URL_PATTERNS = SENSITIVE_ROUTES.map((r) => new RegExp(`${r}(/|$|\\?)`));

export function initPostHog(): void {
  if (typeof window === "undefined" || !KEY) return;
  // posthog-js sets __loaded after init — skip if already initialised
  if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;
  posthog.init(KEY, {
    api_host:          HOST,
    capture_pageview:  false, // fired manually via PostHogProvider
    capture_pageleave: true,
    persistence:       "localStorage+cookie",

    // Redacts personal data (emails, card-shaped strings) out of event
    // properties and URLs before anything leaves the browser.
    mask_personal_data_properties: true,

    // Autocapture records the TEXT of clicked elements, so on the sensitive
    // routes above it is switched off rather than masked.
    autocapture: { url_ignorelist: SENSITIVE_URL_PATTERNS },

    // ── Session Replay ──────────────────────────────────────────────────────
    // Enabled per-project in PostHog → Settings → Session Replay, where the
    // sample rate, minimum duration and URL blocklist also live. The settings
    // below are the client-side floor: whatever the dashboard says, this is the
    // least that is always masked.
    session_recording: {
      maskAllInputs: true,      // every <input> / <textarea> value
      // "*" masks EVERY text node on the page.
      //
      // 🔴 This was previously "[data-mask]" — a selector that matches NOTHING
      // anywhere in this codebase. Replay would therefore have recorded every
      // rendered email address, venue name, staff list and prediction in plain
      // text. Opt-in masking fails silently; opt-out masking fails loudly.
      maskTextSelector: "*",
      // Escape hatch for anything that must not even appear as a placeholder.
      blockSelector: "[data-ph-block]",
    },
  });
  loadVenueContext();
  applyReplayPolicy(window.location.pathname);
}

/**
 * Start or stop replay for the current route.
 *
 * startSessionRecording() is called with NO arguments on purpose — passing
 * `{ sampling: true }` would override the project's sample rate and record
 * every session, which is the opposite of the conservative default we want.
 */
export function applyReplayPolicy(pathname: string): void {
  if (typeof window === "undefined" || !KEY) return;
  if (!(posthog as unknown as { __loaded?: boolean }).__loaded) return;
  try {
    if (isSensitiveRoute(pathname)) {
      // Not recording beats masking. Wins over any force rule below.
      posthog.stopSessionRecording();
    } else if (isForcedReplayRoute(pathname)) {
      // { sampling: true } exempts THIS session from the 10% project sample.
      // The exemption is session-scoped, so a venue owner who finishes the wizard
      // and then browses the app stays recorded for the rest of that session —
      // intended: it is one continuous session, and leaving it recorded is what
      // makes the wizard→first-use transition watchable end to end. Navigating to
      // a sensitive route still stops it via the branch above.
      posthog.startSessionRecording({ sampling: true });
    } else {
      // No argument: resume normal, sampled behaviour. Passing { sampling: true }
      // here would silently record 100% of all traffic.
      posthog.startSessionRecording();
    }
  } catch { /* never let analytics break navigation */ }
}

export function trackPageView(): void {
  if (typeof window === "undefined" || !KEY) return;
  posthog.capture("$pageview", { $current_url: window.location.href });
}

// ── Identity ──────────────────────────────────────────────────────────────────
//
// Without identify(), every user stays permanently anonymous and PostHog cannot
// join a person's sessions together. That makes retention, activation and every
// signup→paid funnel impossible to build — not merely inaccurate.
//
// 🔒 The Supabase user id is the ONLY thing sent. No email, no display name, no
// other trait. The id is an opaque UUID and is already the join key used against
// Supabase, so it adds no new personal data to PostHog.

/**
 * Link this browser to a signed-in user.
 *
 * Calls initPostHog() first because React runs child effects before parent ones —
 * AuthProvider sits inside PostHogProvider, so its effect can fire first. init is
 * idempotent, so this removes the ordering hazard rather than racing it.
 *
 * Safe to call repeatedly with the same id.
 */
export function identifyUser(userId: string): void {
  if (typeof window === "undefined" || !KEY || !userId) return;
  initPostHog();
  posthog.identify(userId);
}

/**
 * Unlink on sign-out, so the next person to use this browser does not inherit
 * the previous user's identity. Only call on an actual sign-out — calling it on
 * a plain anonymous page load would churn the anonymous id and break the
 * anonymous → identified stitching PostHog does at signup.
 */
export function resetUser(): void {
  if (typeof window === "undefined" || !KEY) return;
  if (!(posthog as unknown as { __loaded?: boolean }).__loaded) return;
  posthog.reset();
}

// ── The product dimension ─────────────────────────────────────
//
// Consumer and Venue share one codebase, one domain and one PostHog project, so
// every event must say which product it belongs to or the two funnels silently
// merge. This is set per-event rather than as a super property on purpose: a
// super property is sticky per browser, and one person (Dylan, a venue owner
// trying the consumer app) would poison every subsequent event with whichever
// product they touched first.
//
// t()  → product: "consumer"
// tv() → product: "venue"

function t(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !KEY) return;
  posthog.capture(event, { product: "consumer", ...props });
}

/** Venue (B2B) event. Always carries product: "venue". */
function tv(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !KEY) return;
  posthog.capture(event, { ..._venueContext, ...props, product: "venue" });
}

// ── Venue dimension ───────────────────────────────────────────
//
// The venue id is the join key for the entire B2B funnel: outreach carries it as
// `?v=<uuid>` (see lib/leadTrack.ts), it survives into signup, and it is the id
// the Stripe webhook attributes billing to server-side. Setting it once here
// means every venue event and every predictor event fired inside a venue-owned
// league carries it, without call sites having to remember.
//
// 🔴 Like the competition dimension, this CANNOT be backfilled — a venue event
// emitted without venue_id is permanently unattributable to the venue that
// caused it, which is exactly the question the B2B funnel exists to answer.

interface VenueContext { venue_id?: string; venue_slug?: string }

const VENUE_KEY = "sb_venue_ctx";

let _venueContext: VenueContext = {};

/**
 * Record which venue the user is currently acting on or inside.
 *
 * Persisted to localStorage because venue membership outlives a page load: a
 * customer who scans a poster in September is still that venue's customer in
 * November, and retention is precisely the question of whether they came back.
 * An in-memory-only context would reset on every reload and make every returning
 * visit look unattributed.
 */
export function setVenueContext(ctx: VenueContext): void {
  _venueContext = { ..._venueContext, ...ctx };
  try { localStorage.setItem(VENUE_KEY, JSON.stringify(_venueContext)); } catch { /* private mode */ }
}

/** Rehydrate on load. Called by initPostHog(). */
function loadVenueContext(): void {
  try {
    const raw = localStorage.getItem(VENUE_KEY);
    if (raw) _venueContext = { ..._venueContext, ...JSON.parse(raw) };
  } catch { /* ignore */ }
}

/** Clear it — e.g. leaving a venue league for the plain consumer app. */
export function clearVenueContext(): void {
  _venueContext = {};
  try { localStorage.removeItem(VENUE_KEY); } catch { /* ignore */ }
}

export function getVenueContext(): Readonly<VenueContext> {
  return _venueContext;
}

// ── Device helper ─────────────────────────────────────────────
// Simple mobile/desktop discriminator. Coarse but sufficient for
// PostHog segmentation — no external library needed.
function _device(): "mobile" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  return navigator.maxTouchPoints > 0 ? "mobile" : "desktop";
}

// ── Competition dimension — Competition Engine V2 ─────────────
//
// 🔴 THIS CANNOT BE BACKFILLED. PostHog properties are fixed at ingest
// time. Any predictor event emitted without a competition dimension is
// permanently unattributable — so with several competitions live, every
// predictor funnel would silently merge them and become meaningless.
//
// That is why this is wired up now rather than with the Premier League UI:
// it is the only piece of Phase 1 whose cost is irreversible if deferred.
//
// The context is set once, when a page resolves its competition, and is then
// attached to every predictor event automatically. Call sites do not have to
// remember to pass it — anything that relies on remembering will be missed.

interface CompetitionContext {
  competition_id?:   string;
  competition_slug?: string;
  season_id?:        string;
  sport?:            string;
  round_id?:         string;
  round_code?:       string;
}

let _competitionContext: CompetitionContext = {};

/**
 * Record which competition the user is currently looking at.
 *
 * Call after resolving the competition (and again when the round changes).
 * Safe to call repeatedly; fields are merged so setting a round later does
 * not clear the competition.
 */
export function setCompetitionContext(ctx: CompetitionContext): void {
  _competitionContext = { ..._competitionContext, ...ctx };
}

/** Clear the context — e.g. when navigating away from a competition. */
export function clearCompetitionContext(): void {
  _competitionContext = {};
}

/** Current context, for callers that need to inspect it. */
export function getCompetitionContext(): Readonly<CompetitionContext> {
  return _competitionContext;
}

/**
 * Fire a predictor event with the competition dimension attached — plus the
 * venue dimension when the player belongs to a venue league.
 *
 * A prediction is consumer behaviour (product stays "consumer"), but it is also
 * the usage unit a venue is paying for. Carrying venue_id as a DIMENSION rather
 * than emitting a separate venue event keeps one event per real-world action:
 * predictions are made against a fixture, not against a league, so a
 * "venue_prediction_made" event would imply a scoping the product does not have.
 */
function tc(event: string, props?: Record<string, unknown>): void {
  t(event, { ..._competitionContext, ..._venueContext, ...props });
}

export const track = {
  // ── Cognitive tests ──────────────────────────────────────────────────────────
  homepageView:      ()                                                              => t("homepage_view"),
  testStarted:       (testName: string)                                              => t("test_started",       { test_name: testName }),
  testCompleted:     (testName: string, score: number)                               => t("test_completed",     { test_name: testName, score }),
  resultShared:      (method: "whatsapp" | "native" | "copy", testName: string, score: number) =>
                                                                                        t("result_shared",     { method, test_name: testName, score }),
  challengeOpened:   (testName: string)                                              => t("challenge_opened",   { test_name: testName }),
  challengeAccepted: (testName: string)                                              => t("challenge_accepted", { test_name: testName }),
  retryClicked:      (testName: string)                                              => t("retry_clicked",      { test_name: testName }),
  // context is explicit on BOTH leaderboard helpers. Separating them by the
  // ABSENCE of context would silently mis-bucket any future caller that forgot
  // it. Historical rows (before 4 Sep 2026) have no context — for those,
  // absent means "test".
  leaderboardViewed: (testName: string)                                              => t("leaderboard_viewed", { context: "test", test_name: testName }),

  // ── Auth ─────────────────────────────────────────────────────────────────────
  signupStarted:     ()                                                              => t("signup_started"),
  signupCompleted:   ()                                                              => t("signup_completed"),

  // ── Predictor ────────────────────────────────────────────────────────────────
  // These use `tc`, so every one carries the competition dimension set by
  // setCompetitionContext(). Do not switch any of them back to `t`.
  predictionSaved:         (fixtureId: string, isEdit: boolean)                     => tc("prediction_saved",          { fixture_id: fixtureId, is_edit: isEdit, device: _device() }),
  /** F1 — a top-five session board saved (qualifying or race). */
  f1SessionPredicted:      (fixtureId: string)                                      => tc("f1_session_predicted",      { fixture_id: fixtureId, device: _device() }),
  bonusAnswerSaved:        (questionKey: string)                                     => tc("bonus_answer_saved",        { question_key: questionKey }),
  leagueCreated:           (visibility: "private" | "public")                        => tc("league_created",            { visibility }),
  leagueJoined:            (leagueId: string)                                        => tc("league_joined",             { league_id: leagueId }),
  inviteLinkCopied:        (leagueId: string, copyType: "code" | "link")             => tc("invite_link_copied",        { league_id: leagueId, copy_type: copyType }),
  whatsappShareClicked:    (leagueId: string)                                        => tc("whatsapp_share_clicked",    { league_id: leagueId }),
  predictorLeaderboardViewed: (window?: "round" | "month" | "season")                 => tc("leaderboard_viewed",        { context: "predictor", window: window ?? "season" }),

  /** Matchweek navigation — the round dimension for Phase 4/5 funnels. */
  roundViewed:             (roundCode: string, roundId: string)                      => tc("round_viewed",              { round_code: roundCode, round_id: roundId, device: _device() }),
  /** Fired when the user switches competition. */
  competitionSwitched:     (fromSlug: string | null, toSlug: string)                 => tc("competition_switched",      { from_slug: fromSlug, to_slug: toSlug, device: _device() }),

  // ── Growth / funnel events ────────────────────────────────────────────────────
  // Funnel A:  invite_page_viewed → league_joined → prediction_created
  // Funnel B:  signup_completed → prediction_created
  // Funnel C:  prediction_created → all_group_matches_predicted

  /** Fired once when the /predict/leagues/join page mounts (regardless of auth) */
  invitePageViewed: (leagueId: string | null, source: "link" | "code" | "unknown") =>
    t("invite_page_viewed", { league_id: leagueId, source, device: _device() }),

  /** Fired when the user clicks "Continue with Google" on any sign-in surface */
  googleLoginClicked: (surface: "login_page" | "join_page") =>
    t("google_login_clicked", { surface, device: _device() }),

  /**
   * A NEW prediction was created for a fixture (none existed before).
   *
   * Renamed from `first_prediction_saved`, which was actively deceptive: the
   * old name implied "this user's first ever prediction", but the condition has
   * always been "this FIXTURE had no prediction yet". It fired ~36 times per
   * person over 200 days. The old event is legacy historical data — do NOT sum
   * its counts with this one.
   *
   * Always accompanied by prediction_saved, on every surface. prediction_saved
   * counts every successful write; prediction_created counts the subset that
   * were new. created + edits = saves, on every surface, always.
   */
  predictionCreated: (fixtureId: string) =>
    tc("prediction_created", { fixture_id: fixtureId, device: _device() }),

  /**
   * A bulk action ("predict all home wins") was applied.
   *
   * Action-level only. The individual predictions it writes each emit their own
   * prediction_saved / prediction_created, so bulk and single-tap saves are
   * counted identically — activation and retention must not depend on which
   * button a user pressed. Previously this emitted ONE prediction_saved for N
   * predictions, carrying a fake fixture_id of `bulk:<label>:<n>`.
   */
  bulkPredictionApplied: (label: string, count: number, created: number) =>
    tc("bulk_prediction_applied", { label, count, created, device: _device() }),

  /** Fired when the user has predicted every open group-stage match */
  allGroupMatchesPredicted: (totalPredicted: number) =>
    t("all_group_matches_predicted", { total_predicted: totalPredicted, device: _device() }),

  /** Fired when any WhatsApp channel CTA is clicked — surface identifies which one */
  whatsappChannelClicked: (surface: "card" | "homepage_hero" | "first_prediction_banner") =>
    t("whatsapp_channel_clicked", { surface, device: _device() }),

  // ── Grand Prize ───────────────────────────────────────────────────────────────

  /** Fired when a prize placement enters the viewport */
  grandPrizeViewed: (surface: "homepage_section" | "join_card" | "fixtures_banner" | "leaderboard_banner" | "rules_section" | "prize_page" | "predict_hub" | "bonus_page") =>
    t("grand_prize_viewed", { surface, device: _device() }),

  /** Fired when user clicks any prize element (non-CTA, e.g. banner link) */
  grandPrizeClicked: (surface: "fixtures_banner" | "leaderboard_banner" | "footer" | "predict_hub" | "homepage") =>
    t("grand_prize_clicked", { surface, device: _device() }),

  /** Fired when user navigates to /predict/prize or clicks a "prize details" link */
  grandPrizeDetailsViewed: (source: "homepage_section" | "join_card" | "rules_section" | "direct" | "predict_hub" | "leaderboard" | "bonus_page") =>
    t("grand_prize_details_viewed", { source, device: _device() }),

  /** Fired when user clicks a "Start Predicting" CTA that originated from a prize placement */
  grandPrizeCTAClicked: (surface: "homepage_section" | "prize_page") =>
    t("grand_prize_cta_clicked", { surface, device: _device() }),

  // ── Grand Prize card-level events (for impression + click tracking) ───────────
  /** Fired on mount for any prize card/banner component */
  grandPrizeCardViewed: (surface: string) =>
    t("grand_prize_card_viewed", { surface, device: _device() }),

  /** Fired when user clicks a prize card or banner */
  grandPrizeCardClicked: (surface: string) =>
    t("grand_prize_card_clicked", { surface, device: _device() }),

  /** Fired when /predict/prize page mounts */
  prizePageViewed: () =>
    t("prize_page_viewed", { device: _device() }),

  // ── Venue (B2B) ───────────────────────────────────────────────────────────────
  //
  // Deliberately small. These are the commercial funnel's load-bearing moments,
  // not a click log — every event below is one a decision could be made on:
  //
  //   venue_landing_viewed → venue_signup_started → venue_checkout_opened
  //     → [server] trial_started → venue_wizard_step_completed ×4
  //     → venue_launch_completed → venue_player_joined → venue_prediction_made
  //     → [server] converted_to_paid / subscription_ended
  //
  // The legs marked [server] come from the Stripe webhook (lib/analyticsServer.ts)
  // because a browser cannot observe billing. They share the `product: "venue"`
  // dimension and the venue_id, so the whole chain funnels as one sequence.
  venue: {
    /** /venues marketing landing rendered. Top of the B2B funnel. */
    landingViewed: (source: "outreach" | "direct") =>
      tv("venue_landing_viewed", { source, device: _device() }),

    /**
     * The signup form was genuinely engaged — first edit of any field, NOT the
     * page view. A page view measures traffic; an edit measures intent, and the
     * gap between the two is the single most useful number on this page.
     */
    signupStarted: (source: "outreach" | "direct") =>
      tv("venue_signup_started", { source, device: _device() }),

    /** Handing off to Stripe. Last moment we own before checkout. */
    checkoutOpened: (plan: "monthly" | "annual", currency: string) =>
      tv("venue_checkout_opened", { plan, currency, device: _device() }),

    /**
     * One wizard step finished. ONE event with a `step` property rather than
     * five events — abandonment is then a single funnel broken down by step,
     * and adding a sixth step later does not require new analytics.
     */
    wizardStepCompleted: (step: "branding" | "competitions" | "launch_pack" | "staff", index: number) =>
      tv("venue_wizard_step_completed", { step, step_index: index, step_count: 5 }),

    /**
     * The venue reached "live" — onboarding/complete stamped venues.onboarded_at.
     * Setup finished. NOT the same as activated: nobody has played yet.
     */
    launchCompleted: (hasLeague: boolean, competitions: number) =>
      tv("venue_launch_completed", { has_league: hasLeague, competitions }),

    /**
     * A customer joined this venue's league. The first real signal that the
     * venue did something with the product rather than merely configuring it.
     */
    playerJoined: (leagueId: string, via: "qr" | "code" | "link") =>
      tv("venue_player_joined", { league_id: leagueId, via, device: _device() }),
  },
};
