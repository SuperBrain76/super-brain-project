-- ============================================================
-- MIGRATION 013 — Fix get_predictor_leaderboard + reapply
--                 get_league_members with OWNER TO postgres
--
-- Problems fixed:
--   1. get_predictor_leaderboard filtered WHERE points_awarded
--      IS NOT NULL — returned 0 rows pre-tournament because no
--      predictions have been scored yet. Rewritten to show all
--      users who have submitted at least one prediction, with
--      0 points until match results are entered.
--
--   2. get_league_members reapplied to ensure OWNER is postgres
--      (BYPASSRLS guaranteed) in case prior ALTER FUNCTION
--      statements ran before the function existed.
--
-- Safe to re-run (CREATE OR REPLACE throughout).
-- ============================================================


-- ── 1. get_predictor_leaderboard ─────────────────────────────
-- Shows all users who have submitted at least one prediction.
-- Scoring columns show 0 until match results are entered.
-- Includes match_points and bonus_points expected by the app.

CREATE OR REPLACE FUNCTION public.get_predictor_leaderboard(
  p_competition_id uuid
)
RETURNS TABLE (
  rank         bigint,
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
  RETURN QUERY
  WITH all_predictors AS (
    -- All users who have submitted at least one prediction for
    -- this competition. No points_awarded filter — shows everyone
    -- pre-tournament with 0 points.
    SELECT DISTINCT p.user_id
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
  ),
  match_pts AS (
    SELECT
      ap.user_id,
      coalesce(sum(p.points_awarded), 0)              AS pts,
      count(p.id)                                     AS pred_count,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END) AS exact_count
    FROM all_predictors ap
    JOIN public.predictions p ON p.user_id = ap.user_id
    JOIN public.fixtures f    ON f.id = p.fixture_id
                             AND f.competition_id = p_competition_id
    GROUP BY ap.user_id
  ),
  bonus_pts AS (
    SELECT
      ap.user_id,
      coalesce(sum(bp.points_awarded), 0) AS pts
    FROM all_predictors ap
    LEFT JOIN public.bonus_predictions bp
           ON bp.user_id = ap.user_id
          AND bp.points_awarded IS NOT NULL
    GROUP BY ap.user_id
  )
  SELECT
    row_number() OVER (
      ORDER BY (mp.pts + bp.pts) DESC
    )::bigint                                                      AS rank,
    coalesce(nullif(trim(pr.display_name), ''), 'Player')         AS display_name,
    pr.country,
    (mp.pts + bp.pts)::bigint                                     AS total_points,
    mp.pts::bigint                                                AS match_points,
    bp.pts::bigint                                                AS bonus_points,
    mp.pred_count::bigint                                         AS predictions,
    mp.exact_count::bigint                                        AS exact_scores
  FROM match_pts mp
  JOIN bonus_pts bp              ON bp.user_id = mp.user_id
  LEFT JOIN public.user_profiles pr ON pr.id = mp.user_id
  ORDER BY total_points DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_predictor_leaderboard TO anon, authenticated;
ALTER FUNCTION public.get_predictor_leaderboard(uuid) OWNER TO postgres;


-- ── 2. get_league_members (reapply with OWNER TO postgres) ────

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


DO $$
BEGIN
  RAISE NOTICE 'Migration 013 applied:';
  RAISE NOTICE '  - get_predictor_leaderboard: shows all users with predictions (0 pts pre-tournament)';
  RAISE NOTICE '  - get_predictor_leaderboard: match_points + bonus_points columns added';
  RAISE NOTICE '  - get_league_members: reapplied, OWNER TO postgres confirmed';
END;
$$;
