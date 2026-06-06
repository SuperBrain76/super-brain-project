-- MIGRATION 015 — Owner controls for prediction_leagues
--
-- Adds RLS policies so league owners can:
--   • UPDATE their own league  (rename, toggle visibility)
--   • DELETE their own league  (cascades to members via FK)
--
-- Only the row creator (created_by = auth.uid()) is permitted.
-- Admins retain access via the service-role key which bypasses RLS.

-- ── UPDATE policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS "league owner update" ON public.prediction_leagues;
CREATE POLICY "league owner update"
  ON public.prediction_leagues
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- ── DELETE policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS "league owner delete" ON public.prediction_leagues;
CREATE POLICY "league owner delete"
  ON public.prediction_leagues
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
