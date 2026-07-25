-- ============================================================================
-- ⚠️  PROPOSED — NOT APPROVED — DO NOT RUN
-- ----------------------------------------------------------------------------
-- Emergency correction for get_predictor_leaderboard, prepared for review under
-- PRODUCTION_FREEZE.md §3. Apply ONLY with Dylan's explicit written approval,
-- and ONLY if scripts/verify-leaderboard-rpc.sql BLOCK 5 shows the tie-break
-- rules would reorder users at a prize-relevant total.
--
-- If BLOCK 5 returns no rows at the top total_points: DO NOT RUN THIS.
-- The ordering is already unambiguous and this change would be gratuitous risk
-- during a freeze.
-- ============================================================================
--
-- WHY NOT JUST APPLY MIGRATION 019 AS WRITTEN?
--
--   Two reasons. Both are defects in 019 itself.
--
--   1. IT WOULD FAIL. Migration 019 uses a bare CREATE OR REPLACE FUNCTION with
--      no DROP. Its return type differs from both the base definition and 014.
--      PostgreSQL rejects this:
--          ERROR: cannot change return type of existing function
--          HINT:  Use DROP FUNCTION get_predictor_leaderboard(uuid) first.
--      This is very likely why production is not on 019 — the paste errored and
--      the failure went unnoticed. The same is true of 013 and 014.
--
--   2. IT REGRESSES 014. Migration 019 silently DROPS the `user_id` column that
--      migration 014 added specifically so the client could identify the current
--      user's row. The client still reads it:
--          lib/predictor.ts:989          userId: r.user_id as string
--          app/predict/leaderboard/page.tsx:243   const isMe = !!(user && row.userId === user.id)
--          app/predict/leaderboard/page.tsx:249   href={`/predict/user/${row.userId}`}
--      Applying 019 verbatim makes every leaderboard row link to
--      `/predict/user/undefined` and breaks the "YOU" badge.
--
--   This script = migration 019's tie-break ordering + migration 014's user_id.
--   It is a superset of both. No column any client reads is removed.
--
-- ============================================================================
--
-- ROLLBACK
--
--   Your rollback script is BLOCK 2 of scripts/verify-leaderboard-rpc.sql.
--   Run it FIRST and save the output — that is the verbatim current production
--   definition. To roll back:
--       DROP FUNCTION IF EXISTS public.get_predictor_leaderboard(uuid);
--       <paste the saved BLOCK 2 output>
--       GRANT EXECUTE ON FUNCTION public.get_predictor_leaderboard TO anon, authenticated;
--
--   DO NOT PROCEED WITHOUT THAT SAVED OUTPUT. There is no other way back —
--   a DROP is not reversible from the repository, because the repository does
--   not know what is in production.
--
-- ============================================================================
--
-- RISK ASSESSMENT
--
--   Blast radius:  READ PATH ONLY. This function computes a leaderboard from
--                  existing rows. It writes nothing. It cannot alter
--                  points_awarded, predictions, fixtures, or the IQ ledger.
--                  Reverting restores the previous ordering exactly.
--
--   Data risk:     NONE. No stored data is touched.
--
--   Availability:  There is a sub-second window between DROP and CREATE during
--                  which a concurrent call to /predict/leaderboard errors. Run
--                  both statements as ONE transaction (BEGIN/COMMIT below) so
--                  the window is atomic and no user sees a partial state.
--
--   Behaviour:     Ranks WILL change for users currently tied on total_points.
--                  That is the intent. If the champion changes, that is the
--                  finding, not a side effect — and it must be understood and
--                  agreed BEFORE any announcement.
--
--   Downstream:    get_my_predictor_stats (predictor-schema.sql:495) computes
--                  global_rank INDEPENDENTLY, by counting users with more
--                  points. It has no tie-breaks and is NOT changed here, so a
--                  user's "your position" may differ by a place or two from the
--                  board when ties exist. Pre-existing; out of scope; do not
--                  fix under freeze.
--
--   Timing:        Do NOT run during the final or while scoring is in flight.
--                  Run either before kickoff or after fixture 104 is fully
--                  scored and verified (closure checklist items 5–7).
--
-- ============================================================================


-- ⚠️  EVERYTHING BELOW IS INERT UNTIL THE GUARD IS REMOVED.  ⚠️
-- The \if directive prevents accidental execution of a pasted script.
-- Reviewer: remove this guard block ONLY after approval is recorded.

\echo '*** THIS SCRIPT IS NOT APPROVED FOR EXECUTION. ABORTING. ***'
\quit


BEGIN;

-- Required: the return type changes, so CREATE OR REPLACE alone cannot work.
DROP FUNCTION IF EXISTS public.get_predictor_leaderboard(uuid);

CREATE FUNCTION public.get_predictor_leaderboard(
  p_competition_id uuid
)
RETURNS TABLE (
  rank            bigint,
  user_id         uuid,      -- ← restored from migration 014 (019 dropped it)
  display_name    text,
  country         text,
  total_points    bigint,
  match_points    bigint,
  bonus_points    bigint,
  predictions     bigint,
  exact_scores    bigint,
  correct_gd      bigint,    -- ← from migration 019
  correct_results bigint     -- ← from migration 019
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
        (mp.pts + bp.pts)  DESC,   -- 1. total points (match + bonus)
        mp.exact_count     DESC,   -- 2. exact scores (5 pts)
        mp.gd_count        DESC,   -- 3. correct goal difference (3 pts)
        mp.result_count    DESC,   -- 4. correct result (2 pts)
        bp.pts             DESC,   -- 5. bonus question points
        mp.pred_count      DESC    -- 6. most predictions submitted
    )::bigint                                                         AS rank,
    mp.user_id,
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
  JOIN bonus_pts bp                 ON bp.user_id = mp.user_id
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

COMMIT;


-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION — run immediately, all read-only
--
--   1. Signature check — must list user_id AND correct_gd AND correct_results:
--        SELECT pg_get_function_result(p.oid) FROM pg_proc p
--        JOIN pg_namespace n ON n.oid = p.pronamespace
--        WHERE n.nspname='public' AND p.proname='get_predictor_leaderboard';
--
--   2. Executes without error and returns rows:
--        SELECT rank, total_points, exact_scores, correct_gd, correct_results
--        FROM public.get_predictor_leaderboard(
--          (SELECT id FROM public.competitions WHERE slug='wc2026'))
--        ORDER BY rank LIMIT 20;
--
--   3. user_id is populated (not null) on every row — this is what 019 broke:
--        SELECT count(*) FILTER (WHERE user_id IS NULL) AS null_user_ids
--        FROM public.get_predictor_leaderboard(
--          (SELECT id FROM public.competitions WHERE slug='wc2026'));
--        -- expect 0
--
--   4. Matches BLOCK 4's independently-computed intended ordering, rank for rank.
--
--   5. Load /predict/leaderboard in a browser: rows render, the "YOU" badge
--      appears for the signed-in user, and row links resolve to a real user page
--      (NOT /predict/user/undefined).
--
--   6. Anon access still works (RPC is granted to anon; the board is public).
--
--   If ANY check fails → roll back immediately using the saved BLOCK 2 output.
-- ============================================================================
