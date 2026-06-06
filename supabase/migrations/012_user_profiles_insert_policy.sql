-- ============================================================
-- MIGRATION 012 — Allow users to insert/upsert their own profile
--
-- lib/profile.ts saveProfile() was changed from .update() to
-- .upsert() to handle the case where a profile row doesn't
-- exist (trigger failed, old account, etc.).
--
-- Without an INSERT policy, upsert fails when trying to create
-- a new row. This migration adds the missing INSERT policy.
--
-- Safe to re-run (idempotent DO block).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_profiles'
      AND policyname = 'users can insert own profile'
  ) THEN
    CREATE POLICY "users can insert own profile"
      ON public.user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Migration 012 applied: users can insert own profile row';
END;
$$;
