"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { applyReplayPolicy, initPostHog, trackPageView } from "@/lib/analytics";

// Needs Suspense because useSearchParams() opts into dynamic rendering
function PageViewTracker() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Re-apply BEFORE the pageview, so navigating into /login or /settings stops
    // replay on entry rather than after the first frame of the page is captured.
    applyReplayPolicy(pathname);
    trackPageView();
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { initPostHog(); }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </>
  );
}
