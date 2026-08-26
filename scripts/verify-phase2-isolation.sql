-- ============================================================
-- VERIFY PHASE 2 — cross-competition isolation (2026-08-26 rewrite)
--
-- 🔴 THE ACCEPTANCE GATE: "No sum, count, rank or window may cross a
--    competition boundary without saying so explicitly."
--
-- Proves that adding a SECOND competition — in which a user on the first
-- competition's leaderboard scores 5 match points AND 999 bonus points —
-- changes NOTHING about the first competition's predictor leaderboard.
-- That is the exact defect migration 038 fixed (bonus points summed across
-- all competitions). This is the regression guard, re-run now with F1 also
-- present in production.
--
-- Rewritten 26 Aug 2026 to run against the CURRENT schema:
--   · the synthetic competition gets a full hierarchy (stage + season +
--     round), required by the fixture hierarchy trigger (migration 047);
--   · the match prediction is placed while the fixture is still OPEN, then
--     the result is set — so the deadline trigger is satisfied and the
--     auto-score trigger (044) awards the points, exactly as in real play;
--   · it targets ANY competition that already has a scored prediction, so
--     it is never vacuous on a database with real history (the old version
--     hard-coded wc2026).
--
-- SAFETY: runs inside a transaction that ends in ROLLBACK. Nothing survives.
--         Run as ONE statement batch in the SQL editor.
-- ============================================================

begin;

do $$
declare
  v_a        uuid;   -- an existing competition that already has a scored prediction
  v_user     uuid;   -- a user on competition A's leaderboard
  v_b        uuid;   -- the synthetic second competition
  v_b_season uuid;
  v_b_round  uuid;
  v_ta       uuid;
  v_tb       uuid;
  v_fix      uuid;
  v_q        uuid;
  v_before   text;
  v_after    text;
  v_rows     integer;
begin
  -- ── Find a real competition WITH a scored prediction, and a user on it ──
  select f.competition_id, p.user_id
    into v_a, v_user
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where p.points_awarded is not null
  order by f.competition_id
  limit 1;

  if v_a is null then
    raise notice '⚠️ No scored predictions in any competition — isolation test is vacuous.';
    raise notice '   (Nothing to leak into. Re-run once a competition has real results.)';
    return;
  end if;

  select md5(coalesce(string_agg(
           rank || '|' || display_name || '|' || total_points || '|' ||
           match_points || '|' || bonus_points || '|' || predictions,
           ',' order by rank), '(empty)'))
    into v_before
  from public.get_predictor_leaderboard(v_a);

  raise notice 'BEFORE: competition % — leaderboard checksum %', v_a, v_before;

  -- ── Build a fully-valid synthetic SECOND competition ────────
  insert into public.competitions (name, slug, status, starts_at, ends_at)
  values ('ISOLATION TEST LEAGUE', '__isolation_test__', 'active',
          now() - interval '30 days', now() + interval '30 days')
  returning id into v_b;

  insert into public.competition_stages
    (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_b, 'league', 'Matchweek', 1, true, false);

  insert into public.seasons
    (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_b, '__isolation_test_season__', 'TEST', 'active', true,
          now() - interval '30 days', now() + interval '30 days')
  returning id into v_b_season;

  insert into public.rounds (season_id, code, label, sort_order, kind, status)
  values (v_b_season, 'r1', 'Matchweek 1', 1, 'matchweek', 'upcoming')
  returning id into v_b_round;

  insert into public.teams (competition_id, name, code, season_id)
  values (v_b, 'Test Alpha', 'TSA', v_b_season) returning id into v_ta;
  insert into public.teams (competition_id, name, code, season_id)
  values (v_b, 'Test Beta',  'TSB', v_b_season) returning id into v_tb;

  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_b,'exact',5,1),(v_b,'gd',3,2),(v_b,'result',2,3),(v_b,'wrong',0,4);

  -- Match prediction, deadline-safe: OPEN fixture → predict → set result.
  insert into public.fixtures
    (competition_id, season_id, round_id, stage, fixture_number,
     home_team_id, away_team_id, kicks_off_at, status)
  values (v_b, v_b_season, v_b_round, 'league', 1,
          v_ta, v_tb, now() + interval '1 hour', 'scheduled')
  returning id into v_fix;

  insert into public.predictions (user_id, fixture_id, home_score, away_score)
  values (v_user, v_fix, 3, 0);

  -- Setting the result fires auto_score_predictions (044): 3-0 vs 3-0 → 5 pts.
  update public.fixtures
  set home_score = 3, away_score = 0, status = 'completed'
  where id = v_fix;

  -- Bonus leak (the 038 defect): a 999-point bonus answer in competition B.
  insert into public.bonus_questions
    (competition_id, season_id, question_key, question_text, points_value,
     answer_type, status, locks_at, correct_answer_text)
  values (v_b, v_b_season, 'test_q', 'Isolation test question', 999,
          'player', 'answered', now() - interval '10 days', 'X')
  returning id into v_q;

  insert into public.bonus_predictions
    (user_id, question_id, answer_text, points_awarded)
  values (v_user, v_q, 'X', 999);

  -- ── Snapshot competition A again ────────────────────────────
  select md5(coalesce(string_agg(
           rank || '|' || display_name || '|' || total_points || '|' ||
           match_points || '|' || bonus_points || '|' || predictions,
           ',' order by rank), '(empty)'))
    into v_after
  from public.get_predictor_leaderboard(v_a);

  raise notice 'AFTER:  leaderboard checksum %', v_after;

  -- ── ASSERT ──────────────────────────────────────────────────
  if v_before is distinct from v_after then
    raise exception
      '🔴 ISOLATION FAILURE: competition %''s leaderboard CHANGED after a '
      'second competition added 999 bonus + 5 match points for a shared user. '
      'A leaderboard aggregate reaches bonus_predictions or predictions without '
      'filtering on competition — confirm migration 038 is applied and look for '
      'any other unscoped aggregate.', v_a;
  end if;

  raise notice '';
  raise notice '════════════════════════════════════════════════════';
  raise notice '✅ ISOLATION PASSED';
  raise notice 'A second competition with 999 bonus + 5 match points for a';
  raise notice 'shared user changed NOTHING about competition %.', v_a;
  raise notice '════════════════════════════════════════════════════';
end;
$$;

rollback;

do $$
begin
  raise notice 'Rolled back — no synthetic data remains.';
  raise notice 'Confirm with: select slug from public.competitions where slug like ''__isolation%%'';';
end;
$$;
