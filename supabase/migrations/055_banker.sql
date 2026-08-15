-- ============================================================
-- 055 — Banker (double-a-match)
--
-- Each matchweek a player may nominate ONE prediction as their "banker": if
-- it's right, its points count double. Implemented WITHOUT touching the
-- scoring path (auto_score_predictions stays exactly as-is, per the known
-- deadline-trigger drift risk). points_awarded remains the base score; the
-- doubling happens purely in the AGGREGATION functions:
--     sum(points_awarded)  →  sum(points_awarded * (is_banker ? 2 : 1))
--
-- Pre-season every points_awarded is NULL/0, so this is ZERO-DELTA today and
-- only bites once results arrive. The three functions below are recreated
-- verbatim from the live production definitions with that one change, so there
-- is no other behavioural drift.
-- ============================================================

-- 1. The flag. Default false = existing predictions unaffected.
alter table public.predictions
  add column if not exists is_banker boolean not null default false;

create index if not exists idx_predictions_banker
  on public.predictions (user_id) where is_banker;

-- 2. Set (or clear) the caller's banker for a fixture's matchweek. One banker
--    per user per round: setting one clears any other in the same round, in a
--    single statement. Only affects rows the caller has actually predicted.
create or replace function public.set_banker(p_fixture_id uuid, p_is_banker boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_round uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select round_id into v_round from public.fixtures where id = p_fixture_id;
  if v_round is null then
    raise exception 'Fixture not found.';
  end if;

  update public.predictions p
  set is_banker = (p.fixture_id = p_fixture_id and p_is_banker)
  from public.fixtures f
  where p.fixture_id = f.id
    and p.user_id = auth.uid()
    and f.round_id = v_round;
end;
$function$;

grant execute on function public.set_banker(uuid, boolean) to authenticated;

-- 3. Recreate the three aggregation functions with banker doubling.

CREATE OR REPLACE FUNCTION public.get_predictor_leaderboard(p_competition_id uuid)
 RETURNS TABLE(rank bigint, display_name text, country text, total_points bigint, match_points bigint, bonus_points bigint, predictions bigint, exact_scores bigint, correct_gd bigint, correct_results bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      coalesce(sum(p.points_awarded * (CASE WHEN p.is_banker THEN 2 ELSE 1 END)), 0) AS pts,
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
      coalesce((
        SELECT sum(bp.points_awarded)
        FROM public.bonus_predictions bp
        JOIN public.bonus_questions bq ON bq.id = bp.question_id
        WHERE bp.user_id = ap.user_id
          AND bp.points_awarded IS NOT NULL
          AND bq.competition_id = p_competition_id
      ), 0) AS pts
    FROM all_predictors ap
  )
  SELECT
    row_number() OVER (
      ORDER BY
        (mp.pts + bp.pts)  DESC,
        mp.exact_count     DESC,
        mp.gd_count        DESC,
        mp.result_count    DESC,
        bp.pts             DESC,
        mp.pred_count      DESC
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
$function$;

CREATE OR REPLACE FUNCTION public.get_league_leaderboard(p_league_id uuid)
 RETURNS TABLE(rank bigint, user_id uuid, display_name text, country text, total_points bigint, match_points bigint, bonus_points bigint, predictions bigint, exact_scores bigint, correct_gd bigint, correct_results bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      coalesce(sum(p.points_awarded * (CASE WHEN p.is_banker THEN 2 ELSE 1 END)), 0) AS match_pts,
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
      coalesce((
        SELECT sum(bp.points_awarded)
        FROM public.bonus_predictions bp
        JOIN public.bonus_questions bq ON bq.id = bp.question_id
        WHERE bp.user_id = lm.user_id
          AND bp.points_awarded IS NOT NULL
          AND bq.competition_id = (SELECT competition_id FROM comp)
      ), 0) AS bonus_pts
    FROM public.prediction_league_members lm
    WHERE lm.league_id = p_league_id
  )
  SELECT
    row_number() OVER (
      ORDER BY
        (mm.match_pts + mb.bonus_pts)  DESC,
        mm.exact_count                 DESC,
        mm.gd_count                    DESC,
        mm.result_count                DESC,
        mb.bonus_pts                   DESC,
        mm.pred_count                  DESC
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
$function$;

CREATE OR REPLACE FUNCTION public.get_my_predictor_stats(p_competition_id uuid)
 RETURNS TABLE(total_points bigint, match_points bigint, bonus_points bigint, predictions bigint, exact_scores bigint, global_rank bigint, bonus_answered bigint, bonus_total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH all_totals AS (
    SELECT
      p.user_id,
      coalesce(sum(p.points_awarded * (CASE WHEN p.is_banker THEN 2 ELSE 1 END)), 0)
      + coalesce((
          SELECT sum(bp2.points_awarded)
          FROM public.bonus_predictions bp2
          JOIN public.bonus_questions bq2 ON bq2.id = bp2.question_id
          WHERE bq2.competition_id = p_competition_id
            AND bp2.user_id = p.user_id
            AND bp2.points_awarded IS NOT NULL
        ), 0) AS total
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
      AND p.points_awarded IS NOT NULL
    GROUP BY p.user_id
  ),
  my_match AS (
    SELECT
      coalesce(sum(p.points_awarded * (CASE WHEN p.is_banker THEN 2 ELSE 1 END)), 0) AS pts,
      count(p.id)                                       AS preds,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)  AS exacts
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
      AND p.user_id = auth.uid()
  ),
  my_bonus AS (
    SELECT
      coalesce(sum(bp.points_awarded), 0) AS pts,
      count(bp.id)                         AS answered
    FROM public.bonus_predictions bp
    JOIN public.bonus_questions bq ON bq.id = bp.question_id
    WHERE bq.competition_id = p_competition_id
      AND bp.user_id = auth.uid()
  ),
  bonus_count AS (
    SELECT count(*) AS total
    FROM public.bonus_questions
    WHERE competition_id = p_competition_id
  )
  SELECT
    mm.pts + mb.pts                                                     AS total_points,
    mm.pts                                                              AS match_points,
    mb.pts                                                              AS bonus_points,
    mm.preds                                                            AS predictions,
    mm.exacts                                                           AS exact_scores,
    (SELECT count(*)+1 FROM all_totals WHERE total > mm.pts + mb.pts)   AS global_rank,
    mb.answered                                                         AS bonus_answered,
    bc.total                                                            AS bonus_total
  FROM my_match mm, my_bonus mb, bonus_count bc;
$function$;
