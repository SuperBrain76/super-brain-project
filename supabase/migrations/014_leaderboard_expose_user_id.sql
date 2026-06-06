-- MIGRATION 014 — Expose user_id in get_predictor_leaderboard
--
-- The client needs user_id to reliably detect the current user's row
-- and show the "YOU" badge. Previously the RPC omitted user_id, forcing
-- a fragile name+points+rank comparison that breaks on ties.

CREATE OR REPLACE FUNCTION public.get_predictor_leaderboard(
  p_competition_id uuid
)
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
      coalesce(sum(p.points_awarded), 0)               AS pts,
      count(p.id)                                      AS pred_count,
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
    mp.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Player')         AS display_name,
    pr.country,
    (mp.pts + bp.pts)::bigint                                     AS total_points,
    mp.pts::bigint                                                 AS match_points,
    bp.pts::bigint                                                 AS bonus_points,
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
