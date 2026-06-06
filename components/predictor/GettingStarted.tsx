"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "sb_predict_onboarding_dismissed";

interface Props {
  userId:        string | null;
  predictions:   number;
  bonusAnswered: number;
  bonusTotal:    number;
  onDismiss?:    () => void;
}

// ── Step list ─────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { n: 1, label: "Predict every match" },
  { n: 2, label: "Answer bonus questions" },
  { n: 3, label: "Create or join leagues" },
  { n: 4, label: "Climb the rankings" },
  { n: 5, label: "Win the SB Championship Watch" },
];

// ── Main component ────────────────────────────────────────────

export default function GettingStarted({ userId, predictions, bonusAnswered, bonusTotal, onDismiss }: Props) {
  const [visible,       setVisible]       = useState(false);
  const [inLeague,      setInLeague]      = useState(false);
  const [leagueChecked, setLeagueChecked] = useState(false);

  // Only show if not dismissed AND user has 0 predictions (or hasn't dismissed)
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  // Check league membership
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

  // Show when: visible AND (0 predictions OR not dismissed)
  if (!visible) return null;
  // Hide once user has predictions — they're no longer "new"
  if (predictions > 0) return null;

  const hasPredictions = predictions > 0;
  const hasBonus       = bonusTotal > 0 && bonusAnswered > 0;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#fff", borderColor: "#dde5d8" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: "#1a3a2a", borderBottom: "1px solid #234d39" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded flex items-center justify-center shrink-0"
            style={{ background: "#b8972a" }}
          >
            <span style={{ color: "#1a3a2a", fontWeight: 900, fontSize: 9, letterSpacing: "-0.5px" }}>SB</span>
          </div>
          <p className="text-white text-sm font-bold leading-tight">
            How to Play
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-4 flex flex-col gap-4">

        {/* 5-step list */}
        <div className="flex flex-col gap-2">
          {HOW_IT_WORKS.map((s) => {
            // Auto-tick steps based on user progress
            const done =
              (s.n === 1 && hasPredictions) ||
              (s.n === 2 && hasBonus)        ||
              (s.n === 3 && leagueChecked && inLeague);

            return (
              <div key={s.n} className="flex items-center gap-3">
                {/* Step number / tick */}
                <div
                  className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={
                    done
                      ? { background: "#1a3a2a", color: "#fff" }
                      : { background: "#f0f3ef", color: "#7a8f82", border: "1px solid #dde5d8" }
                  }
                >
                  {done ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : s.n}
                </div>

                <span
                  className="text-sm"
                  style={{
                    color:          done ? "#7a8f82" : "#0f1f17",
                    textDecoration: done ? "line-through" : "none",
                    fontWeight:     s.n === 5 ? 600 : 400,
                  }}
                >
                  {s.label}
                  {s.n === 5 && (
                    <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#b8972a" }}>
                      ★ Grand Prize
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="#fixture-list"
            onClick={() => {
              document.getElementById("fixture-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg"
            style={{ background: "#1a3a2a", color: "#fff" }}
          >
            ⚽ Make your first prediction
          </Link>
          <button
            onClick={handleDismiss}
            className="text-xs"
            style={{ color: "#7a8f82" }}
          >
            Dismiss
          </button>
        </div>

      </div>
    </div>
  );
}
