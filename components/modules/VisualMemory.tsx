"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModuleResult } from "@/types";
import { scoreVisual, MODULE_WEIGHTS, MODULE_NAMES } from "@/lib/scoring";

interface Props {
  onComplete: (result: ModuleResult) => void;
}

interface LevelConfig {
  level: number;
  gridSize: number;
  litCount: number;
  showDuration: number; // ms
}

// 7 levels — each show duration extended by ~1.5s for more forgiving memorisation
const LEVELS: LevelConfig[] = [
  { level: 1, gridSize: 3, litCount: 3, showDuration: 5500 },
  { level: 2, gridSize: 3, litCount: 5, showDuration: 5000 },
  { level: 3, gridSize: 4, litCount: 6, showDuration: 5000 },
  { level: 4, gridSize: 4, litCount: 8, showDuration: 4500 },
  { level: 5, gridSize: 4, litCount: 10, showDuration: 4000 },
  { level: 6, gridSize: 5, litCount: 12, showDuration: 3500 },
  { level: 7, gridSize: 5, litCount: 15, showDuration: 3000 },
];

// Fail threshold — below this accuracy the module ends
const FAIL_THRESHOLD = 55;

type Phase = "memorize" | "recall" | "feedback";

interface LevelResult {
  level: number;
  accuracy: number;
}

function generatePattern(size: number, count: number): Set<number> {
  const cells = new Set<number>();
  while (cells.size < count) cells.add(Math.floor(Math.random() * size * size));
  return cells;
}

export default function VisualMemory({ onComplete }: Props) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("memorize");
  const [pattern, setPattern] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [levelResults, setLevelResults] = useState<LevelResult[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackOk, setFeedbackOk] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const currentLevel = LEVELS[Math.min(levelIdx, LEVELS.length - 1)];

  const complete = useCallback((results: LevelResult[]) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const raw = scoreVisual(results);
    onComplete({
      moduleId: "visual",
      moduleName: MODULE_NAMES.visual,
      rawScore: raw,
      weight: MODULE_WEIGHTS.visual,
      weightedScore: raw * MODULE_WEIGHTS.visual,
      completedAt: Date.now(),
      details: {
        levelsCompleted: results.length,
        maxLevel: results.length > 0 ? Math.max(...results.map((r) => r.level)) : 0,
        avgAccuracy: results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.accuracy, 0) / results.length)
          : 0,
      },
    });
  }, [onComplete]);

  const startLevel = useCallback((idx: number) => {
    const lvl = LEVELS[idx];
    const pat = generatePattern(lvl.gridSize, lvl.litCount);
    setPattern(pat);
    setSelected(new Set());
    setPhase("memorize");
    setCountdown(Math.ceil(lvl.showDuration / 1000));

    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setPhase("recall");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startLevel(0);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startLevel]);

  const toggleCell = useCallback((idx: number) => {
    if (phase !== "recall") return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, [phase]);

  const submitRecall = useCallback(() => {
    if (phase !== "recall") return;
    const lvl = currentLevel;
    const hits = [...selected].filter((c) => pattern.has(c)).length;
    const falseHits = [...selected].filter((c) => !pattern.has(c)).length;
    const accuracy = Math.max(0, Math.min(100,
      Math.round((hits / lvl.litCount) * 100 - (falseHits / (lvl.gridSize * lvl.gridSize)) * 25)
    ));

    const newResults = [...levelResults, { level: lvl.level, accuracy }];
    setLevelResults(newResults);
    const isPerfect = hits === lvl.litCount && falseHits === 0;
    const passed = accuracy >= FAIL_THRESHOLD;

    setFeedbackOk(passed);
    setFeedbackMsg(
      isPerfect ? "Perfect recall!" :
      passed    ? `${hits}/${lvl.litCount} correct — advancing` :
                  `${hits}/${lvl.litCount} correct — module ended`
    );
    setPhase("feedback");

    setTimeout(() => {
      if (doneRef.current) return;
      const nextIdx = levelIdx + 1;
      if (!passed || nextIdx >= LEVELS.length) {
        complete(newResults);
        return;
      }
      setLevelIdx(nextIdx);
      startLevel(nextIdx);
    }, 1800);
  }, [phase, selected, pattern, currentLevel, levelResults, levelIdx, startLevel, complete]);

  const size = currentLevel.gridSize;
  const totalCells = size * size;
  const cellSize = Math.min(64, Math.floor(320 / size));

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-lg">
        <div>
          <span className="text-cockpit-dim text-xs tracking-widest uppercase">Level </span>
          <span className="text-cockpit-accent number-display font-semibold">{currentLevel.level}</span>
          <span className="text-cockpit-dim text-xs"> / {LEVELS.length}</span>
        </div>
        <div className="flex gap-1.5">
          {LEVELS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${
              i < levelIdx ? "bg-cockpit-green" :
              i === levelIdx ? "bg-cockpit-accent animate-pulse" : "bg-cockpit-border"
            }`} />
          ))}
        </div>
        <div className="text-sm">
          {phase === "memorize" && <span className="text-cockpit-amber number-display">{countdown}s</span>}
          {phase === "recall" && <span className="text-cockpit-green text-xs tracking-widest uppercase">Recall</span>}
        </div>
      </div>

      {/* Status */}
      <div className="h-6 text-center">
        {phase === "memorize" && (
          <p className="text-cockpit-amber font-semibold tracking-wide text-sm">
            MEMORISE — {countdown}s
          </p>
        )}
        {phase === "recall" && (
          <p className="text-cockpit-green font-semibold tracking-wide text-sm">
            SELECT THE HIGHLIGHTED CELLS
          </p>
        )}
        {phase === "feedback" && (
          <p className={`font-semibold tracking-wide text-sm ${feedbackOk ? "text-cockpit-green" : "text-cockpit-red"}`}>
            {feedbackMsg}
          </p>
        )}
      </div>

      {/* Grid */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
        }}
      >
        {Array.from({ length: totalCells }).map((_, i) => {
          const isLit = pattern.has(i);
          const isSel = selected.has(i);
          const showPattern = phase === "memorize" || phase === "feedback";
          const correct = phase === "feedback" && isLit && isSel;
          const wrong   = phase === "feedback" && !isLit && isSel;
          const missed  = phase === "feedback" && isLit && !isSel;

          return (
            <button
              key={i}
              onClick={() => toggleCell(i)}
              disabled={phase !== "recall"}
              style={{ width: cellSize, height: cellSize }}
              className={`rounded-sm border transition-all duration-100 ${
                showPattern && isLit ? "bg-cockpit-accent border-cockpit-accent glow-accent" :
                correct              ? "bg-cockpit-green border-cockpit-green" :
                wrong                ? "bg-cockpit-red border-cockpit-red" :
                missed               ? "bg-cockpit-amber border-cockpit-amber opacity-60" :
                isSel                ? "bg-cockpit-accent bg-opacity-30 border-cockpit-accent" :
                                       "bg-cockpit-card border-cockpit-border hover:border-cockpit-muted"
              }`}
            />
          );
        })}
      </div>

      {/* Submit */}
      {phase === "recall" && (
        <button onClick={submitRecall} className="btn-primary" disabled={selected.size === 0}>
          Submit Recall ({selected.size} selected)
        </button>
      )}

      <div className="text-cockpit-muted text-xs text-center">
        Grid {size}×{size} · Remember {currentLevel.litCount} cells
      </div>
    </div>
  );
}
