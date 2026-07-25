-- ============================================================================
-- BONUS QUESTION AUDIT + PRIZE MATHEMATICS  ⚠️ PRIZE-CRITICAL
-- ----------------------------------------------------------------------------
-- READ-ONLY. No writes. Safe during the production freeze.
-- Run in: Supabase Dashboard → SQL Editor, against PRODUCTION.
--
-- ⚠️ COLUMNS THAT DO NOT EXIST — read this before interpreting the output.
--
--   The audit request asked for "published/hidden status" and "display order".
--   NEITHER EXISTS in this schema. bonus_questions has exactly these columns
--   (migrations/006:22-40):
--       id, competition_id, question_key, question_text, points_value,
--       answer_type, status, locks_at, correct_team_id, correct_answer_text,
--       created_at
--
--   • There is NO publish/hide concept. RLS is `USING (true)` (006:47-49) and
--     getBonusQuestions() applies NO status filter (lib/predictor.ts:1057-1073).
--     EVERY row in this table is visible to every visitor, always.
--     → A question cannot be "hidden". If it is not on the page, THE ROW IS NOT
--       THERE. That is the whole Golden Glove diagnosis.
--
--   • There is NO display_order. The frontend orders by points_value DESC
--     (lib/predictor.ts:1070). Order is derived, not stored.
--
--   • `status` is (open | locked | answered) — NOT active/inactive. And it does
--     not gate visibility; only locks_at gates submission (006:31-34).
-- ============================================================================


-- ── BLOCK 1 — COMPLETE INVENTORY (deliverable A) ───────────────────────────
select
  q.id                                    as database_id,
  q.question_key,
  q.question_text,
  q.answer_type                           as question_type,
  q.points_value,
  q.status,                               -- open | locked | answered
  q.locks_at                              as prediction_deadline,
  (now() >= q.locks_at)                   as deadline_passed,
  q.created_at,
  -- visibility: ALWAYS true. RLS is USING(true), no status filter client-side.
  true                                    as appears_in_frontend_query,
  -- display order as the UI computes it (points_value DESC) — not stored
  row_number() over (order by q.points_value desc, q.question_key) as display_order,
  count(bp.id)                            as submitted_predictions,
  count(bp.points_awarded)                as scored_predictions,
  (q.status = 'answered')                 as already_scored,
  q.correct_team_id,
  t.name                                  as correct_team_name,
  q.correct_answer_text,
  -- included in bonus scoring: any row with points_awarded set is summed by the
  -- leaderboard RPC. Inclusion is unconditional — there is no opt-out flag.
  true                                    as included_in_bonus_scoring
from public.bonus_questions q
left join public.bonus_predictions bp on bp.question_id = q.id
left join public.teams t              on t.id = q.correct_team_id
where q.competition_id = (select id from public.competitions where slug = 'wc2026')
group by q.id, q.question_key, q.question_text, q.answer_type, q.points_value,
         q.status, q.locks_at, q.created_at, q.correct_team_id, t.name,
         q.correct_answer_text
order by q.points_value desc, q.question_key;

-- EXPECTED (if migration 017 was never applied — the hypothesis):
--   6 rows: winner(20) golden_boot(15) runner_up(10) most_goals(10)
--           best_defence(10) surprise_team(10)  = 75 points
--   NO golden_glove row.
-- The published rules (app/predict/rules/page.tsx:336,348) promise SEVEN
-- questions worth NINETY points, including Golden Glove at 15. 75 + 15 = 90.


-- ── BLOCK 2 — GOLDEN GLOVE / duplicate hunt (deliverable B) ────────────────
-- Catches golden_glove under any key or wording, incl. "Best Goalkeeper".
select id, question_key, question_text, points_value, status, locks_at, created_at
from public.bonus_questions
where competition_id = (select id from public.competitions where slug = 'wc2026')
  and (
        question_key   ilike '%glove%'
     or question_key   ilike '%keeper%'
     or question_key   ilike '%goalie%'
     or question_text  ilike '%glove%'
     or question_text  ilike '%goalkeeper%'
     or question_text  ilike '%keeper%'
  );
-- ZERO ROWS → migration 017 was never applied. This is the expected result.
-- ANY ROW    → it exists; report question_key, status and locks_at immediately.


-- ── BLOCK 3 — Orphaned golden_glove predictions? ───────────────────────────
-- If 017 was applied and the row later deleted, predictions would have
-- cascaded away. This proves whether any user ever answered it.
select count(*) as total_bonus_predictions,
       count(distinct question_id) as distinct_questions_answered
from public.bonus_predictions bp
join public.bonus_questions q on q.id = bp.question_id
where q.competition_id = (select id from public.competitions where slug = 'wc2026');
-- Compare distinct_questions_answered against BLOCK 1's row count.


-- ── BLOCK 4 — Remaining match points available ─────────────────────────────
select
  fixture_number, stage, status, kicks_off_at,
  home_score, away_score,
  case when home_score is null or away_score is null then 5 else 0 end as max_points_still_available
from public.fixtures
where competition_id = (select id from public.competitions where slug = 'wc2026')
  and (status <> 'completed' or home_score is null or away_score is null)
order by fixture_number;
-- Each unplayed fixture is worth up to 5 (exact score).


-- ── BLOCK 5 — Remaining bonus points available ─────────────────────────────
select
  count(*)                          as unresolved_questions,
  coalesce(sum(points_value), 0)    as unresolved_bonus_points,
  string_agg(question_key || ' (' || points_value || ')', ', ' order by points_value desc) as detail
from public.bonus_questions
where competition_id = (select id from public.competitions where slug = 'wc2026')
  and status <> 'answered';


-- ── BLOCK 6 — TOP 20: current, max and min possible (deliverables C + D) ───
-- KEY INSIGHT: points_awarded NEVER DECREASES. A user's current total is
-- therefore their FLOOR (minimum possible final total).
--
--   min_possible = current_total                     (nothing can be lost)
--   max_possible = current_total
--                + 5 × (unplayed fixtures the user HAS predicted)
--                + Σ points_value of unresolved questions the user HAS answered
--
-- A user who did not predict the final cannot gain from it. A user who did not
-- answer a bonus question cannot gain from it. This is what makes elimination
-- provable rather than estimated.
with comp as (select id from public.competitions where slug = 'wc2026'),
unplayed as (
  select id from public.fixtures
  where competition_id = (select id from comp)
    and (home_score is null or away_score is null)
),
unresolved_q as (
  select id, points_value from public.bonus_questions
  where competition_id = (select id from comp) and status <> 'answered'
),
all_predictors as (
  select distinct p.user_id from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where f.competition_id = (select id from comp)
),
-- NOTE: both CTEs below are COMPETITION-SCOPED with inner joins / an explicit
-- question filter. Migration 019's own bonus_pts CTE is NOT — it sums a user's
-- bonus points across EVERY competition. Harmless today (one competition
-- exists); a real bug the moment the Premier League launches. See §Phase 1.
current_match as (
  select ap.user_id, coalesce(sum(p.points_awarded), 0) as pts
  from all_predictors ap
  join public.predictions p on p.user_id = ap.user_id
  join public.fixtures f on f.id = p.fixture_id and f.competition_id = (select id from comp)
  group by ap.user_id
),
current_bonus as (
  select ap.user_id, coalesce(sum(bp.points_awarded), 0) as pts
  from all_predictors ap
  left join public.bonus_predictions bp
         on bp.user_id = ap.user_id
        and bp.points_awarded is not null
        and bp.question_id in (select id from public.bonus_questions
                               where competition_id = (select id from comp))
  group by ap.user_id
),
-- upside: only fixtures this user actually predicted
match_upside as (
  select ap.user_id, count(p.id) * 5 as pts
  from all_predictors ap
  left join public.predictions p on p.user_id = ap.user_id and p.fixture_id in (select id from unplayed)
  group by ap.user_id
),
-- upside: only questions this user actually answered
bonus_upside as (
  select ap.user_id, coalesce(sum(uq.points_value), 0) as pts
  from all_predictors ap
  left join public.bonus_predictions bp on bp.user_id = ap.user_id
  left join unresolved_q uq on uq.id = bp.question_id
  group by ap.user_id
),
totals as (
  select
    cm.user_id,
    (cm.pts + cb.pts)                             as current_total,
    (cm.pts + cb.pts)                             as min_possible,
    (cm.pts + cb.pts + mu.pts + bu.pts)           as max_possible,
    cm.pts as current_match_pts, cb.pts as current_bonus_pts,
    mu.pts as match_upside, bu.pts as bonus_upside
  from current_match cm
  join current_bonus cb on cb.user_id = cm.user_id
  join match_upside  mu on mu.user_id = cm.user_id
  join bonus_upside  bu on bu.user_id = cm.user_id
)
select
  row_number() over (order by current_total desc, max_possible desc) as current_rank,
  substr(md5(user_id::text), 1, 8) as anon_id,
  current_total,
  current_match_pts,
  current_bonus_pts,
  match_upside      as still_winnable_from_matches,
  bonus_upside      as still_winnable_from_bonus,
  min_possible,
  max_possible
from totals
order by current_total desc, max_possible desc
limit 20;


-- ── BLOCK 7 — WHO CAN STILL WIN (deliverable E) ────────────────────────────
-- Elimination proof: the leader's floor is their CURRENT total (points never
-- decrease). Any user whose CEILING is below that floor is mathematically
-- eliminated — no scenario exists in which they finish first.
--
--   can_still_win  ⟺  max_possible(user) >= max(current_total) across all users
--
-- Note: this is the standard necessary condition. It is deliberately
-- CONSERVATIVE — outcomes are correlated (two users predicting the same score
-- both gain together), so a user flagged "can still win" may in practice be
-- unable to overtake. Nobody flagged ELIMINATED can win. That direction is exact.
with comp as (select id from public.competitions where slug = 'wc2026'),
unplayed as (
  select id from public.fixtures where competition_id = (select id from comp)
    and (home_score is null or away_score is null)
),
unresolved_q as (
  select id, points_value from public.bonus_questions
  where competition_id = (select id from comp) and status <> 'answered'
),
all_predictors as (
  select distinct p.user_id from public.predictions p
  join public.fixtures f on f.id = p.fixture_id where f.competition_id = (select id from comp)
),
current_match as (
  select ap.user_id, coalesce(sum(p.points_awarded), 0) as pts from all_predictors ap
  join public.predictions p on p.user_id = ap.user_id
  join public.fixtures f on f.id = p.fixture_id and f.competition_id = (select id from comp)
  group by ap.user_id
),
current_bonus as (
  select ap.user_id, coalesce(sum(bp.points_awarded), 0) as pts from all_predictors ap
  left join public.bonus_predictions bp on bp.user_id = ap.user_id and bp.points_awarded is not null
   and bp.question_id in (select id from public.bonus_questions where competition_id = (select id from comp))
  group by ap.user_id
),
match_upside as (
  select ap.user_id, count(p.id) * 5 as pts from all_predictors ap
  left join public.predictions p on p.user_id = ap.user_id and p.fixture_id in (select id from unplayed)
  group by ap.user_id
),
bonus_upside as (
  select ap.user_id, coalesce(sum(uq.points_value), 0) as pts from all_predictors ap
  left join public.bonus_predictions bp on bp.user_id = ap.user_id
  left join unresolved_q uq on uq.id = bp.question_id
  group by ap.user_id
),
totals as (
  select cm.user_id,
    (cm.pts + cb.pts) as current_total,
    (cm.pts + cb.pts + mu.pts + bu.pts) as max_possible
  from current_match cm
  join current_bonus cb on cb.user_id = cm.user_id
  join match_upside mu on mu.user_id = cm.user_id
  join bonus_upside bu on bu.user_id = cm.user_id
),
leader_floor as (select max(current_total) as floor_pts from totals)
select
  count(*) filter (where t.max_possible >= lf.floor_pts) as users_who_can_still_win,
  count(*) filter (where t.max_possible <  lf.floor_pts) as users_eliminated,
  count(*)                                               as total_predictors,
  max(lf.floor_pts)                                      as leader_current_total
from totals t cross join leader_floor lf;

-- Named list (anonymised) of everyone still alive:
with comp as (select id from public.competitions where slug = 'wc2026'),
unplayed as (select id from public.fixtures where competition_id = (select id from comp) and (home_score is null or away_score is null)),
unresolved_q as (select id, points_value from public.bonus_questions where competition_id = (select id from comp) and status <> 'answered'),
all_predictors as (select distinct p.user_id from public.predictions p join public.fixtures f on f.id = p.fixture_id where f.competition_id = (select id from comp)),
current_match as (select ap.user_id, coalesce(sum(p.points_awarded),0) as pts from all_predictors ap join public.predictions p on p.user_id=ap.user_id join public.fixtures f on f.id=p.fixture_id and f.competition_id=(select id from comp) group by ap.user_id),
current_bonus as (select ap.user_id, coalesce(sum(bp.points_awarded),0) as pts from all_predictors ap left join public.bonus_predictions bp on bp.user_id=ap.user_id and bp.points_awarded is not null and bp.question_id in (select id from public.bonus_questions where competition_id=(select id from comp)) group by ap.user_id),
match_upside as (select ap.user_id, count(p.id)*5 as pts from all_predictors ap left join public.predictions p on p.user_id=ap.user_id and p.fixture_id in (select id from unplayed) group by ap.user_id),
bonus_upside as (select ap.user_id, coalesce(sum(uq.points_value),0) as pts from all_predictors ap left join public.bonus_predictions bp on bp.user_id=ap.user_id left join unresolved_q uq on uq.id=bp.question_id group by ap.user_id),
totals as (select cm.user_id, (cm.pts+cb.pts) as current_total, (cm.pts+cb.pts+mu.pts+bu.pts) as max_possible
  from current_match cm join current_bonus cb on cb.user_id=cm.user_id join match_upside mu on mu.user_id=cm.user_id join bonus_upside bu on bu.user_id=cm.user_id),
leader_floor as (select max(current_total) as floor_pts from totals)
select
  substr(md5(t.user_id::text),1,8) as anon_id,
  t.current_total,
  t.max_possible,
  (t.max_possible - lf.floor_pts) as margin_over_leader_floor
from totals t cross join leader_floor lf
where t.max_possible >= lf.floor_pts
order by t.max_possible desc, t.current_total desc;


-- ============================================================================
-- REPORT BACK: blocks 1–7. No names, emails, countries or user IDs —
-- one-way md5 handles and integers only.
-- ============================================================================
