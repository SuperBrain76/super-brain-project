"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModuleResult } from "@/types";
import { scoreReaction, MODULE_WEIGHTS, MODULE_NAMES } from "@/lib/scoring";

interface Props {
  onComplete: (result: ModuleResult) => void;
}

type Phase = "waiting" | "ready" | "stimulus" | "responded" | "false_start";

interface Trial {
  rt: number;
  falsStart: boolean;
}

const TOTAL_TRIALS = 10;

export default function ReactionSpeed({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [trialIndex, setTrialIndex] = useState(0);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [lastRT, setLastRT] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const stimulusAt = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  const complete = useCallback((finalTrials: Trial[]) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const raw = scoreReaction(finalTrials);
    const valid = finalTrials.filter((t) => !t.falsStart);
    onComplete({
      moduleId: "reaction",
      moduleName: MODULE_NAMES.reaction,
      rawScore: raw,
      weight: MODULE_WEIGHTS.reaction,
      weightedScore: raw * MODULE_WEIGHTS.reaction,
      completedAt: Date.now(),
      details: {
        trials: finalTrials.length,
        falseStarts: finalTrials.filter((t) => t.falsStart).length,
        avgRT: valid.length > 0
          ? Math.round(valid.reduce((s, t) => s + t.rt, 0) / valid.length)
          : 0,
        bestRT: valid.length > 0 ? Math.min(...valid.map((t) => t.rt)) : 0,
      },
    });
  }, [onComplete]);

  const scheduleStimulus = useCallback((currentTrialIdx: number) => {
    setPhase("ready");
    const delay = 1500 + Math.random() * 3500;
    timeoutRef.current = setTimeout(() => {
      stimulusAt.current = Date.now();
      setPhase("stimulus");
    }, delay);
  }, []);

  useEffect(() => {
    scheduleStimulus(0);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [scheduleStimulus]);

  const handleResponse = useCallback((currentPhase: Phase, currentTrials: Trial[], currentIdx: number) => {
    if (currentPhase === "ready") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const updated = [...currentTrials, { rt: 0, falsStart: true }];
      setTrials(updated);
      setFeedback("Too early — wait for green!");
      setPhase("false_start");
      setTimeout(() => {
        if (doneRef.current) return;
        if (updated.length >= TOTAL_TRIALS) { complete(updated); return; }
        setTrialIndex(currentIdx + 1);
        scheduleStimulus(currentIdx + 1);
      }, 1200);
      return;
    }

    if (currentPhase === "stimulus") {
      const rt = Date.now() - stimulusAt.current;
      const updated = [...currentTrials, { rt, falsStart: false }];
      setTrials(updated);
      setLastRT(rt);
      setPhase("responded");
      setFeedback(
        rt < 200 ? "Exceptional!" :
        rt < 280 ? "Very fast!" :
        rt < 380 ? "Good" : "Slow"
      );
      setTimeout(() => {
        if (doneRef.current) return;
        if (updated.length >= TOTAL_TRIALS) { complete(updated); return; }
        setTrialIndex(currentIdx + 1);
        scheduleStimulus(currentIdx + 1);
      }, 1200);
    }
  }, [scheduleStimulus, complete]);

  // We need fresh state in the click/keydown handler — use refs to bridge
  const phaseRef = useRef(phase);
  const trialsRef = useRef(trials);
  const trialIdxRef = useRef(trialIndex);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { trialsRef.current = trials; }, [trials]);
  useEffect(() => { trialIdxRef.current = trialIndex; }, [trialIndex]);

  const fire = useCallback(() => {
    handleResponse(phaseRef.current, trialsRef.current, trialIdxRef.current);
  }, [handleResponse]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); fire(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fire]);

  const validTrials = trials.filter((t) => !t.falsStart);
  const avgRT = validTrials.length > 0
    ? Math.round(validTrials.reduce((s, t) => s + t.rt, 0) / validTrials.length)
    : null;

  const bgColor = phase === "stimulus" ? "#00e676" : phase === "false_start" ? "#ff3d00" : "#0d1117";
  const textColor = phase === "stimulus" ? "#080b0f" : "#e2e8f0";

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Progress dots */}
      <div className="flex gap-2">
        {Array.from({ length: TOTAL_TRIALS }).map((_, i) => {
          const t = trials[i];
          return (
            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${
              t ? (t.falsStart ? "bg-cockpit-red" : "bg-cockpit-green")
                : i === trialIndex ? "bg-cockpit-accent animate-pulse" : "bg-cockpit-border"
            }`} />
          );
        })}
      </div>

      {/* Reaction zone */}
      <div
        className="w-full max-w-2xl h-72 rounded-sm flex flex-col items-center justify-center cursor-pointer select-none border border-cockpit-border transition-colors duration-75"
        style={{ backgroundColor: bgColor }}
        onClick={fire}
      >
        <div style={{ color: textColor }} className="text-center">
          {(phase === "waiting") && <p className="text-2xl font-semibold opacity-40">Preparing…</p>}
          {phase === "ready" && (
            <>
              <p className="text-4xl font-bold mb-2">WAIT</p>
              <p className="text-sm opacity-60">Click or press SPACE when green</p>
            </>
          )}
          {phase === "stimulus" && <p className="text-6xl font-extrabold tracking-widest">CLICK!</p>}
          {phase === "responded" && (
            <>
              <p className="text-5xl font-bold number-display">{lastRT} ms</p>
              <p className="text-base opacity-70 mt-2">{feedback}</p>
            </>
          )}
          {phase === "false_start" && (
            <>
              <p className="text-4xl font-bold">FALSE START</p>
              <p className="text-sm opacity-70 mt-2">{feedback}</p>
            </>
          )}
        </div>
      </div>

      {/* Live stats */}
      <div className="flex gap-10">
        <div className="text-center">
          <div className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">Trial</div>
          <div className="number-display text-cockpit-text text-xl font-semibold">
            {Math.min(trialIndex + 1, TOTAL_TRIALS)} / {TOTAL_TRIALS}
          </div>
        </div>
        {avgRT !== null && (
          <div className="text-center">
            <div className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">Avg RT</div>
            <div className="number-display text-cockpit-accent text-xl font-semibold">{avgRT} ms</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">False Starts</div>
          <div className={`number-display text-xl font-semibold ${trials.filter((t) => t.falsStart).length > 0 ? "text-cockpit-red" : "text-cockpit-muted"}`}>
            {trials.filter((t) => t.falsStart).length}
          </div>
        </div>
      </div>

      <p className="text-cockpit-muted text-sm">Click anywhere on the zone or press SPACE</p>
    </div>
  );
}
