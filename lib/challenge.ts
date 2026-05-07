import { supabase, isSupabaseConfigured } from "./supabase";
import type { ChallengeResult } from "@/types";

const CHALLENGE_KEY = "superbrain_challenge_share_id";

/** Store a challenge share ID in sessionStorage when the user accepts a challenge. */
export function storeChallengeId(shareId: string): void {
  try { sessionStorage.setItem(CHALLENGE_KEY, shareId); } catch { /* SSR / privacy mode */ }
}

/**
 * Read and clear the pending challenge ID.
 * Returns null if no challenge is pending (or storage unavailable).
 */
export function consumeChallengeId(): string | null {
  try {
    const id = sessionStorage.getItem(CHALLENGE_KEY);
    if (id) sessionStorage.removeItem(CHALLENGE_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Load a challenger's result (including display_name) via SECURITY DEFINER RPC. */
export async function loadChallengeResult(shareId: string): Promise<ChallengeResult | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc("get_challenge_result", { p_share_id: shareId });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as Record<string, unknown>;
  return {
    id:          row.id as string,
    userId:      "",                                       // not exposed via RPC
    testName:    row.test_name as string,
    score:       row.score as number,
    percentile:  row.percentile as number,
    resultTitle: row.result_title as string,
    shareId:     row.share_id as string,
    createdAt:   row.created_at as string,
    displayName: (row.display_name as string) ?? "Challenger",
    country:     (row.country as string | null) ?? null,
  };
}
