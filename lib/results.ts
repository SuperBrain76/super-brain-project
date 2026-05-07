import { supabase, isSupabaseConfigured } from "./supabase";
import type { TestResult, SavedResult } from "@/types";

const RESULT_COLUMNS =
  "id, user_id, test_name, score, percentile, result_title, share_id, created_at";

function makeShareId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function rowToSavedResult(row: Record<string, unknown>): SavedResult {
  return {
    id:          row.id as string,
    userId:      row.user_id as string,
    testName:    row.test_name as string,
    score:       row.score as number,
    percentile:  row.percentile as number,
    resultTitle: row.result_title as string,
    shareId:     (row.share_id as string | null) ?? null,
    createdAt:   row.created_at as string,
  };
}

export async function saveResult(
  result: TestResult,
  userId: string,
): Promise<{ shareId: string | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return {
      shareId: null,
      error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    };
  }

  const shareId = makeShareId();

  const { error } = await supabase.from("test_results").insert({
    user_id:      userId,
    test_name:    result.testName,
    score:        result.score,
    percentile:   result.percentileEstimate,
    result_title: result.resultTitle,
    share_id:     shareId,
  });

  if (error) return { shareId: null, error: "Could not save your result — please try again." };
  return { shareId, error: null };
}

export async function loadMyResults(): Promise<SavedResult[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("test_results")
    .select(RESULT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToSavedResult);
}

export async function loadSharedResult(shareId: string): Promise<SavedResult | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("test_results")
    .select(RESULT_COLUMNS)
    .eq("share_id", shareId)
    .single();

  if (error || !data) return null;
  return rowToSavedResult(data as Record<string, unknown>);
}
