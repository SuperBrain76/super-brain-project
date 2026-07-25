/**
 * lib/iqLevel.ts — the SuperBrain IQ economy, as levels.
 *
 * You're not just predicting football — you're building your SuperBrain. Every
 * prediction, test and win earns permanent IQ, and IQ carries you up five
 * named levels. Pure status, no cash value. Derived entirely from lifetime IQ,
 * so no new backend.
 *
 * Complements lib/prestige.ts (profile frames); this is the simple, legible
 * ladder shown on the Competition Home.
 */

export type IqLevelId = "bronze" | "silver" | "gold" | "diamond" | "legend";

export interface IqLevel {
  id:    IqLevelId;
  name:  string;
  min:   number;   // lifetime IQ to reach this level
  color: string;   // accent colour
  icon:  string;
}

export const IQ_LEVELS: IqLevel[] = [
  { id: "bronze",  name: "Bronze",  min: 0,     color: "#C08457", icon: "🥉" },
  { id: "silver",  name: "Silver",  min: 500,   color: "#9AA7B4", icon: "🥈" },
  { id: "gold",    name: "Gold",    min: 2000,  color: "#D9A93A", icon: "🥇" },
  { id: "diamond", name: "Diamond", min: 6000,  color: "#4FC4E0", icon: "💎" },
  { id: "legend",  name: "Legend",  min: 15000, color: "#B45BE0", icon: "👑" },
];

export interface IqStanding {
  level:      IqLevel;
  next:       IqLevel | null;   // null once at Legend
  toNext:     number;           // IQ needed to reach next level (0 at Legend)
  progressPct: number;          // 0–100 through the current level band
}

export function iqStanding(lifetimeIq: number): IqStanding {
  const iq = Math.max(0, Math.floor(lifetimeIq));
  let idx = 0;
  for (let i = 0; i < IQ_LEVELS.length; i++) if (iq >= IQ_LEVELS[i].min) idx = i;

  const level = IQ_LEVELS[idx];
  const next  = IQ_LEVELS[idx + 1] ?? null;

  if (!next) return { level, next: null, toNext: 0, progressPct: 100 };

  const band = next.min - level.min;
  const into = iq - level.min;
  return {
    level, next,
    toNext: next.min - iq,
    progressPct: Math.max(0, Math.min(100, Math.round((into / band) * 100))),
  };
}
