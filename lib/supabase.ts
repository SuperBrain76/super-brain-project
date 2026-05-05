import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when env vars are present — gates all Supabase calls */
export const isSupabaseConfigured = !!(url && key);

export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder");
