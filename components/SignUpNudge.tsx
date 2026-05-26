"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function SignUpNudge() {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (loading || user || dismissed) return null;

  return (
    <div className="relative mb-6 rounded-sm overflow-hidden border border-cockpit-accent/20"
      style={{ background: "linear-gradient(135deg, #00d4ff08 0%, #a855f708 100%)" }}>
      {/* Left accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cockpit-accent to-transparent" />

      <div className="flex items-center gap-4 px-4 py-3.5">
        <div className="shrink-0 w-9 h-9 rounded-full bg-cockpit-accent/10 border border-cockpit-accent/30
          flex items-center justify-center">
          <span className="text-base">🏆</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">
            Rank on the global leaderboard
          </p>
          <p className="text-cockpit-muted text-xs mt-0.5 leading-snug">
            Sign in free — scores are saved, streaks tracked, Elo battles unlocked
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/login"
            className="text-xs font-bold px-3 py-1.5 rounded-sm transition-all active:scale-95"
            style={{ background: "#00d4ff", color: "#0d1117" }}>
            Sign in
          </Link>
          <button onClick={() => setDismissed(true)}
            className="text-cockpit-border hover:text-cockpit-muted transition-colors p-1">
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
