"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import { useIsCompetitionRoute } from "@/components/CompetitionProvider";

// Hide footer on active test/game routes — they need every pixel for the game UI
const HIDE_ON = [
  "/tests/reaction",
  "/tests/stroop",
  "/tests/tap-speed",
  "/tests/verbal-memory",
  "/tests/memory",
  "/tests/pressure",
  "/tests/focus",
  "/tests/career-profile",
  "/tests/matrix",
  "/test",     // fighter pilot test
  "/battle",   // battle room (all battle routes)
  "/predict",  // legacy predictor prefix (redirect route)
  "/prototype", // playable prototypes — full-screen, no marketing footer
];

export default function ConditionalFooter() {
  const pathname = usePathname();
  // Competition Engine V2: predictor routes are now /premier-league,
  // /la-liga, /wc2026 — a static prefix list can no longer recognise them,
  // so ask the competition hook instead.
  const isCompetition = useIsCompetitionRoute();

  if (isCompetition) return null;
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;
  return <Footer />;
}
