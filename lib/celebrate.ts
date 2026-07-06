// ============================================================================
// Celebration detection — spots the moments worth celebrating (level-ups, new
// prestige tiers, freshly-unlocked achievements) by comparing the current
// dashboard against a localStorage snapshot. Pure client-side, no backend.
//
// First run only snapshots (never celebrates), so existing users aren't
// bombarded the first time this ships.
// ============================================================================

import { currentTier, type PrestigeTier } from "./prestige";

export type CelebrationEvent =
  | { kind: "level"; level: number; name: string; icon: string }
  | { kind: "prestige"; tier: PrestigeTier }
  | { kind: "achievement"; code: string; name: string; icon: string };

const LEVEL_KEY = "sb:cel:level";
const TIER_KEY = "sb:cel:tier";
const ACH_KEY = "sb:cel:ach";

function read(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function write(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }

export interface DetectInput {
  level: number | null;
  levelName: string | null;
  levelIcon: string | null;
  lifetimeEarned: number;
  recentAchievements: { code: string; name: string; icon: string }[];
}

export function detectCelebrations(inp: DetectInput): CelebrationEvent[] {
  const firstRun = read(LEVEL_KEY) === null && read(TIER_KEY) === null && read(ACH_KEY) === null;
  const events: CelebrationEvent[] = [];

  // ── Level up ──────────────────────────────────────────────────────────
  const lvl = inp.level ?? 1;
  const prevLevel = Number(read(LEVEL_KEY));
  if (!firstRun && Number.isFinite(prevLevel) && lvl > prevLevel) {
    events.push({ kind: "level", level: lvl, name: inp.levelName ?? "", icon: inp.levelIcon ?? "🧠" });
  }
  write(LEVEL_KEY, String(lvl));

  // ── Prestige tier ─────────────────────────────────────────────────────
  const tier = currentTier(inp.lifetimeEarned);
  const prevTier = read(TIER_KEY);
  if (!firstRun && tier && tier.id !== prevTier) {
    events.push({ kind: "prestige", tier });
  }
  write(TIER_KEY, tier?.id ?? "");

  // ── Achievements ──────────────────────────────────────────────────────
  let seen: string[] = [];
  try { seen = JSON.parse(read(ACH_KEY) ?? "[]"); } catch { seen = []; }
  const seenSet = new Set(seen);
  if (!firstRun) {
    for (const a of inp.recentAchievements) {
      if (!seenSet.has(a.code)) events.push({ kind: "achievement", code: a.code, name: a.name, icon: a.icon });
    }
  }
  const union = Array.from(new Set([...seen, ...inp.recentAchievements.map((a) => a.code)]));
  write(ACH_KEY, JSON.stringify(union.slice(-200)));

  return events;
}

// Copy + emblem for each event, incl. the share text that carries the invite.
export function describeEvent(ev: CelebrationEvent): { badge: string; title: string; sub: string; emblem: string; shareText: string } {
  switch (ev.kind) {
    case "level":
      return {
        badge: "LEVEL UP",
        title: `Level ${ev.level}`,
        sub: ev.name ? `You're now a ${ev.name}` : "You leveled up your SuperBrain",
        emblem: ev.icon || "🧠",
        shareText: `I just reached Level ${ev.level} on SuperBrain 🧠 — building my brain one play at a time. Join me:`,
      };
    case "prestige":
      return {
        badge: "STATUS UNLOCKED",
        title: ev.tier.name,
        sub: `${ev.tier.reward} — pure status, earned with IQ`,
        emblem: ev.tier.icon,
        shareText: `I just unlocked ${ev.tier.name} status on SuperBrain 🏆 Come earn yours:`,
      };
    case "achievement":
      return {
        badge: "ACHIEVEMENT UNLOCKED",
        title: ev.name,
        sub: "Added to your profile",
        emblem: ev.icon || "🎖️",
        shareText: `I just unlocked the "${ev.name}" achievement on SuperBrain 🎖️ Think you can too?`,
      };
  }
}
