import { supabase, isSupabaseConfigured } from "./supabase";

// ============================================================================
// SuperBrain Economy — client module (read side)
// ----------------------------------------------------------------------------
// All WRITES to the economy happen server-side via SECURITY DEFINER RPCs
// (economy_emit / economy_reconcile) called from scoring paths, or via the
// service-role key in API routes. Clients never mint currency directly.
//
// The only client-callable mutation is economy_spend (spends the caller's own
// balance, bound to auth.uid() inside the RPC). See migration 021.
// ============================================================================

export interface Balance {
  currencyCode: string;
  balance: number;
}

export interface ContributionEntry {
  rank: number;
  displayName: string;
  country: string | null;
  balance: number;
}

export interface LedgerEntry {
  id: string;
  currencyCode: string;
  eventCode: string | null;
  delta: number;
  reason: string | null;
  createdAt: string;
}

/**
 * Balances for the signed-in user across all active currencies.
 * Returns [] when not configured or signed out; null on error.
 */
export async function getMyBalance(): Promise<Balance[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_my_balance");
  if (error) return null;
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    currencyCode: r.currency_code,
    balance: Number(r.balance),
  }));
}

/** Convenience: the signed-in user's IQ balance (0 when empty, null on error). */
export async function getMyIqBalance(): Promise<number | null> {
  const balances = await getMyBalance();
  if (balances === null) return null;
  return balances.find((b) => b.currencyCode === "IQ")?.balance ?? 0;
}

/**
 * Global contribution leaderboard by currency balance.
 * Never exposes user_id or private profile fields (definer RPC).
 */
export async function getContributionLeaderboard(
  currencyCode = "IQ",
): Promise<ContributionEntry[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_contribution_leaderboard", {
    p_currency_code: currencyCode,
  });
  if (error) return null;
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    rank: Number(r.rank),
    displayName: r.display_name ?? "Anonymous",
    country: r.country ?? null,
    balance: Number(r.balance),
  }));
}

/**
 * The signed-in user's own ledger history (read via RLS "ledger read own").
 * Most-recent first.
 */
export async function getMyLedger(limit = 50): Promise<LedgerEntry[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("economy_ledger")
    .select("id, currency_code, event_code, delta, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return null;
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    currencyCode: r.currency_code,
    eventCode: r.event_code ?? null,
    delta: Number(r.delta),
    reason: r.reason ?? null,
    createdAt: r.created_at,
  }));
}

// ── Partner Dashboard (single-round-trip aggregate) ─────────────────────────

export interface PartnerDashboard {
  authenticated: boolean;
  currency: { code: string; name: string; symbol: string; decimals: number };
  balance: number;
  lifetimeEarned: number;
  level: {
    level: number | null;
    name: string | null;
    icon: string | null;
    minEarned: number | null;
    nextName: string | null;
    nextAt: number | null;
    progressPct: number;
  };
  streak: { current: number; longest: number; totalCheckins: number; checkedInToday: boolean };
  dailyReward: { available: boolean; login: number; streak: number; streakDay: number; total: number };
  referral: { code: string | null; total: number; active: number; pending: number; earned: number };
  leaderboard: { rank: number | null; total: number };
  achievements: {
    unlocked: number;
    total: number;
    recent: { code: string; name: string; icon: string; unlocked_at: string }[];
  };
  recentTransactions: { created_at: string; delta: number; event_code: string | null; label: string }[];
  nextActions: { code: string; title: string; subtitle: string; href: string; icon: string; iq: number }[];
}

/**
 * The entire Partner Dashboard in one call. Returns { authenticated:false } when
 * signed out, null when not configured / on error. `currencyCode` is optional —
 * omit to use the platform default (configurable, never hardcoded client-side).
 */
export async function getPartnerDashboard(currencyCode?: string): Promise<PartnerDashboard | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_partner_dashboard", {
    p_currency: currencyCode ?? null,
  });
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d.authenticated) return { authenticated: false } as PartnerDashboard;
  return {
    authenticated: true,
    currency: d.currency,
    balance: Number(d.balance),
    lifetimeEarned: Number(d.lifetime_earned),
    level: {
      level: d.level.level ?? null,
      name: d.level.name ?? null,
      icon: d.level.icon ?? null,
      minEarned: d.level.min_earned ?? null,
      nextName: d.level.next_name ?? null,
      nextAt: d.level.next_at ?? null,
      progressPct: Number(d.level.progress_pct ?? 0),
    },
    streak: {
      current: Number(d.streak.current),
      longest: Number(d.streak.longest),
      totalCheckins: Number(d.streak.total_checkins),
      checkedInToday: !!d.streak.checked_in_today,
    },
    dailyReward: {
      available: !!d.daily_reward.available,
      login: Number(d.daily_reward.login),
      streak: Number(d.daily_reward.streak),
      streakDay: Number(d.daily_reward.streak_day),
      total: Number(d.daily_reward.total),
    },
    referral: {
      code: d.referral.code ?? null,
      total: Number(d.referral.total),
      active: Number(d.referral.active),
      pending: Number(d.referral.pending),
      earned: Number(d.referral.earned),
    },
    leaderboard: { rank: d.leaderboard.rank ?? null, total: Number(d.leaderboard.total) },
    achievements: {
      unlocked: Number(d.achievements.unlocked),
      total: Number(d.achievements.total),
      recent: d.achievements.recent ?? [],
    },
    recentTransactions: d.recent_transactions ?? [],
    nextActions: d.next_actions ?? [],
  };
}

// ── Daily login + streaks ───────────────────────────────────────────────────

export interface CheckinResult {
  currentStreak: number;
  longestStreak: number;
  mintedLogin: number;
  mintedStreak: number;
  alreadyCheckedIn: boolean;
}

/**
 * Record today's login and streak. Idempotent per UTC day — safe to call on
 * every app load. Returns null when not configured / signed out / on error.
 */
export async function dailyCheckin(): Promise<CheckinResult | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("economy_daily_checkin");
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
  if (!row) return null;
  return {
    currentStreak: Number(row.current_streak),
    longestStreak: Number(row.longest_streak),
    mintedLogin: Number(row.minted_login),
    mintedStreak: Number(row.minted_streak),
    alreadyCheckedIn: !!row.already_checked_in,
  };
}

export interface Streak {
  currentStreak: number;
  longestStreak: number;
  totalCheckins: number;
  lastCheckin: string | null;
}

export async function getMyStreak(): Promise<Streak | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_my_streak");
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
  if (!row) return null;
  return {
    currentStreak: Number(row.current_streak),
    longestStreak: Number(row.longest_streak),
    totalCheckins: Number(row.total_checkins),
    lastCheckin: row.last_checkin ?? null,
  };
}

// ── Referrals ───────────────────────────────────────────────────────────────

/** The signed-in user's referral code (created on first call). null on error. */
export async function getMyReferralCode(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_my_referral_code");
  if (error || data == null) return null;
  return String(data);
}

/** Attach a referral code to the signed-in (new) user. Returns true if applied. */
export async function attachReferral(code: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data, error } = await supabase.rpc("economy_attach_referral", { p_code: code });
  if (error) return false;
  return data === true;
}

export interface ReferralStats {
  total: number;
  qualified: number;
  pending: number;
  earnedIq: number;
}

export async function getMyReferralStats(): Promise<ReferralStats | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_my_referral_stats");
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
  if (!row) return null;
  return {
    total: Number(row.total),
    qualified: Number(row.qualified),
    pending: Number(row.pending),
    earnedIq: Number(row.earned_iq),
  };
}

// ── Achievements ────────────────────────────────────────────────────────────

export interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  rewardAmount: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

/** All achievements with the signed-in user's unlocked flag. */
export async function getMyAchievements(): Promise<Achievement[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_my_achievements");
  if (error) return null;
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    code: r.code,
    name: r.name,
    description: r.description,
    icon: r.icon,
    rewardAmount: Number(r.reward_amount),
    unlocked: !!r.unlocked,
    unlockedAt: r.unlocked_at ?? null,
  }));
}

/**
 * Spend the signed-in user's currency. The RPC binds to auth.uid(), checks
 * the balance atomically, and raises on insufficient funds. Returns the new
 * balance, or null on error (caller should surface the failure).
 */
export async function spend(
  currencyCode: string,
  amount: number,
  opts: { reason?: string; sourceRef?: string; idempotencyKey?: string } = {},
): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("economy_spend", {
    p_currency_code: currencyCode,
    p_amount: amount,
    p_reason: opts.reason ?? null,
    p_source_ref: opts.sourceRef ?? null,
    p_idempotency_key: opts.idempotencyKey ?? null,
  });
  if (error || data == null) return null;
  return Number(data);
}
