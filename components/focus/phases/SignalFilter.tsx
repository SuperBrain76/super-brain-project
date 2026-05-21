"use client";

// Phase 2 — Signal Filter
// A stream of stimuli flash one at a time. Tap only when you see the target.
// Visual distractions fire randomly. Speed increases over time.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sounds } from "@/lib/sounds";
import type { PhaseResult } from "@/lib/focus-test";

interface Props {
  soundEnabled: boolean;
  onComplete:   (result: PhaseResult) => void;
}

const DURATION_MS = 45_000;

const SHAPES = ["◆", "●", "▲", "■", "★", "◉", "▼", "◈"] as const;
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"] as const;

// Target is always "◆" — displayed in the HUD
const TARGET_SHAPE = "◆";
const DIST_COLORS  = ["#ff3d00", "#ffab00", "#c084fc", "#ff6d00"];

interface Stimulus {
  char:  string;
  color: string;
  key:   number;
}

let _key = 0;

export default function SignalFilter({ soundEnabled, onComplete }: Props) {
  const [stimulus,    setStimulus]    = useState<Stimulus | null>(null);
  const [timeLeft,    setTimeLeft]    = useState(DURATION_MS);
  const [score,       setScore]       = useState(0);
  const [streak,      setStreak]      = useState(0);
  const [streakMax,   setStreakMax]   = useState(0);
  const [flash,       setFlash]       = useState<string | null>(null); // distraction color flash
  const [tapFeedback, setTapFeedback] = useState<{ label: string; color: string } | null>(null);

  const startRef      = useRef(Date.now());
  const completedRef  = useRef(false);
  const hitsRef       = useRef(0);
  const missesRef     = useRef(0);
  const falseHitsRef  = useRef(0); // tapped when shouldn't have
  const reactionsRef  = useRef<number[]>([]);
  const stimulusRef   = useRef<Stimulus | null>(null);
  const stimSpawnRef  = useRef(Date.now());
  const streakRef     = useRef(0);
  const streakMaxRef  = useRef(0);
  const scoreRef      = useRef(0);
  const tappedRef     = useRef(false); // whether current stimulus was already tapped

  const finish = useCallback(() => {
    const totalTargets = hitsRef.current + missesRef.current;
    const accuracy     = totalTargets > 0 ? hitsRef.current / (totalTargets + falseHitsRef.current) : 0;
    const avgMs        = reactionsRef.current.length
      ? reactionsRef.current.reduce((s, v) => s + v, 0) / reactionsRef.current.length
      : 500;

    const raw = accuracy * 75 + Math.max(0, (600 - avgMs) / 6) * 0.25;
    if (soundEnabled) Sounds.phaseComplete();
    onComplete({
      phase:         2,
      score:         Math.min(100, Math.round(raw)),
      accuracy,
      avgReactionMs: Math.round(avgMs),
      streakMax:     streakMaxRef.current,
      extras:        { hits: hitsRef.current, misses: missesRef.current, falseTaps: falseHitsRef.current },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, onComplete]);

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

  // Stimulus stream — speeds up over time
  useEffect(() => {
    const tick = () => {
      const elapsed  = Date.now() - startRef.current;
      if (elapsed >= DURATION_MS) return;

      const progress = elapsed / DURATION_MS;
      const speed    = 700 - progress * 280; // 700ms → 420ms

      // If we had a target and it was NOT tapped → miss
      if (stimulusRef.current?.char === TARGET_SHAPE && !tappedRef.current) {
        missesRef.current++;
        streakRef.current = 0;
        setStreak(0);
      }

      // New stimulus — ~28% chance of being the target
      const isTarget = Math.random() < 0.28;
      const pool     = isTarget
        ? [TARGET_SHAPE]
        : [...SHAPES.filter((s) => s !== TARGET_SHAPE), ...LETTERS];
      const char  = isTarget ? TARGET_SHAPE : pool[Math.floor(Math.random() * pool.length)];
      const color = isTarget ? "#00e676" : "#cbd5e1";
      const next  = { char, color, key: _key++ };

      stimulusRef.current = next;
      stimSpawnRef.current = Date.now();
      tappedRef.current   = false;
      setStimulus(next);

      // Random distraction flash (~15% chance)
      if (Math.random() < 0.15) {
        const dc = DIST_COLORS[Math.floor(Math.random() * DIST_COLORS.length)];
        setFlash(dc);
        if (soundEnabled) Sounds.distract();
        setTimeout(() => setFlash(null), 120);
      }

      setTimeout(tick, speed);
    };

    const first = setTimeout(tick, 400);
    return () => clearTimeout(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = () => {
    if (completedRef.current) return;
    const current = stimulusRef.current;
    if (!current) return;

    const rt = Date.now() - stimSpawnRef.current;

    if (current.char === TARGET_SHAPE && !tappedRef.current) {
      tappedRef.current = true;
      hitsRef.current++;
      reactionsRef.current.push(rt);
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      if (newStreak > streakMaxRef.current) streakMaxRef.current = newStreak;
      setStreak(newStreak);
      setStreakMax(streakMaxRef.current);

      const mult   = newStreak >= 15 ? 2.5 : newStreak >= 7 ? 2 : newStreak >= 3 ? 1.5 : 1;
      const points = Math.round(12 * mult);
      scoreRef.current += points;
      setScore(scoreRef.current);
      setTapFeedback({ label: `+${points}`, color: "#00e676" });
      setTimeout(() => setTapFeedback(null), 500);

      if (soundEnabled) {
        if (newStreak === 3 || newStreak === 7 || newStreak === 15) Sounds.streak();
        else Sounds.hit();
      }
    } else if (current.char !== TARGET_SHAPE) {
      // False tap
      falseHitsRef.current++;
      streakRef.current = 0;
      setStreak(0);
      scoreRef.current = Math.max(0, scoreRef.current - 8);
      setScore(scoreRef.current);
      setTapFeedback({ label: "−8", color: "#ff3d00" });
      setTimeout(() => setTapFeedback(null), 500);
      if (soundEnabled) Sounds.miss();
    }
  };

  const progress    = 1 - timeLeft / DURATION_MS;
  const secsLeft    = Math.ceil(timeLeft / 1000);
  const streakColor = streak >= 15 ? "#ff6d00" : streak >= 7 ? "#ffab00" : streak >= 3 ? "#00d4ff" : "#64748b";
  const isTarget    = stimulus?.char === TARGET_SHAPE;

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
              ×{streak >= 15 ? "2.5" : streak >= 7 ? "2.0" : "1.5"} STREAK
            </span>
          )}
        </div>
        <span className="text-cockpit-muted text-sm font-mono">{secsLeft}s</span>
      </div>

      {/* Timer bar */}
      <div className="h-0.5 w-full bg-cockpit-border rounded-full overflow-hidden">
        <div
          className="h-full bg-[#ffab00]"
          style={{ width: `${(1 - progress) * 100}%`, transition: "width 0.08s linear" }}
        />
      </div>

      {/* Target reminder */}
      <div className="flex items-center justify-center gap-2 py-1">
        <span className="text-cockpit-muted text-xs uppercase tracking-widest font-mono">TAP ONLY</span>
        <span className="text-[#00e676] text-lg font-bold">{TARGET_SHAPE}</span>
      </div>

      {/* Stimulus display */}
      <button
        onClick={handleTap}
        className="flex-1 relative flex items-center justify-center rounded-sm border border-cockpit-border overflow-hidden focus:outline-none active:scale-[0.98] transition-transform duration-75"
        style={{
          background:  flash ? `${flash}18` : "var(--surface,#0d1117)",
          borderColor: flash ? flash : undefined,
          minHeight:   220,
        }}
      >
        {flash && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `${flash}12`, transition: "opacity 0.1s" }}
          />
        )}

        {stimulus && (
          <span
            key={stimulus.key}
            className="text-7xl sm:text-8xl font-bold module-enter"
            style={{
              color:      stimulus.color,
              textShadow: isTarget ? `0 0 30px ${stimulus.color}80` : "none",
            }}
          >
            {stimulus.char}
          </span>
        )}

        {tapFeedback && (
          <span
            className="absolute top-4 right-5 text-sm font-extrabold number-display"
            style={{ color: tapFeedback.color, textShadow: `0 0 8px ${tapFeedback.color}` }}
          >
            {tapFeedback.label}
          </span>
        )}

        <span className="absolute bottom-3 text-cockpit-muted text-xs">
          tap to respond
        </span>
      </button>
    </div>
  );
}
