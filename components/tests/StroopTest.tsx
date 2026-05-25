"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TestResult } from "@/types";
import { scoreToPercentile, getResultTitle, getResultDescription } from "@/lib/percentile";

interface Props {
  onComplete: (result: TestResult) => void;
}

// ── Colour definitions ────────────────────────────────────────────────────────
const COLORS = [
  { id: "RED",    label: "RED",    hex: "#ff3d00" },
  { id: "BLUE",   label: "BLUE",  hex: "#2979ff" },
  { id: "GREEN",  label: "GREEN", hex: "#00e676" },
  { id: "YELLOW", label: "YELLOW", hex: "#ffab00" },
] as const;

type ColorId = (typeof COLORS)[number]["id"];

// Incongruent pairs: word ≠ ink (harder — brain fights itself)
const INCONGRUENT: { word: ColorId; ink: ColorId }[] = [
  { word: "RED",    ink: "BLUE"   },
  { word: "RED",    ink: "GREEN"  },
  { word: "RED",    ink: "YELLOW" },
  { word: "BLUE",   ink: "RED"    },
  { word: "BLUE",   ink: "GREEN"  },
  { word: "BLUE",   ink: "YELLOW" },
  { word: "GREEN",  ink: "RED"    },
  { word: "GREEN",  ink: "BLUE"   },
  { word: "GREEN",  ink: "YELLOW" },
  { word: "YELLOW", ink: "RED"    },
  { word: "YELLOW", ink: "BLUE"   },
  { word: "YELLOW", ink: "GREEN"  },
];

// Congruent pairs: word === ink — creates false confidence, traps fast responders
const CONGRUENT: { word: ColorId; ink: ColorId }[] = [
  { word: "RED",    ink: "RED"    },
  { word: "BLUE",   ink: "BLUE"   },
  { word: "GREEN",  ink: "GREEN"  },
  { word: "YELLOW", ink: "YELLOW" },
];

const TOTAL_TRIALS = 24;
const TIME_LIMIT_MS = 1200; // 1.2s per trial (~29s total) — fast enough to cause errors

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTrials(): { word: ColorId; ink: ColorId }[] {
  // 18 incongruent + 6 congruent = 24 total
  // INCONGRUENT only has 12 pairs, so double the pool before slicing to 18
  const incPool = [...INCONGRUENT, ...INCONGRUENT];
  const inc = shuffle(incPool).slice(0, 18);
  const con = shuffle([...CONGRUENT, ...CONGRUENT]).slice(0, 6);
  return shuffle([...inc, ...con]);
}

type Feedback = "correct" | "wrong" | "timeout" | null;

export default function StroopTest({ onComplete }: Props) {
  const [started,  setStarted]  = useState(false);
  const [trialIdx, setTrialIdx] = useState(0);
  const [trials,   setTrials]   = useState<{ word: ColorId; ink: ColorId }[]>([]);
  const [correct,  setCorrect]  = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [timeBar,  setTimeBar]  = useState(100); // % remaining

  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barInterval   = useRef<ReturnType<typeof setInterval> | null>(null);
  const correctRef    = useRef(0);
  const trialIdxRef   = useRef(0);
  const trialsRef     = useRef<typeof trials>([]);

  const clearTimers = () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (timeoutTimer.current)  clearTimeout(timeoutTimer.current);
    if (barInterval.current)   clearInterval(barInterval.current);
  };

  const nextTrial = useCallback((nextIdx: number, allTrials: typeof trials, score: number) => {
    setFeedback(null);
    if (nextIdx >= TOTAL_TRIALS) {
      const pctScore = Math.round((score / TOTAL_TRIALS) * 100);
      onComplete({
        testId: "stroop",
        testName: "Stroop Test",
        score: pctScore,
        percentileEstimate: scoreToPercentile(pctScore),
        resultTitle: getResultTitle("stroop", pctScore),
        resultDescription: getResultDescription("stroop", pctScore),
        rawMetrics: {
          correct: score,
          total: TOTAL_TRIALS,
          accuracy: `${pctScore}%`,
        },
        createdAt: new Date().toISOString(),
      });
      return;
    }

    trialIdxRef.current = nextIdx;
    setTrialIdx(nextIdx);
    setTimeBar(100);

    // Progress bar animation
    const startTime = Date.now();
    barInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.max(0, 100 - (elapsed / TIME_LIMIT_MS) * 100);
      setTimeBar(pct);
    }, 30);

    // Auto-timeout
    timeoutTimer.current = setTimeout(() => {
      clearInterval(barInterval.current!);
      setFeedback("timeout");
      feedbackTimer.current = setTimeout(() => {
        nextTrial(trialIdxRef.current + 1, trialsRef.current, correctRef.current);
      }, 600);
    }, TIME_LIMIT_MS);
  }, [onComplete]);

  const start = useCallback(() => {
    const t = buildTrials();
    trialsRef.current = t;
    setTrials(t);
    correctRef.current = 0;
    setCorrect(0);
    setStarted(true);
    trialIdxRef.current = 0;
    nextTrial(0, t, 0);
  }, [nextTrial]);

  const handleAnswer = useCallback((colorId: ColorId) => {
    if (feedback) return;
    clearTimers();

    const current   = trialsRef.current[trialIdxRef.current];
    const isCorrect = colorId === current.ink;
    let newScore    = correctRef.current;
    if (isCorrect) { newScore += 1; correctRef.current = newScore; setCorrect(newScore); }

    const fb: Feedback = isCorrect ? "correct" : "wrong";
    setFeedback(fb);
    setTimeBar(0);

    feedbackTimer.current = setTimeout(() => {
      nextTrial(trialIdxRef.current + 1, trialsRef.current, newScore);
    }, 450);
  }, [feedback, nextTrial]);

  // Keyboard: 1/2/3/4
  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < COLORS.length) handleAnswer(COLORS[idx].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, handleAnswer]);

  useEffect(() => () => clearTimers(), []);

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-8 py-10 text-center max-w-sm">
        <h2 className="text-2xl font-bold text-white">Stroop Test</h2>
        <p className="text-cockpit-dim leading-relaxed text-sm">
          A coloured word appears. Tap the button that matches the{" "}
          <span className="text-white font-semibold">ink colour</span> —{" "}
          not the word it spells. Your brain will fight you on this.
        </p>

        {/* Demo */}
        <div className="bg-cockpit-card border border-cockpit-border rounded-sm p-5 w-full">
          <p className="text-cockpit-muted text-xs mb-3 font-mono">Example — tap the ink colour:</p>
          <p className="text-5xl font-extrabold text-center" style={{ color: "#00e676" }}>RED</p>
          <p className="text-cockpit-muted text-xs mt-3 text-center">Answer: <span style={{ color: "#00e676" }}>GREEN</span></p>
        </div>

        <div className="text-cockpit-muted text-xs space-y-1">
          <p>📱 {TOTAL_TRIALS} trials · ~30 seconds · mix of congruent &amp; incongruent</p>
          <p>⌨️ Keyboard: 1=Red · 2=Blue · 3=Green · 4=Yellow</p>
        </div>

        <button className="btn-primary" onClick={start}>
          Begin Test
        </button>
      </div>
    );
  }

  const current = trials[trialIdx];
  const inkHex  = COLORS.find((c) => c.id === current?.ink)?.hex ?? "#ffffff";

  const cardBg =
    feedback === "correct" ? "#00e67610"
    : feedback === "wrong" || feedback === "timeout" ? "#ff3d0010"
    : "#0d1117";

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between w-full px-1 text-xs text-cockpit-muted font-mono">
        <span>{trialIdx + 1} / {TOTAL_TRIALS}</span>
        <span className="text-cockpit-green">{correct} correct</span>
      </div>

      {/* Time bar */}
      <div className="w-full h-1 bg-cockpit-border rounded-full overflow-hidden">
        <div
          className="h-full transition-none"
          style={{
            width: `${timeBar}%`,
            background: timeBar > 50 ? "#00e676" : timeBar > 25 ? "#ffab00" : "#ff3d00",
          }}
        />
      </div>

      {/* Word */}
      <div
        className="w-full h-44 rounded-sm border flex items-center justify-center transition-colors duration-150"
        style={{
          background: cardBg,
          borderColor: feedback === "correct" ? "#00e67650" : feedback === "wrong" ? "#ff3d0050" : "#1e2a38",
        }}
      >
        {feedback === "timeout" ? (
          <p className="text-cockpit-muted text-lg font-bold">Too slow!</p>
        ) : (
          <span
            key={trialIdx}
            className="text-5xl font-extrabold tracking-widest module-enter"
            style={{ color: inkHex }}
          >
            {current?.word}
          </span>
        )}
      </div>

      {/* Tap the ink colour */}
      <p className="text-cockpit-muted text-xs">Tap the ink colour ↓</p>

      {/* Colour buttons */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {COLORS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => handleAnswer(c.id)}
            disabled={!!feedback}
            className="py-5 rounded-sm border text-base font-extrabold tracking-wide transition-all duration-100 active:scale-95"
            style={{
              background: `${c.hex}10`,
              borderColor: `${c.hex}40`,
              color: c.hex,
            }}
          >
            <span className="text-cockpit-muted text-xs font-normal mr-1.5">{i + 1}</span>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
