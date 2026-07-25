import posthog from "posthog-js";

const KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY  ?? "";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

export function initPostHog(): void {
  if (typeof window === "undefined" || !KEY) return;
  // posthog-js sets __loaded after init — skip if already initialised
  if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;
  posthog.init(KEY, {
    api_host:          HOST,
    capture_pageview:  false, // fired manually via PostHogProvider
    capture_pageleave: true,
    persistence:       "localStorage+cookie",

    // ── Session Replay ──────────────────────────────────────────────────────
    // Requires "Session Replay" to be enabled in the PostHog dashboard:
    //   PostHog → your project → Settings → Session Replay → toggle ON
    // Recordings are then visible under PostHog → Recordings.
    session_recording: {
      maskAllInputs: true,          // mask text in <input> / <textarea>
      maskTextSelector: "[data-mask]", // opt-in masking for other elements
    },
  });
}

export function trackPageView(): void {
  if (typeof window === "undefined" || !KEY) return;
  posthog.capture("$pageview", { $current_url: window.location.href });
}

function t(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !KEY) return;
  posthog.capture(event, props);
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

/** Fire a predictor event with the competition dimension attached. */
function tc(event: string, props?: Record<string, unknown>): void {
  t(event, { ..._competitionContext, ...props });
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
  leaderboardViewed: (testName: string)                                              => t("leaderboard_viewed", { test_name: testName }),

  // ── Auth ─────────────────────────────────────────────────────────────────────
  signupStarted:     ()                                                              => t("signup_started"),
  signupCompleted:   ()                                                              => t("signup_completed"),

  // ── Predictor ────────────────────────────────────────────────────────────────
  // These use `tc`, so every one carries the competition dimension set by
  // setCompetitionContext(). Do not switch any of them back to `t`.
  predictionSaved:         (fixtureId: string, isEdit: boolean)                     => tc("prediction_saved",          { fixture_id: fixtureId, is_edit: isEdit, device: _device() }),
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
  // Funnel A:  invite_page_viewed → league_joined → first_prediction_saved
  // Funnel B:  signup_completed → first_prediction_saved
  // Funnel C:  first_prediction_saved → all_group_matches_predicted

  /** Fired once when the /predict/leagues/join page mounts (regardless of auth) */
  invitePageViewed: (leagueId: string | null, source: "link" | "code" | "unknown") =>
    t("invite_page_viewed", { league_id: leagueId, source, device: _device() }),

  /** Fired when the user clicks "Continue with Google" on any sign-in surface */
  googleLoginClicked: (surface: "login_page" | "join_page") =>
    t("google_login_clicked", { surface, device: _device() }),

  /** Fired the very first time a user saves a prediction (myPrediction was null before) */
  firstPredictionSaved: (fixtureId: string) =>
    t("first_prediction_saved", { fixture_id: fixtureId, device: _device() }),

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
};
