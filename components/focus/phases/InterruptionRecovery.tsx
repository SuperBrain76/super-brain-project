"use client";

// Phase 3 — Interruption Recovery
// A pulsing ring cycles every 2s. Tap at peak (when it's largest).
// Random interruptions pop up — tap DISMISS, then recover your rhythm.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sounds } from "@/lib/sounds";
import type { PhaseResult } from "@/lib/focus-test";

interface Props {
  soundEnabled: boolean;
  onComplete:   (result: PhaseResult) => void;
}

const DURATION_MS = 60_000;
const CYCLE_MS    = 2000;     // pulse period
const HIT_WINDOW  = 0.72;     // phase ≥ this = sweet spot (top 28% of cycle)
const GOOD_WINDOW = 0.50;     // phase ≥ this = acceptable

interface Interruption {
  id:      number;
  message: string;
}

const INTERRUPT_MSGS = [
  "URGENT: CHECK THIS",
  "INCOMING MESSAGE",
  "!! ALERT !!",
  "NEW PRIORITY TASK",
  "SYSTEM NOTIFICATION",
  "ACTION REQUIRED",
];

let _iid = 0;

export default function InterruptionRecovery({ soundEnabled, onComplete }: Props) {
  const [timeLeft,      setTimeLeft]      = useState(DURATION_MS);
  const [ringScale,     setRingScale]     = useState(0.75);
  const [score,         setScore]         = useState(0);
  const [streak,        setStreak]        = useState(0);
  const [streakMax,     setStreakMax]      = useState(0);
  const [interruption,  setInterruption]  = useState<Interruption | null>(null);
  const [tapFeedback,   setTapFeedback]   = useState<{ label: string; color: string } | null>(null);
  const [ringColor,     setRingColor]     = useState("#00d4ff");

  const startRef          = useRef(Date.now());
  const completedRef      = useRef(false);
  const tapsRef           = useRef(0);
  const preciseRef        = useRef(0);   // hits in sweet spot
  const goodRef           = useRef(0);   // hits in acceptable range
  const streakRef         = useRef(0);
  const streakMaxRef      = useRef(0);
  const scoreRef          = useRef(0);
  const interruptRef      = useRef(false);
  const interruptStartRef = useRef(0);
  const recoveryTimesRef  = useRef<number[]>([]);
  const firstTapAfterRef  = useRef(false); // first ring tap after dismiss

  const getPhase = useCallback((): number => {
    const elapsed = Date.now() - startRef.current;
    // 0→1→0→1... oscillation; peaks at t = n*CYCLE_MS
    return (Math.sin((elapsed / CYCLE_MS) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  }, []);

  const finish = useCallback(() => {
    const total    = tapsRef.current;
    const accuracy = total > 0 ? (preciseRef.current + goodRef.current * 0.5) / total : 0;
    const avgRecovery = recoveryTimesRef.current.length
      ? recoveryTimesRef.current.reduce((s, v) => s + v, 0) / recoveryTimesRef.current.length
      : 2000;
    // recoveryScore: 100 = instant (<300ms), 0 = very slow (>3000ms)
    const recoveryScore = Math.max(0, Math.min(100, Math.round(100 - (avgRecovery - 300) / 27)));

    const raw = accuracy * 65 + recoveryScore * 0.35;
    if (soundEnabled) Sounds.phaseComplete();
    onComplete({
      phase:         3,
      score:         Math.min(100, Math.round(raw)),
      accuracy,
      avgReactionMs: Math.round(avgRecovery),
      streakMax:     streakMaxRef.current,
      extras:        { recoveryScore, avgRecoveryMs: Math.round(avgRecovery) },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, onComplete]);

  // Ring animation (updates ring scale via state at 60fps-ish)
  useEffect(() => {
    const frame = setInterval(() => {
      const phase = getPhase();
      setRingScale(0.7 + phase * 0.65); // scale 0.7 → 1.35
      setRingColor(phase >= HIT_WINDOW ? "#00e676" : phase >= GOOD_WINDOW ? "#00d4ff" : "#1e2a38");
    }, 32);
    return () => clearInterval(frame);
  }, [getPhase]);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, DURATION_MS - (Date.now() - startRef.current));
      setTimeLeft(left);
      if (left === 0 && !completedRef.current) {
        completedRef.current = true;
        finish();
      }
    }, 80);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule interruptions
  useEffect(() => {
    const schedule = () => {
      if (completedRef.current) return;
      const delay = 7000 + Math.random() * 8000; // every 7-15s
      setTimeout(() => {
        if (completedRef.current) return;
        interruptRef.current = true;
        interruptStartRef.current = Date.now();
        firstTapAfterRef.current = false;
        const msg = INTERRUPT_MSGS[Math.floor(Math.random() * INTERRUPT_MSGS.length)];
        setInterruption({ id: _iid++, message: msg });
        if (soundEnabled) Sounds.alert();
        schedule();
      }, delay);
    };
    const first = setTimeout(schedule, 5000);
    return () => clearTimeout(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissInterruption = (e: React.MouseEvent) => {
    e.stopPropagation();
    interruptRef.current = false;
    firstTapAfterRef.current = true;
    setInterruption(null);
    if (soundEnabled) Sounds.hit();
  };

  const handleRingTap = () => {
    if (completedRef.current || interruptRef.current) return;

    const phase = getPhase();
    tapsRef.current++;

    // If this is the first tap after an interruption, record recovery time
    if (firstTapAfterRef.current) {
      firstTapAfterRef.current = false;
      const recoveryMs = Date.now() - interruptStartRef.current;
      recoveryTimesRef.current.push(recoveryMs);
    }

    if (phase >= HIT_WINDOW) {
      // Perfect
      preciseRef.current++;
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      if (newStreak > streakMaxRef.current) streakMaxRef.current = newStreak;
      setStreak(newStreak);
      setStreakMax(streakMaxRef.current);

      const mult   = newStreak >= 10 ? 2 : newStreak >= 5 ? 1.5 : 1;
      const points = Math.round(15 * mult);
      scoreRef.current += points;
      setScore(scoreRef.current);
      setTapFeedback({ label: `PERFECT +${points}`, color: "#00e676" });
      setTimeout(() => setTapFeedback(null), 600);
      if (soundEnabled) {
        if (newStreak === 5 || newStreak === 10) Sounds.streak();
        else Sounds.hit();
      }
    } else if (phase >= GOOD_WINDOW) {
      // Good
      goodRef.current++;
      streakRef.current = Math.max(0, streakRef.current - 1);
      setStreak(streakRef.current);
      const points = 8;
      scoreRef.current += points;
      setScore(scoreRef.current);
      setTapFeedback({ label: `+${points}`, color: "#00d4ff" });
      setTimeout(() => setTapFeedback(null), 600);
      if (soundEnabled) Sounds.hit();
    } else {
      // Miss — wrong timing
      streakRef.current = 0;
      setStreak(0);
      scoreRef.current = Math.max(0, scoreRef.current - 5);
      setScore(scoreRef.current);
      setTapFeedback({ label: "TOO EARLY", color: "#ff3d00" });
      setTimeout(() => setTapFeedback(null), 600);
      if (soundEnabled) Sounds.miss();
    }
  };

  const progress    = 1 - timeLeft / DURATION_MS;
  const secsLeft    = Math.ceil(timeLeft / 1000);
  const streakColor = streak >= 10 ? "#ff6d00" : streak >= 5 ? "#ffab00" : streak >= 3 ? "#00d4ff" : "#64748b";

  return (
    <div className="flex flex-col gap-3 w-full h-full select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-white text-lg font-extrabold number-display tabular-nums">{score}</span>
          {streak >= 2 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-sm border"
              style={{ color: streakColor, borderColor: `${streakColor}40`, background: `${streakColor}15` }}
            >
              ×{streak >= 10 ? "2.0" : "1.5"} STREAK
            </span>
          )}
        </div>
        <span className="text-cockpit-muted text-sm font-mono">{secsLeft}s</span>
      </div>

      {/* Timer bar */}
      <div className="h-0.5 w-full bg-cockpit-border rounded-full overflow-hidden">
        <div
          className="h-full bg-[#ff6d00]"
          style={{ width: `${(1 - progress) * 100}%`, transition: "width 0.08s linear" }}
        />
      </div>

      {/* Instruction */}
      <p className="text-center text-cockpit-muted text-xs font-mono tracking-widest uppercase">
        Tap the ring at peak glow
      </p>

      {/* Ring tap zone */}
      <div className="flex-1 flex flex-col items-center justify-center relative" style={{ minHeight: 240 }}>
        {/* Interruption overlay */}
        {interruption && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-cockpit-bg/80 backdrop-blur-sm module-enter">
            <div className="bg-cockpit-card border-2 border-[#ff3d00] rounded-sm px-8 py-6 flex flex-col items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-[#ff3d00] animate-ping" />
              <p className="text-[#ff3d00] text-sm font-bold tracking-widest uppercase">
                {interruption.message}
              </p>
              <button
                onClick={dismissInterruption}
                className="px-6 py-2 bg-[#ff3d0020] border border-[#ff3d0060] text-[#ff3d00] text-sm font-bold rounded-sm hover:bg-[#ff3d0030] transition-colors"
              >
                DISMISS
              </button>
            </div>
          </div>
        )}

        {/* Pulse ring */}
        <button
          onClick={handleRingTap}
          className="relative flex items-center justify-center focus:outline-none"
          style={{ width: 180, height: 180 }}
        >
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border:     `3px solid ${ringColor}`,
              transform:  `scale(${ringScale})`,
              boxShadow:  `0 0 ${Math.round(ringScale * 30)}px ${ringColor}60`,
              transition: "border-color 0.15s ease",
            }}
          />
          {/* Inner ring */}
          <div
            className="absolute rounded-full"
            style={{
              inset:     "20%",
              border:    `1px solid ${ringColor}40`,
              transform: `scale(${1 + (ringScale - 0.7) * 0.3})`,
            }}
          />
          {/* Center dot */}
          <div className="w-4 h-4 rounded-full" style={{ background: ringColor, boxShadow: `0 0 12px ${ringColor}` }} />
        </button>

        {/* Tap feedback */}
        {tapFeedback && (
          <div
            className="absolute bottom-6 text-sm font-extrabold number-display module-enter"
            style={{ color: tapFeedback.color }}
          >
            {tapFeedback.label}
          </div>
        )}
      </div>
    </div>
  );
}
