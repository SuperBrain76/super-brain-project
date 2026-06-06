-- MIGRATION 016 — Idempotent owner UPDATE + DELETE policies on prediction_leagues
--
-- Migration 015 contained the same SQL but was never applied to production.
-- This migration is safe to re-run: both statements use DROP POLICY IF EXISTS.
--
-- Grants:
--   UPDATE  — league owner (auth.uid() = created_by)
--   DELETE  — league owner (auth.uid() = created_by)
--
-- Admins bypass RLS via service-role key at the application layer.

-- ── UPDATE ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "league owner update" ON public.prediction_leagues;
CREATE POLICY "league owner update"
  ON public.prediction_leagues
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- ── DELETE ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "league owner delete" ON public.prediction_leagues;
CREATE POLICY "league owner delete"
  ON public.prediction_leagues
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ── Verify ────────────────────────────────────────────────────
-- After running, confirm with:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'prediction_leagues';
