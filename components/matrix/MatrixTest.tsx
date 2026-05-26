"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CellSvg, EmptyCellSvg } from "@/lib/matrix/cells";
import {
  createSession, selectNextQuestion, recordAttempt, isComplete, TOTAL_QUESTIONS,
} from "@/lib/matrix/adaptive";
import { calculateResult } from "@/lib/matrix/scoring";
import type { MatrixQuestion, SessionState, AssessmentResult, Cell } from "@/lib/matrix/types";
import ResultReveal from "./ResultReveal";

// ── Types ─────────────────────────────────────────────────────

type Phase = "intro" | "question" | "feedback" | "processing" | "result";

// ── Timer bar ─────────────────────────────────────────────────

function TimerBar({ pct, warn }: { pct: number; warn: boolean }) {
  const color = warn ? (pct < 20 ? "#ff3d00" : "#ffab00") : "#00d4ff";
  return (
    <div className="w-full h-1 bg-cockpit-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, transition: "width 0.1s linear" }}
      />
    </div>
  );
}

// ── Matrix grid ───────────────────────────────────────────────

function MatrixGrid({
  question,
  revealCorrect,
  cellSize,
}: {
  question:      MatrixQuestion;
  revealCorrect: boolean;
  cellSize:      number;
}) {
  return (
    <div
      className="grid gap-1 p-1 rounded-sm border"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        background:   "#0a1018",
        borderColor:  "#1e2a38",
        width:        cellSize * 3 + 8 + 4, // cells + gaps + padding
      }}
    >
      {question.cells.map((cell, i) => {
        const isMissing = cell === null;
        return (
          <div
            key={i}
            className="flex items-center justify-center rounded-sm"
            style={{
              width:      cellSize,
              height:     cellSize,
              background: isMissing ? "#00d4ff08" : "#111820",
              border:     isMissing ? "1.5px dashed #00d4ff60" : "1px solid #1e2a38",
            }}
          >
            {isMissing
              ? <EmptyCellSvg size={cellSize - 8} />
              : <CellSvg cell={cell} size={cellSize - 8} />
            }
          </div>
        );
      })}
    </div>
  );
}

// ── Option button ─────────────────────────────────────────────

function OptionButton({
  cell,
  label,
  size,
  state,
  onClick,
}: {
  cell:    Cell;
  label:   string;
  size:    number;
  state:   "idle" | "selected" | "correct" | "wrong";
  onClick: () => void;
}) {
  const borderColor =
    state === "correct" ? "#00e676" :
    state === "wrong"   ? "#ff3d00" :
    state === "selected"? "#00d4ff" : "#1e2a38";

  const bg =
    state === "correct" ? "#00e67610" :
    state === "wrong"   ? "#ff3d0010" :
    state === "selected"? "#00d4ff0a" : "#111820";

  const glow =
    state === "correct" ? "0 0 12px #00e67640" :
    state === "wrong"   ? "0 0 12px #ff3d0040" : "none";

  return (
    <button
      onClick={onClick}
      disabled={state !== "idle"}
      className="relative flex items-center justify-center rounded-sm transition-all duration-100 active:scale-95 focus:outline-none select-none"
      style={{
        width:      size,
        height:     size,
        background: bg,
        border:     `1.5px solid ${borderColor}`,
        boxShadow:  glow,
      }}
    >
      {/* Label badge */}
      <span
        className="absolute top-1.5 left-2 text-[9px] font-black font-mono tracking-widest"
        style={{ color: borderColor === "#1e2a38" ? "#2a3a4a" : borderColor }}
      >
        {label}
      </span>
      <CellSvg cell={cell} size={size - 16} />
    </button>
  );
}

// ── Intro screen ──────────────────────────────────────────────

function IntroScreen({ onBegin }: { onBegin: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t); }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
      {/* Pulsing logo */}
      <div className="flex flex-col items-center gap-4"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.6s" }}>
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-cockpit-accent flex items-center justify-center"
            style={{ boxShadow: "0 0 40px #00d4ff30, 0 0 80px #00d4ff15" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
            </svg>
          </div>
          <div className="absolute inset-0 rounded-full border border-cockpit-accent/20 animate-ping" style={{ animationDuration: "2s" }} />
        </div>

        <div className="text-center">
          <p className="text-[10px] font-mono tracking-[0.3em] text-cockpit-muted uppercase mb-2">
            SuperBrain · Cognitive Lab
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Fluid Intelligence<br />
            <span style={{ color: "#00d4ff" }}>Assessment</span>
          </h1>
          <p className="text-cockpit-muted text-xs font-mono mt-1 tracking-widest uppercase">
            Matrix Reasoning · Adaptive
          </p>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.6s 0.2s" }}>
        {[
          ["▸ Abstract reasoning",     "Pattern recognition"],
          ["▸ Logical inference",      "Relational thinking"],
          ["▸ Processing speed",       "Cognitive efficiency"],
          ["▸ Adaptive difficulty",    "Precision estimation"],
        ].map(([a, b]) => (
          <div key={a} className="bg-cockpit-card border border-cockpit-border rounded-sm px-3 py-2">
            <p className="text-cockpit-accent text-[10px] font-mono">{a}</p>
            <p className="text-cockpit-muted text-[10px]">{b}</p>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-center"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.6s 0.35s" }}>
        {[
          ["~12 min",         "Duration"],
          [`${TOTAL_QUESTIONS} questions`, "Adaptive"],
          ["8 patterns",      "Question types"],
        ].map(([v, l]) => (
          <div key={l}>
            <p className="text-white font-black text-lg number-display">{v}</p>
            <p className="text-cockpit-muted text-[10px] uppercase tracking-widest">{l}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-cockpit-border text-[10px] text-center max-w-xs leading-relaxed"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.6s 0.45s" }}>
        This assessment provides a Cognitive Ability Estimate based on fluid reasoning performance.
        It is not a certified clinical measurement.
      </p>

      <button
        onClick={onBegin}
        disabled={!ready}
        className="w-full max-w-xs py-4 rounded-sm font-black text-sm tracking-[0.2em] uppercase transition-all active:scale-[0.98]"
        style={{
          background:  ready ? "#00d4ff" : "#1e2a38",
          color:       ready ? "#0d1117" : "#2a3a4a",
          boxShadow:   ready ? "0 0 30px #00d4ff30" : "none",
          opacity:     ready ? 1 : 0,
          transition:  "opacity 0.6s 0.55s, background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.1s",
        }}
      >
        Begin Assessment →
      </button>
    </div>
  );
}

// ── Processing screen ─────────────────────────────────────────

function ProcessingScreen() {
  const [step, setStep]   = useState(0);
  const [pct,  setPct]    = useState(0);

  const steps = [
    "Analyzing response patterns…",
    "Estimating ability level…",
    "Computing cognitive profile…",
    "Calibrating percentile…",
  ];

  useEffect(() => {
    const iv = setInterval(() => setPct(p => Math.min(100, p + 1.5)), 40);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setStep(s => Math.min(steps.length - 1, s + 1)), 620);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
      <div className="w-16 h-16 rounded-full border-2 border-cockpit-accent flex items-center justify-center animate-spin"
        style={{ boxShadow: "0 0 30px #00d4ff20", animationDuration: "3s" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="1.5">
          <path d="M12 2a10 10 0 1 0 10 10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>

      <div className="text-center">
        <p className="text-cockpit-accent text-sm font-mono tracking-widest animate-pulse">
          {steps[step]}
        </p>
      </div>

      <div className="w-full max-w-xs">
        <div className="w-full h-1 bg-cockpit-border rounded-full overflow-hidden">
          <div className="h-full bg-cockpit-accent rounded-full transition-all duration-100"
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-cockpit-border text-[10px] font-mono text-right mt-1">{Math.round(pct)}%</p>
      </div>
    </div>
  );
}

// ── Main test component ───────────────────────────────────────

export default function MatrixTest({ userId }: { userId?: string }) {
  const [phase,    setPhase]    = useState<Phase>("intro");
  const [session,  setSession]  = useState<SessionState | null>(null);
  const [question, setQuestion] = useState<MatrixQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);   // option index
  const [timerPct, setTimerPct] = useState(100);
  const [result,   setResult]   = useState<AssessmentResult | null>(null);
  const [seedOffset, setSeedOffset] = useState(0);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMsRef  = useRef<number>(0);
  const sessionRef  = useRef<SessionState | null>(null);

  // Keep ref in sync for use in event handlers without stale closures
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Anti-cheat: focus / visibility tracking ────────────────
  useEffect(() => {
    if (phase !== "question") return;
    const handler = () => {
      if (document.hidden && sessionRef.current) {
        setSession(s => s ? { ...s, focusViolations: s.focusViolations + 1 } : s);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [phase]);

  // ── Timer ──────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((limitSec: number) => {
    clearTimer();
    startMsRef.current = Date.now();
    setTimerPct(100);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startMsRef.current;
      const pct     = Math.max(0, 100 - (elapsed / (limitSec * 1000)) * 100);
      setTimerPct(pct);

      if (pct <= 0) {
        clearTimer();
        // Timeout — record as wrong
        handleAnswer(-1, limitSec * 1000);
      }
    }, 80);
  }, [clearTimer]);

  // ── Advance to next question ───────────────────────────────
  const advance = useCallback((sess: SessionState) => {
    clearTimer();
    if (isComplete(sess)) {
      setPhase("processing");
      const res = calculateResult(sess);
      setTimeout(() => { setResult(res); setPhase("result"); }, 2600);
      return;
    }
    const offset = seedOffset + 1 + (sess.attempts.length * 13);
    setSeedOffset(offset);
    const q = selectNextQuestion(sess, offset);
    setQuestion(q);
    setSelected(null);
    setPhase("question");
    setTimeout(() => startTimer(q.timeLimit), 50);
  }, [clearTimer, seedOffset, startTimer]);

  // ── Answer handler ─────────────────────────────────────────
  const handleAnswer = useCallback((optionIndex: number, overrideMs?: number) => {
    const sess = sessionRef.current;
    const q    = question;
    if (!sess || !q || selected !== null) return;
    clearTimer();

    const responseMs = overrideMs ?? (Date.now() - startMsRef.current);
    const correct    = optionIndex === q.correctIndex;

    setSelected(optionIndex);
    setPhase("feedback");

    const attempt = {
      questionId:    q.id,
      difficulty:    q.difficulty,
      correct,
      responseMs,
      selectedIndex: optionIndex,
    };

    const newSess = recordAttempt(sess, attempt);
    setSession(newSess);
    sessionRef.current = newSess;

    // Brief feedback pause then advance
    setTimeout(() => advance(newSess), 1100);
  }, [question, selected, clearTimer, advance]);

  // ── Begin assessment ───────────────────────────────────────
  const handleBegin = useCallback(() => {
    const sess = createSession();
    const q    = selectNextQuestion(sess, 0);
    setSession(sess);
    sessionRef.current = sess;
    setQuestion(q);
    setSelected(null);
    setPhase("question");
    setTimeout(() => startTimer(q.timeLimit), 100);
  }, [startTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // ── Layout sizing ──────────────────────────────────────────
  // Matrix cell size: fit 3 cells in ~320px
  const cellSize    = 96;
  const optionSize  = 130;
  const questionNum = (session?.attempts.length ?? 0) + 1;
  const progress    = ((session?.attempts.length ?? 0) / TOTAL_QUESTIONS) * 100;

  // ── Render ─────────────────────────────────────────────────

  if (phase === "intro") {
    return <IntroScreen onBegin={handleBegin} />;
  }

  if (phase === "processing") {
    return <ProcessingScreen />;
  }

  if (phase === "result" && result) {
    return <ResultReveal result={result} onRetake={() => { setPhase("intro"); setResult(null); }} />;
  }

  if (!question) return null;

  const LABELS = ["A", "B", "C", "D"];

  return (
    <div className="flex-1 flex flex-col items-center gap-4 px-4 py-4 select-none">

      {/* Header: progress + timer */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-cockpit-muted text-xs font-mono">
            {questionNum} / {TOTAL_QUESTIONS}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: question.difficulty >= 7 ? "#ff6d00" : question.difficulty >= 4 ? "#ffab00" : "#00d4ff" }}>
            Level {question.difficulty}
          </span>
        </div>

        {/* Overall progress */}
        <div className="w-full h-0.5 bg-cockpit-border rounded-full overflow-hidden">
          <div className="h-full bg-cockpit-accent/40 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }} />
        </div>

        {/* Timer */}
        <TimerBar pct={timerPct} warn={timerPct < 35} />
      </div>

      {/* Instruction */}
      <p className="text-cockpit-muted text-xs font-mono tracking-widest uppercase">
        Select the missing piece
      </p>

      {/* Matrix */}
      <MatrixGrid question={question} revealCorrect={phase === "feedback"} cellSize={cellSize} />

      {/* Feedback banner */}
      <div className="h-5 flex items-center justify-center">
        {phase === "feedback" && selected !== null && (
          <p
            className="text-xs font-bold tracking-widest uppercase font-mono animate-fade-in"
            style={{
              color: selected === question.correctIndex ? "#00e676" : "#ff3d00",
            }}
          >
            {selected === question.correctIndex ? "✓ Correct" : "✗ Incorrect"}
          </p>
        )}
      </div>

      {/* 2×2 answer grid */}
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((cell, i) => {
          let state: "idle" | "selected" | "correct" | "wrong" = "idle";
          if (phase === "feedback") {
            if (i === question.correctIndex)              state = "correct";
            else if (i === selected)                      state = "wrong";
          } else if (selected === i) {
            state = "selected";
          }
          return (
            <OptionButton
              key={i}
              cell={cell}
              label={LABELS[i]}
              size={optionSize}
              state={state}
              onClick={() => handleAnswer(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
