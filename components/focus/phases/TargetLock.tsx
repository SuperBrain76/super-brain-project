"use client";

// Phase 1 — Target Lock
// Tap green targets, avoid red decoys. Drift animation, 45 second session.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sounds } from "@/lib/sounds";
import type { PhaseResult } from "@/lib/focus-test";

interface Props {
  soundEnabled: boolean;
  onComplete:   (result: PhaseResult) => void;
}

const DURATION_MS   = 45_000;
const CIRCLE_SIZE   = 56;   // px, tap-friendly on mobile
const SPAWN_INTERVAL = 900; // ms between spawns
const LIFETIME_MS   = 2200; // how long each circle lives

const DRIFT_DIRS = ["drift-ne","drift-e","drift-se","drift-s","drift-sw","drift-w","drift-nw","drift-n"] as const;

interface Circle {
  id:      number;
  type:    "target" | "decoy";
  x:       number;     // % left
  y:       number;     // % top
  drift:   string;
  spawnMs: number;
}

let _nextId = 0;

function makeCircle(elapsed: number): Circle {
  const margin = 12;
  return {
    id:      _nextId++,
    type:    Math.random() < 0.6 ? "target" : "decoy",
    x:       margin + Math.random() * (100 - margin * 2),
    y:       margin + Math.random() * (100 - margin * 2),
    drift:   DRIFT_DIRS[Math.floor(Math.random() * DRIFT_DIRS.length)],
    spawnMs: elapsed,
  };
}

export default function TargetLock({ soundEnabled, onComplete }: Props) {
  const [circles,    setCircles]    = useState<Circle[]>([]);
  const [timeLeft,   setTimeLeft]   = useState(DURATION_MS);
  const [score,      setScore]      = useState(0);
  const [streak,     setStreak]     = useState(0);
  const [streakMax,  setStreakMax]  = useState(0);
  const [feedback,   setFeedback]   = useState<{ id: number; label: string; color: string } | null>(null);

  const startRef      = useRef(Date.now());
  const hitsRef       = useRef(0);
  const missesRef     = useRef(0);
  const reactionsRef  = useRef<number[]>([]);
  const completedRef  = useRef(false);
  const streakRef     = useRef(0);
  const streakMaxRef  = useRef(0);
  const scoreRef      = useRef(0);

  // Countdown + auto-expire circles
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left    = Math.max(0, DURATION_MS - elapsed);
      setTimeLeft(left);

      // Expire old circles
      setCircles((prev) => prev.filter((c) => elapsed - c.spawnMs < LIFETIME_MS));

      if (left === 0 && !completedRef.current) {
        completedRef.current = true;
        finish();
      }
    }, 80);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spawn circles
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed >= DURATION_MS) return;

      // Speed up spawn rate as time progresses (faster in last 15s)
      const progress = elapsed / DURATION_MS;
      const interval_ms = SPAWN_INTERVAL * (1 - progress * 0.35);
      if (Math.random() < 80 / interval_ms) {
        setCircles((prev) => [...prev.slice(-18), makeCircle(elapsed)]);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const finish = useCallback(() => {
    const total    = hitsRef.current + missesRef.current;
    const accuracy = total > 0 ? hitsRef.current / total : 0;
    const avgMs    = reactionsRef.current.length
      ? reactionsRef.current.reduce((s, v) => s + v, 0) / reactionsRef.current.length
      : 1500;

    // Score: accuracy × speed bonus
    const speedBonus = Math.max(0, (1000 - avgMs) / 10); // 0-100
    const raw = accuracy * 70 + speedBonus * 0.3;
    const phaseScore = Math.min(100, Math.round(raw));

    if (soundEnabled) Sounds.phaseComplete();
    onComplete({
      phase:         1,
      score:         phaseScore,
      accuracy,
      avgReactionMs: Math.round(avgMs),
      streakMax:     streakMaxRef.current,
      extras:        { hits: hitsRef.current, misses: missesRef.current },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, onComplete]);

  const handleCircleClick = (circle: Circle, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (completedRef.current) return;

    const elapsed = Date.now() - startRef.current;
    const reactionMs = elapsed - circle.spawnMs;

    // Remove this circle
    setCircles((prev) => prev.filter((c) => c.id !== circle.id));

    if (circle.type === "target") {
      hitsRef.current++;
      reactionsRef.current.push(reactionMs);
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      if (newStreak > streakMaxRef.current) streakMaxRef.current = newStreak;

      const multiplier = newStreak >= 15 ? 2.5 : newStreak >= 7 ? 2 : newStreak >= 3 ? 1.5 : 1;
      const points = Math.round(10 * multiplier);
      scoreRef.current += points;
      setScore(scoreRef.current);
      setStreak(newStreak);
      setStreakMax(streakMaxRef.current);
      setFeedback({ id: circle.id, label: `+${points}${multiplier > 1 ? " ×" + multiplier : ""}`, color: "#00e676" });
      setTimeout(() => setFeedback(null), 600);

      if (soundEnabled) {
        if (newStreak === 3 || newStreak === 7 || newStreak === 15) Sounds.streak();
        else Sounds.hit();
      }
    } else {
      // Clicked a decoy
      missesRef.current++;
      streakRef.current = 0;
      setStreak(0);
      scoreRef.current = Math.max(0, scoreRef.current - 5);
      setScore(scoreRef.current);
      setFeedback({ id: circle.id, label: "-5", color: "#ff3d00" });
      setTimeout(() => setFeedback(null), 600);
      if (soundEnabled) Sounds.miss();
    }
  };

  const progress  = 1 - timeLeft / DURATION_MS;
  const secsLeft  = Math.ceil(timeLeft / 1000);
  const streakColor = streak >= 15 ? "#ff6d00" : streak >= 7 ? "#ffab00" : streak >= 3 ? "#00d4ff" : "#64748b";

  return (
    <div className="flex flex-col gap-3 w-full h-full select-none">
      {/* HUD */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-white text-lg font-extrabold number-display tabular-nums">{score}</span>
          {streak >= 2 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-sm border tabular-nums"
              style={{ color: streakColor, borderColor: `${streakColor}40`, background: `${streakColor}15` }}
            >
              ×{streak >= 15 ? "2.5" : streak >= 7 ? "2.0" : streak >= 3 ? "1.5" : "1.0"} STREAK
            </span>
          )}
        </div>
        <span className="text-cockpit-muted text-sm font-mono">{secsLeft}s</span>
      </div>

      {/* Timer bar */}
      <div className="h-0.5 w-full bg-cockpit-border rounded-full overflow-hidden">
        <div
          className="h-full bg-[#00d4ff] transition-none"
          style={{ width: `${(1 - progress) * 100}%`, transition: "width 0.08s linear" }}
        />
      </div>

      {/* Play area */}
      <div
        className="relative flex-1 bg-cockpit-surface border border-cockpit-border rounded-sm overflow-hidden cursor-default"
        style={{ minHeight: 300 }}
      >
        {/* Instruction */}
        {circles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-cockpit-muted text-sm">Targets incoming…</p>
          </div>
        )}

        {circles.map((c) => {
          const elapsed    = Date.now() - startRef.current - c.spawnMs;
          const remaining  = LIFETIME_MS - elapsed;
          const opacity    = remaining < 400 ? remaining / 400 : 1;

          return (
            <button
              key={c.id}
              onClick={(e) => handleCircleClick(c, e)}
              onTouchStart={(e) => handleCircleClick(c, e)}
              className="absolute focus:outline-none active:scale-90 transition-transform duration-75"
              style={{
                left:           `${c.x}%`,
                top:            `${c.y}%`,
                width:          CIRCLE_SIZE,
                height:         CIRCLE_SIZE,
                borderRadius:   "50%",
                border:         `2px solid ${c.type === "target" ? "#00e676" : "#ff3d00"}`,
                background:     c.type === "target" ? "#00e67620" : "#ff3d0020",
                boxShadow:      `0 0 14px ${c.type === "target" ? "#00e67640" : "#ff3d0040"}`,
                opacity,
                animation:      `${c.drift} ${LIFETIME_MS}ms linear forwards`,
                touchAction:    "manipulation",
              }}
            />
          );
        })}

        {/* Floating feedback */}
        {feedback && (
          <div
            key={feedback.id}
            className="absolute pointer-events-none text-sm font-extrabold number-display"
            style={{
              color:     feedback.color,
              left:      "50%",
              top:       "50%",
              transform: "translate(-50%,-50%)",
              animation: "moduleEnter 0.6s ease-out forwards",
              textShadow: `0 0 10px ${feedback.color}`,
            }}
          >
            {feedback.label}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#00e676] bg-[#00e67615]" />
          <span className="text-cockpit-muted text-xs">TAP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#ff3d00] bg-[#ff3d0015]" />
          <span className="text-cockpit-muted text-xs">AVOID</span>
        </div>
      </div>
    </div>
  );
}
