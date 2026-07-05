"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BRAND, MATERIAL } from "@/lib/brand";

export default function SignUpNudge() {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (loading || user || dismissed) return null;

  return (
    <div className="relative mb-6 rounded-2xl overflow-hidden"
      style={{ background: MATERIAL.raise, border: `0.5px solid ${BRAND.hairline}` }}>
      {/* Soft gold glow — the reward on offer */}
      <div className="absolute -top-10 -left-6 w-40 h-28 pointer-events-none" style={{ background: MATERIAL.goldGlow }} />

      <div className="relative flex items-center gap-4 px-4 py-3.5">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(232,193,90,0.10)", border: `0.5px solid ${MATERIAL.ringFaint}` }}>
          <span className="text-base">🏆</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: BRAND.ink }}>
            Rank on the global leaderboard
          </p>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: BRAND.muted }}>
            Sign in free — scores are saved, streaks tracked, Elo battles unlocked
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/login"
            className="text-xs font-bold px-3.5 py-1.5 rounded-full transition-transform active:scale-95"
            style={{ background: BRAND.ink, color: BRAND.black }}>
            Sign in
          </Link>
          <button onClick={() => setDismissed(true)}
            className="transition-colors p-1" style={{ color: BRAND.dim }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
