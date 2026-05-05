"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModuleResult } from "@/types";
import { scoreMultitask, MODULE_WEIGHTS, MODULE_NAMES } from "@/lib/scoring";

interface Props {
  onComplete: (result: ModuleResult) => void;
}

const DURATION_SEC = 4 * 60; // 4 minutes

// Recall timing constants
const SHOW_MS    = 1300; // character visible for 1.3s
const RESPOND_MS = 2200; // window to respond after hide
const FEEDBACK_MS = 700; // feedback flash duration
const GAP_MIN_MS = 3000; // minimum gap between prompts
const GAP_MAX_MS = 5500; // maximum gap

type RecallPhase = "idle" | "show" | "respond" | "feedback_correct" | "feedback_wrong" | "feedback_missed";

const CHARS = "0123456789ABCDEFGHJKLMNPQR".split("");
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

export default function MultitaskingStress({ onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // ── Ball animation ──────────────────────────────────────────────────────
  const tRef = useRef(0);
  const [ballPos, setBallPos] = useState({ x: 50, y: 50 });
  const mousePos = useRef({ x: 50, y: 50 });
  const distanceSamples = useRef<number[]>([]);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Countdown ───────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Recall state (all timing via refs to avoid stale closures) ──────────
  const recallPhaseRef = useRef<RecallPhase>("idle");
  const [recallPhase, setRecallPhaseSt] = useState<RecallPhase>("idle");

  const currentCharRef = useRef("");
  const [currentChar, setCurrentCharSt] = useState("");

  const respondedRef = useRef(false);

  // Counters — refs are the source of truth; state is display only
  const correctRef  = useRef(0);
  const wrongRef    = useRef(0);
  const missedRef   = useRef(0);
  const totalRef    = useRef(0);
  const [recallStats, setRecallStats] = useState({ correct: 0, wrong: 0, missed: 0, total: 0 });

  const expiredRef = useRef(false);
  const [finished, setFinished] = useState(false);

  // Active timeout handles so we can clear them on finish
  const showTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const respondTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRecallPhase = useCallback((p: RecallPhase) => {
    recallPhaseRef.current = p;
    setRecallPhaseSt(p);
  }, []);

  const setCurrentChar = useCallback((ch: string) => {
    currentCharRef.current = ch;
    setCurrentCharSt(ch);
  }, []);

  const bumpStats = useCallback(() => {
    setRecallStats({
      correct: correctRef.current,
      wrong:   wrongRef.current,
      missed:  missedRef.current,
      total:   totalRef.current,
    });
  }, []);

  // ── Finish ──────────────────────────────────────────────────────────────
  const finish = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;

    cancelAnimationFrame(rafRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    if (showTimerRef.current)    clearTimeout(showTimerRef.current);
    if (respondTimerRef.current) clearTimeout(respondTimerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (gapTimerRef.current)     clearTimeout(gapTimerRef.current);

    const samples = distanceSamples.current;
    const avgDist = samples.length > 0
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : 50;
    const trackingScore = Math.round(Math.max(0, 100 - avgDist * 2.2));

    const t = totalRef.current;
    const recallScore = t > 0 ? Math.round((correctRef.current / t) * 100) : 50;

    const raw = scoreMultitask(trackingScore, recallScore);
    setFinished(true);
    onComplete({
      moduleId: "multitask",
      moduleName: MODULE_NAMES.multitask,
      rawScore: raw,
      weight: MODULE_WEIGHTS.multitask,
      weightedScore: raw * MODULE_WEIGHTS.multitask,
      completedAt: Date.now(),
      details: {
        trackingScore,
        recallScore,
        recallCorrect: correctRef.current,
        recallWrong: wrongRef.current,
        recallMissed: missedRef.current,
        recallTotal: totalRef.current,
        avgTrackingDistance: Math.round(avgDist * 10) / 10,
        trackingSamples: samples.length,
      },
    });
  }, [onComplete]);

  // ── Recall cycle ─────────────────────────────────────────────────────────
  // Uses chained setTimeout (not setInterval) so each phase is exactly
  // one discrete event — no accumulated drift, no re-entry.
  const startRecallCycle = useCallback(() => {
    if (expiredRef.current) return;

    const gap = GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS);
    gapTimerRef.current = setTimeout(() => {
      if (expiredRef.current) return;

      // 1. Show character
      const ch = randChar();
      setCurrentChar(ch);
      setRecallPhase("show");

      showTimerRef.current = setTimeout(() => {
        if (expiredRef.current) return;

        // 2. Hide character, open response window
        setRecallPhase("respond");
        respondedRef.current = false;

        respondTimerRef.current = setTimeout(() => {
          if (expiredRef.current) return;
          // Time's up — if not already responded, count as missed
          if (!respondedRef.current) {
            missedRef.current += 1;
            totalRef.current  += 1;
            bumpStats();
            setRecallPhase("feedback_missed");
            feedbackTimerRef.current = setTimeout(() => {
              if (expiredRef.current) return;
              setRecallPhase("idle");
              startRecallCycle();
            }, FEEDBACK_MS);
          }
        }, RESPOND_MS);
      }, SHOW_MS);
    }, gap);
  }, [setCurrentChar, setRecallPhase, bumpStats]);

  // ── Keyboard handler — active during "show" (early press) AND "respond" window ──
  // Accepting during "show" lets users who type the character immediately still score.
  // respondedRef ensures each prompt counts only once regardless of timing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const phase = recallPhaseRef.current;
      // Accept input during the visible flash ("show") or the post-hide response window ("respond")
      if (phase !== "show" && phase !== "respond") return;
      if (respondedRef.current) return;

      // Only accept printable single characters
      if (e.key.length !== 1) return;
      e.preventDefault();

      respondedRef.current = true;
      // Cancel whichever phase timer is currently pending
      if (showTimerRef.current)    clearTimeout(showTimerRef.current);
      if (respondTimerRef.current) clearTimeout(respondTimerRef.current);

      const typed = e.key.toUpperCase();
      const isCorrect = typed === currentCharRef.current;

      if (isCorrect) correctRef.current += 1; else wrongRef.current += 1;
      totalRef.current += 1;
      bumpStats();

      const fb: RecallPhase = isCorrect ? "feedback_correct" : "feedback_wrong";
      setRecallPhase(fb);

      feedbackTimerRef.current = setTimeout(() => {
        if (expiredRef.current) return;
        setRecallPhase("idle");
        startRecallCycle();
      }, FEEDBACK_MS);
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
    // startRecallCycle and setRecallPhase are stable refs — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpStats]);

  // ── Ball animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      if (expiredRef.current) return;
      tRef.current += 0.007;
      const t = tRef.current;
      const x = 50 + 36 * Math.sin(1.3 * t + 0.4);
      const y = 50 + 30 * Math.sin(1.7 * t);
      setBallPos({ x, y });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Distance sampling ────────────────────────────────────────────────────
  // ballPos state used only inside this effect to avoid stale values
  const ballPosRef = useRef({ x: 50, y: 50 });
  useEffect(() => { ballPosRef.current = ballPos; }, [ballPos]);

  useEffect(() => {
    sampleTimerRef.current = setInterval(() => {
      if (expiredRef.current) return;
      const dx = ballPosRef.current.x - mousePos.current.x;
      const dy = ballPosRef.current.y - mousePos.current.y;
      distanceSamples.current.push(Math.sqrt(dx * dx + dy * dy));
    }, 200);
    return () => { if (sampleTimerRef.current) clearInterval(sampleTimerRef.current); };
  }, []);

  // ── Countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      if (expiredRef.current) return;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          finish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    // Start recall loop after a short lead-in
    const kickoff = setTimeout(() => startRecallCycle(), 2500);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      clearTimeout(kickoff);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mousePos.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  if (finished) return null;

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const pct = timeLeft / DURATION_SEC;

  // Recall overlay content
  const showOverlay = recallPhase !== "idle";
  const overlayBg =
    recallPhase === "feedback_correct" ? "rgba(0,230,118,0.12)" :
    recallPhase === "feedback_wrong"   ? "rgba(255,61,0,0.12)" :
    recallPhase === "feedback_missed"  ? "rgba(255,171,0,0.12)" :
    "rgba(8,11,15,0.88)";

  return (
    <div className="flex flex-col gap-4 w-full" style={{ outline: "none" }} tabIndex={-1}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <span className="text-cockpit-dim text-xs uppercase tracking-widest">
            Correct <span className="text-cockpit-green number-display font-semibold ml-1">{recallStats.correct}</span>
          </span>
          <span className="text-cockpit-dim text-xs uppercase tracking-widest">
            Wrong <span className="text-cockpit-red number-display font-semibold ml-1">{recallStats.wrong}</span>
          </span>
          <span className="text-cockpit-dim text-xs uppercase tracking-widest">
            Missed <span className="text-cockpit-amber number-display font-semibold ml-1">{recallStats.missed}</span>
          </span>
        </div>
        {/* Timer */}
        <div className="flex items-center gap-3">
          <div className="w-32 h-1.5 bg-cockpit-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${pct < 0.25 ? "bg-cockpit-red" : "bg-cockpit-accent"}`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <span className={`number-display text-sm font-bold tabular-nums ${timeLeft <= 30 ? "text-cockpit-red animate-pulse" : "text-cockpit-accent"}`}>
            {m}:{s.toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Tracking field */}
      <div
        ref={containerRef}
        className="relative w-full rounded-sm border border-cockpit-border cursor-crosshair-custom overflow-hidden"
        style={{ height: 400, background: "#080b0f" }}
        onMouseMove={handleMouseMove}
      >
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.04) 1px,transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        {/* Crosshair guides */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute" style={{ left:"50%", top:0, bottom:0, width:0, borderLeft:"1px dashed rgba(255,255,255,0.06)" }} />
          <div className="absolute" style={{ top:"50%", left:0, right:0, height:0, borderTop:"1px dashed rgba(255,255,255,0.06)" }} />
        </div>

        {/* Moving target */}
        <div
          className="absolute pointer-events-none"
          style={{ left:`${ballPos.x}%`, top:`${ballPos.y}%`, transform:"translate(-50%,-50%)" }}
        >
          <div className="relative w-9 h-9 rounded-full border-2 border-cockpit-green flex items-center justify-center"
            style={{ boxShadow:"0 0 14px #00e676, 0 0 28px rgba(0,230,118,0.25)" }}>
            <div className="w-2 h-2 rounded-full bg-cockpit-green" />
          </div>
        </div>

        {/* Recall overlay */}
        {showOverlay && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 transition-colors duration-150"
            style={{ background: overlayBg }}
          >
            {recallPhase === "show" && (
              <div className="text-center">
                <p className="text-cockpit-dim text-xs tracking-widest uppercase mb-4">Press this key</p>
                <div className="w-24 h-24 flex items-center justify-center border-2 border-cockpit-accent rounded-sm glow-accent bg-cockpit-card">
                  <span className="text-cockpit-accent font-mono text-5xl font-bold">{currentChar}</span>
                </div>
              </div>
            )}
            {recallPhase === "respond" && (
              <div className="text-center">
                <p className="text-cockpit-amber text-sm tracking-widest uppercase mb-3 animate-pulse">
                  Type it now!
                </p>
                <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-cockpit-amber rounded-sm bg-cockpit-card opacity-50">
                  <span className="text-cockpit-amber font-mono text-5xl font-bold">?</span>
                </div>
              </div>
            )}
            {recallPhase === "feedback_correct" && (
              <div className="text-center">
                <div className="w-20 h-20 flex items-center justify-center border-2 border-cockpit-green rounded-sm bg-cockpit-card mb-2">
                  <span className="text-cockpit-green text-4xl font-bold">✓</span>
                </div>
                <p className="text-cockpit-green text-sm font-semibold">Correct</p>
              </div>
            )}
            {recallPhase === "feedback_wrong" && (
              <div className="text-center">
                <div className="w-20 h-20 flex items-center justify-center border-2 border-cockpit-red rounded-sm bg-cockpit-card mb-2">
                  <span className="text-cockpit-red text-4xl font-bold">✗</span>
                </div>
                <p className="text-cockpit-red text-sm font-semibold">
                  Wrong — it was <span className="font-mono text-lg">{currentChar}</span>
                </p>
              </div>
            )}
            {recallPhase === "feedback_missed" && (
              <div className="text-center">
                <div className="w-20 h-20 flex items-center justify-center border-2 border-cockpit-amber rounded-sm bg-cockpit-card mb-2">
                  <span className="text-cockpit-amber text-4xl font-bold">—</span>
                </div>
                <p className="text-cockpit-amber text-sm font-semibold">
                  Missed — it was <span className="font-mono text-lg">{currentChar}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Idle hint */}
        {recallPhase === "idle" && (
          <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
            <p className="text-cockpit-muted text-xs">
              Track the green target with your mouse — a character will flash periodically, press the key to score
            </p>
          </div>
        )}
      </div>

      {/* Recall history dots */}
      {recallStats.total > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: recallStats.correct }).map((_, i) => (
            <div key={`c${i}`} className="w-5 h-5 rounded-sm bg-cockpit-green bg-opacity-80 flex items-center justify-center text-xs text-cockpit-bg font-bold">✓</div>
          ))}
          {Array.from({ length: recallStats.wrong }).map((_, i) => (
            <div key={`w${i}`} className="w-5 h-5 rounded-sm bg-cockpit-red bg-opacity-80 flex items-center justify-center text-xs text-cockpit-bg font-bold">✗</div>
          ))}
          {Array.from({ length: recallStats.missed }).map((_, i) => (
            <div key={`m${i}`} className="w-5 h-5 rounded-sm bg-cockpit-amber bg-opacity-70 flex items-center justify-center text-xs text-cockpit-bg font-bold">—</div>
          ))}
        </div>
      )}
    </div>
  );
}
