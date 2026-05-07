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

export async function getLeaderboard(
  testName: string,
  country?: string,
): Promise<LeaderboardEntry[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase.rpc("get_leaderboard", {
    filter_test_name: testName,
    filter_country:   country ?? null,
  });

  if (error || !data) return [];

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
