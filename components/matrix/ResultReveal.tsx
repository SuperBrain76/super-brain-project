"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AssessmentResult } from "@/lib/matrix/types";

// ── Animated counter ──────────────────────────────────────────

function Counter({ target, duration = 1200, suffix = "" }: { target: number; duration?: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const frame = (now: number) => {
      const t   = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setValue(Math.round(ease * target));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target, duration]);
  return <>{value}{suffix}</>;
}

// ── Score ring ────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(score / 100), 200);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 130, height: 130 }}>
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ position: "absolute" }}>
        {/* Track */}
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1e2a38" strokeWidth="6" />
        {/* Progress */}
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - drawn)}
          style={{ transform: "rotate(-90deg)", transformOrigin: "65px 65px", transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)" }}
        />
        {/* Glow */}
        <circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeOpacity="0.2"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - drawn)}
          style={{ transform: "rotate(-90deg)", transformOrigin: "65px 65px", transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-4xl font-black number-display" style={{ color }}>
          <Counter target={score} duration={1400} />
        </p>
        <p className="text-[9px] font-mono tracking-widest text-cockpit-muted uppercase">Score</p>
      </div>
    </div>
  );
}

// ── Metric bar ────────────────────────────────────────────────

function MetricBar({ label, value, max = 100, color, delay = 0 }: {
  label: string; value: number; max?: number; color: string; delay?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW((value / max) * 100), delay + 300);
    return () => clearTimeout(t);
  }, [value, max, delay]);

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-cockpit-muted text-xs">{label}</span>
        <span className="text-white text-xs font-bold number-display">{value}{max === 100 ? "%" : ""}</span>
      </div>
      <div className="h-1.5 bg-cockpit-border rounded-full overflow-hidden">
        <div className="h-full rounded-full"
          style={{ width: `${w}%`, background: color, transition: `width 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }} />
      </div>
    </div>
  );
}

// ── Result reveal ─────────────────────────────────────────────

interface Props {
  result:   AssessmentResult;
  onRetake: () => void;
}

export default function ResultReveal({ result, onRetake }: Props) {
  const [shown, setShown] = useState(false);
  const containerRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 100);
    return () => clearTimeout(t);
  }, []);

  const { fluidScore, percentile, speedScore, accuracyRate, difficultyReached,
          consistencyScore, questionsAnswered, avgResponseMs, profile, flagged } = result;

  const scoreColor =
    fluidScore >= 80 ? "#00e676" :
    fluidScore >= 65 ? "#00d4ff" :
    fluidScore >= 50 ? "#ffab00" : "#ff6d00";

  const percentileText =
    percentile >= 95 ? "Top 5%" :
    percentile >= 85 ? "Top 15%" :
    percentile >= 70 ? "Top 30%" :
    percentile >= 50 ? "Top 50%" :
    `Bottom ${100 - percentile}%`;

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col gap-4 px-4 py-4 overflow-y-auto"
      style={{ opacity: shown ? 1 : 0, transition: "opacity 0.5s" }}
    >
      {/* Banner */}
      <div className="rounded-sm border text-center py-6 px-4"
        style={{ borderColor: `${scoreColor}30`, background: `${scoreColor}08` }}>
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase mb-2"
          style={{ color: `${scoreColor}80` }}>
          Fluid Intelligence Assessment · Complete
        </p>
        <p className="text-sm font-bold mb-3" style={{ color: scoreColor }}>
          {profile.label}
        </p>
        <p className="text-cockpit-dim text-xs leading-relaxed max-w-xs mx-auto">
          {profile.description}
        </p>
      </div>

      {/* Score ring + percentile */}
      <div className="flex items-center justify-around bg-cockpit-card border border-cockpit-border rounded-sm px-4 py-5">
        <ScoreRing score={fluidScore} color={scoreColor} />

        <div className="flex flex-col gap-3 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-mono text-cockpit-muted">Cognitive Percentile</p>
            <p className="text-2xl font-black number-display" style={{ color: scoreColor }}>
              <Counter target={percentile} duration={1200} suffix="th" />
            </p>
            <p className="text-xs font-semibold" style={{ color: scoreColor }}>{percentileText}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-mono text-cockpit-muted">Max Difficulty</p>
            <p className="text-xl font-black number-display text-white">{difficultyReached}<span className="text-cockpit-muted text-sm">/10</span></p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm px-4 py-4 flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-widest font-mono text-cockpit-muted mb-1">Cognitive Profile</p>
        <MetricBar label="Accuracy"    value={Math.round(accuracyRate * 100)} color="#00e676"   delay={0}   />
        <MetricBar label="Speed"       value={speedScore}                      color="#00d4ff"   delay={100} />
        <MetricBar label="Consistency" value={consistencyScore}                color="#a855f7"   delay={200} />
        <MetricBar
          label="Difficulty Reached"
          value={difficultyReached}
          max={10}
          color="#ffab00"
          delay={300}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Questions",    value: questionsAnswered },
          { label: "Avg Response", value: `${(avgResponseMs / 1000).toFixed(1)}s` },
          { label: "Fluid Score",  value: fluidScore },
        ].map(({ label, value }) => (
          <div key={label} className="bg-cockpit-card border border-cockpit-border rounded-sm px-3 py-3 text-center">
            <p className="text-white text-lg font-black number-display">{value}</p>
            <p className="text-cockpit-muted text-[9px] uppercase tracking-widest mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Strengths */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest font-mono text-cockpit-muted mb-3">Identified Strengths</p>
        <div className="flex flex-col gap-2">
          {profile.strengths.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full shrink-0" style={{ background: scoreColor }} />
              <span className="text-cockpit-dim text-sm">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Flag notice */}
      {flagged && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-sm px-4 py-3">
          <p className="text-amber-400 text-xs font-mono">
            ⚠ Anomalous response patterns detected. Results may not be representative.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-cockpit-border text-[10px] text-center leading-relaxed px-4">
        This is a Cognitive Ability Estimate, not a clinically certified IQ measurement.
        Scores reflect fluid reasoning performance on this specific assessment only.
      </p>

      {/* Actions */}
      <div className="flex gap-3 pb-2">
        <button onClick={onRetake} className="flex-1 btn-primary">
          Retake
        </button>
        <Link href="/tests" className="flex-1">
          <button className="w-full btn-ghost">All Tests</button>
        </Link>
      </div>
    </div>
  );
}
