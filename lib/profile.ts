import { supabase, isSupabaseConfigured } from "./supabase";
import type { UserProfile } from "@/types";

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id:              row.id as string,
    displayName:     (row.display_name as string) ?? "Anonymous",
    country:         (row.country as string | null) ?? null,
    birthYear:       (row.birth_year as number | null) ?? null,
    gender:          (row.gender as string | null) ?? null,
    industry:        (row.industry as string | null) ?? null,
    avatarColor:     (row.avatar_color as string | null) ?? "#00d4ff",
    profileComplete: (row.profile_complete as boolean) ?? false,
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
  };
}

export async function loadMyProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  // Must filter by id explicitly — relying on RLS alone breaks when the
  // "authenticated can read any profile" policy (migration 011) is active,
  // because .single() then sees multiple rows and errors.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return rowToProfile(data as Record<string, unknown>);
}

export interface ProfileUpdate {
  displayName?: string;
  country?: string | null;
  birthYear?: number | null;
  gender?: string | null;
  industry?: string | null;
  avatarColor?: string;
  profileComplete?: boolean;
}

export async function saveProfile(
  userId: string,
  fields: ProfileUpdate,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: "Supabase not configured." };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.displayName     !== undefined) payload.display_name     = fields.displayName;
  if (fields.country         !== undefined) payload.country          = fields.country;
  if (fields.birthYear       !== undefined) payload.birth_year       = fields.birthYear;
  if (fields.gender          !== undefined) payload.gender           = fields.gender;
  if (fields.industry        !== undefined) payload.industry         = fields.industry;
  if (fields.avatarColor     !== undefined) payload.avatar_color     = fields.avatarColor;
  if (fields.profileComplete !== undefined) payload.profile_complete = fields.profileComplete;

  // Use upsert so a missing profile row is created rather than silently
  // failing. .update() with no matching row returns no error but writes nothing.
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ id: userId, ...payload }, { onConflict: "id" });

  if (error) return { error: error.message };

  // Verify the write actually landed — catches silent RLS-blocked writes
  const { data: verify } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  if (!verify) return { error: "Profile saved but could not be verified. Try again." };
  return { error: null };
}
