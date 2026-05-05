"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModuleResult, MathQuestion } from "@/types";
import { scoreMath, MODULE_WEIGHTS, MODULE_NAMES } from "@/lib/scoring";
import { generateMathQuestion } from "@/lib/mathQuestions";
import Timer from "@/components/Timer";

interface Props {
  onComplete: (result: ModuleResult) => void;
}

const DURATION = 5 * 60; // 5 minutes

export default function MentalMath({ onComplete }: Props) {
  const [difficulty, setDifficulty] = useState(1);
  const [question, setQuestion] = useState<MathQuestion>(() => generateMathQuestion(1));
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [lastAnswer, setLastAnswer] = useState<number | null>(null);

  // Display-only counters (derived from refs)
  const [displayStats, setDisplayStats] = useState({ correct: 0, wrong: 0, attempted: 0 });

  // Refs are the single source of truth for counts — never stale in callbacks
  const correctRef   = useRef(0);
  const wrongRef     = useRef(0);
  const attemptedRef = useRef(0);
  const streakRef    = useRef(0);
  const diffRef      = useRef(1);
  const expiredRef   = useRef(false);
  const questionStartRef = useRef(Date.now());
  const timesRef     = useRef<number[]>([]);
  const inputRef     = useRef<HTMLInputElement>(null);

  const bumpDisplay = useCallback(() => {
    setDisplayStats({
      correct: correctRef.current,
      wrong:   wrongRef.current,
      attempted: attemptedRef.current,
    });
  }, []);

  // finish reads directly from refs — never stale regardless of when it fires
  const finish = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    const c = correctRef.current;
    const a = attemptedRef.current;
    const raw = scoreMath(c, a);
    const times = timesRef.current;
    const avgTime = times.length > 0 ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0;
    onComplete({
      moduleId: "math",
      moduleName: MODULE_NAMES.math,
      rawScore: raw,
      weight: MODULE_WEIGHTS.math,
      weightedScore: raw * MODULE_WEIGHTS.math,
      completedAt: Date.now(),
      details: {
        correct: c,
        wrong: wrongRef.current,
        attempted: a,
        accuracy: a > 0 ? Math.round((c / a) * 100) : 0,
        avgTimeMs: avgTime,
        maxDifficulty: diffRef.current,
      },
    });
  }, [onComplete]);

  const nextQuestion = useCallback((diff: number) => {
    const q = generateMathQuestion(diff);
    setQuestion(q);
    setInput("");
    setFeedback(null);
    setLastAnswer(null);
    questionStartRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const submit = useCallback(() => {
    if (expiredRef.current) return;
    const raw = input.trim();
    if (raw === "") return;
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) return;

    const elapsed = Date.now() - questionStartRef.current;
    timesRef.current.push(elapsed);

    const isCorrect = Math.abs(parsed - question.answer) < 0.01;
    setLastAnswer(question.answer);
    setFeedback(isCorrect ? "correct" : "wrong");

    // Update refs immediately (synchronous)
    attemptedRef.current += 1;
    if (isCorrect) {
      correctRef.current += 1;
      streakRef.current  += 1;
    } else {
      wrongRef.current  += 1;
      streakRef.current  = 0;
    }
    bumpDisplay();

    // Adaptive difficulty
    let newDiff = diffRef.current;
    if (streakRef.current >= 3 && newDiff < 5) {
      newDiff += 1;
      streakRef.current = 0;
    } else if (!isCorrect && newDiff > 1) {
      newDiff = Math.max(1, newDiff - 1);
    }
    diffRef.current = newDiff;
    setDifficulty(newDiff);

    setTimeout(() => {
      if (expiredRef.current) return;
      nextQuestion(newDiff);
    }, 350);
  }, [input, question, bumpDisplay, nextQuestion]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submit]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const { correct, wrong, attempted } = displayStats;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="flex gap-5">
          <div>
            <span className="text-cockpit-dim text-xs tracking-widest uppercase">Correct </span>
            <span className="text-cockpit-green number-display font-semibold">{correct}</span>
          </div>
          <div>
            <span className="text-cockpit-dim text-xs tracking-widest uppercase">Wrong </span>
            <span className="text-cockpit-red number-display font-semibold">{wrong}</span>
          </div>
          {accuracy !== null && (
            <div>
              <span className="text-cockpit-dim text-xs tracking-widest uppercase">Acc </span>
              <span className="text-cockpit-accent number-display font-semibold">{accuracy}%</span>
            </div>
          )}
        </div>
        {/* Timer reads the stable `finish` via ref inside Timer — no stale closure */}
        <Timer totalSeconds={DURATION} onExpire={finish} urgentAt={60} />
      </div>

      {/* Difficulty bar */}
      <div className="w-full max-w-lg flex items-center gap-3">
        <span className="text-cockpit-muted text-xs w-8">Lvl</span>
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((l) => (
            <div
              key={l}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${l <= difficulty ? "bg-cockpit-amber" : "bg-cockpit-border"}`}
            />
          ))}
        </div>
        <span className="text-cockpit-amber text-xs number-display w-8 text-right">{difficulty}/5</span>
      </div>

      {/* Question card */}
      <div className={`w-full max-w-lg bg-cockpit-card border rounded-sm p-10 text-center transition-all duration-200 module-enter ${
        feedback === "correct" ? "border-cockpit-green" :
        feedback === "wrong"   ? "border-cockpit-red" :
                                 "border-cockpit-border"
      }`}>
        <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-5">Solve</p>
        <p className="text-5xl font-bold number-display text-white mb-2">{question.display}</p>
        <p className="text-cockpit-dim text-3xl mb-8">= ?</p>

        <div className="flex items-center justify-center gap-3">
          <input
            ref={inputRef}
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Answer"
            className="w-44 text-center text-2xl number-display"
            autoComplete="off"
          />
          <button onClick={submit} className="btn-primary h-12 px-6" disabled={!input.trim()}>
            →
          </button>
        </div>

        {feedback && (
          <div className={`mt-4 text-sm font-semibold ${feedback === "correct" ? "text-cockpit-green" : "text-cockpit-red"}`}>
            {feedback === "correct"
              ? "Correct!"
              : `Wrong — answer was ${lastAnswer}`}
          </div>
        )}
      </div>

      {/* Streak indicator */}
      <div className="flex items-center gap-2">
        <span className="text-cockpit-dim text-xs">Streak:</span>
        {[1, 2, 3].map((n) => (
          <div key={n} className={`w-6 h-6 rounded-sm border transition-all duration-300 ${
            streakRef.current >= n ? "bg-cockpit-amber border-cockpit-amber" : "border-cockpit-border"
          }`} />
        ))}
        {streakRef.current >= 3 && (
          <span className="text-cockpit-amber text-xs ml-1">Level up!</span>
        )}
      </div>

      {/* Summary so far */}
      {attempted > 0 && (
        <div className="w-full max-w-lg grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Attempted", value: attempted, color: "text-cockpit-text" },
            { label: "Correct",   value: correct,   color: "text-cockpit-green" },
            { label: "Wrong",     value: wrong,      color: "text-cockpit-red" },
            { label: "Accuracy",  value: `${accuracy}%`, color: "text-cockpit-accent" },
          ].map((s) => (
            <div key={s.label} className="bg-cockpit-card border border-cockpit-border rounded-sm p-3">
              <div className={`number-display text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-cockpit-muted text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
