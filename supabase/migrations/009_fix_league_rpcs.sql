-- ============================================================
-- MIGRATION 009 — Fix league RPCs
--
-- Migration 008 introduced complex subqueries in
-- get_league_leaderboard() that break on any DB where
-- bonus_predictions data is absent or the query plan differs.
-- This migration replaces both RPCs with clean, tested versions.
--
-- Safe to re-run (CREATE OR REPLACE throughout).
-- ============================================================


-- ── 1. get_league_leaderboard (clean rewrite) ─────────────────
-- Key fixes vs 008:
--   - Removed nested correlated subqueries for bonus_points
--   - LEFT JOIN bonus_predictions instead (single pass)
--   - LEFT JOIN user_profiles (not INNER JOIN — members without
--     a profile row still appear)
--   - match_points and bonus_points returned separately

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
  WITH member_match AS (
    -- Match points: sum of scored fixture predictions for each member
    SELECT
      lm.user_id,
      coalesce(sum(p.points_awarded), 0)                     AS match_pts,
      count(p.id)                                            AS pred_count,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)       AS exact_count
    FROM public.prediction_league_members lm
    LEFT JOIN public.predictions p
           ON p.user_id = lm.user_id
    LEFT JOIN public.fixtures f
           ON f.id = p.fixture_id
          AND f.competition_id = (
                SELECT competition_id FROM public.prediction_leagues
                WHERE id = p_league_id
              )
          AND p.points_awarded IS NOT NULL
    WHERE lm.league_id = p_league_id
    GROUP BY lm.user_id
  ),
  member_bonus AS (
    -- Bonus points: sum of scored bonus predictions for each member
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
    )::bigint                                                         AS rank,
    mm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous')         AS display_name,
    pr.country,
    (mm.match_pts + mb.bonus_pts)::bigint                            AS total_points,
    mm.match_pts::bigint                                             AS match_points,
    mb.bonus_pts::bigint                                             AS bonus_points,
    mm.pred_count::bigint                                            AS predictions,
    mm.exact_count::bigint                                           AS exact_scores
  FROM member_match mm
  JOIN member_bonus mb         ON mb.user_id = mm.user_id
  LEFT JOIN public.user_profiles pr ON pr.id = mm.user_id
  ORDER BY total_points DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_leaderboard TO authenticated;


-- ── 2. get_league_members (clean version) ─────────────────────
-- Returns all members with display name, country, joined_at.
-- SECURITY DEFINER bypasses user_profiles RLS.

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
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous') AS display_name,
    pr.country,
    lm.joined_at
  FROM public.prediction_league_members lm
  LEFT JOIN public.user_profiles pr ON pr.id = lm.user_id
  WHERE lm.league_id = p_league_id
  ORDER BY lm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_members TO authenticated;


DO $$
BEGIN
  RAISE NOTICE 'Migration 009 applied: get_league_leaderboard and get_league_members fixed.';
END;
$$;
