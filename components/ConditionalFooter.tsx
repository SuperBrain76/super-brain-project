"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

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
  "/test", // fighter pilot test
];

export default function ConditionalFooter() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;
  return <Footer />;
}
