"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TestResult } from "@/types";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";

interface Props {
  onComplete: (result: TestResult) => void;
}

interface Question {
  id: number;
  text: string;
  options: string[];
  correct: number;       // index
  explanation: string;
  timeLimit: number;     // seconds
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "System alert: Alarm C triggers Alarm B which triggers Alarm A (critical). Alarm C just fired. What do you address first?",
    options: ["Alarm A (critical)", "Alarm B", "Alarm C — the root cause", "Address all simultaneously"],
    correct: 2,
    explanation: "Addressing the root cause (C) prevents the cascade to B then A.",
    timeLimit: 8,
  },
  {
    id: 2,
    text: "Option A: $50 guaranteed. Option B: 70% chance of $80, 30% chance of $0. Which has the higher expected value?",
    options: ["Option A ($50 certain)", "Option B (EV = $56)", "They're equal", "Depends on risk tolerance"],
    correct: 1,
    explanation: "Expected value of B = 0.7 × $80 = $56 > $50.",
    timeLimit: 8,
  },
  {
    id: 3,
    text: "Three casualties: severe arterial bleeding, unconscious but breathing steadily, broken arm. Standard triage — who gets immediate attention?",
    options: ["Severe bleeding", "Unconscious (breathing)", "Broken arm", "Treat all simultaneously"],
    correct: 0,
    explanation: "Arterial bleeding is immediately life-threatening. Always highest triage priority.",
    timeLimit: 8,
  },
  {
    id: 4,
    text: "6-hour window. Task X: 4h, value 10. Task Y: 3h, value 8. Task Z: 2h, value 5. What combination maximises value in exactly 6h?",
    options: ["X only (4h, value 10)", "X + Z (6h, value 15)", "Y + Z (5h, value 13)", "Y only (3h, value 8)"],
    correct: 1,
    explanation: "X + Z = 4 + 2 = 6h exactly, giving value 15 — the highest achievable.",
    timeLimit: 8,
  },
  {
    id: 5,
    text: "4 tasks, all required. Task A must complete before B or C can start. D is independent. Optimal starting task?",
    options: ["D first (it's independent)", "A first — it unblocks B and C", "B or C first", "Run all four simultaneously"],
    correct: 1,
    explanation: "A is the critical-path blocker. Completing it first maximises parallel progress.",
    timeLimit: 8,
  },
  {
    id: 6,
    text: "Two instruments show conflicting readings. A third backup instrument agrees with one. What do you trust?",
    options: ["The one reading higher", "The one the backup agrees with", "Average all three", "Ignore all; use direct observation"],
    correct: 1,
    explanation: "Two consistent sources outweigh one outlier — standard cross-reference protocol.",
    timeLimit: 8,
  },
  {
    id: 7,
    text: "A medical test is 95% accurate. The disease affects 1% of the population. You test positive. Approximate probability you actually have the disease?",
    options: ["~95%", "~50%", "Under 20%", "Under 2%"],
    correct: 2,
    explanation: "Bayes' theorem: P(disease|positive) ≈ 16%. Low base rate dominates even an accurate test.",
    timeLimit: 8,
  },
  {
    id: 8,
    text: "You discover a critical safety flaw 10 minutes before launch. Fixing it takes 25 minutes. What do you do?",
    options: ["Proceed — risk is likely low", "Delay launch to fix the flaw", "Patch it superficially in 10 minutes", "Delegate and hope"],
    correct: 1,
    explanation: "Known critical safety flaws must be resolved before proceeding, regardless of schedule pressure.",
    timeLimit: 8,
  },
  {
    id: 9,
    text: "Team of 4. Task 1 needs 3 people for 2h. Task 2 needs 1 person for 6h. Best split?",
    options: ["All 4 on Task 1, then Task 2", "3 on Task 1 + 1 on Task 2 simultaneously", "2 and 2 split", "Task 2 first"],
    correct: 1,
    explanation: "3 finish Task 1 in 2h while 1 starts Task 2. Then all 4 finish Task 2 together.",
    timeLimit: 8,
  },
  {
    id: 10,
    text: "Stress increases with time pressure. You have one minute left and three tasks. Task A is critical. Task B is urgent. Task C is optional. Priority?",
    options: ["A → B (skip C)", "B → A → C", "C → B → A", "All three at once"],
    correct: 0,
    explanation: "Critical precedes urgent. Optional tasks are dropped under severe time pressure.",
    timeLimit: 8,
  },
];

export default function PressureDecision({ onComplete }: Props) {
  const [started, setStarted] = useState(false);
  const [qIdx, setQIdx]       = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFb, setShowFb]     = useState(false);
  const [scores, setScores]     = useState<number[]>([]);
  const [history, setHistory]   = useState<{ correct: boolean; time: number }[]>([]);
  const qStartRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef  = useRef(false);

  const startQuestion = useCallback((idx: number) => {
    setSelected(null);
    setShowFb(false);
    setTimeLeft(QUESTIONS[idx].timeLimit);
    qStartRef.current = Date.now();
    expiredRef.current = false;

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          if (!expiredRef.current) {
            expiredRef.current = true;
            // Timed out — treat as wrong with full time
            const hist = { correct: false, time: QUESTIONS[idx].timeLimit * 1000 };
            setHistory((h) => [...h, hist]);
            setScores((s) => [...s, 0]);
            setSelected(-1); // signals "timed out"
            setShowFb(true);
            setTimeout(() => {
              const next = idx + 1;
              if (next >= QUESTIONS.length) { finish([...scores, 0], [...history, hist]); return; }
              setQIdx(next);
              startQuestion(next);
            }, 1400);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [scores, history]);

  const handleChoice = useCallback((choiceIdx: number) => {
    if (showFb || expiredRef.current || selected !== null) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    expiredRef.current = true;

    const elapsed = Date.now() - qStartRef.current;
    const q = QUESTIONS[qIdx];
    const isCorrect = choiceIdx === q.correct;

    // Score: correct = up to 10pts based on speed; wrong = 0
    const maxTime = q.timeLimit * 1000;
    const pts = isCorrect ? Math.round(10 * (1 - (elapsed / maxTime) * 0.5)) : 0;

    const hist = { correct: isCorrect, time: elapsed };
    setHistory((h) => [...h, hist]);
    setScores((s) => [...s, pts]);
    setSelected(choiceIdx);
    setShowFb(true);

    setTimeout(() => {
      const next = qIdx + 1;
      if (next >= QUESTIONS.length) { finish([...scores, pts], [...history, hist]); return; }
      setQIdx(next);
      startQuestion(next);
    }, 1400);
  }, [showFb, selected, qIdx, scores, history, startQuestion]);

  function finish(finalScores: number[], finalHistory: { correct: boolean; time: number }[]) {
    const totalPts = finalScores.reduce((a, b) => a + b, 0);
    const maxPts   = QUESTIONS.length * 10;
    const score    = Math.round((totalPts / maxPts) * 100);
    const correct  = finalHistory.filter((h) => h.correct).length;
    const avgTime  = Math.round(finalHistory.reduce((s, h) => s + h.time, 0) / finalHistory.length);

    onComplete({
      testId: "pressure",
      testName: "Pressure Decision Test",
      score,
      percentileEstimate: scoreToPercentile(score),
      resultTitle: getResultTitle("pressure", score),
      resultDescription: getResultDescription("pressure", score),
      rawMetrics: {
        correct,
        wrong: QUESTIONS.length - correct,
        "avg time (ms)": avgTime,
        "total points": totalPts,
      },
      createdAt: new Date().toISOString(),
    });
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!started) return;
      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in map) handleChoice(map[e.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [started, handleChoice]);

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Pressure Decision Test</h2>
        <p className="text-cockpit-dim max-w-sm leading-relaxed">
          10 scenarios. 8 seconds each. Speed and accuracy both contribute to your score.
          Press <kbd className="bg-cockpit-card border border-cockpit-border px-2 py-0.5 rounded text-xs">1–4</kbd> or click your answer.
        </p>
        <button className="btn-primary" onClick={() => { setStarted(true); startQuestion(0); }}>
          Begin Test
        </button>
      </div>
    );
  }

  const q = QUESTIONS[qIdx];
  const pct = timeLeft / q.timeLimit;

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {QUESTIONS.map((_, i) => {
            const h = history[i];
            return (
              <div key={i} className={`w-2 h-2 rounded-full ${h ? (h.correct ? "bg-cockpit-green" : "bg-cockpit-red") : i === qIdx ? "bg-cockpit-accent animate-pulse" : "bg-cockpit-border"}`} />
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-cockpit-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 3 ? "bg-cockpit-red" : "bg-cockpit-accent"}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <span className={`number-display text-sm font-semibold ${timeLeft <= 3 ? "text-cockpit-red animate-pulse" : "text-cockpit-accent"}`}>{timeLeft}s</span>
        </div>
      </div>

      {/* Question */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-8 module-enter">
        <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-4">Question {qIdx + 1} of {QUESTIONS.length}</p>
        <p className="text-white text-base leading-relaxed mb-8">{q.text}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct;
            const isSelected = selected === i;
            let cls = "border-cockpit-border hover:border-cockpit-accent hover:bg-cockpit-surface";
            if (showFb && isCorrect) cls = "border-cockpit-green bg-cockpit-green bg-opacity-10";
            else if (showFb && isSelected && !isCorrect) cls = "border-cockpit-red bg-cockpit-red bg-opacity-10";

            return (
              <button
                key={i}
                onClick={() => handleChoice(i)}
                disabled={showFb}
                className={`text-left p-4 border rounded-sm transition-all duration-100 text-sm text-cockpit-dim ${cls}`}
              >
                <span className="text-cockpit-muted font-mono text-xs mr-2">{i + 1}.</span>
                {opt}
              </button>
            );
          })}
        </div>

        {showFb && (
          <div className={`mt-5 px-4 py-3 rounded-sm border text-xs leading-relaxed ${selected === q.correct ? "border-cockpit-green border-opacity-40 text-cockpit-green" : "border-cockpit-red border-opacity-40 text-cockpit-red"}`}>
            {selected === -1 ? "⏱ Time's up — " : selected === q.correct ? "✓ Correct — " : "✗ Wrong — "}
            {q.explanation}
          </div>
        )}
      </div>

      <p className="text-cockpit-muted text-xs text-center">Press 1–4 to select</p>
    </div>
  );
}
