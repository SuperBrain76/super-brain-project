"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactionChallenge } from "@/lib/battle";

interface Props {
  challenge:    ReactionChallenge;
  startedAt:    Date;          // when the round_started_at elapses
  onAnswer:     (answer: string, timeMs: number) => void;
  opponentDone: boolean;
  disabled:     boolean;
}

export default function ReactionRound({ challenge, startedAt, onAnswer, opponentDone, disabled }: Props) {
  const [phase,     setPhase]     = useState<"wait" | "ready" | "go" | "tapped" | "early">("wait");
  const [elapsed,   setElapsed]   = useState(0);
  const startTimeRef = useRef<number>(0);
  const firedRef     = useRef(false);

  useEffect(() => {
    // Wait for round_started_at, then begin the delay
    const now    = Date.now();
    const goAt   = startedAt.getTime();
    const waitMs = Math.max(0, goAt - now);

    const t1 = setTimeout(() => {
      setPhase("ready");
      // After delay_ms, flash GO
      const t2 = setTimeout(() => {
        startTimeRef.current = Date.now();
        setPhase("go");
      }, challenge.delay_ms);
      return () => clearTimeout(t2);
    }, waitMs);

    return () => clearTimeout(t1);
  }, [startedAt, challenge.delay_ms]);

  // Tick elapsed when GO
  useEffect(() => {
    if (phase !== "go") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 30);
    return () => clearInterval(iv);
  }, [phase]);

  const handleTap = () => {
    if (disabled || firedRef.current) return;
    if (phase === "ready") {
      firedRef.current = true;
      setPhase("early");
      onAnswer("EARLY", 99999);
      return;
    }
    if (phase !== "go") return;
    firedRef.current = true;
    const ms = Date.now() - startTimeRef.current;
    setPhase("tapped");
    onAnswer("TAP", ms);
  };

  const bgColor =
    phase === "go"    ? "#00e676" :
    phase === "tapped"? "#00e67640" :
    phase === "early" ? "#ff3d0020" : "#0d1117";

  const textColor =
    phase === "go"    ? "#0d1117" :
    phase === "tapped"? "#00e676"  :
    phase === "early" ? "#ff3d00"  : "#1e2a38";

  return (
    <div className="flex flex-col items-center gap-6 w-full select-none">
      <button
        onClick={handleTap}
        disabled={disabled && phase !== "go"}
        className="w-full rounded-sm flex flex-col items-center justify-center transition-all duration-75 active:scale-[0.98] focus:outline-none"
        style={{ height: 240, background: bgColor, border: `2px solid ${textColor}40` }}
      >
        {phase === "wait" && (
          <p className="text-cockpit-muted text-xl font-mono tracking-widest animate-pulse">LOADING…</p>
        )}
        {phase === "ready" && (
          <>
            <p className="text-cockpit-muted text-lg font-mono tracking-widest">GET READY…</p>
            <p className="text-cockpit-border text-xs mt-2">Don&apos;t tap yet</p>
          </>
        )}
        {phase === "go" && (
          <>
            <p className="text-8xl font-black text-cockpit-bg" style={{ textShadow: "none" }}>TAP!</p>
            <p className="text-cockpit-bg text-sm font-mono mt-2">{elapsed}ms</p>
          </>
        )}
        {phase === "tapped" && (
          <>
            <p className="text-5xl font-black" style={{ color: "#00e676" }}>{elapsed}ms</p>
            <p className="text-cockpit-dim text-sm mt-1">Tapped!</p>
          </>
        )}
        {phase === "early" && (
          <p className="text-4xl font-black" style={{ color: "#ff3d00" }}>TOO EARLY!</p>
        )}
      </button>

      {opponentDone && phase !== "go" && (
        <p className="text-cockpit-muted text-xs animate-pulse">Waiting for your tap…</p>
      )}
      {opponentDone && (
        <p className="text-xs text-cockpit-accent font-mono">Opponent answered</p>
      )}
    </div>
  );
}
