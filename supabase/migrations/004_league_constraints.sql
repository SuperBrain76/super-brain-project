-- ============================================================
-- MIGRATION 004 — League constraints, max_members, audit log
--
-- Depends on: predictor-schema.sql, 003_league_name_moderation.sql
-- Safe to re-run (idempotent guards throughout).
-- ============================================================


-- ── 1. Unique league names within a competition ───────────────
-- Prevents duplicate leagues with identical normalized names in
-- the same competition. "The Vikings", "the vikings", "THE VIKINGS",
-- and "The   Vikings" all normalize to "the vikings" and are treated
-- as the same name.
--
-- ⚠ If running on a DB that already has duplicate normalized_name
--   values within the same competition, resolve them first.
--   On a fresh install this is always safe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leagues_unique_normalized_name_per_competition'
  ) THEN
    ALTER TABLE public.prediction_leagues
      ADD CONSTRAINT leagues_unique_normalized_name_per_competition
        UNIQUE (competition_id, normalized_name);
  END IF;
END;
$$;


-- ── 2. Max members field ─────────────────────────────────────
-- Nullable — NULL means unlimited (default, enforced by application).
-- Set to a positive integer to hard-cap a league's membership.
-- NOT enforced by DB trigger yet; application layer checks this
-- field when max_members IS NOT NULL.

ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS max_members integer NULL;

COMMENT ON COLUMN public.prediction_leagues.max_members IS
  'NULL = unlimited. Positive integer = hard cap. Application checks this before joinLeague().';


-- ── 3. League audit log ───────────────────────────────────────
-- Records key events on prediction_leagues for traceability.
-- Currently captures: created.
-- league_id has no FK so audit records survive league deletion.

CREATE TABLE IF NOT EXISTS public.league_audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text        NOT NULL,       -- 'created' | future: 'deleted', 'renamed'
  league_id       uuid        NOT NULL,       -- no FK — preserved after deletion
  competition_id  uuid        NOT NULL,
  created_by      uuid        NOT NULL,       -- auth.users.id of the actor
  normalized_name text        NOT NULL,       -- snapshot of name at time of event
  event_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_audit_log_league_idx
  ON public.league_audit_log (league_id);
CREATE INDEX IF NOT EXISTS league_audit_log_created_by_idx
  ON public.league_audit_log (created_by);
CREATE INDEX IF NOT EXISTS league_audit_log_event_at_idx
  ON public.league_audit_log (event_at DESC);

-- RLS: enable but add no policies — readable only via service role
-- or SECURITY DEFINER functions. Regular clients cannot read or write.
ALTER TABLE public.league_audit_log ENABLE ROW LEVEL SECURITY;


-- ── 4. Audit trigger ─────────────────────────────────────────
-- Fires AFTER INSERT on prediction_leagues and writes one row
-- to league_audit_log capturing the three required fields:
-- created_by, created_at (= event_at), normalized_name.

CREATE OR REPLACE FUNCTION public.audit_league_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.league_audit_log
    (event_type, league_id, competition_id, created_by, normalized_name)
  VALUES
    ('created', NEW.id, NEW.competition_id, NEW.created_by, NEW.normalized_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_league_created ON public.prediction_leagues;
CREATE TRIGGER on_league_created
  AFTER INSERT ON public.prediction_leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_league_creation();


DO $$
BEGIN
  RAISE NOTICE 'Migration 004 applied:';
  RAISE NOTICE '  - UNIQUE (competition_id, normalized_name) on prediction_leagues';
  RAISE NOTICE '  - max_members nullable column on prediction_leagues';
  RAISE NOTICE '  - league_audit_log table created';
  RAISE NOTICE '  - on_league_created trigger installed';
END;
$$;
