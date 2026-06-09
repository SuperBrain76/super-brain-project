"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function CallbackHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // ── Parse all possible auth params from the URL ──────────────────────────
    //
    // Supabase sends TWO different URL formats depending on the auth type:
    //
    //   EMAIL CONFIRMATION (OTP / magic-link):
    //     /auth/callback?token_hash=<hash>&type=signup[&next=<path>]
    //     Must be handled with: supabase.auth.verifyOtp({ token_hash, type })
    //
    //   OAUTH (Google, GitHub, etc.) — PKCE code flow:
    //     /auth/callback?code=<auth_code>[&next=<path>]
    //     Must be handled with: supabase.auth.exchangeCodeForSession(code)
    //
    // The original code only handled ?code=, so email confirmation links
    // (which use ?token_hash=) fell through to the else branch, where
    // getSession() returned null and the user was bounced to /login
    // without their email ever being confirmed. That is the bug.
    //
    const tokenHash = searchParams.get("token_hash");
    const type      = searchParams.get("type");   // "signup" | "email" | "recovery" | "invite"
    const code      = searchParams.get("code");
    const next      = searchParams.get("next");   // optional post-auth destination

    async function resolve() {
      // ── Path A: Email OTP / confirmation link ──────────────────────────────
      // token_hash + type are set by Supabase in every email-based link:
      //   - Sign-up confirmation (type="signup")
      //   - Magic-link login    (type="magiclink")
      //   - Email change        (type="email_change")
      //   - Password reset      (type="recovery")
      //   - Team invite         (type="invite")
      if (tokenHash && type) {
        console.log("[auth/callback] email OTP path — type:", type);
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
        });
        if (error) {
          console.error("[auth/callback] verifyOtp error:", error.message);
          router.replace("/login?error=confirmation_failed");
          return;
        }
        // verifyOtp succeeds → email is now confirmed, user has an active session
        console.log("[auth/callback] verifyOtp success — email confirmed");
      }

      // ── Path B: OAuth PKCE code exchange (Google, etc.) ───────────────────
      else if (code) {
        console.log("[auth/callback] OAuth PKCE path — exchanging code");
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[auth/callback] exchangeCodeForSession error:", error.message);
          router.replace("/login?error=confirmation_failed");
          return;
        }
        console.log("[auth/callback] exchangeCodeForSession success");
      }

      // ── Path C: Implicit flow fallback (no code, no token_hash) ──────────
      // Older Supabase projects / implicit-flow tokens arrive as URL hash
      // fragments (#access_token=...). The Supabase client processes the hash
      // automatically; we just check that a session was established.
      else {
        console.log("[auth/callback] implicit/hash path — checking session");
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          console.warn("[auth/callback] no session found — redirecting to /login");
          router.replace("/login");
          return;
        }
      }

      // ── Redirect after auth ───────────────────────────────────────────────

      // If a specific destination was requested, honour it immediately.
      // This covers: password reset, league invite, any ?next= destination.
      if (next) {
        router.replace(next);
        return;
      }

      // No ?next= — determine where to send the user based on provider.
      const { data: { user } } = await supabase.auth.getUser();
      const isOAuthUser = user?.app_metadata?.provider !== "email";

      // Google / OAuth users are fully authenticated without email verification.
      if (isOAuthUser) {
        router.replace("/predict");
        return;
      }

      // Email users: check whether they have completed their profile.
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("profile_complete")
        .single();

      router.replace(profile?.profile_complete ? "/predict" : "/profile/complete");
    }

    resolve();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f3ef" }}>
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#dde5d8" strokeWidth="3"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#1a3a2a" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <p className="text-sm font-medium" style={{ color: "#7a8f82" }}>Signing you in…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f3ef" }}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#dde5d8" strokeWidth="3"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#1a3a2a" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium" style={{ color: "#7a8f82" }}>Signing you in…</p>
        </div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
