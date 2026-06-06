"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "sb_predict_onboarding_dismissed";

interface Props {
  userId:        string | null;
  predictions:   number;        // from MyStats
  bonusAnswered: number;        // from MyStats
  bonusTotal:    number;        // from MyStats
  /** Called after dismiss so parent can hide without remounting */
  onDismiss?: () => void;
}

// ── Checklist item ────────────────────────────────────────────

function CheckItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-4 h-4 rounded-sm shrink-0 flex items-center justify-center transition-colors"
        style={{
          background:   done ? "#00e67618" : "transparent",
          border:       `1px solid ${done ? "#00e67650" : "#2a3a4a"}`,
        }}
      >
        {done && (
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <polyline points="2 6 5 9 10 3" stroke="#00e676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span
        className="text-sm leading-snug"
        style={{ color: done ? "#4a6a7a" : "#a8b8cc", textDecoration: done ? "line-through" : "none" }}
      >
        {children}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function GettingStarted({ userId, predictions, bonusAnswered, bonusTotal, onDismiss }: Props) {
  const [visible,       setVisible]       = useState(false);
  const [inLeague,      setInLeague]      = useState(false);
  const [leagueChecked, setLeagueChecked] = useState(false);

  // Only show if not dismissed
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  // Check league membership once — cheap count query
  useEffect(() => {
    if (!userId || !visible) return;
    supabase
      .from("prediction_league_members")
      .select("league_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(({ count }) => {
        setInLeague((count ?? 0) > 0);
        setLeagueChecked(true);
      });
  }, [userId, visible]);

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* private mode */ }
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  const hasPredictions  = predictions > 0;
  const hasBonus        = bonusTotal > 0 && bonusAnswered > 0;
  const isNewUser       = !hasPredictions;

  // Steps for the explainer
  const steps = [
    { icon: "⚽", label: "Predict every World Cup match" },
    { icon: "🏆", label: "Answer bonus questions for extra points" },
    { icon: "👥", label: "Create or join a prediction league" },
    { icon: "📲", label: "Invite friends via WhatsApp or link" },
    { icon: "📈", label: "Climb the global leaderboard" },
    { icon: "⌚", label: "Compete for the SB Champion Watch" },
  ];

  return (
    <div
      className="rounded-sm border overflow-hidden"
      style={{ background: "#080d14", borderColor: "#1a2a3a" }}
    >
      {/* Header row */}
      <div
        className="flex items-start justify-between gap-3 px-4 pt-4 pb-3"
        style={{ borderBottom: "1px solid #1a2a3a" }}
      >
        <div className="flex items-center gap-2.5">
          {/* SB mark */}
          <div
            className="w-7 h-7 rounded-sm shrink-0 flex items-center justify-center"
            style={{ background: "#00d4ff", flexShrink: 0 }}
          >
            <span style={{ color: "#080b0f", fontWeight: 900, fontSize: 11 }}>SB</span>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">
              Welcome to the SuperBrain World Cup Predictor
            </p>
            <p className="text-cockpit-muted text-[11px] mt-0.5">
              Predict every match · earn points · win the Watch
            </p>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 mt-0.5 text-cockpit-muted hover:text-cockpit-dim transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-3">

        {/* How it works — steps */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm leading-none shrink-0">{s.icon}</span>
              <span className="text-cockpit-dim text-[11px] leading-snug">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Checklist — only shown for users with 0 predictions */}
        {isNewUser && userId && (
          <div
            className="flex flex-col gap-2 px-3 py-3 rounded-sm"
            style={{ background: "#0d1622", border: "1px solid #1a2a3a" }}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-cockpit-muted mb-0.5">
              Getting started
            </p>
            <CheckItem done={hasPredictions}>Make your first prediction</CheckItem>
            <CheckItem done={hasBonus}>
              {bonusTotal > 0
                ? `Complete bonus questions (${bonusAnswered}/${bonusTotal})`
                : "Complete bonus questions"}
            </CheckItem>
            <CheckItem done={leagueChecked && inLeague}>Join or create a league</CheckItem>
            <CheckItem done={leagueChecked && inLeague}>
              Invite a friend to your league
            </CheckItem>
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="#fixtures"
            onClick={() => {
              // Smooth-scroll to the tab/fixture list
              document.getElementById("fixture-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-sm transition-colors"
            style={{
              background: "#00d4ff",
              color:      "#080b0f",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 8 16 12 12 16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Make Your First Prediction
          </Link>

          <button
            onClick={handleDismiss}
            className="text-[11px] text-cockpit-muted hover:text-cockpit-dim transition-colors"
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
}
