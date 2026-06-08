-- ============================================================
-- MIGRATION 019 — Meaningful tie-break ordering for leaderboards
--
-- Problem:
--   Both get_predictor_leaderboard and get_league_leaderboard
--   break ties by nothing meaningful (effectively random row
--   order within equal total_points). Sign-up date was
--   originally implied but is unfair and was removed from rules.
--
-- Solution:
--   Multi-column ORDER BY based on skill metrics:
--     1. total_points DESC           (primary — match + bonus)
--     2. exact_scores DESC           (5-pt exact score predictions)
--     3. correct_gd DESC             (3-pt correct goal difference)
--     4. correct_results DESC        (2-pt correct result)
--     5. bonus_points DESC           (bonus question pts)
--     6. predictions DESC            (most predictions submitted)
--
--   If all six columns are equal: prize is shared (row_number
--   gives sequential ranks — front-end shows "T-3" style if
--   needed but that is a UI concern, not a DB concern).
--
-- New columns returned (appended — no existing column removed):
--   correct_gd      bigint   count of 3-pt predictions
--   correct_results bigint   count of 2-pt predictions
--
-- Safe to re-run (CREATE OR REPLACE throughout).
-- ============================================================


-- ── 1. get_predictor_leaderboard ─────────────────────────────

CREATE OR REPLACE FUNCTION public.get_predictor_leaderboard(
  p_competition_id uuid
)
RETURNS TABLE (
  rank            bigint,
  display_name    text,
  country         text,
  total_points    bigint,
  match_points    bigint,
  bonus_points    bigint,
  predictions     bigint,
  exact_scores    bigint,
  correct_gd      bigint,
  correct_results bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH all_predictors AS (
    SELECT DISTINCT p.user_id
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
  ),
  match_pts AS (
    SELECT
      ap.user_id,
      coalesce(sum(p.points_awarded), 0)                        AS pts,
      count(p.id)                                               AS pred_count,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)          AS exact_count,
      count(CASE WHEN p.points_awarded = 3 THEN 1 END)          AS gd_count,
      count(CASE WHEN p.points_awarded = 2 THEN 1 END)          AS result_count
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
      ORDER BY
        (mp.pts + bp.pts)  DESC,   -- 1. total points
        mp.exact_count     DESC,   -- 2. exact scores (5 pts)
        mp.gd_count        DESC,   -- 3. correct goal diff (3 pts)
        mp.result_count    DESC,   -- 4. correct result (2 pts)
        bp.pts             DESC,   -- 5. bonus question points
        mp.pred_count      DESC    -- 6. most predictions submitted
    )::bigint                                                         AS rank,
    coalesce(nullif(trim(pr.display_name), ''), 'Player')            AS display_name,
    pr.country,
    (mp.pts + bp.pts)::bigint                                        AS total_points,
    mp.pts::bigint                                                    AS match_points,
    bp.pts::bigint                                                    AS bonus_points,
    mp.pred_count::bigint                                             AS predictions,
    mp.exact_count::bigint                                            AS exact_scores,
    mp.gd_count::bigint                                               AS correct_gd,
    mp.result_count::bigint                                           AS correct_results
  FROM match_pts mp
  JOIN bonus_pts bp              ON bp.user_id = mp.user_id
  LEFT JOIN public.user_profiles pr ON pr.id = mp.user_id
  ORDER BY
    total_points    DESC,
    exact_scores    DESC,
    correct_gd      DESC,
    correct_results DESC,
    bonus_points    DESC,
    predictions     DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_predictor_leaderboard TO anon, authenticated;
ALTER FUNCTION public.get_predictor_leaderboard(uuid) OWNER TO postgres;


-- ── 2. get_league_leaderboard ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_league_leaderboard(p_league_id uuid)
RETURNS TABLE (
  rank            bigint,
  user_id         uuid,
  display_name    text,
  country         text,
  total_points    bigint,
  match_points    bigint,
  bonus_points    bigint,
  predictions     bigint,
  exact_scores    bigint,
  correct_gd      bigint,
  correct_results bigint
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
      coalesce(sum(p.points_awarded), 0)                        AS match_pts,
      count(p.id)                                               AS pred_count,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)          AS exact_count,
      count(CASE WHEN p.points_awarded = 3 THEN 1 END)          AS gd_count,
      count(CASE WHEN p.points_awarded = 2 THEN 1 END)          AS result_count
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
      ORDER BY
        (mm.match_pts + mb.bonus_pts)  DESC,   -- 1. total points
        mm.exact_count                 DESC,   -- 2. exact scores
        mm.gd_count                    DESC,   -- 3. correct GD
        mm.result_count                DESC,   -- 4. correct result
        mb.bonus_pts                   DESC,   -- 5. bonus pts
        mm.pred_count                  DESC    -- 6. predictions submitted
    )::bigint                                                          AS rank,
    mm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Player')             AS display_name,
    pr.country,
    (mm.match_pts + mb.bonus_pts)::bigint                             AS total_points,
    mm.match_pts::bigint                                              AS match_points,
    mb.bonus_pts::bigint                                              AS bonus_points,
    mm.pred_count::bigint                                             AS predictions,
    mm.exact_count::bigint                                            AS exact_scores,
    mm.gd_count::bigint                                               AS correct_gd,
    mm.result_count::bigint                                           AS correct_results
  FROM member_match mm
  JOIN member_bonus mb              ON mb.user_id = mm.user_id
  LEFT JOIN public.user_profiles pr ON pr.id = mm.user_id
  ORDER BY
    total_points    DESC,
    exact_scores    DESC,
    correct_gd      DESC,
    correct_results DESC,
    bonus_points    DESC,
    predictions     DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_leaderboard TO authenticated;
ALTER FUNCTION public.get_league_leaderboard(uuid) OWNER TO postgres;


DO $$
BEGIN
  RAISE NOTICE 'Migration 019 applied:';
  RAISE NOTICE '  - get_predictor_leaderboard: tie-break ORDER BY exact_scores → correct_gd → correct_results → bonus_pts → predictions';
  RAISE NOTICE '  - get_league_leaderboard:    same tie-break ordering applied';
  RAISE NOTICE '  - Both RPCs now return correct_gd and correct_results columns';
END;
$$;
