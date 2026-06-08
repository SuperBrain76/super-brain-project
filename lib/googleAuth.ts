/**
 * Google OAuth helper — shared across login, signup and league join flows.
 *
 * Handles:
 * - PKCE flow (supabase-js v2 default for OAuth)
 * - Preserving the ?next= redirect destination through the OAuth round-trip
 * - Canonical site URL so the callback always lands on production
 */

import { supabase } from "./supabase";

/**
 * Kick off Google OAuth sign-in.
 * @param next  Optional path to redirect to after sign-in (e.g. "/predict/leagues/join?code=ABC")
 * @returns     Error message string, or null on success (browser navigates away)
 */
export async function signInWithGoogle(next?: string): Promise<string | null> {
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  const callbackUrl = next
    ? `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`
    : `${siteUrl}/auth/callback`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo:   callbackUrl,
      queryParams: {
        // Request offline access + profile so we get a stable sub and display name
        access_type: "offline",
        prompt:      "select_account",
      },
    },
  });

  return error ? error.message : null;
}
