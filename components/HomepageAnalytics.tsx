"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Zero-UI client component that fires homepage_view once on mount.
 * Kept separate so app/page.tsx stays a server component.
 * No props — importing the tracking function here avoids the
 * "cannot pass functions to Client Components" error.
 */
export default function HomepageAnalytics() {
  useEffect(() => {
    track.homepageView();
  }, []);
  return null;
}
