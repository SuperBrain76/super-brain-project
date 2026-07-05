"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getOnboardingStatus } from "@/lib/onboarding";

// ============================================================================
// Guarantees every new user experiences onboarding exactly once — including
// OAuth (Google/Apple) users, who previously went straight past it.
//
// Fires once per device: if a signed-in user hasn't completed onboarding and
// hasn't been sent to /welcome yet, redirect them there. After that (or once
// they complete it) the localStorage flag stops it firing again, so it never
// traps or nags — the dashboard's "Resume" banner handles later nudging.
// ============================================================================

const SEEN_KEY = "sb:onboardingSeen";
const EXCLUDE = ["/welcome", "/login", "/auth", "/forgot-password", "/reset-password", "/profile/complete"];

export default function OnboardingGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (loading || !user) return;
    if (typeof window === "undefined") return;

    // Already seen on this device → never run again (and skip the RPC).
    try { if (window.localStorage.getItem(SEEN_KEY)) { handled.current = true; return; } } catch { return; }

    // Don't interrupt the onboarding/auth flows themselves.
    if (EXCLUDE.some((p) => pathname.startsWith(p))) return;

    handled.current = true;
    (async () => {
      const st = await getOnboardingStatus();
      if (!st || !st.authenticated) { handled.current = false; return; } // let it retry once auth settles
      try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* storage blocked */ }
      if (!st.completedAt) router.replace("/welcome");
    })();
  }, [user, loading, pathname, router]);

  return null;
}
