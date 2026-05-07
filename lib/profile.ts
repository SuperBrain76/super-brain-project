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
    profileComplete: (row.profile_complete as boolean) ?? false,
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
  };
}

export async function loadMyProfile(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
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
  if (fields.profileComplete !== undefined) payload.profile_complete = fields.profileComplete;

  const { error } = await supabase
    .from("user_profiles")
    .update(payload)
    .eq("id", userId);

  return { error: error?.message ?? null };
}
