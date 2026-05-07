"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { loadSession } from "@/lib/storage";
import { saveResult } from "@/lib/results";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getUserRank } from "@/lib/leaderboard";
import { consumeChallengeId, loadChallengeResult } from "@/lib/challenge";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";
import ResultCard from "@/components/ResultCard";
import ChallengeShare from "@/components/ChallengeShare";
import type { TestSession, TestResult, ChallengeResult } from "@/types";

export default function ResultsPage() {
  const { user, loading } = useAuth();

  const [session,    setSession]    = useState<TestSession | null>(null);
  const [pageLoad,   setPageLoad]   = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [shareId,    setShareId]    = useState<string | null>(null);
  const [saveErr,    setSaveErr]    = useState<string | null>(null);
  const [rank,       setRank]       = useState<number | null>(null);
  const [challenger, setChallenger] = useState<ChallengeResult | null>(null);

  const hasSaved         = useRef(false);
  const challengeShareId = useRef<string | null>(null);

  // Load session from storage and consume any pending challenge context
  useEffect(() => {
    setSession(loadSession());
    setPageLoad(false);
    challengeShareId.current = consumeChallengeId();
    if (challengeShareId.current) {
      loadChallengeResult(challengeShareId.current).then(setChallenger);
    }
  }, []);

  const testResult = useMemo<TestResult | null>(() => session
    ? {
        testId:             "fighter-pilot",
        testName:           "Fighter Pilot Cognitive Test",
        score:              session.totalScore,
        percentileEstimate: scoreToPercentile(session.totalScore),
        resultTitle:        getResultTitle("fighter-pilot", session.totalScore),
        resultDescription:  getResultDescription("fighter-pilot", session.totalScore),
        rawMetrics:         { modules: session.modules.length },
        createdAt:          new Date(session.completedAt).toISOString(),
      }
    : null, [session]);

  // Auto-save once auth state and result are both ready
  useEffect(() => {
    if (loading || !testResult || !user) return;
    if (!isSupabaseConfigured)  return;
    if (hasSaved.current)       return;
    hasSaved.current = true;

    setSaving(true);
    saveResult(testResult, user.id).then(({ shareId: sid, error }) => {
      setSaving(false);
      if (error) { setSaveErr(error); return; }
      setShareId(sid);
      if (sid) getUserRank(testResult.testName, testResult.score).then(setRank);
    });
  }, [user, loading, testResult]);

  if (pageLoad) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading results…</p>
      </div>
    );
  }

  if (!session || !testResult) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-6">
        <p className="text-cockpit-dim text-lg">No completed assessment found.</p>
        <Link href="/test"><button className="btn-primary">Start Assessment</button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-5 py-12">

        <div className="mb-8 text-center">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">Assessment Complete</p>
          <h1 className="text-3xl font-bold text-white">Your Results</h1>
        </div>

        <ResultCard session={session} />

        {/* ── Challenge / save block ──────────────────────────── */}
        <div
          className="mt-6 bg-cockpit-card border rounded-sm p-6"
          style={{ borderColor: shareId ? "#00e67630" : "#1e2a38" }}
        >
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-4 font-mono">
            Save &amp; Challenge
          </p>
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

        {/* Nav */}
        <div className="mt-4 flex gap-3">
          <Link href="/tests" className="flex-1 btn-ghost text-center flex items-center justify-center">
            All Tests
          </Link>
          <Link href="/test" className="flex-1 btn-ghost text-center flex items-center justify-center">
            Retake
          </Link>
        </div>
      </div>
    </div>
  );
}
