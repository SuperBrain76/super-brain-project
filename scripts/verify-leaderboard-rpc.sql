-- ============================================================================
-- PHASE 0.1 — LEADERBOARD RPC VERIFICATION  ⚠️ PRIZE-CRITICAL
-- ----------------------------------------------------------------------------
-- READ-ONLY. No writes. Safe during the production freeze.
-- Run in: Supabase Dashboard → SQL Editor, against PRODUCTION.
-- Paste the output of blocks 1–5 back for analysis.
--
-- WHY: `get_predictor_leaderboard` is defined FOUR times in this repository,
-- each with a DIFFERENT return type, and NONE of the migrations DROP the
-- function first. PostgreSQL cannot change a function's return type via
-- CREATE OR REPLACE — it raises:
--     ERROR: cannot change return type of existing function
--     HINT:  Use DROP FUNCTION get_predictor_leaderboard(uuid) first.
-- Therefore each migration WOULD HAVE FAILED unless the function was dropped
-- by hand. There is no migration ledger, so which version is live is unknown.
--
-- WHAT'S AT STAKE PER VERSION:
--
--   BASE (predictor-schema.sql:410) — 6 cols, no user_id, NO BONUS JOIN,
--        ORDER BY total_points only.
--        → Bonus points (75 available) INVISIBLE. Champion could be very wrong.
--
--   013  — joins bonus.
--
--   014  — 9 cols incl. user_id, joins bonus, ORDER BY total_points only.
--        → Bonus counted ✅. NO tie-breaks ❌.
--
--   019  — 10 cols incl. correct_gd + correct_results, full 6-level tie-break,
--          but user_id REMOVED (regresses 014).
--        → Tie-breaks ✅. Every leaderboard row links to /predict/user/undefined ❌.
--
-- The client (lib/predictor.ts:987–999) reads ALL of: user_id, match_points,
-- bonus_points, correct_gd, correct_results — and coalesces missing numerics
-- to 0 via `?? 0`. Missing columns therefore produce NO ERROR, just wrong data.
-- ============================================================================


-- ── BLOCK 1 — Which version is live? (the decisive query) ───────────────────
-- Read the returns signature and compare against the table above.
select
  p.proname,
  pg_get_function_result(p.oid) as returns_signature,
  case p.prosecdef when true then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
  p.provolatile as volatility,   -- 's' = STABLE
  l.lanname     as language       -- base = sql; 013/014/019 = plpgsql
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language  l on l.oid = p.prolang
where n.nspname = 'public'
  and p.proname in ('get_predictor_leaderboard', 'get_league_leaderboard');

-- Quick read of BLOCK 1:
--   returns contains 'user_id' and NOT 'correct_gd'      → 014 is live (no tie-breaks)
--   returns contains 'correct_gd' and NOT 'user_id'      → 019 is live (links broken)
--   returns has neither 'match_points' nor 'user_id'     → BASE is live (NO BONUS — escalate)
--   language = 'sql'                                     → BASE is live (013+ are plpgsql)


-- ── BLOCK 2 — Full production source (definitive) ───────────────────────────
-- Paste this output back verbatim. It is the ground truth for the ORDER BY.
select pg_get_functiondef(p.oid) as production_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_predictor_leaderboard';


-- ── BLOCK 3 — Current production top 20 (ANONYMISED) ───────────────────────
-- No display_name, no country, no user_id. Rank + metrics only.
-- This is the ordering the prize is currently being decided by.
select
  rank,
  total_points,
  predictions,
  exact_scores
from public.get_predictor_leaderboard(
  (select id from public.competitions where slug = 'wc2026')
)
order by rank
limit 20;
-- NOTE: if this errors with "column ... does not exist", the live signature is
-- narrower than expected — that IS the finding. Record the error and stop.


-- ── BLOCK 4 — INTENDED (019) ordering, computed independently ──────────────
-- Recomputes the leaderboard using migration 019's exact tie-break rules
-- WITHOUT touching the installed function. Pure SELECT.
-- Compare rank-for-rank against BLOCK 3.
with comp as (
  select id from public.competitions where slug = 'wc2026'
),
all_predictors as (
  select distinct p.user_id
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where f.competition_id = (select id from comp)
),
match_pts as (
  select
    ap.user_id,
    coalesce(sum(p.points_awarded), 0)               as pts,
    count(p.id)                                      as pred_count,
    count(case when p.points_awarded = 5 then 1 end) as exact_count,
    count(case when p.points_awarded = 3 then 1 end) as gd_count,
    count(case when p.points_awarded = 2 then 1 end) as result_count
  from all_predictors ap
  join public.predictions p on p.user_id = ap.user_id
  join public.fixtures f    on f.id = p.fixture_id
                           and f.competition_id = (select id from comp)
  group by ap.user_id
),
bonus_pts as (
  select
    ap.user_id,
    coalesce(sum(bp.points_awarded), 0) as pts
  from all_predictors ap
  left join public.bonus_predictions bp
         on bp.user_id = ap.user_id
        and bp.points_awarded is not null
  group by ap.user_id
)
select
  row_number() over (
    order by
      (mp.pts + bp.pts) desc,
      mp.exact_count    desc,
      mp.gd_count       desc,
      mp.result_count   desc,
      bp.pts            desc,
      mp.pred_count     desc
  ) as intended_rank,
  -- anonymised stable handle: NOT reversible to a user, stable across blocks 4/5
  substr(md5(mp.user_id::text), 1, 8) as anon_id,
  (mp.pts + bp.pts) as total_points,
  mp.pts            as match_points,
  bp.pts            as bonus_points,
  mp.exact_count    as exact_scores,
  mp.gd_count       as correct_gd,
  mp.result_count   as correct_results,
  mp.pred_count     as predictions
from match_pts mp
join bonus_pts bp on bp.user_id = mp.user_id
order by intended_rank
limit 20;


-- ── BLOCK 5 — DOES IT CHANGE THE PRIZE? (the only question that matters) ────
-- Returns rows ONLY where the tie-break rules would reorder tied users.
-- ZERO ROWS = current ordering is safe regardless of which version is live.
with comp as (select id from public.competitions where slug = 'wc2026'),
all_predictors as (
  select distinct p.user_id from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where f.competition_id = (select id from comp)
),
match_pts as (
  select ap.user_id,
    coalesce(sum(p.points_awarded), 0) as pts,
    count(p.id) as pred_count,
    count(case when p.points_awarded = 5 then 1 end) as exact_count,
    count(case when p.points_awarded = 3 then 1 end) as gd_count,
    count(case when p.points_awarded = 2 then 1 end) as result_count
  from all_predictors ap
  join public.predictions p on p.user_id = ap.user_id
  join public.fixtures f on f.id = p.fixture_id and f.competition_id = (select id from comp)
  group by ap.user_id
),
bonus_pts as (
  select ap.user_id, coalesce(sum(bp.points_awarded), 0) as pts
  from all_predictors ap
  left join public.bonus_predictions bp on bp.user_id = ap.user_id and bp.points_awarded is not null
  group by ap.user_id
),
totals as (
  select mp.user_id, (mp.pts + bp.pts) as total_points,
         mp.exact_count, mp.gd_count, mp.result_count, bp.pts as bonus, mp.pred_count
  from match_pts mp join bonus_pts bp on bp.user_id = mp.user_id
)
select
  total_points,
  count(*) as users_tied_on_points,
  count(distinct (exact_count, gd_count, result_count, bonus, pred_count))
    as distinct_tiebreak_profiles,
  case
    when count(distinct (exact_count, gd_count, result_count, bonus, pred_count)) = 1
      then 'FULLY TIED — tie-breaks cannot separate; shared prize decision'
    else 'TIE-BREAKS WOULD REORDER THESE USERS'
  end as verdict
from totals
group by total_points
having count(*) > 1
order by total_points desc
limit 10;

-- Interpretation:
--   No rows at any prize-relevant total  → ordering is unambiguous. No emergency change needed.
--   Rows at the TOP total_points         → the tie-break version DOES decide the champion.
--                                          → emergency correction required BEFORE announcing.
--   'FULLY TIED'                          → no rule separates them. Product decision, not a bug.


-- ── BLOCK 6 — Bonus scoring sanity (only matters if BASE is live) ───────────
select
  count(*)                                                as bonus_predictions_total,
  count(*) filter (where points_awarded is not null)      as scored,
  coalesce(sum(points_awarded), 0)                        as total_bonus_points_awarded
from public.bonus_predictions bp
join public.bonus_questions q on q.id = bp.question_id
where q.competition_id = (select id from public.competitions where slug = 'wc2026');
-- If BASE is live AND total_bonus_points_awarded > 0, the live leaderboard is
-- omitting every one of those points. Escalate immediately.


-- ============================================================================
-- REPORT BACK: output of blocks 1, 2, 3, 4, 5, 6.
-- Contains no names, emails, countries or user IDs — ranks, metrics and
-- one-way md5 handles only.
-- ============================================================================
