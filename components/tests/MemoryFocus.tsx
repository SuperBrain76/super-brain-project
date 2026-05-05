"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TestResult } from "@/types";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";

interface Props {
  onComplete: (result: TestResult) => void;
}

const GRID = 4; // 4×4
const TOTAL_CELLS = GRID * GRID;
const BASE_SEQ_LEN = 3;
const MAX_SEQ_LEN  = 9;
const FLASH_MS = 600;  // each tile visible
const INTER_MS = 150;  // gap between flashes

type Phase = "idle" | "showing" | "input" | "feedback_ok" | "feedback_fail";

function genSequence(len: number): number[] {
  const seq: number[] = [];
  while (seq.length < len) {
    const n = Math.floor(Math.random() * TOTAL_CELLS);
    if (!seq.includes(n)) seq.push(n);
  }
  return seq;
}

function scoreForLevel(level: number): number {
  // level 1 = seq len 3 → 14pts; level 7 = seq len 9 → 100pts
  return Math.round(Math.min(100, ((level - 1) / 6) * 100 + 14));
}

export default function MemoryFocus({ onComplete }: Props) {
  const [started, setStarted]     = useState(false);
  const [phase, setPhase]         = useState<Phase>("idle");
  const [sequence, setSequence]   = useState<number[]>([]);
  const [lit, setLit]             = useState<number | null>(null);
  const [userSeq, setUserSeq]     = useState<number[]>([]);
  const [level, setLevel]         = useState(1);
  const [seqLen, setSeqLen]       = useState(BASE_SEQ_LEN);
  const [maxLevel, setMaxLevel]   = useState(0);
  const [msg, setMsg]             = useState("");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const playSequence = useCallback((seq: number[]) => {
    setPhase("showing");
    setLit(null);
    let t = 0;
    seq.forEach((cell, i) => {
      const showId = setTimeout(() => setLit(cell), t);
      t += FLASH_MS;
      const hideId = setTimeout(() => setLit(null), t);
      t += INTER_MS;
      timersRef.current.push(showId, hideId);
    });
    const doneId = setTimeout(() => {
      setPhase("input");
      setUserSeq([]);
    }, t);
    timersRef.current.push(doneId);
  }, []);

  const startLevel = useCallback((lvl: number, len: number) => {
    clearTimers();
    const seq = genSequence(len);
    setSequence(seq);
    setUserSeq([]);
    setPhase("idle");
    // Small delay before showing
    const id = setTimeout(() => playSequence(seq), 600);
    timersRef.current.push(id);
  }, [playSequence]);

  useEffect(() => () => clearTimers(), []);

  const handleCellClick = useCallback((cell: number) => {
    if (phase !== "input") return;
    const next = [...userSeq, cell];
    setUserSeq(next);

    // Check step-by-step
    const stepIdx = next.length - 1;
    if (next[stepIdx] !== sequence[stepIdx]) {
      // Wrong
      setPhase("feedback_fail");
      setMsg(`Wrong! Sequence was: ${sequence.join("→")}`);
      const score = scoreForLevel(maxLevel);
      clearTimers();
      setTimeout(() => {
        onComplete({
          testId: "memory",
          testName: "Memory & Focus Test",
          score,
          percentileEstimate: scoreToPercentile(score),
          resultTitle: getResultTitle("memory", score),
          resultDescription: getResultDescription("memory", score),
          rawMetrics: {
            "max sequence length": seqLen - 1,
            "levels completed": maxLevel,
            "final score": score,
          },
          createdAt: new Date().toISOString(),
        });
      }, 1800);
      return;
    }

    if (next.length === sequence.length) {
      // Correct!
      const newMax = Math.max(maxLevel, level);
      setMaxLevel(newMax);
      setPhase("feedback_ok");
      setMsg(seqLen >= MAX_SEQ_LEN ? "Perfect! Maximum level reached!" : "Correct! Level up…");

      if (seqLen >= MAX_SEQ_LEN) {
        const score = 100;
        setTimeout(() => {
          onComplete({
            testId: "memory",
            testName: "Memory & Focus Test",
            score,
            percentileEstimate: scoreToPercentile(score),
            resultTitle: getResultTitle("memory", score),
            resultDescription: getResultDescription("memory", score),
            rawMetrics: {
              "max sequence length": seqLen,
              "levels completed": newMax,
              "final score": score,
            },
            createdAt: new Date().toISOString(),
          });
        }, 1500);
        return;
      }

      const nextLen = seqLen + 1;
      const nextLvl = level + 1;
      setSeqLen(nextLen);
      setLevel(nextLvl);
      setTimeout(() => startLevel(nextLvl, nextLen), 1500);
    }
  }, [phase, userSeq, sequence, level, seqLen, maxLevel, startLevel, onComplete]);

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Memory & Focus Test</h2>
        <p className="text-cockpit-dim max-w-sm leading-relaxed">
          Watch tiles light up on the grid. After the sequence ends, click them in the same order.
          Sequences start at 3 tiles and grow with each correct round.
        </p>
        <button className="btn-primary" onClick={() => { setStarted(true); startLevel(1, BASE_SEQ_LEN); }}>
          Begin Test
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="text-center">
          <div className="text-cockpit-dim text-xs tracking-widest uppercase">Level</div>
          <div className="text-cockpit-accent number-display font-bold text-xl">{level}</div>
        </div>
        <div className="text-center">
          <div className="text-cockpit-dim text-xs tracking-widest uppercase">Sequence</div>
          <div className="text-cockpit-accent number-display font-bold text-xl">{seqLen} tiles</div>
        </div>
        <div className="text-center">
          <div className="text-cockpit-dim text-xs tracking-widest uppercase">Progress</div>
          <div className="text-cockpit-accent number-display font-bold text-xl">{userSeq.length}/{seqLen}</div>
        </div>
      </div>

      {/* Status */}
      <div className="h-6 text-center">
        {phase === "idle" && <p className="text-cockpit-dim text-sm">Get ready…</p>}
        {phase === "showing" && <p className="text-cockpit-amber text-sm font-semibold">WATCH THE SEQUENCE</p>}
        {phase === "input" && <p className="text-cockpit-green text-sm font-semibold">REPEAT THE SEQUENCE</p>}
        {phase === "feedback_ok" && <p className="text-cockpit-green text-sm font-semibold">{msg}</p>}
        {phase === "feedback_fail" && <p className="text-cockpit-red text-sm font-semibold">Sequence broken</p>}
      </div>

      {/* Grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}
      >
        {Array.from({ length: TOTAL_CELLS }).map((_, i) => {
          const isLit       = lit === i;
          const isUserSel   = userSeq.includes(i) && phase === "input";
          const seqOrder    = userSeq.indexOf(i);
          const isCorrectSel = phase === "feedback_ok" && sequence.includes(i);
          const isWrongSel   = phase === "feedback_fail" && sequence.includes(i);

          return (
            <button
              key={i}
              onClick={() => handleCellClick(i)}
              disabled={phase !== "input"}
              className={`w-14 h-14 rounded-sm border transition-all duration-75 relative ${
                isLit
                  ? "bg-cockpit-accent border-cockpit-accent glow-accent"
                  : isCorrectSel
                  ? "bg-cockpit-green border-cockpit-green"
                  : isWrongSel
                  ? "bg-cockpit-red border-cockpit-red opacity-60"
                  : isUserSel
                  ? "bg-cockpit-accent bg-opacity-30 border-cockpit-accent"
                  : "bg-cockpit-card border-cockpit-border hover:border-cockpit-muted"
              }`}
            >
              {isUserSel && seqOrder >= 0 && (
                <span className="text-cockpit-accent text-xs font-bold number-display absolute inset-0 flex items-center justify-center">
                  {seqOrder + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Level indicators */}
      <div className="flex gap-1.5">
        {Array.from({ length: MAX_SEQ_LEN - BASE_SEQ_LEN + 1 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${i < level - 1 ? "bg-cockpit-green" : i === level - 1 ? "bg-cockpit-accent animate-pulse" : "bg-cockpit-border"}`}
          />
        ))}
      </div>
    </div>
  );
}
