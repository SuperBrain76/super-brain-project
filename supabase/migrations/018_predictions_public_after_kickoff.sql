-- ============================================================
-- MIGRATION 018 — Predictions Public After Kickoff
--
-- Adds a permissive RLS policy on the predictions table so that
-- any authenticated or anonymous user can read a prediction once
-- the related fixture's kicks_off_at time has passed.
--
-- Before kickoff:  predictions remain private (auth.uid() = user_id)
-- After kickoff:   predictions are publicly readable (for leaderboard
--                  click-through, league standings, user prediction pages)
--
-- This enables:
--   • /predict/user/[userId]      — public user prediction pages
--   • getUserPublicPredictions()  — lib/predictor.ts cross-user reads
--   • League standings row click  — view member predictions post-kickoff
--   • Global leaderboard click    — view player predictions post-kickoff
--
-- Security model:
--   Predictions are only readable after the match has kicked off.
--   There is no way to read a prediction before kickoff except as the
--   submitting user themselves (existing "own" policy). This preserves
--   competitive fairness.
--
-- Depends on: predictor-schema.sql (predictions + fixtures tables)
-- Safe to re-run (DROP IF EXISTS + CREATE).
-- ============================================================

-- Drop the old policy first if it exists (idempotent)
DROP POLICY IF EXISTS "predictions readable after kickoff" ON public.predictions;

-- Allow any role (anon, authenticated) to read a prediction once
-- the fixture it belongs to has kicked off.
CREATE POLICY "predictions readable after kickoff"
  ON public.predictions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.fixtures f
      WHERE f.id = fixture_id
        AND f.kicks_off_at < now()
    )
  );

-- Note: the existing "users read own predictions" policy (auth.uid() = user_id)
-- continues to apply for reading own predictions on any fixture (before and
-- after kickoff). This new policy stacks additively — Postgres RLS uses OR
-- semantics across policies for the same operation.

DO $$
BEGIN
  RAISE NOTICE 'Migration 018 applied:';
  RAISE NOTICE '  - Added RLS policy: predictions readable after kickoff';
  RAISE NOTICE '  - Applies to all roles (anon + authenticated)';
  RAISE NOTICE '  - Condition: fixture.kicks_off_at < now()';
  RAISE NOTICE '  - Existing own-read policy preserved (stacks with OR)';
  RAISE NOTICE '  - Enables /predict/user/[userId] cross-user prediction reads';
END;
$$;
