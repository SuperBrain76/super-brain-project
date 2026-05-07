import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface FeedbackPayload {
  testName:       string;
  score:          number;
  resultTitle:    string;
  feltOptions:    string[];
  wouldShare:     string;
  almostQuit:     string;
  testSuggestion: string;
  userId:         string | null;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from("test_feedback").insert({
    test_name:       payload.testName,
    score:           payload.score,
    result_title:    payload.resultTitle,
    felt_options:    payload.feltOptions,
    would_share:     payload.wouldShare    || null,
    almost_quit:     payload.almostQuit.trim()     || null,
    test_suggestion: payload.testSuggestion.trim() || null,
    user_id:         payload.userId,
  });
}
