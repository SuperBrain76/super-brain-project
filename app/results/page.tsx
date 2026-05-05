"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TestSession } from "@/types";
import { loadSession } from "@/lib/storage";
import { getRankingColor } from "@/lib/scoring";
import { saveResult } from "@/lib/results";
import { isSupabaseConfigured } from "@/lib/supabase";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";
import { useAuth } from "@/components/AuthProvider";
import ResultCard from "@/components/ResultCard";

export default function ResultsPage() {
  const { user } = useAuth();
  const [session, setSession]     = useState<TestSession | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [shareId, setShareId]     = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setLoading(false);
  }, []);

  const handleSave = async () => {
    if (!user || !session) return;
    setSaving(true); setSaveError(null);

    const { shareId: sid, error } = await saveResult(
      {
        testId:             "fighter-pilot",
        testName:           "Fighter Pilot Cognitive Test",
        score:              session.totalScore,
        percentileEstimate: scoreToPercentile(session.totalScore),
        resultTitle:        getResultTitle("fighter-pilot", session.totalScore),
        resultDescription:  getResultDescription("fighter-pilot", session.totalScore),
        rawMetrics:         { modules: session.modules.length },
        createdAt:          new Date(session.completedAt).toISOString(),
      },
      user.id,
    );

    setSaving(false);
    if (error) { setSaveError(error); return; }
    setShareId(sid);
  };

  const shareUrl = shareId ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareId}` : null;
  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <div className="text-cockpit-dim text-sm animate-pulse">Loading results…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-6">
        <p className="text-cockpit-dim text-lg">No completed assessment found.</p>
        <Link href="/test"><button className="btn-primary">Start Assessment</button></Link>
      </div>
    );
  }

  const rankColor = getRankingColor(session.totalScore);

  return (
    <div className="min-h-screen hud-grid">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8 text-center">
          <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-2">Assessment Complete</p>
          <h1 className="text-3xl font-bold text-white">Your Results</h1>
        </div>

        <ResultCard session={session} />

        {/* ── Save / Share ─────────────────────────────────────────────────── */}
        <div className="mt-8 bg-cockpit-card border border-cockpit-border rounded-sm p-6">
          <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-4">Save & Share</p>
          {shareId ? (
            <div className="flex flex-col gap-3">
              <p className="text-cockpit-green text-sm font-semibold flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Saved to your profile!
              </p>
              <div className="flex items-center gap-2">
                <input readOnly value={shareUrl ?? ""} className="flex-1 text-xs font-mono" />
                <button onClick={copyLink} className="shrink-0 btn-ghost text-xs px-3 py-2">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ) : user ? (
            <div className="flex flex-col gap-3">
              <p className="text-cockpit-dim text-sm">Save to your profile and generate a shareable link.</p>
              {saveError && <p className="text-cockpit-red text-xs">{saveError}</p>}
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? "Saving…" : "Save & Get Share Link"}
              </button>
            </div>
          ) : isSupabaseConfigured ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <p className="text-cockpit-dim text-sm flex-1">Create a free account to save this result permanently.</p>
              <Link href="/login"><button className="btn-primary shrink-0">Create Account</button></Link>
            </div>
          ) : (
            <p className="text-cockpit-muted text-xs">
              Connect Supabase to enable cloud save & sharing. See README for setup instructions.
            </p>
          )}
        </div>

        {/* Nav */}
        <div className="mt-6 flex gap-3">
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
