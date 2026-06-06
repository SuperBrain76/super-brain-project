-- ============================================================
-- MIGRATION 011 — Fix display names, RLS, and league RPCs
--
-- Consolidates and supersedes fixes from migrations 008-010.
-- Safe to re-run (CREATE OR REPLACE + DO idempotent guards).
--
-- Problems fixed:
--   1. user_profiles RLS only allowed reading own row — SECURITY
--      DEFINER functions could not read other users' names if the
--      function owner lacked BYPASSRLS.
--   2. get_league_leaderboard used INNER JOIN user_profiles and
--      filtered to scored predictions only — members with 0
--      points were excluded and got no display name.
--   3. get_league_members RPC did not exist in some environments.
--   4. visibility/is_featured columns may be missing if
--      migration 007 was not applied.
-- ============================================================


-- ── 1. Add public read policy on user_profiles ────────────────
-- The schema comment already states:
--   "Only display_name and country are exposed publicly."
-- This adds the missing policy so any authenticated user can
-- read any profile row. Existing "own row" update policy is
-- unchanged — users can still only update their own profile.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_profiles'
      AND policyname = 'authenticated can read any profile'
  ) THEN
    CREATE POLICY "authenticated can read any profile"
      ON public.user_profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;


-- ── 2. visibility + is_featured + sponsor + suspended columns ─
-- Idempotent — safe if migration 007 already ran.

ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS visibility   text    NOT NULL DEFAULT 'private';
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS is_featured  boolean NOT NULL DEFAULT false;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_name        text NULL;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_url         text NULL;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_description text NULL;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS sponsor_logo_url    text NULL;
ALTER TABLE public.prediction_leagues
  ADD COLUMN IF NOT EXISTS suspended    boolean NOT NULL DEFAULT false;

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

CREATE INDEX IF NOT EXISTS prediction_leagues_discover_idx
  ON public.prediction_leagues (competition_id, visibility, is_featured);


-- ── 3. RLS — public/featured league visibility ────────────────

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'prediction_league_members'
      AND policyname = 'league_members_insert_public'
  ) THEN
    CREATE POLICY league_members_insert_public
      ON public.prediction_league_members
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


-- ── 4. get_league_members RPC ─────────────────────────────────
-- Returns all league members with display_name and country.
-- LEFT JOIN user_profiles so members without a profile still appear.
-- SECURITY DEFINER + OWNER TO postgres guarantees RLS bypass.

CREATE OR REPLACE FUNCTION public.get_league_members(p_league_id uuid)
RETURNS TABLE (
  user_id      uuid,
  display_name text,
  country      text,
  joined_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.prediction_league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you must be a member of this league.';
  END IF;

  RETURN QUERY
  SELECT
    lm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Player') AS display_name,
    pr.country,
    lm.joined_at
  FROM public.prediction_league_members lm
  LEFT JOIN public.user_profiles pr ON pr.id = lm.user_id
  WHERE lm.league_id = p_league_id
  ORDER BY lm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_members TO authenticated;
ALTER FUNCTION public.get_league_members(uuid) OWNER TO postgres;


-- ── 5. get_league_leaderboard RPC ────────────────────────────
-- Returns ALL league members (LEFT JOIN predictions — 0-point
-- members appear). LEFT JOIN user_profiles — members without a
-- profile row still appear. Includes match_points and bonus_points.

CREATE OR REPLACE FUNCTION public.get_league_leaderboard(p_league_id uuid)
RETURNS TABLE (
  rank         bigint,
  user_id      uuid,
  display_name text,
  country      text,
  total_points bigint,
  match_points bigint,
  bonus_points bigint,
  predictions  bigint,
  exact_scores bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.prediction_league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you must be a member of this league.';
  END IF;

  RETURN QUERY
  WITH comp AS (
    SELECT competition_id FROM public.prediction_leagues WHERE id = p_league_id
  ),
  member_match AS (
    SELECT
      lm.user_id,
      coalesce(sum(p.points_awarded), 0)              AS match_pts,
      count(p.id)                                     AS pred_count,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END) AS exact_count
    FROM public.prediction_league_members lm
    LEFT JOIN public.predictions p
           ON p.user_id = lm.user_id
    LEFT JOIN public.fixtures f
           ON f.id = p.fixture_id
          AND f.competition_id = (SELECT competition_id FROM comp)
          AND p.points_awarded IS NOT NULL
    WHERE lm.league_id = p_league_id
    GROUP BY lm.user_id
  ),
  member_bonus AS (
    SELECT
      lm.user_id,
      coalesce(sum(bp.points_awarded), 0) AS bonus_pts
    FROM public.prediction_league_members lm
    LEFT JOIN public.bonus_predictions bp
           ON bp.user_id = lm.user_id
          AND bp.points_awarded IS NOT NULL
    WHERE lm.league_id = p_league_id
    GROUP BY lm.user_id
  )
  SELECT
    row_number() OVER (
      ORDER BY (mm.match_pts + mb.bonus_pts) DESC
    )::bigint                                                       AS rank,
    mm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Player')          AS display_name,
    pr.country,
    (mm.match_pts + mb.bonus_pts)::bigint                          AS total_points,
    mm.match_pts::bigint                                           AS match_points,
    mb.bonus_pts::bigint                                           AS bonus_points,
    mm.pred_count::bigint                                          AS predictions,
    mm.exact_count::bigint                                         AS exact_scores
  FROM member_match mm
  JOIN member_bonus mb              ON mb.user_id = mm.user_id
  LEFT JOIN public.user_profiles pr ON pr.id = mm.user_id
  ORDER BY total_points DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_leaderboard TO authenticated;
ALTER FUNCTION public.get_league_leaderboard(uuid) OWNER TO postgres;


-- ── Summary ───────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Migration 011 applied:';
  RAISE NOTICE '  - user_profiles: authenticated can read any profile (display_name, country)';
  RAISE NOTICE '  - prediction_leagues: visibility, is_featured, sponsor, suspended columns';
  RAISE NOTICE '  - leagues_select_public + league_members_insert_public RLS policies';
  RAISE NOTICE '  - get_league_members: clean RPC, LEFT JOIN, OWNER postgres';
  RAISE NOTICE '  - get_league_leaderboard: LEFT JOIN all members, match+bonus pts, OWNER postgres';
END;
$$;
