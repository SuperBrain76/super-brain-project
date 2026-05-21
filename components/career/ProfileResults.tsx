"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { saveResult } from "@/lib/results";
import { isSupabaseConfigured } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import FeedbackModal from "@/components/FeedbackModal";
import {
  DIM_META,
  type DimKey,
  type Dimensions,
  type ArchetypeResult,
} from "@/lib/career-profile";
import type { TestResult } from "@/types";

const DIM_KEYS: DimKey[] = [
  "analyticalRatio",
  "cognitiveSpeed",
  "riskTolerance",
  "systemsThinking",
  "autonomyDrive",
  "leadershipMode",
  "adaptability",
];

interface Props {
  testResult:       TestResult;
  dimensions:       Dimensions;
  archetypeResults: ArchetypeResult[];
  onRetake:         () => void;
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-cockpit-muted text-[10px] uppercase tracking-widest font-mono">
        {label}
      </span>
      <div className="flex-1 h-px bg-cockpit-border" />
    </div>
  );
}

// ── Profile detail card ───────────────────────────────────────────────────────

function DetailCard({ label, body, color }: { label: string; body: string; color: string }) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5">
      <p
        className="text-[10px] uppercase tracking-widest font-mono mb-2"
        style={{ color: `${color}99` }}
      >
        {label}
      </p>
      <p className="text-cockpit-dim text-sm leading-relaxed">{body}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileResults({
  testResult,
  dimensions,
  archetypeResults,
  onRetake,
}: Props) {
  const { user, loading } = useAuth();

  const [saving,       setSaving]       = useState(false);
  const [shareId,      setShareId]      = useState<string | null>(null);
  const [saveErr,      setSaveErr]      = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [animated,     setAnimated]     = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const hasSaved         = useRef(false);
  const completedTracked = useRef(false);

  const top     = archetypeResults[0];
  const second  = archetypeResults[1];
  const archetype = top.archetype;
  const color   = archetype.color;

  // Animate dimension bars in after mount
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Track completion once
  useEffect(() => {
    if (completedTracked.current) return;
    completedTracked.current = true;
    track.testCompleted(testResult.testName, testResult.score);
    const t = setTimeout(() => setShowFeedback(true), 4000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save once auth is known
  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured || hasSaved.current) return;
    hasSaved.current = true;
    setSaving(true);
    saveResult(testResult, user.id).then(({ shareId: sid, error }) => {
      setSaving(false);
      if (error) { setSaveErr(error); return; }
      setShareId(sid);
    });
  }, [user, loading, testResult]);

  const shareUrl = shareId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/challenge/${shareId}`
    : null;

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clarityLabel =
    testResult.score >= 85
      ? "Extremely clear profile"
      : testResult.score >= 70
      ? "Distinct profile"
      : testResult.score >= 55
      ? "Moderate profile clarity"
      : "Mixed profile — multiple strong archetypes";

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

        {/* ── Archetype hero card ─────────────────────────────────────────────── */}
        <div
          className="relative bg-cockpit-card border rounded-sm overflow-hidden"
          style={{ borderColor: `${color}40` }}
        >
          {/* Top accent line */}
          <div
            className="h-0.5 w-full"
            style={{ background: `linear-gradient(90deg, ${color}, ${color}00)` }}
          />
          {/* Ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${color}0d 0%, transparent 65%)`,
            }}
          />

          <div className="relative px-6 pt-10 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              {/* Left: archetype info */}
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest font-mono mb-2"
                  style={{ color: `${color}aa` }}>
                  Your Cognitive Archetype
                </p>
                <h1
                  className="text-3xl sm:text-4xl font-extrabold mb-2 leading-tight"
                  style={{ color, textShadow: `0 0 40px ${color}30` }}
                >
                  {archetype.name}
                </h1>
                <p className="text-cockpit-dim text-base mb-5 leading-snug">
                  {archetype.tagline}
                </p>
                <p className="text-cockpit-dim text-sm leading-relaxed max-w-lg">
                  {archetype.summary}
                </p>
              </div>

              {/* Right: clarity score */}
              <div className="sm:text-right shrink-0">
                <div
                  className="inline-flex flex-col items-center sm:items-end gap-1 px-5 py-4 rounded-sm border"
                  style={{ borderColor: `${color}30`, background: `${color}08` }}
                >
                  <span
                    className="text-4xl font-extrabold number-display tabular-nums"
                    style={{ color }}
                  >
                    {top.match}%
                  </span>
                  <span className="text-cockpit-muted text-xs">archetype match</span>
                  <div className="w-full h-px bg-cockpit-border my-1" />
                  <span className="text-cockpit-muted text-[10px]">{clarityLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cognitive fingerprint ───────────────────────────────────────────── */}
        <div>
          <SectionHeading label="Cognitive Fingerprint" />
          <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-5">
            {DIM_KEYS.map((k, i) => {
              const meta  = DIM_META[k];
              const value = Math.round(dimensions[k]);
              return (
                <div key={k} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white text-sm font-medium">{meta.label}</span>
                      <p className="text-cockpit-muted text-[10px] mt-0.5 hidden sm:block">
                        {meta.description}
                      </p>
                    </div>
                    <span
                      className="text-sm font-bold number-display tabular-nums ml-4 shrink-0"
                      style={{ color }}
                    >
                      {value}
                    </span>
                  </div>

                  {/* Bar track */}
                  <div className="relative h-1.5 bg-cockpit-border rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width:           animated ? `${value}%` : "0%",
                        background:      `linear-gradient(90deg, ${color}70, ${color})`,
                        transition:      "width 0.85s cubic-bezier(0.16, 1, 0.3, 1)",
                        transitionDelay: `${i * 60}ms`,
                      }}
                    />
                  </div>

                  {/* Low / high labels */}
                  <div className="flex items-center justify-between text-[10px] text-cockpit-muted">
                    <span>← {meta.low}</span>
                    <span>{meta.high} →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Career matches ──────────────────────────────────────────────────── */}
        <div>
          <SectionHeading label="Strongest Career Matches" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {archetype.careers.map((career) => (
              <div
                key={career.title}
                className="bg-cockpit-card border border-cockpit-border rounded-sm px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{career.title}</p>
                  <p className="text-cockpit-muted text-xs mt-0.5">{career.category}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className="text-sm font-bold number-display tabular-nums"
                    style={{ color }}
                  >
                    {career.match}%
                  </span>
                  <div className="w-16 h-1 bg-cockpit-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:      animated ? `${career.match}%` : "0%",
                        background: color,
                        transition: "width 1s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Profile details ─────────────────────────────────────────────────── */}
        <div>
          <SectionHeading label="Your Profile" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailCard label="Leadership Mode"       body={archetype.leadership}     color={color} />
            <DetailCard label="Communication Style"   body={archetype.communication}  color={color} />
            <DetailCard label="Thinking Style"        body={archetype.thinkingStyle}  color={color} />
            <DetailCard label="Risk Profile"          body={archetype.riskProfile}    color={color} />
          </div>
        </div>

        {/* ── Environments & drains ───────────────────────────────────────────── */}
        <div>
          <SectionHeading label="Work Environment" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Where you thrive */}
            <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5">
              <p className="text-[10px] uppercase tracking-widest font-mono mb-3"
                style={{ color: "#00e67699" }}>
                Where you thrive
              </p>
              <ul className="flex flex-col gap-2">
                {archetype.environments.map((env) => (
                  <li key={env} className="flex items-start gap-2.5">
                    <div className="w-1 h-1 rounded-full bg-cockpit-green mt-1.5 shrink-0" />
                    <span className="text-cockpit-dim text-sm">{env}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What drains you */}
            <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5">
              <p className="text-[10px] uppercase tracking-widest font-mono mb-3"
                style={{ color: "#ff3d0099" }}>
                What drains you
              </p>
              <ul className="flex flex-col gap-2">
                {archetype.drains.map((drain) => (
                  <li key={drain} className="flex items-start gap-2.5">
                    <div className="w-1 h-1 rounded-full bg-cockpit-red mt-1.5 shrink-0" />
                    <span className="text-cockpit-dim text-sm">{drain}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── Secondary archetype ─────────────────────────────────────────────── */}
        {second && (
          <div>
            <SectionHeading label="Secondary Archetype" />
            <div
              className="bg-cockpit-card border rounded-sm p-5 flex items-start gap-5"
              style={{ borderColor: `${second.archetype.color}30` }}
            >
              <div
                className="w-10 h-10 rounded-sm border shrink-0 flex items-center justify-center"
                style={{ borderColor: `${second.archetype.color}40`, background: `${second.archetype.color}12` }}
              >
                <span className="text-xs font-bold" style={{ color: second.archetype.color }}>
                  {second.match}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold">{second.archetype.name}</p>
                <p className="text-cockpit-muted text-xs mt-0.5">{second.archetype.tagline}</p>
                <p className="text-cockpit-dim text-xs mt-2 leading-relaxed line-clamp-2">
                  {second.archetype.summary.split(".")[0]}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Save & share ─────────────────────────────────────────────────────── */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-6 flex flex-col gap-4">
          {isSupabaseConfigured && !user && !loading && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-semibold mb-1">Save your profile</p>
                <p className="text-cockpit-muted text-xs">
                  Sign in to save your result and get a shareable link.
                </p>
              </div>
              <Link href="/auth" className="btn-primary shrink-0 text-center">
                Sign In →
              </Link>
            </div>
          )}

          {isSupabaseConfigured && saving && (
            <p className="text-cockpit-muted text-sm">Saving profile…</p>
          )}

          {saveErr && (
            <p className="text-cockpit-dim text-sm">{saveErr}</p>
          )}

          {shareId && shareUrl && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-white text-sm font-semibold mb-1">Profile saved</p>
                <p className="text-cockpit-muted text-xs">Share your cognitive archetype with others.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-cockpit-surface border border-cockpit-border rounded-sm px-3 py-2 overflow-hidden">
                  <p className="text-cockpit-dim text-xs font-mono truncate">{shareUrl}</p>
                </div>
                <button
                  onClick={copyLink}
                  className={`btn-ghost text-xs shrink-0 ${copied ? "border-cockpit-green text-cockpit-green" : ""}`}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              track.retryClicked(testResult.testName);
              onRetake();
            }}
            className="flex-1 btn-ghost flex items-center justify-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
            </svg>
            Retake
          </button>
          <Link href="/tests" className="flex-1 btn-ghost flex items-center justify-center">
            All Tests →
          </Link>
        </div>
      </div>
    </>
  );
}
