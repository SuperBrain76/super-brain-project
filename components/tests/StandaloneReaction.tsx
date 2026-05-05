"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TestResult } from "@/types";
import { scoreReaction } from "@/lib/scoring";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";

interface Props {
  onComplete: (result: TestResult) => void;
}

type Phase = "ready" | "wait" | "stimulus" | "responded" | "false_start";

interface Trial { rt: number; falsStart: boolean }

const TOTAL = 5;

export default function StandaloneReaction({ onComplete }: Props) {
  const [phase, setPhase]       = useState<Phase>("ready");
  const [trialIdx, setTrialIdx] = useState(0);
  const [trials, setTrials]     = useState<Trial[]>([]);
  const [lastRT, setLastRT]     = useState<number | null>(null);
  const [msg, setMsg]           = useState("");
  const stimAt    = useRef(0);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started   = useRef(false);

  const scheduleNext = useCallback(() => {
    setPhase("wait");
    timerRef.current = setTimeout(() => {
      stimAt.current = Date.now();
      setPhase("stimulus");
    }, 1500 + Math.random() * 3500);
  }, []);

  const handleClick = useCallback(() => {
    if (phase === "wait") {
      if (timerRef.current) clearTimeout(timerRef.current);
      const updated = [...trials, { rt: 0, falsStart: true }];
      setTrials(updated);
      setMsg("Too early — wait for green!");
      setPhase("false_start");
      setTimeout(() => {
        if (updated.length >= TOTAL) { complete(updated); return; }
        setTrialIdx((n) => n + 1);
        scheduleNext();
      }, 1200);
      return;
    }
    if (phase === "stimulus") {
      const rt = Date.now() - stimAt.current;
      const updated = [...trials, { rt, falsStart: false }];
      setTrials(updated);
      setLastRT(rt);
      setPhase("responded");
      setMsg(rt < 200 ? "Lightning fast!" : rt < 280 ? "Very fast!" : rt < 380 ? "Good" : "Slow response");
      setTimeout(() => {
        if (updated.length >= TOTAL) { complete(updated); return; }
        setTrialIdx((n) => n + 1);
        scheduleNext();
      }, 1100);
    }
  }, [phase, trials, scheduleNext]);

  function complete(finalTrials: Trial[]) {
    const valid = finalTrials.filter((t) => !t.falsStart);
    const score = scoreReaction(finalTrials);
    const avgRT = valid.length > 0 ? Math.round(valid.reduce((s, t) => s + t.rt, 0) / valid.length) : 0;
    const bestRT = valid.length > 0 ? Math.min(...valid.map((t) => t.rt)) : 0;
    onComplete({
      testId: "reaction",
      testName: "Reaction Speed Test",
      score,
      percentileEstimate: scoreToPercentile(score),
      resultTitle: getResultTitle("reaction", score),
      resultDescription: getResultDescription("reaction", score),
      rawMetrics: {
        "avg RT (ms)": avgRT,
        "best RT (ms)": bestRT,
        "false starts": finalTrials.filter((t) => t.falsStart).length,
        trials: TOTAL,
      },
      createdAt: new Date().toISOString(),
    });
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") handleClick();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClick]);

  const bgColor = phase === "stimulus" ? "#00e676" : phase === "false_start" ? "#ff3d00" : "#0d1117";
  const textCol = phase === "stimulus" || phase === "false_start" ? "#080b0f" : "#e2e8f0";

  if (!started.current) {
    return (
      <div className="flex flex-col items-center gap-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Reaction Speed Test</h2>
        <p className="text-cockpit-dim max-w-sm leading-relaxed">
          Wait for the screen to turn <span className="text-cockpit-green font-semibold">green</span>, then click or press <kbd className="bg-cockpit-card border border-cockpit-border px-2 py-0.5 rounded text-xs">SPACE</kbd> as fast as possible. 5 trials.
        </p>
        <button
          className="btn-primary"
          onClick={() => { started.current = true; scheduleNext(); }}
        >
          Begin Test
        </button>
      </div>
    );
  }

  const validTrials = trials.filter((t) => !t.falsStart);
  const avgRT = validTrials.length > 0 ? Math.round(validTrials.reduce((s, t) => s + t.rt, 0) / validTrials.length) : null;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xl mx-auto">
      {/* Trial dots */}
      <div className="flex gap-2">
        {Array.from({ length: TOTAL }).map((_, i) => {
          const t = trials[i];
          return (
            <div key={i} className={`w-3 h-3 rounded-full transition-all ${t ? (t.falsStart ? "bg-cockpit-red" : "bg-cockpit-green") : i === trialIdx ? "bg-cockpit-accent animate-pulse" : "bg-cockpit-border"}`} />
          );
        })}
      </div>

      {/* Zone */}
      <div
        className="w-full h-64 rounded-sm flex flex-col items-center justify-center cursor-pointer select-none border border-cockpit-border transition-colors duration-75"
        style={{ backgroundColor: bgColor }}
        onClick={handleClick}
      >
        <div style={{ color: textCol }} className="text-center">
          {phase === "wait"       && <p className="text-2xl font-bold">WAIT…</p>}
          {phase === "stimulus"   && <p className="text-5xl font-extrabold tracking-widest">CLICK!</p>}
          {phase === "responded"  && <><p className="text-4xl font-bold number-display">{lastRT} ms</p><p className="text-sm opacity-70 mt-2">{msg}</p></>}
          {phase === "false_start"&& <><p className="text-3xl font-bold">FALSE START</p><p className="text-sm opacity-70 mt-2">{msg}</p></>}
        </div>
      </div>

      {/* Stats */}
      {avgRT !== null && (
        <div className="flex gap-8 text-center">
          <div>
            <div className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">Avg RT</div>
            <div className="number-display text-cockpit-accent text-xl font-semibold">{avgRT} ms</div>
          </div>
          <div>
            <div className="text-cockpit-dim text-xs tracking-widest uppercase mb-1">Trial</div>
            <div className="number-display text-cockpit-text text-xl font-semibold">{trialIdx + 1}/{TOTAL}</div>
          </div>
        </div>
      )}
      <p className="text-cockpit-muted text-sm">Click the zone or press SPACE</p>
    </div>
  );
}
