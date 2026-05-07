"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function CallbackHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");

    async function resolve() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { router.replace("/login?error=confirmation_failed"); return; }
      } else {
        // Implicit flow — session is picked up from URL hash by the client automatically
        const { data } = await supabase.auth.getSession();
        if (!data.session) { router.replace("/login"); return; }
      }

      // Check whether the user has completed optional profile fields
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("profile_complete")
        .single();

      router.replace(profile?.profile_complete ? "/profile" : "/profile/complete");
    }

    resolve();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen hud-grid flex items-center justify-center">
      <p className="text-cockpit-dim text-sm animate-pulse">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Signing you in…</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
