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

// ── Native image upload (Supabase Storage) ──────────────────────────────────

const IMAGE_BOUNDS = {
  avatar: { w: 512, h: 512 },
  banner: { w: 1600, h: 600 },
} as const;

/** Downscale + re-encode an image client-side so uploads stay small/fast. */
async function resizeImage(file: File, maxW: number, maxH: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85),
  );
}

/**
 * Upload an avatar or banner to Storage and return its public URL.
 * Resizes client-side, stores under {user_id}/{kind}-{ts}.jpg. No manual URLs.
 */
export async function uploadProfileImage(
  kind: "avatar" | "banner",
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: "Not configured." };
  if (!file.type.startsWith("image/")) return { error: "Please choose an image file." };
  if (file.size > 15 * 1024 * 1024) return { error: "That image is too large (max 15 MB)." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  let body: Blob = file;
  try {
    const b = IMAGE_BOUNDS[kind];
    body = await resizeImage(file, b.w, b.h);
  } catch {
    /* fall back to the original file if resizing fails */
  }

  const path = `${user.id}/${kind}-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("profile-images")
    .upload(path, body, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
  if (upErr) return { error: upErr.message };

  const { data } = supabase.storage.from("profile-images").getPublicUrl(path);
  return { url: data.publicUrl };
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
