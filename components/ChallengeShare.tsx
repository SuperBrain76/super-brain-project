"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRankingColor } from "@/lib/scoring";
import type { AuthUser, ChallengeResult } from "@/types";

// ── Comparison card ────────────────────────────────────────────────────────────

function ComparisonCard({
  myScore,
  myTitle,
  challenger,
}: {
  myScore: number;
  myTitle: string;
  challenger: ChallengeResult;
}) {
  const diff    = myScore - challenger.score;
  const iWon    = diff > 0;
  const isTie   = diff === 0;
  const myColor = getRankingColor(myScore);
  const theirColor = getRankingColor(challenger.score);

  return (
    <div className={`rounded-sm border p-5 ${iWon ? "border-cockpit-green bg-cockpit-green bg-opacity-5" : isTie ? "border-cockpit-dim" : "border-cockpit-red bg-cockpit-red bg-opacity-5"}`}>
      <p className="text-xs tracking-widest uppercase font-mono mb-3" style={{ color: iWon ? "#00e676" : isTie ? "var(--dim)" : "#ff4040" }}>
        Challenge Result
      </p>

      <p className="text-white font-extrabold text-xl mb-4 leading-tight">
        {isTie
          ? "It's a tie! 🤝"
          : iWon
          ? `You beat ${challenger.displayName}! 🏆`
          : `${challenger.displayName} beat you by ${Math.abs(diff)} pts`}
      </p>

      {/* Score comparison bars */}
      <div className="flex flex-col gap-3">
        {/* Me */}
        <div className="flex items-center gap-3">
          <span className="text-cockpit-muted text-xs w-14 text-right font-mono shrink-0">You</span>
          <div className="flex-1 h-2 rounded-full bg-cockpit-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${myScore}%`, background: myColor }}
            />
          </div>
          <span className="font-extrabold number-display w-8 text-right text-sm shrink-0" style={{ color: myColor }}>
            {myScore}
          </span>
        </div>

        {/* Challenger */}
        <div className="flex items-center gap-3">
          <span className="text-cockpit-muted text-xs w-14 text-right font-mono shrink-0 truncate" title={challenger.displayName}>
            {challenger.displayName.slice(0, 6)}
          </span>
          <div className="flex-1 h-2 rounded-full bg-cockpit-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${challenger.score}%`, background: theirColor }}
            />
          </div>
          <span className="font-extrabold number-display w-8 text-right text-sm shrink-0" style={{ color: theirColor }}>
            {challenger.score}
          </span>
        </div>
      </div>

      {!isTie && (
        <p className="text-cockpit-muted text-xs mt-3 text-center">
          {iWon
            ? `${myTitle} vs ${challenger.resultTitle} — you're ahead by ${diff} pts`
            : `${Math.abs(diff)} pts between you and ${challenger.resultTitle}`}
        </p>
      )}
    </div>
  );
}

// ── Share buttons ──────────────────────────────────────────────────────────────

function ShareButtons({
  challengeUrl,
  testName,
  score,
}: {
  challengeUrl: string;
  testName: string;
  score: number;
}) {
  const [copied,         setCopied]         = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // Detect native share API after mount — avoids SSR/hydration mismatch
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const shareText = `I scored ${score}/100 on ${testName}. Think you can beat me?`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${challengeUrl}`)}`;

  const nativeShare = () => {
    navigator.share({ title: "SuperBrain Challenge", text: shareText, url: challengeUrl }).catch(() => {});
  };

  const copyLink = () => {
    navigator.clipboard.writeText(challengeUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* WhatsApp — primary CTA */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-sm font-semibold text-sm transition-all duration-150"
        style={{ background: "#25D366", color: "#fff" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Challenge on WhatsApp
      </a>

      {/* Native share (mobile) */}
      {canNativeShare && (
        <button
          onClick={nativeShare}
          className="btn-ghost w-full flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share Challenge
        </button>
      )}

      {/* Copy link */}
      <button
        onClick={copyLink}
        className="btn-ghost w-full flex items-center justify-center gap-2"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        {copied ? "Copied!" : "Copy Challenge Link"}
      </button>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

interface ChallengeShareProps {
  testName: string;
  score: number;
  resultTitle: string;
  shareId: string | null;
  saving: boolean;
  saveErr: string | null;
  user: AuthUser | null;
  authLoading: boolean;
  challenger: ChallengeResult | null;
  rank: number | null;
}

export default function ChallengeShare({
  testName,
  score,
  resultTitle,
  shareId,
  saving,
  saveErr,
  user,
  authLoading,
  challenger,
  rank,
}: ChallengeShareProps) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const challengeUrl = shareId && origin ? `${origin}/challenge/${shareId}` : null;

  // ── Auth loading ───────────────────────────────────────────
  if (authLoading) {
    return <p className="text-cockpit-muted text-xs text-center animate-pulse">Loading…</p>;
  }

  // ── Not logged in ──────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-white font-semibold text-sm">Save your result</p>
        <p className="text-cockpit-dim text-sm">
          Create a free account to keep your score, challenge friends, and climb the leaderboard.
        </p>
        <Link
          href="/login"
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          Sign in to save →
        </Link>
        <p className="text-cockpit-muted text-xs text-center">Free forever. No credit card.</p>
      </div>
    );
  }

  // ── Saving in progress ─────────────────────────────────────
  if (saving) {
    return (
      <p className="text-cockpit-dim text-sm animate-pulse flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cockpit-accent animate-ping" />
        Saving your result…
      </p>
    );
  }

  // ── Save error ─────────────────────────────────────────────
  if (saveErr) {
    return <p className="text-cockpit-red text-xs leading-relaxed">{saveErr}</p>;
  }

  // ── Saved — show challenge block ───────────────────────────
  if (shareId && challengeUrl) {
    return (
      <div className="flex flex-col gap-4">
        {/* Rank badge */}
        {rank !== null && (
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cockpit-accent">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <p className="text-cockpit-dim text-sm">
              Global rank <span className="text-white font-bold">#{rank}</span>
              <span className="text-cockpit-muted"> for {testName}</span>
            </p>
          </div>
        )}

        {/* Comparison if challenged */}
        {challenger && (
          <ComparisonCard myScore={score} myTitle={resultTitle} challenger={challenger} />
        )}

        {/* Challenge heading */}
        <div>
          <p className="text-white font-bold text-base">
            {challenger ? "Challenge someone else?" : "Can your friends beat this?"}
          </p>
          <p className="text-cockpit-dim text-xs mt-0.5">
            Share your challenge link — they see your score and race to beat it.
          </p>
        </div>

        <ShareButtons challengeUrl={challengeUrl} testName={testName} score={score} />

        {/* Leaderboard link */}
        <Link
          href="/leaderboard"
          className="text-cockpit-muted text-xs text-center hover:text-cockpit-accent transition-colors"
        >
          View global leaderboard →
        </Link>
      </div>
    );
  }

  // ── Supabase not configured ────────────────────────────────
  return (
    <p className="text-cockpit-muted text-xs text-center">
      Add Supabase env vars to enable saving.
    </p>
  );
}
