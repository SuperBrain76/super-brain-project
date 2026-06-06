-- ============================================================
-- MIGRATION 010 — Allow authenticated users to read display
--                 names and countries from user_profiles
--
-- Root cause: user_profiles had only one SELECT policy:
--   auth.uid() = id (own row only)
--
-- This caused SECURITY DEFINER league RPCs to return NULL for
-- other members' display_name when the function owner lacked
-- BYPASSRLS, producing "Anonymous" for all members.
--
-- The schema already documents this intent:
--   "Only display_name and country are exposed publicly."
--
-- This migration adds the missing policy.
-- Safe to re-run (idempotent DO block).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_profiles'
      AND policyname = 'authenticated users read display names'
  ) THEN
    CREATE POLICY "authenticated users read display names"
      ON public.user_profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Ensure SECURITY DEFINER league functions are owned by postgres
-- so they bypass RLS regardless of how they were created.
ALTER FUNCTION public.get_league_leaderboard(uuid) OWNER TO postgres;
ALTER FUNCTION public.get_league_members(uuid)      OWNER TO postgres;

DO $$
BEGIN
  RAISE NOTICE 'Migration 010 applied:';
  RAISE NOTICE '  - user_profiles: authenticated users can now read display_name and country';
  RAISE NOTICE '  - get_league_leaderboard owned by postgres (guaranteed BYPASSRLS)';
  RAISE NOTICE '  - get_league_members owned by postgres (guaranteed BYPASSRLS)';
END;
$$;
