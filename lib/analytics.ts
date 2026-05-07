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

export const track = {
  homepageView:      ()                                                              => t("homepage_view"),
  testStarted:       (testName: string)                                              => t("test_started",       { test_name: testName }),
  testCompleted:     (testName: string, score: number)                               => t("test_completed",     { test_name: testName, score }),
  resultShared:      (method: "whatsapp" | "native" | "copy", testName: string, score: number) =>
                                                                                        t("result_shared",     { method, test_name: testName, score }),
  challengeOpened:   (testName: string)                                              => t("challenge_opened",   { test_name: testName }),
  challengeAccepted: (testName: string)                                              => t("challenge_accepted", { test_name: testName }),
  retryClicked:      (testName: string)                                              => t("retry_clicked",      { test_name: testName }),
  leaderboardViewed: (testName: string)                                              => t("leaderboard_viewed", { test_name: testName }),
  signupStarted:     ()                                                              => t("signup_started"),
  signupCompleted:   ()                                                              => t("signup_completed"),
};
