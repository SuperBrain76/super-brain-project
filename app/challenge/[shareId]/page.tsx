"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { loadChallengeResult, storeChallengeId } from "@/lib/challenge";
import { getRankingColor } from "@/lib/scoring";
import { isSupabaseConfigured } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import type { ChallengeResult } from "@/types";

// Map test names to their start route
function testHref(testName: string): string {
  const lower = testName.toLowerCase();
  if (lower.includes("reaction"))      return "/tests/reaction";
  if (lower.includes("pressure"))      return "/tests/pressure";
  if (lower.includes("memory"))        return "/tests/memory";
  if (lower.includes("fighter pilot")) return "/test";
  return "/tests";
}

export default function ChallengePage() {
  const params  = useParams();
  const router  = useRouter();
  const shareId = typeof params.shareId === "string" ? params.shareId : "";

  const [result,  setResult]  = useState<ChallengeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shareId) return;
    loadChallengeResult(shareId).then((r) => {
      setResult(r);
      setLoading(false);
      if (r) track.challengeOpened(r.testName);
    });
  }, [shareId]);

  const acceptChallenge = () => {
    if (!result) return;
    track.challengeAccepted(result.testName);
    storeChallengeId(shareId);
    router.push(testHref(result.testName));
  };

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen hud-grid flex items-center justify-center">
        <p className="text-cockpit-dim text-sm animate-pulse">Loading challenge…</p>
      </div>
    );
  }

  // ── Supabase not configured ─────────────────────────────────
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-cockpit-dim">Challenge links require Supabase. Add your environment variables to enable this feature.</p>
        <Link href="/tests"><button className="btn-primary">Take a Test</button></Link>
      </div>
    );
  }

  // ── Not found ───────────────────────────────────────────────
  if (!result) {
    return (
      <div className="min-h-screen hud-grid flex flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-cockpit-dim text-lg">Challenge not found.</p>
        <p className="text-cockpit-muted text-sm">This link may have expired or the result was deleted.</p>
        <Link href="/tests"><button className="btn-primary">Take a Test</button></Link>
      </div>
    );
  }

  const color  = getRankingColor(result.score);
  const topPct = 100 - result.percentile;
  const href   = testHref(result.testName);

  return (
    <div className="min-h-screen hud-grid flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm module-enter flex flex-col gap-5">

        {/* ── Challenge header ─────────────────────────────── */}
        <div className="text-center">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-2 font-mono">
            You've been challenged
          </p>
          <h1 className="text-2xl font-extrabold text-white leading-tight">
            {result.displayName} is challenging you
          </h1>
          <p className="text-cockpit-dim text-sm mt-1">
            Can you beat their score?
          </p>
        </div>

        {/* ── Challenger result card ────────────────────────── */}
        <div
          className="relative bg-cockpit-card border rounded-sm overflow-hidden"
          style={{ borderColor: `${color}50` }}
        >
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${color}0d 0%, transparent 70%)` }}
          />

          <div className="relative px-6 pt-9 pb-7 text-center">
            <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-5 font-mono">
              {result.testName}
            </p>

            <div
              className="text-4xl font-extrabold tracking-tight mb-3 leading-none"
              style={{ color, textShadow: `0 0 50px ${color}40` }}
            >
              {result.resultTitle}
            </div>

            <div className="mb-7">
              <span
                className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-sm border"
                style={{ borderColor: `${color}40`, color, background: `${color}12` }}
              >
                Top {topPct}% of test-takers
              </span>
            </div>

            <div className="flex items-end justify-center gap-2">
              <span
                className="text-7xl font-extrabold number-display tabular-nums"
                style={{ color, textShadow: `0 0 30px ${color}50` }}
              >
                {result.score}
              </span>
              <span className="text-cockpit-muted text-xl font-bold mb-2">/100</span>
            </div>

            {result.country && (
              <p className="text-cockpit-muted text-xs mt-3">{result.country}</p>
            )}
          </div>

          <div className="border-t border-cockpit-border px-5 py-3 text-center">
            <p className="text-cockpit-muted text-xs font-mono">
              Score set {new Date(result.createdAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* ── Accept challenge CTA ──────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 flex flex-col gap-3 text-center">
          <p className="text-white font-bold text-lg leading-tight">
            Think you can beat {result.score}/100?
          </p>
          <p className="text-cockpit-dim text-sm">
            Your result will be compared to {result.displayName}&apos;s score after you finish.
          </p>
          <button
            onClick={acceptChallenge}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base font-bold"
          >
            Accept Challenge →
          </button>
          <Link href={href} className="text-cockpit-muted text-xs hover:text-cockpit-dim transition-colors">
            Take test without challenge tracking
          </Link>
        </div>

        <p className="text-center text-cockpit-muted text-xs">
          Powered by <Link href="/" className="text-cockpit-accent hover:underline">SuperBrain</Link>
        </p>
      </div>
    </div>
  );
}
