"use client";

// Phase 5 — Priority Storm
// Task cards appear with CRITICAL / HIGH / LOW priority and countdown timers.
// Complete highest-priority tasks first. New tasks spawn continuously.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sounds } from "@/lib/sounds";
import type { PhaseResult } from "@/lib/focus-test";

interface Props {
  soundEnabled: boolean;
  onComplete:   (result: PhaseResult) => void;
}

const DURATION_MS = 90_000;
const MAX_TASKS   = 5;

type Priority = "CRITICAL" | "HIGH" | "LOW";

interface Task {
  id:          number;
  priority:    Priority;
  label:       string;
  timeoutMs:   number;   // how long before it expires
  spawnedAt:   number;   // Date.now()
}

const PRIORITY_META: Record<Priority, { color: string; timeout: number; points: number }> = {
  CRITICAL: { color: "#ff3d00", timeout: 6000,  points: 30 },
  HIGH:     { color: "#ffab00", timeout: 10000, points: 15 },
  LOW:      { color: "#00d4ff", timeout: 16000, points:  6 },
};

const TASK_LABELS: Record<Priority, string[]> = {
  CRITICAL: ["System failure", "Data breach", "Network down", "Server crash", "Critical bug"],
  HIGH:     ["Stakeholder reply", "Deadline review", "Team blocker", "Release approval", "Budget sign-off"],
  LOW:      ["Read report", "Slack message", "Team standup", "Update docs", "Weekly review"],
};

let _tid = 0;

function makeTask(): Task {
  const roll     = Math.random();
  const priority: Priority = roll < 0.25 ? "CRITICAL" : roll < 0.55 ? "HIGH" : "LOW";
  const meta     = PRIORITY_META[priority];
  const labels   = TASK_LABELS[priority];
  return {
    id:        _tid++,
    priority,
    label:     labels[Math.floor(Math.random() * labels.length)],
    timeoutMs: meta.timeout,
    spawnedAt: Date.now(),
  };
}

export default function PriorityStorm({ soundEnabled, onComplete }: Props) {
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [timeLeft,    setTimeLeft]    = useState(DURATION_MS);
  const [score,       setScore]       = useState(0);
  const [streak,      setStreak]      = useState(0);
  const [streakMax,   setStreakMax]   = useState(0);
  const [shake,       setShake]       = useState(false);
  const [flash,       setFlash]       = useState<string | null>(null);

  const startRef       = useRef(Date.now());
  const completedRef   = useRef(false);
  const completedCount = useRef(0);
  const critMissedRef  = useRef(0);
  const wrongOrderRef  = useRef(0);
  const streakRef      = useRef(0);
  const streakMaxRef   = useRef(0);
  const scoreRef       = useRef(0);

  const finish = useCallback(() => {
    const total    = completedCount.current + critMissedRef.current;
    const accuracy = total > 0 ? completedCount.current / total : 0;
    // Penalise wrong-order taps
    const orderPenalty = wrongOrderRef.current * 3;
    const raw = Math.max(0, accuracy * 80 + streakMaxRef.current * 0.5 - orderPenalty);
    if (soundEnabled) Sounds.phaseComplete();
    onComplete({
      phase:         5,
      score:         Math.min(100, Math.round(raw)),
      accuracy,
      avgReactionMs: 0,
      streakMax:     streakMaxRef.current,
      extras:        { completed: completedCount.current, critMissed: critMissedRef.current },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, onComplete]);

  // Countdown + expire tasks
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left    = Math.max(0, DURATION_MS - elapsed);
      setTimeLeft(left);

      // Expire overdue tasks
      setTasks((prev) => {
        const now      = Date.now();
        const expired  = prev.filter((t) => now - t.spawnedAt >= t.timeoutMs);
        const kept     = prev.filter((t) => now - t.spawnedAt < t.timeoutMs);
        expired.forEach((t) => {
          if (t.priority === "CRITICAL") {
            critMissedRef.current++;
            scoreRef.current = Math.max(0, scoreRef.current - 20);
            setScore(scoreRef.current);
            streakRef.current = 0;
            setStreak(0);
            setShake(true);
            setTimeout(() => setShake(false), 400);
            if (soundEnabled) Sounds.critical();
          }
        });
        return kept;
      });

      if (left === 0 && !completedRef.current) {
        completedRef.current = true;
        finish();
      }
    }, 100);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spawn tasks
  useEffect(() => {
    const spawn = () => {
      if (completedRef.current) return;
      const elapsed  = Date.now() - startRef.current;
      const progress = elapsed / DURATION_MS;
      const interval = 3500 - progress * 1500; // 3500ms → 2000ms

      setTasks((prev) => {
        if (prev.length >= MAX_TASKS) return prev;
        return [...prev, makeTask()];
      });

      setTimeout(spawn, interval);
    };

    // Initial tasks
    setTasks([makeTask(), makeTask()]);
    const t = setTimeout(spawn, 2500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleComplete = (task: Task) => {
    if (completedRef.current) return;

    // Check if higher-priority tasks exist (tap order discipline)
    const higherExists = tasks.some(
      (t) => t.id !== task.id &&
        (PRIORITY_META[t.priority].points > PRIORITY_META[task.priority].points)
    );

    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    completedCount.current++;

    const meta   = PRIORITY_META[task.priority];
    const timeMs = Date.now() - task.spawnedAt;
    // Speed bonus: faster = more points
    const speedBonus = Math.max(0, Math.round((1 - timeMs / task.timeoutMs) * meta.points * 0.5));

    if (higherExists && task.priority !== "CRITICAL") {
      wrongOrderRef.current++;
    }

    const newStreak = streakRef.current + 1;
    streakRef.current = newStreak;
    if (newStreak > streakMaxRef.current) streakMaxRef.current = newStreak;
    setStreak(newStreak);
    setStreakMax(streakMaxRef.current);

    const mult   = newStreak >= 8 ? 2 : newStreak >= 4 ? 1.5 : 1;
    const points = Math.round((meta.points + speedBonus) * mult);
    scoreRef.current += points;
    setScore(scoreRef.current);

    setFlash(meta.color);
    setTimeout(() => setFlash(null), 120);

    if (soundEnabled) {
      if (newStreak === 4 || newStreak === 8) Sounds.streak();
      else Sounds.hit();
    }
  };

  const progress    = 1 - timeLeft / DURATION_MS;
  const secsLeft    = Math.ceil(timeLeft / 1000);
  const streakColor = streak >= 8 ? "#ff6d00" : streak >= 4 ? "#ffab00" : "#64748b";

  return (
    <div className={`flex flex-col gap-3 w-full h-full select-none ${shake ? "shake" : ""}`}
      style={{ borderColor: flash ? flash : undefined }}>
      {/* HUD */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-white text-lg font-extrabold number-display tabular-nums">{score}</span>
          {streak >= 2 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-sm border"
              style={{ color: streakColor, borderColor: `${streakColor}40`, background: `${streakColor}15` }}>
              ×{streak >= 8 ? "2.0" : "1.5"} STREAK
            </span>
          )}
        </div>
        <span className="text-cockpit-muted text-sm font-mono">{secsLeft}s</span>
      </div>

      {/* Timer bar */}
      <div className="h-0.5 w-full bg-cockpit-border rounded-full overflow-hidden">
        <div className="h-full bg-[#00e676]" style={{ width: `${(1-progress)*100}%`, transition: "width 0.1s linear" }} />
      </div>

      <p className="text-cockpit-muted text-[10px] uppercase tracking-widest font-mono text-center">
        Complete highest priority first
      </p>

      {/* Task cards */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto" style={{ minHeight: 220 }}>
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-cockpit-muted text-sm">Tasks incoming…</p>
          </div>
        )}
        {tasks
          .slice()
          .sort((a, b) => PRIORITY_META[b.priority].points - PRIORITY_META[a.priority].points)
          .map((task) => {
            const meta     = PRIORITY_META[task.priority];
            const elapsed  = Date.now() - task.spawnedAt;
            const pct      = Math.max(0, 1 - elapsed / task.timeoutMs);
            const secsLeft = Math.max(0, Math.ceil((task.timeoutMs - elapsed) / 1000));
            return (
              <button
                key={task.id}
                onClick={() => handleComplete(task)}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-sm border text-left transition-all duration-100 active:scale-[0.97] focus:outline-none"
                style={{
                  borderColor: `${meta.color}50`,
                  background:  `${meta.color}08`,
                }}
              >
                {/* Priority badge */}
                <span
                  className="text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-sm border shrink-0"
                  style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}15` }}
                >
                  {task.priority}
                </span>

                {/* Label */}
                <span className="flex-1 text-sm font-medium text-white truncate">{task.label}</span>

                {/* Countdown */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-mono number-display" style={{ color: meta.color }}>
                    {secsLeft}s
                  </span>
                  <div className="w-12 h-0.5 bg-cockpit-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct * 100}%`, background: meta.color, transition: "width 0.1s linear" }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
