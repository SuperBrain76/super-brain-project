-- ============================================================
-- VERIFY 038 — bonus points competition scoping
--
-- READ-ONLY. Safe to run at any time, including under freeze.
--
-- HOW TO USE
--   1. Run this file BEFORE applying migration 038. Save the output.
--   2. Apply 038.
--   3. Run this file AGAIN. Save the output.
--   4. Diff. Blocks A and B must be IDENTICAL. Block C explains why.
--
--   If block A or B differs, STOP and do not proceed to Phase 2.
--   A difference means the World Cup leaderboard changed, which this
--   migration is not permitted to do.
-- ============================================================

\echo '=== BLOCK A — global leaderboard, top 50 (must not change) ==='

select rank, display_name, total_points, match_points, bonus_points,
       predictions, exact_scores, correct_gd, correct_results
from public.get_predictor_leaderboard(
  (select id from public.competitions where slug = 'wc2026')
)
order by rank
limit 50;


\echo '=== BLOCK B — full-leaderboard checksum (must not change) ==='
-- A single hash over every row. Cheaper to eyeball than 200 rows and
-- catches a change anywhere in the table, not just the visible top 50.

select
  count(*)                                        as rows_returned,
  sum(total_points)                               as sum_total_points,
  sum(bonus_points)                               as sum_bonus_points,
  sum(match_points)                               as sum_match_points,
  md5(string_agg(
        rank || '|' || display_name || '|' || total_points || '|' || bonus_points,
        ',' order by rank))                       as leaderboard_checksum
from public.get_predictor_leaderboard(
  (select id from public.competitions where slug = 'wc2026')
);


\echo '=== BLOCK C — is any bonus point outside wc2026? (the blast radius) ==='
-- This is the query that proves WHY blocks A and B cannot change today.
-- If every scored bonus prediction belongs to wc2026, then the old
-- unfiltered sum and the new filtered sum are equal by definition.
--
-- EXPECTED TODAY: one row, slug = 'wc2026'.
-- If a second slug appears, the defect described in migration 038 is
-- already LIVE and the leaderboard has been wrong since that competition
-- scored its first bonus question.

select
  c.slug                          as competition,
  count(*)                        as scored_bonus_predictions,
  count(distinct bp.user_id)      as users,
  sum(bp.points_awarded)          as total_bonus_points
from public.bonus_predictions bp
join public.bonus_questions   bq on bq.id = bp.question_id
join public.competitions      c  on c.id  = bq.competition_id
where bp.points_awarded is not null
group by c.slug
order by total_bonus_points desc nulls last;


\echo '=== BLOCK D — orphaned bonus predictions (should be zero rows) ==='
-- A scored bonus prediction whose question no longer exists would be
-- counted by the OLD code and ignored by the NEW code — the one scenario
-- in which blocks A/B could legitimately differ. Confirm there are none.

select bp.id, bp.user_id, bp.question_id, bp.points_awarded
from public.bonus_predictions bp
left join public.bonus_questions bq on bq.id = bp.question_id
where bp.points_awarded is not null
  and bq.id is null;


\echo '=== BLOCK E — stat card vs leaderboard agreement ==='
-- get_my_predictor_stats already filtered correctly; the leaderboard did
-- not. Before 038 these two can disagree; after 038 they must agree.
-- Run as a real user session (auth.uid() must resolve) or skip.
-- Reported per user from raw tables so it works from the SQL editor.

with comp as (select id from public.competitions where slug = 'wc2026'),
lb as (
  select display_name, total_points, bonus_points
  from public.get_predictor_leaderboard((select id from comp))
),
raw as (
  select
    pr.display_name,
    coalesce((
      select sum(bp.points_awarded)
      from public.bonus_predictions bp
      join public.bonus_questions bq on bq.id = bp.question_id
      where bp.user_id = p.user_id
        and bp.points_awarded is not null
        and bq.competition_id = (select id from comp)
    ), 0) as scoped_bonus
  from public.predictions p
  join public.fixtures f       on f.id = p.fixture_id
  join public.user_profiles pr on pr.id = p.user_id
  where f.competition_id = (select id from comp)
  group by pr.display_name, p.user_id
)
select
  lb.display_name,
  lb.bonus_points   as leaderboard_bonus,
  raw.scoped_bonus  as correctly_scoped_bonus,
  lb.bonus_points - raw.scoped_bonus as difference
from lb
join raw on raw.display_name = lb.display_name
where lb.bonus_points is distinct from raw.scoped_bonus
order by abs(lb.bonus_points - raw.scoped_bonus) desc;
-- EXPECTED: zero rows, both before and after. Any row here before the
-- migration is a live wrong leaderboard entry.
