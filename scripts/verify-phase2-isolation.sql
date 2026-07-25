-- ============================================================
-- VERIFY PHASE 2 — two-competition isolation
--
-- 🔴 THE ACCEPTANCE GATE FOR PHASE 2.
--
-- The rule Phase 2 exists to enforce:
--
--   "No sum, count, rank or window may cross a competition boundary
--    without saying so explicitly."
--
-- This script creates a SECOND synthetic competition sharing users with the
-- World Cup, then asserts that every World Cup leaderboard is BIT-IDENTICAL
-- to what it was before that competition existed.
--
-- Had this test existed when migration 019 was written, it would have caught
-- the bonus-points leak (fixed in 038) on day one.
--
-- ────────────────────────────────────────────────────────────
-- SAFETY
-- ────────────────────────────────────────────────────────────
-- The whole script runs inside a transaction that ends in ROLLBACK. Nothing
-- it creates survives. It is therefore safe to run against any database —
-- though STAGING IS STILL PREFERRED, because it takes brief row locks and
-- because an accidental COMMIT would leave synthetic data behind.
--
-- ⚠️ In the Supabase SQL editor, run this as ONE statement batch. If the
--    editor wraps statements individually the ROLLBACK will not cover them.
--    When in doubt, run it via psql.
--
-- REQUIRES: migrations 037-046 applied. Run AFTER 038 — before it, this
--           script is expected to FAIL, which is the point.
-- ============================================================

begin;

do $$
declare
  v_wc            uuid;
  v_other         uuid;
  v_wc_season     uuid;
  v_team_a        uuid;
  v_team_b        uuid;
  v_fixture       uuid;
  v_question      uuid;
  v_user          uuid;

  v_lb_before     text;
  v_lb_after      text;
  v_stats_before  bigint;
  v_stats_after   bigint;
  v_users         integer;
begin
  select id into v_wc from public.competitions where slug = 'wc2026';
  if v_wc is null then
    raise exception 'wc2026 not found — nothing to isolate against.';
  end if;

  -- ── Snapshot the World Cup leaderboard BEFORE ───────────────
  select md5(string_agg(
           rank || '|' || display_name || '|' || total_points || '|' ||
           match_points || '|' || bonus_points || '|' || predictions,
           ',' order by rank))
    into v_lb_before
  from public.get_predictor_leaderboard(v_wc);

  select count(*) into v_users
  from public.get_predictor_leaderboard(v_wc);

  raise notice 'BEFORE: % users on the wc2026 leaderboard, checksum %',
               v_users, coalesce(v_lb_before, '(empty)');

  -- Pick a real user who already has World Cup bonus points — the exact
  -- profile that the leak affected.
  select bp.user_id into v_user
  from public.bonus_predictions bp
  join public.bonus_questions bq on bq.id = bp.question_id
  where bq.competition_id = v_wc and bp.points_awarded is not null
  limit 1;

  if v_user is null then
    -- Fall back to any user with predictions.
    select p.user_id into v_user
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where f.competition_id = v_wc
    limit 1;
  end if;

  if v_user is null then
    raise notice 'No users with wc2026 predictions — isolation test is vacuous. '
                 'Run this on a database that has real World Cup data.';
    return;
  end if;

  select coalesce(sum(p.points_awarded), 0) into v_stats_before
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where f.competition_id = v_wc and p.user_id = v_user;

  -- ── Create a synthetic SECOND competition ───────────────────
  insert into public.competitions (name, slug, status, starts_at, ends_at)
  values ('ISOLATION TEST LEAGUE', '__isolation_test__', 'active',
          now() - interval '30 days', now() + interval '30 days')
  returning id into v_other;

  insert into public.competition_stages
    (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_other, 'league', 'Matchweek', 1, true, false);

  insert into public.seasons
    (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_other, '__isolation_test_season__', 'TEST', 'active', true,
          now() - interval '30 days', now() + interval '30 days')
  returning id into v_wc_season;

  insert into public.teams (competition_id, name, code, season_id)
  values (v_other, 'Test Alpha', 'TSA', v_wc_season) returning id into v_team_a;
  insert into public.teams (competition_id, name, code, season_id)
  values (v_other, 'Test Beta',  'TSB', v_wc_season) returning id into v_team_b;

  -- A completed fixture in the OTHER competition.
  -- If this insert fails on the stage CHECK, migration 040 has not been
  -- applied — which is itself the finding.
  insert into public.fixtures
    (competition_id, season_id, stage, fixture_number,
     home_team_id, away_team_id, home_score, away_score, kicks_off_at, status)
  values (v_other, v_wc_season, 'league', 1,
          v_team_a, v_team_b, 3, 0, now() - interval '1 day', 'completed')
  returning id into v_fixture;

  -- The same user predicts in the OTHER competition and scores heavily.
  insert into public.predictions
    (user_id, fixture_id, home_score, away_score, points_awarded)
  values (v_user, v_fixture, 3, 0, 5);

  -- ...and answers a bonus question in the OTHER competition. THIS is the
  -- line that broke the World Cup leaderboard before migration 038.
  insert into public.bonus_questions
    (competition_id, season_id, question_key, question_text, points_value,
     answer_type, status, locks_at, correct_answer_text)
  values (v_other, v_wc_season, 'test_q', 'Isolation test question', 999,
          'player', 'answered', now() - interval '10 days', 'X')
  returning id into v_question;

  insert into public.bonus_predictions
    (user_id, question_id, answer_text, points_awarded)
  values (v_user, v_question, 'X', 999);

  -- ── Snapshot AFTER ──────────────────────────────────────────
  select md5(string_agg(
           rank || '|' || display_name || '|' || total_points || '|' ||
           match_points || '|' || bonus_points || '|' || predictions,
           ',' order by rank))
    into v_lb_after
  from public.get_predictor_leaderboard(v_wc);

  select coalesce(sum(p.points_awarded), 0) into v_stats_after
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where f.competition_id = v_wc and p.user_id = v_user;

  raise notice 'AFTER:  checksum %', coalesce(v_lb_after, '(empty)');

  -- ── ASSERT ──────────────────────────────────────────────────

  if v_stats_before <> v_stats_after then
    raise exception
      '🔴 ISOLATION FAILURE (match points): a user''s wc2026 match points changed '
      'from % to % after a DIFFERENT competition was added. A fixtures join is '
      'missing a competition filter.', v_stats_before, v_stats_after;
  end if;

  if v_lb_before is distinct from v_lb_after then
    raise exception
      '🔴 ISOLATION FAILURE (leaderboard): the wc2026 leaderboard changed after a '
      'DIFFERENT competition was added. 999 bonus points and 5 match points from '
      '"__isolation_test__" have leaked in. This is the migration 038 defect — '
      'confirm 038 is applied, then look for any other aggregate that reaches '
      'bonus_predictions or predictions without filtering on competition.';
  end if;

  raise notice '';
  raise notice '════════════════════════════════════════════════════';
  raise notice '✅ ISOLATION PASSED';
  raise notice 'A second competition with 999 bonus points and 5 match';
  raise notice 'points for a shared user changed NOTHING about wc2026.';
  raise notice '════════════════════════════════════════════════════';
end;
$$;

-- ── Nothing is kept ───────────────────────────────────────────
rollback;

do $$
begin
  raise notice 'Rolled back — no synthetic data remains.';
  raise notice 'Confirm with: select slug from public.competitions where slug like ''__isolation%%'';';
  raise notice 'That query must return zero rows.';
end;
$$;
