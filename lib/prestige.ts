// ============================================================================
// IQ Prestige — status you unlock NOW by earning IQ. No monetary value; pure
// prestige. Derived entirely from lifetime IQ (permanent), so no new backend.
// ============================================================================

import { MATERIAL } from "./brand";

export type PrestigeId = "bronze" | "silver" | "gold" | "animated" | "elite" | "founder";

export interface PrestigeTier {
  id: PrestigeId;
  threshold: number;   // lifetime IQ required
  name: string;        // "Gold Ring"
  reward: string;      // what it unlocks, one line
  icon: string;        // ladder icon
  ring: string;        // CSS background for the avatar ring
  glow: boolean;       // gold-glow shadow behind the avatar
  animated: boolean;   // subtle pulsing shimmer
  emblem?: string;     // small badge pinned to the avatar
}

export const PRESTIGE_TIERS: PrestigeTier[] = [
  { id: "bronze",   threshold: 100,   name: "Bronze Frame",   reward: "Bronze profile frame",  icon: "🥉", ring: "linear-gradient(135deg,#D8996A,#8A5A2E)", glow: false, animated: false },
  { id: "silver",   threshold: 500,   name: "Silver Frame",   reward: "Silver profile frame",  icon: "🥈", ring: "linear-gradient(135deg,#E4E9F0,#9AA3AE)", glow: false, animated: false },
  { id: "gold",     threshold: 1000,  name: "Gold Ring",      reward: "Gold profile ring",     icon: "🥇", ring: MATERIAL.goldFill, glow: true,  animated: false },
  { id: "animated", threshold: 2000,  name: "Animated Badge", reward: "Animated gold ring",    icon: "✨", ring: MATERIAL.goldFill, glow: true,  animated: true,  emblem: "✨" },
  { id: "elite",    threshold: 5000,  name: "Elite Profile",  reward: "Elite profile status",  icon: "👑", ring: MATERIAL.goldFill, glow: true,  animated: true,  emblem: "👑" },
  { id: "founder",  threshold: 10000, name: "Founder Badge",  reward: "Founder badge",         icon: "🛡️", ring: "linear-gradient(135deg,#F6E6A8,#E8C15A 45%,#8A6D12)", glow: true, animated: true, emblem: "🛡️" },
];

/** Highest tier unlocked at this lifetime IQ (null below the first threshold). */
export function currentTier(iq: number): PrestigeTier | null {
  let cur: PrestigeTier | null = null;
  for (const t of PRESTIGE_TIERS) if (iq >= t.threshold) cur = t;
  return cur;
}

/** The next tier to chase (null once everything is unlocked). */
export function nextTier(iq: number): PrestigeTier | null {
  for (const t of PRESTIGE_TIERS) if (iq < t.threshold) return t;
  return null;
}

export function tiersWithState(iq: number): { tier: PrestigeTier; unlocked: boolean }[] {
  return PRESTIGE_TIERS.map((tier) => ({ tier, unlocked: iq >= tier.threshold }));
}
