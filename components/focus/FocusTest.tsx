"use client";

import { useEffect, useRef, useState } from "react";
import TargetLock         from "@/components/focus/phases/TargetLock";
import SignalFilter        from "@/components/focus/phases/SignalFilter";
import InterruptionRecovery from "@/components/focus/phases/InterruptionRecovery";
import DualTrack           from "@/components/focus/phases/DualTrack";
import PriorityStorm       from "@/components/focus/phases/PriorityStorm";
import {
  computeMetrics,
  getResultTitle,
  getResultDescription,
  getPercentile,
  PHASE_COLORS,
  PHASE_NAMES,
  type PhaseResult,
  type FocusMetrics,
} from "@/lib/focus-test";
import { Sounds } from "@/lib/sounds";
import type { TestResult } from "@/types";

export interface FocusOutput {
  testResult:    TestResult;
  phaseResults:  PhaseResult[];
  metrics:       FocusMetrics;
}

interface Props {
  onComplete: (out: FocusOutput) => void;
}

type Phase = "intro" | "phase-intro" | "playing" | "transition" | "done";

const PHASE_DURATIONS = [45, 45, 60, 60, 90]; // seconds
const PHASE_DESCRIPTIONS = [
  "Tap green targets. Avoid red decoys. They move — stay sharp.",
  "A stream of shapes flashes. Tap only when you see ◆. False taps cost points.",
  "Maintain the pulse rhythm. Dismiss interruptions and recover fast.",
  "Two streams run simultaneously. Vowels on top — tap. Evens below — tap.",
  "Tasks arrive with CRITICAL / HIGH / LOW priority. Complete highest priority first before they expire.",
];

export default function FocusTest({ onComplete }: Props) {
  const [phase,        setPhase]       = useState<Phase>("intro");
  const [phaseIdx,     setPhaseIdx]    = useState(0); // 0-4
  const [phaseResults, setPhaseResults] = useState<PhaseResult[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [countdown,    setCountdown]   = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);

  const startedRef = useRef(false);

  // Countdown before each phase
  useEffect(() => {
    if (!showCountdown) return;
    setCountdown(3);
    let n = 3;
    const interval = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(interval);
        setShowCountdown(false);
        setPhase("playing");
        if (soundEnabled) Sounds.phaseStart();
      } else {
        setCountdown(n);
        if (soundEnabled) Sounds.tick();
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountdown]);

  const startPhase = () => {
    setShowCountdown(true);
    setPhase("transition");
  };

  const handlePhaseComplete = (result: PhaseResult) => {
    const newResults = [...phaseResults, result];
    setPhaseResults(newResults);

    if (phaseIdx < 4) {
      setPhaseIdx(phaseIdx + 1);
      setPhase("phase-intro");
    } else {
      // All phases done
      const metrics   = computeMetrics(newResults);
      const score     = metrics.focusScore;
      const title     = getResultTitle(score);
      const desc      = getResultDescription(score);
      const percentile = getPercentile(score);

      onComplete({
        testResult: {
          testId:             "focus",
          testName:           "Focus & Attention Test",
          score,
          percentileEstimate: percentile,
          resultTitle:        title,
          resultDescription:  desc,
          rawMetrics:         metrics as unknown as Record<string, number>,
          createdAt:          new Date().toISOString(),
        },
        phaseResults:  newResults,
        metrics,
      });
    }
  };

  const color = PHASE_COLORS[phaseIdx] ?? "#00d4ff";
  const name  = PHASE_NAMES[phaseIdx];

  // ── Intro ───────────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col gap-8 module-enter">
        <div className="text-center">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono mb-3">
            SuperBrain · Assessment
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
            Focus &<br />Attention Test
          </h1>
          <p className="text-cockpit-dim text-sm leading-relaxed max-w-sm mx-auto">
            5 phases of progressively intense cognitive challenges. Measures distraction resistance, recovery speed, and sustained focus under pressure.
          </p>
        </div>

        {/* Phase list */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm divide-y divide-cockpit-border">
          {PHASE_NAMES.map((pname, i) => (
            <div key={pname} className="flex items-center gap-4 px-5 py-3.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: PHASE_COLORS[i] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{pname}</p>
              </div>
              <span className="text-cockpit-muted text-xs font-mono shrink-0">
                {PHASE_DURATIONS[i]}s
              </span>
            </div>
          ))}
        </div>

        {/* Sound toggle */}
        <div className="flex items-center justify-between px-5 py-3 bg-cockpit-card border border-cockpit-border rounded-sm">
          <div>
            <p className="text-white text-sm font-semibold">Audio distractions</p>
            <p className="text-cockpit-muted text-xs mt-0.5">Sound adds to the challenge — recommended</p>
          </div>
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className={`relative w-12 h-6 rounded-full border transition-colors duration-200 shrink-0 ${
              soundEnabled ? "bg-cockpit-accent/20 border-cockpit-accent" : "bg-cockpit-surface border-cockpit-border"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200 ${
                soundEnabled ? "left-6 bg-cockpit-accent" : "left-0.5 bg-cockpit-muted"
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-cockpit-muted text-xs">
            <div className="w-1 h-1 rounded-full bg-cockpit-green shrink-0" />
            ~5 minutes · highly replayable
          </div>
          <div className="flex items-center gap-3 text-cockpit-muted text-xs">
            <div className="w-1 h-1 rounded-full bg-cockpit-green shrink-0" />
            Each phase gets progressively harder
          </div>
        </div>

        <button
          onClick={() => { startedRef.current = true; setPhase("phase-intro"); }}
          className="btn-primary w-full"
        >
          Begin →
        </button>
      </div>
    );
  }

  // ── Phase intro ─────────────────────────────────────────────────────────────

  if (phase === "phase-intro") {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col gap-8 items-center text-center module-enter">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono mb-3"
            style={{ color: `${color}aa` }}>
            Phase {phaseIdx + 1} of 5
          </p>
          <h2
            className="text-2xl sm:text-3xl font-extrabold mb-4"
            style={{ color }}
          >
            {name}
          </h2>
          <p className="text-cockpit-dim text-sm leading-relaxed max-w-sm">
            {PHASE_DESCRIPTIONS[phaseIdx]}
          </p>
        </div>

        <div className="w-full bg-cockpit-card border border-cockpit-border rounded-sm px-5 py-3 flex items-center gap-3">
          <div className="w-1 h-1 rounded-full shrink-0" style={{ background: color }} />
          <p className="text-cockpit-muted text-xs">{PHASE_DURATIONS[phaseIdx]} seconds</p>
          {phaseIdx > 0 && (
            <>
              <span className="text-cockpit-border text-xs">·</span>
              <p className="text-cockpit-muted text-xs">harder than previous</p>
            </>
          )}
        </div>

        <button onClick={startPhase} className="btn-primary w-full">
          Start Phase →
        </button>
      </div>
    );
  }

  // ── Countdown ───────────────────────────────────────────────────────────────

  if (phase === "transition" && showCountdown) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center gap-4 module-enter" style={{ minHeight: 300 }}>
        <p className="text-cockpit-muted text-xs tracking-widest uppercase font-mono">{name}</p>
        <div
          className="text-8xl font-extrabold number-display tabular-nums"
          style={{ color, textShadow: `0 0 40px ${color}60` }}
        >
          {countdown}
        </div>
        <p className="text-cockpit-muted text-sm">Get ready…</p>
      </div>
    );
  }

  // ── Active phase ─────────────────────────────────────────────────────────────

  if (phase === "playing") {
    const phaseProps = { soundEnabled, onComplete: handlePhaseComplete };
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 module-enter" style={{ minHeight: "min(600px, 85vh)" }}>
        {/* Phase header */}
        <div className="flex items-center gap-3 px-1">
          <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: color }} />
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color }}>
            {name}
          </span>
          <span className="text-cockpit-border text-xs">·</span>
          <span className="text-cockpit-muted text-xs">Phase {phaseIdx + 1}/5</span>
        </div>

        {phaseIdx === 0 && <TargetLock           key={0} {...phaseProps} />}
        {phaseIdx === 1 && <SignalFilter          key={1} {...phaseProps} />}
        {phaseIdx === 2 && <InterruptionRecovery  key={2} {...phaseProps} />}
        {phaseIdx === 3 && <DualTrack             key={3} {...phaseProps} />}
        {phaseIdx === 4 && <PriorityStorm         key={4} {...phaseProps} />}
      </div>
    );
  }

  return null;
}
