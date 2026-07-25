"use client";

import { useCompetitionSlug } from "@/components/CompetitionProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "sb_predict_onboarding_dismissed";

const GREEN  = "#1a3a2a";
const GOLD   = "#b8972a";
const MUTED  = "#7a8f82";
const BORDER = "#dde5d8";
const TEXT1  = "#0f1f17";
const TEXT2  = "#2e4a37";

interface Props {
  userId:        string | null;
  predictions:   number;
  bonusAnswered: number;
  bonusTotal:    number;
  hasProfile?:   boolean;  // true if user has set their display name
  onDismiss?:    () => void;
}

// ── Tick circle ───────────────────────────────────────────────
function Tick({ done }: { done: boolean }) {
  return (
    <div
      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
      style={
        done
          ? { background: GREEN, color: "#fff" }
          : { background: "#f0f3ef", color: MUTED, border: `1px solid ${BORDER}` }
      }
    >
      {done ? (
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <polyline points="2,5 4.5,7.5 8,3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : null}
    </div>
  );
}

export default function GettingStarted({ userId, predictions, bonusAnswered, bonusTotal, hasProfile, onDismiss }: Props) {
  const competitionSlug = useCompetitionSlug();
  const compHref = (sub = "") => (competitionSlug ? `/${competitionSlug}${sub}` : `/predict${sub}`);
  const [visible,       setVisible]       = useState(false);
  const [inLeague,      setInLeague]      = useState(false);
  const [leagueChecked, setLeagueChecked] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

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

  // Show when: visible AND user has fewer than 10 predictions
  if (!visible) return null;
  if (predictions >= 10) return null;

  // Step completion state
  const step1 = !!hasProfile || !!userId; // has profile set (or at least signed in)
  const step2 = predictions > 0;
  const step3 = leagueChecked && inLeague;
  const step4 = bonusTotal > 0 && bonusAnswered > 0;
  const step5 = predictions >= 10;

  const stepsCompleted = [step1, step2, step3, step4, step5].filter(Boolean).length;
  const pct = Math.round((stepsCompleted / 5) * 100);

  const steps = [
    {
      n:    1,
      href: "/settings/profile",
      label: "Complete Profile",
      done: step1,
    },
    {
      n:    2,
      href: "#fixture-list",
      label: "Predict World Cup Matches",
      done: step2,
    },
    {
      n:    3,
      href: compHref("/leagues"),
      label: "Join or Create a League",
      done: step3,
    },
    {
      n:    4,
      href: compHref("/bonus"),
      label: "Answer Bonus Questions",
      done: step4,
    },
    {
      n:    5,
      href: compHref("/leaderboard"),
      label: "Climb the Rankings",
      done: step5,
      gold: true,
    },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#fff", border: `1px solid ${BORDER}` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: GREEN, borderBottom: "1px solid #234d39" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded flex items-center justify-center shrink-0"
            style={{ background: GOLD }}
          >
            <span style={{ color: GREEN, fontWeight: 900, fontSize: 9, letterSpacing: "-0.5px" }}>SB</span>
          </div>
          <p className="text-white text-sm font-bold">Getting Started</p>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: `${GOLD}25`, color: GOLD }}
          >
            {stepsCompleted}/5
          </span>
        </div>
        <button onClick={handleDismiss} aria-label="Dismiss" style={{ color: "rgba(255,255,255,0.5)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1" style={{ background: "#e8ede6" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct === 100 ? GOLD : GREEN }}
        />
      </div>

      {/* Steps */}
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {steps.map((s) => (
          <Link
            key={s.n}
            href={s.href}
            onClick={s.href === "#fixture-list" ? (e) => {
              e.preventDefault();
              document.getElementById("fixture-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } : undefined}
            className="flex items-center gap-3 group"
          >
            <Tick done={s.done} />
            <span
              className="text-sm flex-1"
              style={{
                color:          s.done ? MUTED : TEXT1,
                textDecoration: s.done ? "line-through" : "none",
                fontWeight:     s.gold && !s.done ? 600 : 400,
              }}
            >
              {s.label}
              {s.gold && !s.done && (
                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                  ★ Grand Prize
                </span>
              )}
            </span>
            {!s.done && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </Link>
        ))}
      </div>

      {/* CTA */}
      <div className="px-4 pb-4 flex items-center gap-3">
        <Link
          href="#fixture-list"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("fixture-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg"
          style={{ background: GREEN, color: "#fff" }}
        >
          ⚽ {predictions === 0 ? "Make your first prediction" : "Keep predicting"}
        </Link>
        <button onClick={handleDismiss} className="text-xs" style={{ color: MUTED }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
