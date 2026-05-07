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
  correct: number;
  explanation: string;
}

const TIME_LIMIT   = 15;  // seconds per question (answering phase)
const READ_SECS    = 2;   // silent read phase before countdown starts
const FEEDBACK_MS  = 1800; // how long to show feedback before next question

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Alarm C triggers B, which triggers A (critical). Alarm C just fired. What do you fix first?",
    options: [
      "Alarm A — it's the critical one",
      "Alarm B — middle of the chain",
      "Alarm C — the root cause",
      "All three simultaneously",
    ],
    correct: 2,
    explanation: "Stop the root cause (C) and the cascade never reaches A.",
  },
  {
    id: 2,
    text: "Option A: $50 guaranteed. Option B: 70% chance of $80, 30% chance of $0. Which has the higher expected value?",
    options: [
      "Option A ($50 certain)",
      "Option B (EV = $56)",
      "They're equal",
      "Depends on risk tolerance",
    ],
    correct: 1,
    explanation: "EV of B = 0.7 × $80 = $56. Higher than $50, regardless of risk preference.",
  },
  {
    id: 3,
    text: "Three casualties: arterial bleeding, unconscious but breathing steadily, broken arm. Standard triage — who goes first?",
    options: [
      "Arterial bleeding",
      "Unconscious (breathing)",
      "Broken arm",
      "Assess all before deciding",
    ],
    correct: 0,
    explanation: "Arterial bleeding is immediately fatal. Always the highest triage priority.",
  },
  {
    id: 4,
    text: "6 hours available. Task X: 4h, value 10. Task Y: 3h, value 8. Task Z: 2h, value 5. Best combination?",
    options: [
      "X only — 4h, value 10",
      "X + Z — 6h, value 15",
      "Y + Z — 5h, value 13",
      "Y only — 3h, value 8",
    ],
    correct: 1,
    explanation: "X + Z fills exactly 6h and returns value 15 — the highest possible.",
  },
  {
    id: 5,
    text: "A must finish before B or C can start. D is independent. You have one time slot. What do you tackle first?",
    options: [
      "D — it's unblocked",
      "A — it unblocks B and C",
      "B or C — your choice",
      "Start all four at once",
    ],
    correct: 1,
    explanation: "A is the bottleneck. Finishing it first unlocks the most parallel work.",
  },
  {
    id: 6,
    text: "Two instruments show conflicting readings. A third backup agrees with one of them. Which do you trust?",
    options: [
      "The one showing higher values",
      "The one the backup agrees with",
      "Average all three",
      "Ignore all; observe directly",
    ],
    correct: 1,
    explanation: "Two consistent sources outweigh one outlier — standard cross-check protocol.",
  },
  {
    id: 7,
    text: "A test is 95% accurate. The disease affects 1% of people. You test positive. Approximate chance you actually have it?",
    options: [
      "About 95%",
      "About 50%",
      "Under 20%",
      "Under 2%",
    ],
    correct: 2,
    explanation: "Bayes' theorem gives ~16%. Low base rate (1%) dominates even an accurate test.",
  },
  {
    id: 8,
    text: "Critical safety flaw found 10 minutes before launch. Fixing it takes 25 minutes. What do you do?",
    options: [
      "Proceed — risk is probably low",
      "Delay launch and fix it",
      "Quick patch in 10 minutes",
      "Delegate and monitor",
    ],
    correct: 1,
    explanation: "Known critical safety flaws are non-negotiable. Schedule pressure doesn't override safety.",
  },
  {
    id: 9,
    text: "Team of 4. Task 1 needs 3 people for 2h. Task 2 needs 1 person for 6h. What's the fastest overall approach?",
    options: [
      "All 4 on Task 1, then Task 2",
      "3 on Task 1 + 1 starts Task 2 now",
      "Split 2 and 2",
      "Task 2 first, then Task 1",
    ],
    correct: 1,
    explanation: "Running tasks in parallel: Task 1 finishes in 2h while Task 2 gets a 2h head start.",
  },
  {
    id: 10,
    text: "One minute left. Task A is critical. Task B is urgent. Task C is optional. You can't do all three. Priority?",
    options: [
      "A then B — skip C",
      "B then A — urgency first",
      "C, B, A — easiest first",
      "All three at half effort",
    ],
    correct: 0,
    explanation: "Critical beats urgent. Optional is dropped under time pressure. Always.",
  },
];

type Phase = "reading" | "answering" | "feedback";

export default function PressureDecision({ onComplete }: Props) {
  const [started, setStarted]   = useState(false);
  const [qIdx, setQIdx]         = useState(0);
  const [phase, setPhase]       = useState<Phase>("reading");
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [selected, setSelected] = useState<number | null>(null); // -1 = timed out
  const [scores, setScores]     = useState<number[]>([]);
  const [history, setHistory]   = useState<{ correct: boolean; time: number }[]>([]);

  const intervalRef  = useRef<ReturnType<typeof setInterval>  | null>(null);
  const readTimerRef = useRef<ReturnType<typeof setTimeout>   | null>(null);
  const lockedRef    = useRef(false); // prevents double-fire
  const qStartRef    = useRef(0);

  // ── Finish the whole test ───────────────────────────────────────────────
  const finish = useCallback((finalScores: number[], finalHistory: { correct: boolean; time: number }[]) => {
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
      resultTitle:        getResultTitle("pressure", score),
      resultDescription:  getResultDescription("pressure", score),
      rawMetrics: {
        correct,
        wrong:          QUESTIONS.length - correct,
        "avg time (ms)": avgTime,
        "total points":  totalPts,
      },
      createdAt: new Date().toISOString(),
    });
  }, [onComplete]);

  // ── Advance to next question (or finish) ────────────────────────────────
  const advance = useCallback((nextIdx: number, latestScores: number[], latestHistory: { correct: boolean; time: number }[]) => {
    if (nextIdx >= QUESTIONS.length) {
      finish(latestScores, latestHistory);
      return;
    }

    // Reset for new question
    lockedRef.current = false;
    setQIdx(nextIdx);
    setSelected(null);
    setTimeLeft(TIME_LIMIT);
    setPhase("reading");
  }, [finish]);

  // ── Commit an answer (correct, wrong, or timed-out) ─────────────────────
  const commitAnswer = useCallback((choiceIdx: number, elapsed: number, currentIdx: number, currentScores: number[], currentHistory: { correct: boolean; time: number }[]) => {
    if (intervalRef.current)  { clearInterval(intervalRef.current);  intervalRef.current  = null; }
    if (readTimerRef.current) { clearTimeout(readTimerRef.current);  readTimerRef.current = null; }

    const q         = QUESTIONS[currentIdx];
    const isCorrect = choiceIdx === q.correct;
    const pts       = isCorrect
      ? Math.max(3, Math.round(10 - (elapsed / (TIME_LIMIT * 1000)) * 6))
      : 0;

    const hist        = { correct: isCorrect, time: elapsed };
    const nextScores  = [...currentScores, pts];
    const nextHistory = [...currentHistory, hist];

    setHistory(nextHistory);
    setScores(nextScores);
    setSelected(choiceIdx);
    setPhase("feedback");

    setTimeout(() => advance(currentIdx + 1, nextScores, nextHistory), FEEDBACK_MS);
  }, [advance]);

  // ── Handle user clicking / pressing a key ───────────────────────────────
  const handleChoice = useCallback((choiceIdx: number) => {
    if (phase !== "answering") return;
    if (lockedRef.current) return;
    lockedRef.current = true;

    const elapsed = Date.now() - qStartRef.current;
    commitAnswer(choiceIdx, elapsed, qIdx, scores, history);
  }, [phase, qIdx, scores, history, commitAnswer]);

  // ── Start read phase then answering phase ───────────────────────────────
  const beginQuestion = useCallback(() => {
    lockedRef.current = false;
    setPhase("reading");
    setSelected(null);
    setTimeLeft(TIME_LIMIT);

    readTimerRef.current = setTimeout(() => {
      setPhase("answering");
      qStartRef.current = Date.now();

      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            if (!lockedRef.current) {
              lockedRef.current = true;
              // Use functional setState to capture current idx/scores/history
              setQIdx((idx) => {
                setScores((sc) => {
                  setHistory((hi) => {
                    commitAnswer(-1, TIME_LIMIT * 1000, idx, sc, hi);
                    return hi;
                  });
                  return sc;
                });
                return idx;
              });
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }, READ_SECS * 1000);
  }, [commitAnswer]);

  // Re-run beginQuestion whenever qIdx changes (and test is started)
  useEffect(() => {
    if (!started) return;
    beginQuestion();
    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, qIdx]);

  // ── Keyboard handler ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!started) return;
      const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
      if (e.key in map) handleChoice(map[e.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [started, handleChoice]);

  // ── Intro screen ────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="flex flex-col items-center gap-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Pressure Decision Test</h2>
        <div className="text-cockpit-dim max-w-sm leading-relaxed space-y-2">
          <p>10 questions. 15 seconds each to answer.</p>
          <p>Read the question, then decide. Speed and accuracy both count.</p>
          <p className="text-cockpit-muted text-sm">
            Press <kbd className="bg-cockpit-card border border-cockpit-border px-1.5 py-0.5 rounded text-xs font-mono">1–4</kbd> or tap an option.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setStarted(true)}>
          Begin Test
        </button>
      </div>
    );
  }

  const q      = QUESTIONS[qIdx];
  const timePct = timeLeft / TIME_LIMIT;
  const urgent  = timeLeft <= 4 && phase === "answering";

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">

      {/* ── Progress dots + timer ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {QUESTIONS.map((_, i) => {
            const h = history[i];
            return (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  h
                    ? h.correct
                      ? "bg-cockpit-green"
                      : "bg-cockpit-red"
                    : i === qIdx
                    ? "bg-cockpit-accent animate-pulse"
                    : "bg-cockpit-border"
                }`}
              />
            );
          })}
        </div>

        {/* Timer — only visible during answering */}
        <div className={`flex items-center gap-2 transition-opacity duration-300 ${phase === "answering" || phase === "feedback" ? "opacity-100" : "opacity-0"}`}>
          <div className="w-24 h-1.5 bg-cockpit-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 linear ${urgent ? "bg-cockpit-red" : "bg-cockpit-accent"}`}
              style={{ width: `${timePct * 100}%` }}
            />
          </div>
          <span className={`number-display text-sm font-semibold w-6 text-right ${urgent ? "text-cockpit-red animate-pulse" : "text-cockpit-accent"}`}>
            {phase === "feedback" ? "" : `${timeLeft}s`}
          </span>
        </div>
      </div>

      {/* ── Question card ─────────────────────────────────────────────── */}
      <div className="bg-cockpit-card border border-cockpit-border rounded-sm overflow-hidden module-enter">

        {/* Read phase banner */}
        {phase === "reading" && (
          <div className="flex items-center gap-2 px-6 py-2.5 border-b border-cockpit-border bg-cockpit-surface">
            <span className="w-1.5 h-1.5 rounded-full bg-cockpit-amber animate-pulse" />
            <span className="text-cockpit-amber text-xs tracking-widest uppercase font-mono">
              Read — timer starts in {READ_SECS}s
            </span>
          </div>
        )}

        <div className="p-6 sm:p-8">
          <p className="text-cockpit-muted text-xs tracking-widest uppercase mb-4 font-mono">
            Question {qIdx + 1} of {QUESTIONS.length}
          </p>
          <p className="text-white text-base sm:text-lg leading-relaxed mb-7">{q.text}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {q.options.map((opt, i) => {
              const isCorrect  = i === q.correct;
              const isSelected = selected === i;
              const isFeedback = phase === "feedback";

              let cls = "border-cockpit-border text-cockpit-dim hover:border-cockpit-accent hover:text-white";
              if (isFeedback && isCorrect)             cls = "border-cockpit-green text-cockpit-green bg-cockpit-green bg-opacity-8";
              else if (isFeedback && isSelected && !isCorrect) cls = "border-cockpit-red text-cockpit-red bg-cockpit-red bg-opacity-8";
              else if (isFeedback)                     cls = "border-cockpit-border text-cockpit-muted opacity-50";
              else if (phase === "reading")            cls = "border-cockpit-border text-cockpit-dim opacity-70 cursor-default";

              return (
                <button
                  key={i}
                  onClick={() => handleChoice(i)}
                  disabled={phase !== "answering"}
                  className={`text-left p-4 border rounded-sm transition-all duration-100 text-sm ${cls}`}
                >
                  <span className="font-mono text-xs opacity-60 mr-2">{i + 1}.</span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {phase === "feedback" && (
            <div
              className={`mt-5 px-4 py-3 rounded-sm border text-xs leading-relaxed ${
                selected === q.correct
                  ? "border-cockpit-green border-opacity-40 text-cockpit-green"
                  : "border-cockpit-red border-opacity-40 text-cockpit-red"
              }`}
            >
              {selected === -1
                ? "⏱ Time's up — "
                : selected === q.correct
                ? "✓ Correct — "
                : "✗ Wrong — "}
              {q.explanation}
            </div>
          )}
        </div>
      </div>

      <p className="text-cockpit-muted text-xs text-center">
        {phase === "reading" ? "Take a moment to read the question" : phase === "answering" ? "Press 1–4 to select" : ""}
      </p>
    </div>
  );
}
