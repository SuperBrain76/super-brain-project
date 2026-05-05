import { supabase, isSupabaseConfigured } from "./supabase";
import type { TestResult, SavedResult } from "@/types";

function makeShareId(): string {
  return Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6);
}

/** Save a completed test result for the currently signed-in user. */
export async function saveResult(
  result: TestResult,
  userId: string,
): Promise<{ shareId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { shareId: null, error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file." };
  }

  const shareId = makeShareId();

  const { error } = await supabase.from("test_results").insert({
    user_id:            userId,
    test_id:            result.testId,
    test_name:          result.testName,
    score:              result.score,
    percentile_estimate: result.percentileEstimate,
    result_title:       result.resultTitle,
    result_description: result.resultDescription,
    raw_metrics:        result.rawMetrics,
    share_id:           shareId,
    created_at:         result.createdAt,
  });

  if (error) return { shareId: null, error: error.message };
  return { shareId, error: null };
}

/** Fetch all results for the signed-in user. */
export async function loadMyResults(): Promise<SavedResult[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("test_results")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id:                 row.id,
    userId:             row.user_id,
    testId:             row.test_id,
    testName:           row.test_name,
    score:              row.score,
    percentileEstimate: row.percentile_estimate,
    resultTitle:        row.result_title,
    resultDescription:  row.result_description,
    rawMetrics:         row.raw_metrics ?? {},
    createdAt:          row.created_at,
    shareId:            row.share_id,
  }));
}

/** Fetch a single result by its public shareId (no auth required). */
export async function loadSharedResult(shareId: string): Promise<SavedResult | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("test_results")
    .select("*")
    .eq("share_id", shareId)
    .single();

  if (error || !data) return null;

  return {
    id:                 data.id,
    userId:             data.user_id,
    testId:             data.test_id,
    testName:           data.test_name,
    score:              data.score,
    percentileEstimate: data.percentile_estimate,
    resultTitle:        data.result_title,
    resultDescription:  data.result_description,
    rawMetrics:         data.raw_metrics ?? {},
    createdAt:          data.created_at,
    shareId:            data.share_id,
  };
}
