"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function CallbackHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next"); // e.g. "/predict/leagues/join?code=ABC" or "/reset-password"

    async function resolve() {
      // ── 1. Exchange code for session (PKCE — works for both email confirm AND OAuth) ──
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { router.replace("/login?error=confirmation_failed"); return; }
      } else {
        // Implicit flow fallback — session from URL hash
        const { data } = await supabase.auth.getSession();
        if (!data.session) { router.replace("/login"); return; }
      }

      // ── 2. If a specific destination was requested, go there immediately ──
      // This covers: password reset, league invite, any ?next= destination.
      // Also covers Google OAuth users — they land here with ?next= preserved.
      if (next) {
        router.replace(next);
        return;
      }

      // ── 3. No ?next= — determine where to send the user ──────────────────
      // Check whether this is a Google/OAuth user or email user.
      const { data: { user } } = await supabase.auth.getUser();
      const isOAuthUser = user?.app_metadata?.provider !== "email";

      // OAuth users (Google etc.) skip the profile-complete gate — they are
      // already authenticated without email verification. Send straight to /predict.
      if (isOAuthUser) {
        router.replace("/predict");
        return;
      }

      // Email users: check profile completion (existing behaviour).
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
