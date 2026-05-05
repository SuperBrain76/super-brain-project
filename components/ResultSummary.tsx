"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { saveResult } from "@/lib/results";
import { getRankingColor } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { TestResult } from "@/types";

interface Props {
  result: TestResult;
  onRetake?: () => void;
}

export default function ResultSummary({ result, onRetake }: Props) {
  const { user } = useAuth();
  const [saving, setSaving]     = useState(false);
  const [shareId, setShareId]   = useState<string | null>(null);
  const [saveError, setSaveErr] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  const color       = getRankingColor(result.score);
  const percentileTop = 100 - result.percentileEstimate;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveErr(null);
    const { shareId: sid, error } = await saveResult(result, user.id);
    setSaving(false);
    if (error) { setSaveErr(error); return; }
    setShareId(sid);
  };

  const shareUrl = shareId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareId}`
    : null;

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-5 module-enter">
      {/* ── Identity card ──────────────────────────────────────────────── */}
      <div
        className="relative bg-cockpit-card border rounded-sm overflow-hidden"
        style={{ borderColor: `${color}50` }}
      >
        {/* Top glow line */}
        <div
          className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
        />

        {/* Background ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${color}0d 0%, transparent 70%)`,
          }}
        />

        <div className="relative px-6 pt-10 pb-8 text-center">
          {/* Test label */}
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-6 font-mono">
            {result.testName}
          </p>

          {/* Identity title — the hero element */}
          <div
            className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3 leading-none"
            style={{ color, textShadow: `0 0 60px ${color}40` }}
          >
            {result.resultTitle}
          </div>

          {/* Percentile badge */}
          <div className="mb-8">
            <span
              className="inline-block text-sm font-semibold tracking-widest uppercase px-4 py-1.5 rounded-sm border"
              style={{ borderColor: `${color}40`, color, background: `${color}12` }}
            >
              Top {percentileTop}% of test-takers
            </span>
          </div>

          {/* Score — secondary but still prominent */}
          <div className="flex items-end justify-center gap-2 mb-2">
            <span
              className="text-7xl font-extrabold number-display tabular-nums"
              style={{ color, textShadow: `0 0 30px ${color}50` }}
            >
              {result.score}
            </span>
            <span className="text-cockpit-muted text-2xl font-bold mb-2">/100</span>
          </div>

          {/* Description */}
          <p className="text-cockpit-dim text-sm leading-relaxed max-w-xs mx-auto mt-4">
            {result.resultDescription}
          </p>
        </div>

        {/* Raw metrics strip */}
        {Object.keys(result.rawMetrics).length > 0 && (
          <div className="border-t border-cockpit-border px-6 py-4 flex flex-wrap gap-6 justify-center">
            {Object.entries(result.rawMetrics).map(([k, v]) => (
              <div key={k} className="text-center">
                <div className="text-cockpit-accent number-display font-semibold text-sm">{String(v)}</div>
                <div className="text-cockpit-muted text-xs mt-0.5 capitalize">{k.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Save / Share ───────────────────────────────────────────────── */}
      {shareId ? (
        /* Already saved — show share link prominently */
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-4">
          <div className="text-center">
            <p className="text-cockpit-green text-sm font-semibold flex items-center justify-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved to your profile
            </p>
            <p className="text-cockpit-muted text-xs">Share your result and see if anyone can beat you.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl ?? ""}
              className="flex-1 text-xs font-mono"
            />
            <button
              onClick={copyLink}
              className="shrink-0 btn-primary text-xs px-4 py-2"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>
      ) : user ? (
        /* Logged in — offer to save */
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-3">
          <p className="text-cockpit-dim text-sm">
            Save to your profile and get a link to challenge others.
          </p>
          {saveError && <p className="text-cockpit-red text-xs">{saveError}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full justify-center flex items-center gap-2 text-base py-3"
          >
            {saving ? "Saving…" : "Save & Share →"}
          </button>
        </div>
      ) : isSupabaseConfigured ? (
        /* Not logged in — create account CTA */
        <div
          className="bg-cockpit-card border rounded-sm p-6 flex flex-col gap-4 text-center"
          style={{ borderColor: `${color}30` }}
        >
          <div>
            <p className="text-white font-semibold mb-1">Lock in your result</p>
            <p className="text-cockpit-dim text-sm">
              Create a free account to save this score and share it publicly.
            </p>
          </div>
          <Link
            href="/login"
            className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
          >
            Create Free Account →
          </Link>
          <p className="text-cockpit-muted text-xs">No credit card. No spam. Just your results.</p>
        </div>
      ) : (
        /* Supabase not configured */
        <p className="text-cockpit-muted text-xs text-center py-2">
          Result saved locally. Connect Supabase to enable cloud save & sharing.
        </p>
      )}

      {/* ── Nav actions ────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        {onRetake && (
          <button
            onClick={onRetake}
            className="flex-1 btn-ghost flex items-center justify-center gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
            Retake
          </button>
        )}
        <Link href="/tests" className="flex-1 btn-ghost flex items-center justify-center gap-2">
          All Tests →
        </Link>
      </div>
    </div>
  );
}
