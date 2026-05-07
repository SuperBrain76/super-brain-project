"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { saveResult } from "@/lib/results";
import { getRankingColor } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getUserRank } from "@/lib/leaderboard";
import { consumeChallengeId, loadChallengeResult } from "@/lib/challenge";
import ChallengeShare from "@/components/ChallengeShare";
import type { TestResult, ChallengeResult } from "@/types";

interface Props {
  result: TestResult;
  onRetake?: () => void;
}

export default function ResultSummary({ result, onRetake }: Props) {
  const { user, loading } = useAuth();

  const [saving,     setSaving]     = useState(false);
  const [shareId,    setShareId]    = useState<string | null>(null);
  const [saveErr,    setSaveErr]    = useState<string | null>(null);
  const [rank,       setRank]       = useState<number | null>(null);
  const [challenger, setChallenger] = useState<ChallengeResult | null>(null);

  const hasSaved          = useRef(false);
  const challengeShareId  = useRef<string | null>(null);

  // Consume challenge context once on mount (before any renders read it)
  useEffect(() => {
    challengeShareId.current = consumeChallengeId();
    if (challengeShareId.current) {
      loadChallengeResult(challengeShareId.current).then(setChallenger);
    }
  }, []);

  // Auto-save once auth state is known
  useEffect(() => {
    if (loading)               return;
    if (!user)                 return;
    if (!isSupabaseConfigured) return;
    if (hasSaved.current)      return;
    hasSaved.current = true;

    setSaving(true);
    saveResult(result, user.id).then(({ shareId: sid, error }) => {
      setSaving(false);
      if (error) { setSaveErr(error); return; }
      setShareId(sid);
      if (sid) getUserRank(result.testName, result.score).then(setRank);
    });
  }, [user, loading, result]);

  const color  = getRankingColor(result.score);
  const topPct = 100 - result.percentileEstimate;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-5 module-enter">

      {/* ── Identity card ──────────────────────────────────────── */}
      <div
        className="relative bg-cockpit-card border rounded-sm overflow-hidden"
        style={{ borderColor: `${color}50` }}
      >
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${color}0d 0%, transparent 70%)` }}
        />

        <div className="relative px-6 pt-10 pb-8 text-center">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-6 font-mono">
            {result.testName}
          </p>

          <div
            className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 leading-none"
            style={{ color, textShadow: `0 0 60px ${color}40` }}
          >
            {result.resultTitle}
          </div>

          <div className="mb-8">
            <span
              className="inline-block text-sm font-semibold tracking-widest uppercase px-4 py-1.5 rounded-sm border"
              style={{ borderColor: `${color}40`, color, background: `${color}12` }}
            >
              Top {topPct}% of test-takers
            </span>
          </div>

          <div className="flex items-end justify-center gap-2 mb-2">
            <span
              className="text-7xl font-extrabold number-display tabular-nums"
              style={{ color, textShadow: `0 0 30px ${color}50` }}
            >
              {result.score}
            </span>
            <span className="text-cockpit-muted text-2xl font-bold mb-2">/100</span>
          </div>

          <p className="text-cockpit-dim text-sm leading-relaxed max-w-xs mx-auto mt-4">
            {result.resultDescription}
          </p>
        </div>
      </div>

      {/* ── Challenge / save block ─────────────────────────────── */}
      <div
        className="bg-cockpit-card border rounded-sm p-6"
        style={{ borderColor: shareId ? "#00e67630" : "var(--border, #1e2a38)" }}
      >
        <ChallengeShare
          testName={result.testName}
          score={result.score}
          resultTitle={result.resultTitle}
          shareId={shareId}
          saving={saving}
          saveErr={saveErr}
          user={user}
          authLoading={loading}
          challenger={challenger}
          rank={rank}
        />
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <div className="flex gap-3">
        {onRetake && (
          <button
            onClick={onRetake}
            className="flex-1 btn-ghost flex items-center justify-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
            Retake
          </button>
        )}
        <Link href="/tests" className="flex-1 btn-ghost flex items-center justify-center">
          All Tests →
        </Link>
      </div>
    </div>
  );
}
