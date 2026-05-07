import { supabase, isSupabaseConfigured } from "./supabase";

export interface LeaderboardEntry {
  rank: number;
  testName: string;
  score: number;
  percentile: number;
  resultTitle: string;
  displayName: string;
  country: string | null;
}

export interface LeaderboardStats {
  totalAttempts: number;
  totalPlayers:  number;
}

/**
 * Returns the rank (1 = best) that p_score achieves for a given test.
 * Requires the get_user_rank RPC in schema.sql.
 */
export async function getUserRank(testName: string, score: number): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_user_rank", {
    p_test_name: testName,
    p_score:     score,
  });
  if (error || data == null) return null;
  return Number(data);
}

/**
 * Returns ranked entries, [] when genuinely empty, null on error.
 * Callers must handle null to show an error state instead of empty.
 */
export async function getLeaderboard(
  testName: string,
  country?: string,
): Promise<LeaderboardEntry[] | null> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc("get_leaderboard", {
    filter_test_name: testName,
    filter_country:   country ?? null,
  });

  if (error) return null;
  if (!data)  return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => ({
    rank:        Number(row.rank),
    testName:    row.test_name,
    score:       row.score,
    percentile:  row.percentile,
    resultTitle: row.result_title,
    displayName: row.display_name ?? "Anonymous",
    country:     row.country ?? null,
  }));
}

export async function getLeaderboardStats(testName: string): Promise<LeaderboardStats | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc("get_leaderboard_stats", {
    p_test_name: testName,
  });

  if (error || !data || !(data as unknown[]).length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])[0];
  return {
    totalAttempts: Number(row.total_attempts),
    totalPlayers:  Number(row.total_players),
  };
}
