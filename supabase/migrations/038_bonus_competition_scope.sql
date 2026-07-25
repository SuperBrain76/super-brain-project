-- ============================================================
-- MIGRATION 038 — Scope bonus points to the competition  🔴 CORRECTNESS
--
-- Competition Engine V2, Phase 2.1 — ELEVATED to run immediately after
-- the 037 gate because it is the only correctness DEFECT in the plan and
-- it is cheap. Everything else in Phase 1 is structural.
--
-- ────────────────────────────────────────────────────────────
-- THE DEFECT
-- ────────────────────────────────────────────────────────────
-- Migration 019 defines both leaderboard RPCs with a bonus-points CTE
-- shaped like this:
--
--     bonus_pts AS (
--       SELECT ap.user_id, coalesce(sum(bp.points_awarded), 0) AS pts
--       FROM all_predictors ap
--       LEFT JOIN public.bonus_predictions bp
--              ON bp.user_id = ap.user_id
--             AND bp.points_awarded IS NOT NULL
--       GROUP BY ap.user_id
--     )
--
-- `bonus_predictions` carries no competition_id. It reaches the
-- competition through bonus_questions.competition_id — AND THAT JOIN IS
-- MISSING. The CTE therefore sums EVERY bonus point the user has ever
-- scored, in ANY competition, and adds it to their total for THIS one.
--
--   • Today (one competition): harmless. The unfiltered sum is equal to
--     the filtered sum by definition. That is why this has never shown up.
--   • The moment a second competition has scored bonus questions: every
--     global and league leaderboard is WRONG. A user who did well in the
--     World Cup starts the Premier League with an unearned head start.
--     This determines prize winners.
--
-- Note that get_my_predictor_stats (migration 006) DOES filter correctly.
-- So the two disagree — the user's own stat card would show a different
-- total than their own leaderboard row. That divergence is the symptom.
--
-- ────────────────────────────────────────────────────────────
-- THE FIX
-- ────────────────────────────────────────────────────────────
-- Add the bonus_questions join and the competition predicate. NOTHING
-- ELSE CHANGES: same signature, same returned columns in the same order,
-- same six-column tie-break, same limit, same security. Diff this file
-- against 019 — the only differences are the two CTEs.
--
-- ────────────────────────────────────────────────────────────
-- WORLD CUP COMPATIBILITY — PROVED, NOT ASSUMED
-- ────────────────────────────────────────────────────────────
-- With exactly one competition holding bonus questions, filtered and
-- unfiltered sums are identical, so every WC rank must be unchanged.
-- That is an argument, not evidence. Run the verification in
-- scripts/verify-038-bonus-scope.sql BEFORE and AFTER applying this
-- migration and diff the two outputs. Expected: zero rows differ.
--
-- DEPENDS ON: 019, 006, 037
-- SAFE TO RE-RUN: yes (create or replace).
-- ROLLBACK: re-apply migration 019 verbatim. Both functions are
--           self-contained; no stored data is touched by either version.
-- ============================================================

-- Production drifted: its existing leaderboard functions have a different
-- (older) return shape than this version, and CREATE OR REPLACE cannot
-- change a return type. Drop first, then recreate. The live production
-- definitions are captured in supabase/prod-rollback/ for rollback.
drop function if exists public.get_predictor_leaderboard(uuid);
drop function if exists public.get_league_leaderboard(uuid);


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
    -- ▼▼ THE FIX ▼▼
    -- Reach competition_id through bonus_questions and constrain to THIS
    -- competition.
    --
    -- Deliberately a CORRELATED SUBQUERY rather than an extra LEFT JOIN.
    -- With a join + competition predicate, a user whose only bonus answers
    -- belong to a DIFFERENT competition produces zero surviving rows, drops
    -- out of this CTE, and is then eliminated by the `JOIN bonus_pts` below —
    -- silently vanishing from the leaderboard despite having match points.
    -- The subquery form emits exactly one row per predictor, always, so the
    -- cardinality is provably identical to migration 019's.
    --
    -- This is also the exact shape get_my_predictor_stats (migration 006)
    -- already uses correctly, so the two now agree by construction.
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
    -- ▲▲ THE FIX ▲▲
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
-- Same defect, same fix. A private league belongs to one competition
-- (prediction_leagues.competition_id), so the league's own competition is
-- the correct scope — resolved once in the `comp` CTE, which migration
-- 019 already declares and already uses for match points.

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
    -- ▼▼ THE FIX ▼▼ scope bonus points to the league's own competition.
    -- Correlated subquery for the same cardinality reason as above: every
    -- league member must yield exactly one row, including members who have
    -- answered nothing and members whose only answers are in another
    -- competition. Losing a member from a private league leaderboard would
    -- be a visible, reportable bug.
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
    -- ▲▲ THE FIX ▲▲
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


insert into public.schema_migrations (version, name, notes)
values ('038', 'bonus_competition_scope',
        'Scopes bonus_predictions to the competition in both leaderboard RPCs. '
        'Zero-delta expected while only one competition has bonus questions. '
        'Verify with scripts/verify-038-bonus-scope.sql before AND after.')
on conflict (version) do nothing;

DO $$
BEGIN
  RAISE NOTICE 'Migration 038 applied — bonus points are now competition-scoped.';
  RAISE NOTICE 'Run scripts/verify-038-bonus-scope.sql and diff against the pre-migration output.';
  RAISE NOTICE 'Expected: ZERO rows changed.';
END;
$$;
