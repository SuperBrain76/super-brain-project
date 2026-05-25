import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────

export type RoundType = "reaction" | "math" | "sequence";

export interface BattleProfile {
  user_id:      string;
  display_name: string;
  elo:          number;
  wins:         number;
  losses:       number;
  win_streak:   number;
  best_streak:  number;
  country:      string | null;
}

export interface BattleMatch {
  id:               string;
  player1_id:       string;
  player2_id:       string;
  player1_name:     string;
  player2_name:     string;
  player1_elo:      number;
  player2_elo:      number;
  player1_score:    number;
  player2_score:    number;
  status:           "lobby" | "active" | "result" | "complete";
  current_round:    number;
  total_rounds:     number;
  round_types:      RoundType[];
  challenge_data:   ChallengeData | null;
  round_started_at: string | null;
  winner_id:        string | null;
  player1_elo_delta: number | null;
  player2_elo_delta: number | null;
  created_at:       string;
  ended_at:         string | null;
}

export interface ReactionChallenge { type: "reaction"; delay_ms: number; correct_answer: "TAP" }
export interface MathChallenge     { type: "math";     a: number; op: string; b: number; options: number[]; correct_answer: string }
export interface SequenceChallenge { type: "sequence"; nums: number[]; options: number[]; correct_answer: string }
export type ChallengeData = ReactionChallenge | MathChallenge | SequenceChallenge;

// ── Divisions ─────────────────────────────────────────────────

export interface Division {
  name:  string;
  color: string;
  min:   number;
  max:   number;
}

export const DIVISIONS: Division[] = [
  { name: "Unranked",    color: "#64748b", min: 0,    max: 899  },
  { name: "Bronze",      color: "#cd7c32", min: 900,  max: 1099 },
  { name: "Silver",      color: "#94a3b8", min: 1100, max: 1299 },
  { name: "Gold",        color: "#ffab00", min: 1300, max: 1499 },
  { name: "Platinum",    color: "#00d4ff", min: 1500, max: 1699 },
  { name: "Diamond",     color: "#a855f7", min: 1700, max: 1899 },
  { name: "Master",      color: "#ff6d00", min: 1900, max: 2099 },
  { name: "Grandmaster", color: "#ff3d00", min: 2100, max: 9999 },
];

export function getDivision(elo: number): Division {
  return DIVISIONS.find((d) => elo >= d.min && elo <= d.max) ?? DIVISIONS[0];
}

export function eloProgress(elo: number): number {
  const d = getDivision(elo);
  if (d.name === "Grandmaster") return 100;
  const range = d.max - d.min + 1;
  return Math.min(100, Math.round(((elo - d.min) / range) * 100));
}

// ── Round metadata ────────────────────────────────────────────

export const ROUND_META: Record<RoundType, { label: string; color: string; icon: string; desc: string }> = {
  reaction: { label: "Reaction",    color: "#ff3d00", icon: "⚡", desc: "Tap the moment you see it" },
  math:     { label: "Math Sprint", color: "#00d4ff", icon: "∑",  desc: "Fastest correct answer wins" },
  sequence: { label: "Sequence",    color: "#a855f7", icon: "→",  desc: "Find the next number" },
};

// ── Supabase helpers ──────────────────────────────────────────

export async function ensureBattleProfile(
  userId: string,
  name: string,
  country?: string,
): Promise<BattleProfile | null> {
  const { data } = await supabase.rpc("ensure_battle_profile", {
    p_user_id: userId,
    p_name:    name,
    p_country: country ?? null,
  });
  return (data as BattleProfile) ?? null;
}

export async function getBattleProfile(userId: string): Promise<BattleProfile | null> {
  const { data } = await supabase
    .from("battle_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  return (data as BattleProfile) ?? null;
}

export async function findOrCreateBattle(
  userId: string,
  name: string,
  elo: number,
  country?: string,
): Promise<{ status: "queued" | "matched"; match_id?: string }> {
  const { data } = await supabase.rpc("find_or_create_battle", {
    p_user_id: userId,
    p_name:    name,
    p_elo:     elo,
    p_country: country ?? null,
  });
  return data as { status: "queued" | "matched"; match_id?: string };
}

export async function leaveQueue(userId: string) {
  await supabase.from("battle_queue").delete().eq("user_id", userId);
}

export async function getMatch(matchId: string): Promise<BattleMatch | null> {
  const { data } = await supabase
    .from("battle_matches")
    .select("*")
    .eq("id", matchId)
    .single();
  return (data as BattleMatch) ?? null;
}

export async function startBattleRound(matchId: string, fromRound: number) {
  return supabase.rpc("start_battle_round", {
    p_match_id:   matchId,
    p_from_round: fromRound,
  });
}

export async function submitBattleAnswer(
  matchId: string,
  userId:  string,
  answer:  string,
  timeMs:  number,
) {
  return supabase.rpc("submit_battle_answer", {
    p_match_id: matchId,
    p_user_id:  userId,
    p_answer:   answer,
    p_time_ms:  timeMs,
  });
}
