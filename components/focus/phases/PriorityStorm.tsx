"use client";

// Phase 5 — Priority Storm
// Task cards with CRITICAL / HIGH / LOW priority and countdown timers.
// Constant pressure maintained — backlog refills immediately when cleared.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sounds } from "@/lib/sounds";
import type { PhaseResult } from "@/lib/focus-test";

interface Props {
  soundEnabled: boolean;
  onComplete:   (result: PhaseResult) => void;
}

const DURATION_MS = 45_000;   // 45 seconds
const MAX_TASKS   = 5;
const MIN_TASKS   = 2;        // always keep at least this many visible

type Priority = "CRITICAL" | "HIGH" | "LOW";

interface Task {
  id:        number;
  priority:  Priority;
  label:     string;
  timeoutMs: number;
  spawnedAt: number;
}

const PRIORITY_META: Record<Priority, { color: string; timeout: number; points: number }> = {
  CRITICAL: { color: "#ff3d00", timeout: 5500,  points: 30 },
  HIGH:     { color: "#ffab00", timeout: 9000,  points: 15 },
  LOW:      { color: "#00d4ff", timeout: 14000, points:  6 },
};

const TASK_LABELS: Record<Priority, string[]> = {
  CRITICAL: ["System failure", "Data breach", "Network down", "Server crash", "Critical bug", "Pipeline blocked"],
  HIGH:     ["Stakeholder reply", "Deadline review", "Team blocker", "Release approval", "Budget sign-off", "Client escalation"],
  LOW:      ["Read report", "Slack message", "Team standup", "Update docs", "Weekly review", "Log progress"],
};

let _tid = 0;

function makeTask(forcePriority?: Priority): Task {
  const roll     = Math.random();
  const priority: Priority = forcePriority ?? (roll < 0.28 ? "CRITICAL" : roll < 0.60 ? "HIGH" : "LOW");
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

function activeTasks(tasks: Task[]): Task[] {
  const now = Date.now();
  return tasks.filter((t) => now - t.spawnedAt < t.timeoutMs);
}

export default function PriorityStorm({ soundEnabled, onComplete }: Props) {
  const [tasks,     setTasks]     = useState<Task[]>([]);
  const [timeLeft,  setTimeLeft]  = useState(DURATION_MS);
  const [score,     setScore]     = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [streakMax, setStreakMax] = useState(0);
  const [shake,     setShake]     = useState(false);

  const startRef        = useRef(Date.now());
  const completedRef    = useRef(false);
  const completedCount  = useRef(0);
  const critMissedRef   = useRef(0);
  const wrongOrderRef   = useRef(0);
  const streakRef       = useRef(0);
  const streakMaxRef    = useRef(0);
  const scoreRef        = useRef(0);

  const finish = useCallback(() => {
    const total    = completedCount.current + critMissedRef.current;
    const accuracy = total > 0 ? completedCount.current / total : 0;
    const raw = Math.max(0, accuracy * 80 + streakMaxRef.current * 0.5 - wrongOrderRef.current * 3);
    if (soundEnabled) Sounds.phaseComplete();
    onComplete({
      phase: 5, score: Math.min(100, Math.round(raw)), accuracy,
      avgReactionMs: 0, streakMax: streakMaxRef.current,
      extras: { completed: completedCount.current, critMissed: critMissedRef.current },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, onComplete]);

  // Countdown + expire tasks + maintain minimum pressure
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left    = Math.max(0, DURATION_MS - elapsed);
      setTimeLeft(left);

      const progress = elapsed / DURATION_MS;

      setTasks((prev) => {
        const now     = Date.now();
        const expired = prev.filter((t) => now - t.spawnedAt >= t.timeoutMs);
        let   kept    = prev.filter((t) => now - t.spawnedAt  < t.timeoutMs);

        // Penalise expired CRITICAL tasks
        expired.forEach((t) => {
          if (t.priority === "CRITICAL") {
            critMissedRef.current++;
            scoreRef.current = Math.max(0, scoreRef.current - 20);
            setScore(scoreRef.current);
            streakRef.current = 0;
            setStreak(0);
            setShake(true);
            setTimeout(() => setShake(false), 380);
            if (soundEnabled) Sounds.critical();
          }
        });

        // Ensure minimum task count — spawn immediately if below floor
        if (kept.length < MIN_TASKS && !completedRef.current) {
          const needed  = MIN_TASKS + Math.round(progress * 2) - kept.length; // floor rises over time
          const toSpawn = Math.min(needed, MAX_TASKS - kept.length);
          for (let i = 0; i < toSpawn; i++) kept = [...kept, makeTask()];
        }

        return kept;
      });

      if (left === 0 && !completedRef.current) {
        completedRef.current = true;
        finish();
      }
    }, 300);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Burst-spawn initial load + ongoing trickle
  useEffect(() => {
    // Heavy initial load so there's instant pressure
    setTasks([makeTask("CRITICAL"), makeTask("HIGH"), makeTask("HIGH"), makeTask("LOW")]);

    const spawn = () => {
      if (completedRef.current) return;
      const elapsed  = Date.now() - startRef.current;
      const progress = elapsed / DURATION_MS;
      // 1800ms → 900ms as phase progresses
      const delay = Math.round(1800 - progress * 900);

      setTasks((prev) => {
        const active = activeTasks(prev);
        if (active.length >= MAX_TASKS) return prev;
        return [...active, makeTask()];
      });

      setTimeout(spawn, delay);
    };

    const t = setTimeout(spawn, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleComplete = (task: Task) => {
    if (completedRef.current) return;

    const higherExists = tasks.some(
      (t) => t.id !== task.id &&
        PRIORITY_META[t.priority].points > PRIORITY_META[task.priority].points,
    );
    if (higherExists) wrongOrderRef.current++;

    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    completedCount.current++;

    const meta      = PRIORITY_META[task.priority];
    const timeMs    = Date.now() - task.spawnedAt;
    const speedBonus = Math.max(0, Math.round((1 - timeMs / task.timeoutMs) * meta.points * 0.5));

    const ns = streakRef.current + 1;
    streakRef.current = ns;
    if (ns > streakMaxRef.current) streakMaxRef.current = ns;
    setStreak(ns); setStreakMax(streakMaxRef.current);

    const mult   = ns >= 8 ? 2 : ns >= 4 ? 1.5 : 1;
    const points = Math.round((meta.points + speedBonus) * mult);
    scoreRef.current += points; setScore(scoreRef.current);

    if (soundEnabled) {
      if (ns === 4 || ns === 8) Sounds.streak();
      else Sounds.hit();
    }
  };

  const progress    = 1 - timeLeft / DURATION_MS;
  const secsLeft    = Math.ceil(timeLeft / 1000);
  const streakColor = streak >= 8 ? "#ff6d00" : streak >= 4 ? "#ffab00" : "#64748b";

  const sortedTasks = tasks
    .slice()
    .sort((a, b) => PRIORITY_META[b.priority].points - PRIORITY_META[a.priority].points);

  return (
    <div className={`flex flex-col gap-3 w-full h-full select-none ${shake ? "shake" : ""}`}>
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

      <div className="h-0.5 w-full bg-cockpit-border rounded-full overflow-hidden">
        <div className="h-full bg-[#00e676]"
          style={{ width: `${(1 - progress) * 100}%`, transition: "width 0.1s linear" }} />
      </div>

      <p className="text-cockpit-muted text-[10px] uppercase tracking-widest font-mono text-center">
        Complete highest priority first
      </p>

      <div className="flex-1 flex flex-col gap-2 overflow-y-auto" style={{ minHeight: 200 }}>
        {sortedTasks.map((task) => {
          const meta    = PRIORITY_META[task.priority];
          const elapsed = Date.now() - task.spawnedAt;
          const pct     = Math.max(0, 1 - elapsed / task.timeoutMs);
          const sLeft   = Math.max(0, Math.ceil((task.timeoutMs - elapsed) / 1000));
          const urgent  = pct < 0.25;
          return (
            <button
              key={task.id}
              onClick={() => handleComplete(task)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-sm border text-left transition-all duration-100 active:scale-[0.97] focus:outline-none"
              style={{
                borderColor: `${meta.color}${urgent ? "90" : "45"}`,
                background:  `${meta.color}${urgent ? "14" : "08"}`,
              }}
            >
              <span className="text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-sm border shrink-0"
                style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}15` }}>
                {task.priority}
              </span>
              <span className="flex-1 text-sm font-medium text-white truncate">{task.label}</span>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs font-mono number-display" style={{ color: meta.color }}>{sLeft}s</span>
                <div className="w-12 h-0.5 bg-cockpit-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${pct * 100}%`, background: meta.color, transition: "width 0.1s linear" }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
