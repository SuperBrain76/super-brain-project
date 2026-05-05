"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSharedResult } from "@/lib/results";
import { getRankingColor } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { SavedResult } from "@/types";

const TEST_HREFS: Record<string, string> = {
  "fighter-pilot": "/test",
  reaction:         "/tests/reaction",
  pressure:         "/tests/pressure",
  memory:           "/tests/memory",
};

export default function SharePage() {
  const params  = useParams();
  const shareId = typeof params.shareId === "string" ? params.shareId : "";
  const [result, setResult]   = useState<SavedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    if (!shareId) return;
    loadSharedResult(shareId).then((r) => { setResult(r); setLoading(false); });
  }, [shareId]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading result…</p>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-cockpit-dim">Share links require Supabase. Add your environment variables to enable this feature.</p>
        <Link href="/tests"><button className="btn-primary">Take a Test</button></Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-cockpit-dim text-lg">Result not found.</p>
        <p className="text-cockpit-muted text-sm">This link may have expired or the result was deleted.</p>
        <Link href="/tests"><button className="btn-primary">Take a Test</button></Link>
      </div>
    );
  }

  const color    = getRankingColor(result.score);
  const testHref = TEST_HREFS[result.testId] ?? "/tests";
  const topPct   = 100 - result.percentileEstimate;

  return (
    <div className="min-h-screen hud-grid flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm module-enter flex flex-col gap-5">

        {/* ── Result identity card ───────────────────────────────────────── */}
        <div
          className="relative bg-cockpit-card border rounded-sm overflow-hidden"
          style={{ borderColor: `${color}50` }}
        >
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${color}0d 0%, transparent 70%)`,
            }}
          />

          <div className="relative px-6 pt-9 pb-7 text-center">
            {/* Shared label */}
            <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-5 font-mono">
              {result.testName}
            </p>

            {/* Identity title — hero */}
            <div
              className="text-4xl font-extrabold tracking-tight mb-3 leading-none"
              style={{ color, textShadow: `0 0 50px ${color}40` }}
            >
              {result.resultTitle}
            </div>

            {/* Percentile badge */}
            <div className="mb-7">
              <span
                className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-sm border"
                style={{ borderColor: `${color}40`, color, background: `${color}12` }}
              >
                Top {topPct}% of test-takers
              </span>
            </div>

            {/* Score */}
            <div className="flex items-end justify-center gap-2 mb-3">
              <span
                className="text-7xl font-extrabold number-display tabular-nums"
                style={{ color, textShadow: `0 0 30px ${color}50` }}
              >
                {result.score}
              </span>
              <span className="text-cockpit-muted text-xl font-bold mb-2">/100</span>
            </div>

            {/* Description */}
            <p className="text-cockpit-dim text-sm leading-relaxed mt-2">
              {result.resultDescription}
            </p>
          </div>

          <div className="border-t border-cockpit-border px-5 py-3 text-center">
            <p className="text-cockpit-muted text-xs font-mono">
              {new Date(result.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* ── Challenge CTA ─────────────────────────────────────────────── */}
        <div
          className="bg-cockpit-card border rounded-sm p-5 text-center"
          style={{ borderColor: `${color}25` }}
        >
          <p className="text-white font-bold text-lg mb-1">Can you beat this?</p>
          <p className="text-cockpit-dim text-sm mb-4">
            Take the same test and see where you rank.
          </p>
          <Link
            href={testHref}
            className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
          >
            Take This Test →
          </Link>
        </div>

        {/* ── Copy link ─────────────────────────────────────────────────── */}
        <button
          onClick={copyLink}
          className="btn-ghost w-full flex items-center justify-center gap-2"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {copied ? "Copied!" : "Copy Share Link"}
        </button>

        {/* Footer link */}
        <p className="text-center text-cockpit-muted text-xs">
          Powered by{" "}
          <Link href="/" className="text-cockpit-accent hover:underline">SuperBrain</Link>
        </p>
      </div>
    </div>
  );
}
