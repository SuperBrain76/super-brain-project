"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { saveResult } from "@/lib/results";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getRankingColor } from "@/lib/scoring";
import { track } from "@/lib/analytics";
import FeedbackModal from "@/components/FeedbackModal";
import ChallengeShare from "@/components/ChallengeShare";
import { getUserRank } from "@/lib/leaderboard";
import { consumeChallengeId, loadChallengeResult } from "@/lib/challenge";
import {
  METRIC_META,
  PHASE_COLORS,
  PHASE_NAMES,
  type FocusMetrics,
  type PhaseResult,
} from "@/lib/focus-test";
import type { TestResult, ChallengeResult } from "@/types";

const METRIC_KEYS: (keyof FocusMetrics)[] = [
  "focusScore",
  "distractionResistance",
  "sustainedAttention",
  "recoverySpeed",
  "processingConsistency",
  "cognitiveEndurance",
];

interface Props {
  testResult:   TestResult;
  phaseResults: PhaseResult[];
  metrics:      FocusMetrics;
  onRetake:     () => void;
}

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-cockpit-muted text-[10px] uppercase tracking-widest font-mono">{label}</span>
      <div className="flex-1 h-px bg-cockpit-border" />
    </div>
  );
}

export default function FocusResults({ testResult, phaseResults, metrics, onRetake }: Props) {
  const { user, loading } = useAuth();

  const [saving,       setSaving]       = useState(false);
  const [shareId,      setShareId]      = useState<string | null>(null);
  const [saveErr,      setSaveErr]      = useState<string | null>(null);
  const [rank,         setRank]         = useState<number | null>(null);
  const [challenger,   setChallenger]   = useState<ChallengeResult | null>(null);
  const [animated,     setAnimated]     = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const hasSaved         = useRef(false);
  const completedTracked = useRef(false);
  const challengeShareId = useRef<string | null>(null);

  const score     = testResult.score;
  const topPct    = 100 - testResult.percentileEstimate;
  const accentColor = getRankingColor(score);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    challengeShareId.current = consumeChallengeId();
    if (challengeShareId.current) {
      loadChallengeResult(challengeShareId.current).then(setChallenger);
    }
    if (!completedTracked.current) {
      completedTracked.current = true;
      track.testCompleted(testResult.testName, testResult.score);
    }
    const t = setTimeout(() => setShowFeedback(true), 3500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured || hasSaved.current) return;
    hasSaved.current = true;
    setSaving(true);
    saveResult(testResult, user.id).then(({ shareId: sid, error }) => {
      setSaving(false);
      if (error) { setSaveErr(error); return; }
      setShareId(sid);
      if (sid) getUserRank(testResult.testName, testResult.score).then(setRank);
    });
  }, [user, loading, testResult]);

  return (
    <>
      {showFeedback && (
        <FeedbackModal
          testName={testResult.testName}
          score={testResult.score}
          resultTitle={testResult.resultTitle}
          userId={user?.id ?? null}
          onClose={() => setShowFeedback(false)}
        />
      )}

      <div className="w-full max-w-2xl mx-auto flex flex-col gap-8 module-enter pb-16">

        {/* ── Score hero ──────────────────────────────────────────────────────── */}
        <div
          className="relative bg-cockpit-card border rounded-sm overflow-hidden"
          style={{ borderColor: `${accentColor}40` }}
        >
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accentColor}0d 0%, transparent 65%)` }}
          />
          <div className="relative px-6 pt-10 pb-8 text-center">
            <p className="text-[10px] uppercase tracking-widest font-mono mb-3"
              style={{ color: `${accentColor}aa` }}>
              Focus &amp; Attention Test
            </p>
            <div
              className="text-4xl sm:text-5xl font-extrabold mb-3"
              style={{ color: accentColor, textShadow: `0 0 40px ${accentColor}30` }}
            >
              {testResult.resultTitle}
            </div>
            <div className="mb-6">
              <span
                className="inline-block text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-sm border"
                style={{ borderColor: `${accentColor}40`, color: accentColor, background: `${accentColor}12` }}
              >
                Top {topPct}% of test-takers
              </span>
            </div>
            <div className="flex items-end justify-center gap-2 mb-3">
              <span
                className="text-7xl font-extrabold number-display tabular-nums"
                style={{ color: accentColor, textShadow: `0 0 30px ${accentColor}50` }}
              >
                {score}
              </span>
              <span className="text-cockpit-muted text-2xl font-bold mb-2">/100</span>
            </div>
            <p className="text-cockpit-dim text-sm leading-relaxed max-w-sm mx-auto">
              {testResult.resultDescription}
            </p>
          </div>
        </div>

        {/* ── Phase breakdown ──────────────────────────────────────────────────── */}
        <div>
          <SectionHeading label="Phase Breakdown" />
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {phaseResults.map((p, i) => {
              const c = PHASE_COLORS[i];
              return (
                <div
                  key={p.phase}
                  className="bg-cockpit-card border border-cockpit-border rounded-sm px-3 py-4 flex flex-col gap-2"
                  style={{ borderColor: `${c}30` }}
                >
                  <div className="flex sm:flex-col items-center sm:items-start justify-between gap-2">
                    <p className="text-[10px] font-mono text-cockpit-muted uppercase tracking-wider">
                      P{i + 1}
                    </p>
                    <span className="text-sm font-extrabold number-display" style={{ color: c }}>
                      {p.score}
                    </span>
                  </div>
                  <p className="text-[10px] text-cockpit-dim leading-tight hidden sm:block">
                    {PHASE_NAMES[i]}
                  </p>
                  <p className="text-cockpit-dim text-xs sm:hidden">{PHASE_NAMES[i]}</p>
                  <div className="h-1 bg-cockpit-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:           animated ? `${p.score}%` : "0%",
                        background:      c,
                        transition:      "width 0.8s cubic-bezier(0.16,1,0.3,1)",
                        transitionDelay: `${i * 80}ms`,
                      }}
                    />
                  </div>
                  {p.streakMax > 0 && (
                    <p className="text-[10px] text-cockpit-muted">
                      Best ×{p.streakMax >= 15 ? "2.5" : p.streakMax >= 7 ? "2.0" : p.streakMax >= 3 ? "1.5" : "1.0"} streak
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Cognitive metrics ────────────────────────────────────────────────── */}
        <div>
          <SectionHeading label="Cognitive Metrics" />
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-5">
            {METRIC_KEYS.map((key, i) => {
              const meta  = METRIC_META[key];
              const value = Math.round(metrics[key]);
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white text-sm font-medium">{meta.label}</span>
                      <p className="text-cockpit-muted text-[10px] mt-0.5 hidden sm:block">
                        {meta.description}
                      </p>
                    </div>
                    <span
                      className="text-sm font-bold number-display tabular-nums ml-4 shrink-0"
                      style={{ color: accentColor }}
                    >
                      {value}
                    </span>
                  </div>
                  <div className="h-1.5 bg-cockpit-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:           animated ? `${value}%` : "0%",
                        background:      `linear-gradient(90deg, ${accentColor}70, ${accentColor})`,
                        transition:      "width 0.85s cubic-bezier(0.16,1,0.3,1)",
                        transitionDelay: `${i * 60}ms`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-cockpit-muted">
                    <span>← {meta.low}</span>
                    <span>{meta.high} →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Save / challenge ──────────────────────────────────────────────────── */}
        <div
          className="bg-cockpit-card border rounded-sm p-6"
          style={{ borderColor: shareId ? "#00e67630" : "var(--border,#1e2a38)" }}
        >
          <ChallengeShare
            testName={testResult.testName}
            score={testResult.score}
            resultTitle={testResult.resultTitle}
            shareId={shareId}
            saving={saving}
            saveErr={saveErr}
            user={user}
            authLoading={loading}
            challenger={challenger}
            rank={rank}
          />
        </div>

        {/* ── Nav ──────────────────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            onClick={() => { track.retryClicked(testResult.testName); onRetake(); }}
            className="flex-1 btn-ghost flex items-center justify-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
            </svg>
            Retry
          </button>
          <Link href="/tests" className="flex-1 btn-ghost flex items-center justify-center">
            All Tests →
          </Link>
        </div>
      </div>
    </>
  );
}
