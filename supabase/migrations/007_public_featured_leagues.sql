-- ============================================================
-- MIGRATION 007 — Public & Featured leagues
--
-- Depends on: predictor-schema.sql, 004_league_constraints.sql
-- Safe to re-run (idempotent guards throughout).
--
-- Changes:
--   1. visibility column  ('private' | 'public') — default 'private'
--   2. is_featured column (boolean)               — admin-set, default false
--   3. Sponsor fields     (all nullable)
--   4. RLS: authenticated users can read public/featured leagues
--   5. RLS: authenticated users can insert a league membership without
--      an invite code when the league is public or featured
--   6. Index on (competition_id, visibility) for discover queries
-- ============================================================


-- ── 1. visibility ─────────────────────────────────────────────
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'prediction_leagues_visibility_check'
  ) THEN
    ALTER TABLE public.prediction_leagues
      ADD CONSTRAINT prediction_leagues_visibility_check
        CHECK (visibility IN ('private', 'public'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.prediction_leagues.visibility IS
  '''private'' = invite-only (default). ''public'' = discoverable and joinable without invite code.';


-- ── 2. is_featured ────────────────────────────────────────────
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prediction_leagues.is_featured IS
  'Admin-set. Featured leagues appear above regular public leagues on the Discover page.';


-- ── 3. Sponsor fields ─────────────────────────────────────────
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_name        text NULL;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_url         text NULL;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_description text NULL;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_logo_url    text NULL;

COMMENT ON COLUMN public.prediction_leagues.sponsor_name        IS 'Display name of the sponsoring business (Featured leagues only).';
COMMENT ON COLUMN public.prediction_leagues.sponsor_url         IS 'External website URL for the sponsor (Featured leagues only).';
COMMENT ON COLUMN public.prediction_leagues.sponsor_description IS 'Short sponsor description shown on the league card (max ~160 chars recommended).';
COMMENT ON COLUMN public.prediction_leagues.sponsor_logo_url    IS 'CDN URL for sponsor logo image (Featured leagues only).';


-- ── 4. Index for discover queries ────────────────────────────
CREATE INDEX IF NOT EXISTS prediction_leagues_discover_idx
  ON public.prediction_leagues (competition_id, visibility, is_featured);


-- ── 5. RLS — read public/featured leagues ────────────────────
-- Any authenticated user can SELECT leagues that are public or featured.
-- Private leagues remain invisible unless the user is a member (existing policy).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'prediction_leagues'
      AND policyname = 'leagues_select_public'
  ) THEN
    CREATE POLICY leagues_select_public
      ON public.prediction_leagues
      FOR SELECT
      TO authenticated
      USING (visibility = 'public' OR is_featured = true);
  END IF;
END;
$$;


-- ── 6. RLS — join public/featured leagues without invite code ─
-- Authenticated users may insert their own membership row for a
-- public or featured league. The application layer already handles
-- the invite-code path for private leagues via a separate RPC.
-- This policy covers the open-join path only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'league_members'
      AND policyname = 'league_members_insert_public'
  ) THEN
    CREATE POLICY league_members_insert_public
      ON public.league_members
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.prediction_leagues pl
          WHERE pl.id = league_id
            AND (pl.visibility = 'public' OR pl.is_featured = true)
        )
      );
  END IF;
END;
$$;


-- ── Summary ───────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Migration 007 applied:';
  RAISE NOTICE '  - visibility column (private|public) on prediction_leagues';
  RAISE NOTICE '  - is_featured boolean column on prediction_leagues';
  RAISE NOTICE '  - sponsor_name, sponsor_url, sponsor_description, sponsor_logo_url columns';
  RAISE NOTICE '  - prediction_leagues_discover_idx index';
  RAISE NOTICE '  - leagues_select_public RLS policy';
  RAISE NOTICE '  - league_members_insert_public RLS policy';
END;
$$;
