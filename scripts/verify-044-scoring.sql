-- ============================================================
-- VERIFY 044 — scoring rule extraction is zero-delta
--
-- 🔴 THE DECISIVE TEST FOR MIGRATION 044.
--
-- Migration 044 moves the 5/3/2/0 CASE out of two hardcoded copies into
-- one table plus one function. The claim is that behaviour is byte-identical.
-- This file proves it — or refuses to.
--
-- BLOCKS A–C are READ-ONLY and safe at any time.
-- BLOCK D **WRITES** (it rescores). Read its warning before running it.
--
-- HOW TO USE
--   1. BEFORE applying 044: run blocks A and B. Save both outputs.
--   2. Apply 044.
--   3. Run blocks A and B again. Diff. They must be IDENTICAL.
--   4. Optionally run block D (a full rescore) and then block A again.
--      Still identical. That is the acceptance test.
-- ============================================================

\set comp_slug 'wc2026'


\echo '=== BLOCK A — points distribution checksum (must not change) ==='
-- Every prediction's awarded points, aggregated. If the scoring logic
-- changed in any way, this moves.

select
  p.points_awarded,
  count(*) as predictions
from public.predictions p
join public.fixtures f    on f.id = p.fixture_id
join public.competitions c on c.id = f.competition_id
where c.slug = :'comp_slug'
group by p.points_awarded
order by p.points_awarded nulls last;

select
  count(*)                          as total_predictions,
  count(p.points_awarded)           as scored,
  sum(p.points_awarded)             as total_points_awarded,
  md5(string_agg(p.id::text || ':' || coalesce(p.points_awarded::text, 'null'),
                 ',' order by p.id)) as predictions_checksum
from public.predictions p
join public.fixtures f     on f.id = p.fixture_id
join public.competitions c on c.id = f.competition_id
where c.slug = :'comp_slug';
-- ▲ predictions_checksum is the single number that matters. It covers every
--   prediction individually, so it catches a change that a distribution
--   count could mask (two predictions swapping 3 and 2, for instance).


\echo '=== BLOCK B — independent recomputation, in pure SQL ==='
-- Recompute what EVERY prediction should score, directly from the fixture
-- result and the seeded rules, without calling any function under test.
-- Then compare to what is actually stored.
--
-- This is the real check: it does not trust apply_fixture_scoring, the
-- trigger, or rescore_fixture. It only trusts arithmetic.

with rules as (
  select
    coalesce(max(points) filter (where rule_code = 'exact'),  5) as p_exact,
    coalesce(max(points) filter (where rule_code = 'gd'),     3) as p_gd,
    coalesce(max(points) filter (where rule_code = 'result'), 2) as p_result,
    coalesce(max(points) filter (where rule_code = 'wrong'),  0) as p_wrong
  from public.scoring_rules sr
  join public.competitions c on c.id = sr.competition_id
  where c.slug = :'comp_slug'
),
expected as (
  select
    p.id,
    p.points_awarded as stored,
    case
      when p.home_score = f.home_score and p.away_score = f.away_score then r.p_exact
      when (p.home_score - p.away_score) = (f.home_score - f.away_score) then r.p_gd
      when (case when p.home_score > p.away_score then 'home'
                 when p.away_score > p.home_score then 'away'
                 else 'draw' end)
         = (case when f.home_score > f.away_score then 'home'
                 when f.away_score > f.home_score then 'away'
                 else 'draw' end) then r.p_result
      else r.p_wrong
    end as recomputed
  from public.predictions p
  join public.fixtures f     on f.id = p.fixture_id
  join public.competitions c on c.id = f.competition_id
  cross join rules r
  where c.slug = :'comp_slug'
    and f.home_score is not null
    and f.away_score is not null
)
select count(*) as mismatched_predictions
from expected
where stored is distinct from recomputed;
-- EXPECTED: 0. Any other number means stored points do not match the rules,
-- either because 044 changed behaviour or because a historical fixture was
-- scored under different rules and never rescored.

-- The offending rows, if any:
with rules as (
  select
    coalesce(max(points) filter (where rule_code = 'exact'),  5) as p_exact,
    coalesce(max(points) filter (where rule_code = 'gd'),     3) as p_gd,
    coalesce(max(points) filter (where rule_code = 'result'), 2) as p_result,
    coalesce(max(points) filter (where rule_code = 'wrong'),  0) as p_wrong
  from public.scoring_rules sr
  join public.competitions c on c.id = sr.competition_id
  where c.slug = :'comp_slug'
)
select
  f.fixture_number,
  f.home_score || '-' || f.away_score as actual,
  p.home_score || '-' || p.away_score as predicted,
  p.points_awarded                    as stored,
  case
    when p.home_score = f.home_score and p.away_score = f.away_score then r.p_exact
    when (p.home_score - p.away_score) = (f.home_score - f.away_score) then r.p_gd
    when (case when p.home_score > p.away_score then 'home'
               when p.away_score > p.home_score then 'away' else 'draw' end)
       = (case when f.home_score > f.away_score then 'home'
               when f.away_score > f.home_score then 'away' else 'draw' end) then r.p_result
    else r.p_wrong
  end as recomputed
from public.predictions p
join public.fixtures f     on f.id = p.fixture_id
join public.competitions c on c.id = f.competition_id
cross join rules r
where c.slug = :'comp_slug'
  and f.home_score is not null
  and p.points_awarded is distinct from (
    case
      when p.home_score = f.home_score and p.away_score = f.away_score then r.p_exact
      when (p.home_score - p.away_score) = (f.home_score - f.away_score) then r.p_gd
      when (case when p.home_score > p.away_score then 'home'
                 when p.away_score > p.home_score then 'away' else 'draw' end)
         = (case when f.home_score > f.away_score then 'home'
                 when f.away_score > f.home_score then 'away' else 'draw' end) then r.p_result
      else r.p_wrong
    end
  )
limit 50;


\echo '=== BLOCK C — seeded rules are the historical literals ==='

select sr.rule_code, sr.points, sr.sort_order
from public.scoring_rules sr
join public.competitions c on c.id = sr.competition_id
where c.slug = :'comp_slug'
order by sr.sort_order;
-- EXPECTED exactly: exact=5, gd=3, result=2, wrong=0.
-- These are the literals from predictor-schema.sql:268-275.


\echo '=== BLOCK D — FULL RESCORE. THIS WRITES. ==========================='
-- ⚠️⚠️ DO NOT RUN THIS CASUALLY. ⚠️⚠️
--
-- rescore_competition recalculates EVERY prediction and calls
-- economy_award_fixture for every fixture. It is idempotent and the economy
-- reconciles deltas rather than double-minting — but it touches every row
-- of the prediction table and every IQ ledger entry derived from it.
--
-- Preconditions:
--   • the closure snapshot exists and block A's checksum has been saved
--   • a database backup has been taken AND a restore tested
--   • nobody is mid-match (no fixture in 'live')
--
-- Uncomment ONLY when all three hold, and re-run block A immediately after.
-- The checksum must be UNCHANGED. If it changed, migration 044 altered
-- historical scoring and must be rolled back.
--
-- select public.rescore_competition(
--   (select id from public.competitions where slug = 'wc2026')
-- ) as predictions_updated;
--
-- Note: predictions_updated will be a large NON-ZERO number — it counts rows
-- WRITTEN, not rows CHANGED. `updated_at` moves on every row. The proof of
-- correctness is block A's checksum, not this return value.
-- ====================================================================
