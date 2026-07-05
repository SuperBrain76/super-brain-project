"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

// ============================================================================
// Once per day, on a signed-in user's first *neutral* app visit, send them to
// their /iq dashboard — so IQ is the thing they see first each day.
//
// Deliberately non-annoying:
//   • Only fires from the bare home route ("/"). Deep links, notification
//     links and active prediction/battle/test flows all live on other routes,
//     so they're never interrupted.
//   • Skips when the URL carries any query string (?ref=, ?utm_source=push,
//     campaign/notification params, etc.) — those are intentional entries.
//   • Runs at most once per calendar day (persisted in localStorage), and
//     never fights the user: after it fires, they can navigate anywhere freely.
// ============================================================================

const KEY = "sb:dailyHomeRedirect";

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (local-ish, stable per day)
}

export default function DailyHomeRedirect() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const doneThisMount = useRef(false);

  useEffect(() => {
    if (doneThisMount.current) return;
    if (loading || !user) return;
    if (pathname !== "/") return;                       // only the neutral home
    if (typeof window === "undefined") return;
    if (window.location.search) return;                 // deep link / notification / campaign entry

    let last: string | null = null;
    try { last = window.localStorage.getItem(KEY); } catch { return; }
    if (last === today()) return;                       // already sent home today

    doneThisMount.current = true;
    try { window.localStorage.setItem(KEY, today()); } catch { /* storage blocked — still redirect once */ }
    router.replace("/iq");
  }, [user, loading, pathname, router]);

  return null;
}
