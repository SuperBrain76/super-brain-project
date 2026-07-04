import { supabase, isSupabaseConfigured } from "./supabase";

// ============================================================================
// Public Profile System — client module
// ----------------------------------------------------------------------------
// Reads go through get_public_profile (anon-safe, privacy-filtered). Writes
// (set_username / update_public_profile) bind to auth.uid() inside the RPC.
// ============================================================================

export interface ProfileAchievement {
  code: string;
  name: string;
  icon: string;
  description: string;
  unlocked_at: string;
}
export interface ProfileTestBest {
  test_name: string;
  score: number;
  percentile: number;
}

export interface PublicProfile {
  found: boolean;
  isPublic: boolean;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  bannerUrl: string | null;
  joinDate: string | null;
  country: string | null;
  currency: { code: string; name: string; symbol: string } | null;
  level: {
    level: number | null;
    name: string | null;
    icon: string | null;
    progressPct: number;
    nextName: string | null;
    nextAt: number | null;
    lifetimeEarned: number;
  } | null;
  balance: number | null;
  achievements: { unlocked: number; total: number; list: ProfileAchievement[] } | null;
  predictions: { totalPoints: number; predictions: number; exactScores: number; rank: number | null } | null;
  tests: { completed: number; avgPercentile: number | null; best: ProfileTestBest[] } | null;
  leaderboard: { contributionRank: number | null; predictorRank: number | null };
  network: { total: number; active: number } | null;
  referral: { code: string | null } | null;
  activity: { created_at: string; delta: number; label: string }[] | null;
}

/** Public profile by username. `{found:false}` when missing, null on error. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_public_profile", { p_username: username });
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d.found) return { found: false } as PublicProfile;
  if (d.is_public === false) {
    return {
      found: true,
      isPublic: false,
      username: d.username ?? null,
      displayName: d.display_name ?? null,
      avatarUrl: d.avatar_url ?? null,
      avatarColor: d.avatar_color ?? null,
      bannerUrl: d.banner_url ?? null,
    } as PublicProfile;
  }
  return {
    found: true,
    isPublic: true,
    username: d.username ?? null,
    displayName: d.display_name ?? null,
    bio: d.bio ?? null,
    avatarUrl: d.avatar_url ?? null,
    avatarColor: d.avatar_color ?? null,
    bannerUrl: d.banner_url ?? null,
    joinDate: d.join_date ?? null,
    country: d.country ?? null,
    currency: d.currency ?? null,
    level: d.level
      ? {
          level: d.level.level ?? null,
          name: d.level.name ?? null,
          icon: d.level.icon ?? null,
          progressPct: Number(d.level.progress_pct ?? 0),
          nextName: d.level.next_name ?? null,
          nextAt: d.level.next_at ?? null,
          lifetimeEarned: Number(d.level.lifetime_earned ?? 0),
        }
      : null,
    balance: d.balance ?? null,
    achievements: d.achievements
      ? { unlocked: Number(d.achievements.unlocked), total: Number(d.achievements.total), list: d.achievements.list ?? [] }
      : null,
    predictions: d.predictions
      ? {
          totalPoints: Number(d.predictions.total_points),
          predictions: Number(d.predictions.predictions),
          exactScores: Number(d.predictions.exact_scores),
          rank: d.predictions.rank ?? null,
        }
      : null,
    tests: d.tests
      ? { completed: Number(d.tests.completed), avgPercentile: d.tests.avg_percentile ?? null, best: d.tests.best ?? [] }
      : null,
    leaderboard: {
      contributionRank: d.leaderboard?.contribution_rank ?? null,
      predictorRank: d.leaderboard?.predictor_rank ?? null,
    },
    network: d.network ? { total: Number(d.network.total), active: Number(d.network.active) } : null,
    referral: d.referral ? { code: d.referral.code ?? null } : null,
    activity: d.activity ?? null,
  };
}

// ── Editor (own profile) ─────────────────────────────────────────────────────

export interface ProfileSettings {
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatarColor: string | null;
  country: string | null;
  isPublic: boolean;
  privacy: Record<string, boolean>;
}

export async function getMyProfileSettings(): Promise<ProfileSettings | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_my_profile_settings");
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    username: d.username ?? null,
    displayName: d.display_name ?? null,
    bio: d.bio ?? null,
    avatarUrl: d.avatar_url ?? null,
    bannerUrl: d.banner_url ?? null,
    avatarColor: d.avatar_color ?? null,
    country: d.country ?? null,
    isPublic: d.is_public ?? true,
    privacy: d.privacy ?? {},
  };
}

/** Claim/change username. Returns the normalized handle or an error message. */
export async function setUsername(username: string): Promise<{ username?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Not configured." };
  const { data, error } = await supabase.rpc("set_username", { p_username: username });
  if (error) return { error: error.message };
  return { username: String(data) };
}

/** Update customization + privacy. Only provided fields change. */
export async function updatePublicProfile(fields: {
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isPublic?: boolean;
  privacy?: Record<string, boolean>;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Not configured." };
  const { error } = await supabase.rpc("update_public_profile", {
    p_bio: fields.bio ?? null,
    p_avatar_url: fields.avatarUrl ?? null,
    p_banner_url: fields.bannerUrl ?? null,
    p_is_public: fields.isPublic ?? null,
    p_privacy: fields.privacy ?? null,
  });
  if (error) return { error: error.message };
  return {};
}
