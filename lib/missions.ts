import { supabase, isSupabaseConfigured } from "./supabase";

// ============================================================================
// Daily Missions Engine — client module. Missions are DB config; progress is
// derived server-side from the economy ledger + source tables (migration 031).
// ============================================================================

export type MissionCadence = "daily" | "weekly" | "event";

export interface Mission {
  code: string;
  title: string;
  description: string;
  icon: string;
  cadence: MissionCadence;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  reward: { amount: number; currency: string };
  periodKey: string;
}

export interface MissionsResult {
  authenticated: boolean;
  currency: { code: string; name: string; symbol: string } | null;
  missions: Mission[];
}

export async function getMissions(currencyCode?: string): Promise<MissionsResult | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_missions", { p_currency: currencyCode ?? null });
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d.authenticated) return { authenticated: false, currency: null, missions: [] };
  return {
    authenticated: true,
    currency: d.currency ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    missions: (d.missions ?? []).map((m: any) => ({
      code: m.code,
      title: m.title,
      description: m.description,
      icon: m.icon,
      cadence: m.cadence,
      target: Number(m.target),
      progress: Number(m.progress),
      completed: !!m.completed,
      claimed: !!m.claimed,
      reward: { amount: Number(m.reward?.amount ?? 0), currency: m.reward?.currency ?? "IQ" },
      periodKey: m.period_key,
    })),
  };
}

/** Claim a completed mission's reward. Returns minted amount or an error. */
export async function claimMission(code: string): Promise<{ claimed: boolean; amount?: number; error?: string }> {
  if (!isSupabaseConfigured) return { claimed: false, error: "Not configured." };
  const { data, error } = await supabase.rpc("claim_mission", { p_code: code });
  if (error) return { claimed: false, error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { claimed: !!d?.claimed, amount: d?.amount != null ? Number(d.amount) : undefined, error: d?.error };
}
