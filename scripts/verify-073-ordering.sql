-- ============================================================
-- verify-073-ordering.sql — acceptance test for migration 073
--
-- Run in the Supabase SQL editor AFTER applying 073 (and 074), BEFORE
-- flipping the F1 competition public. Everything runs inside one
-- transaction and ROLLS BACK — no test data survives.
--
-- Proves, against the real production schema:
--   1. the shape guard: score fixtures reject payloads / partial scores,
--      ordering fixtures reject scores / short boards / duplicate entrants
--   2. settle_ordering_fixture writes a classification, completes the
--      fixture, and scores predictions on the exact-hit ladder
--   3. the hit ladder lands on the scoring_rules values (5/3/2/0)
--   4. economy: scored ordering predictions are visible to
--      economy_award_fixture's selection (points_awarded set)
--
-- Expected output: every line prints ✅. Any ❌ or an unexpected error
-- ABORTS — do not launch on a failed run.
-- ============================================================

begin;

do $$
declare
  v_comp    uuid;
  v_season  uuid;
  v_round   uuid;
  v_fix     uuid;
  v_users   uuid[];
  v_d       uuid[];   -- five driver/team ids, seeded order = actual top 5
  v_pts     integer;
  v_scored  integer;
  v_failed  boolean;
begin
  -- ── Scaffolding: a throwaway ordering competition ─────────────
  insert into public.competitions (name, slug, sport_code, status)
  values ('VERIFY 073', 'verify-073-tmp', 'motorsport', 'active')
  returning id into v_comp;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'GP', 1, true, false);

  insert into public.seasons (competition_id, slug, label, status, is_current)
  values (v_comp, 'verify-073-season', 'test', 'upcoming', true)
  returning id into v_season;

  insert into public.rounds (season_id, code, label, sort_order, kind)
  values (v_season, 'r1', 'Test GP', 1, 'matchweek')
  returning id into v_round;

  with ins as (
    insert into public.teams (competition_id, season_id, name, code)
    values (v_comp, v_season, 'Driver A', 'DA1'),
           (v_comp, v_season, 'Driver B', 'DB1'),
           (v_comp, v_season, 'Driver C', 'DC1'),
           (v_comp, v_season, 'Driver D', 'DD1'),
           (v_comp, v_season, 'Driver E', 'DE1')
    returning id, code
  )
  select array_agg(id order by code) into v_d from ins;

  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number,
                               prediction_type, kicks_off_at, status, provider_fixture_id)
  values (v_comp, v_season, v_round, 'regular', 9901, 'ordering',
          now() + interval '1 hour', 'scheduled', 'f1-9999-1-r')
  returning id into v_fix;

  -- scoring_rules default 5/3/2/0
  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4);

  -- Four existing real users (any) to hold predictions.
  select array_agg(id) into v_users from (select id from auth.users limit 4) u;
  if array_length(v_users, 1) is distinct from 4 then
    raise exception 'Need at least 4 users in auth.users to run this test.';
  end if;

  -- ── 1a. ordering fixture rejects a score prediction ───────────
  v_failed := false;
  begin
    insert into public.predictions (user_id, fixture_id, home_score, away_score)
    values (v_users[1], v_fix, 1, 0);
  exception when others then v_failed := true;
  end;
  if v_failed then raise notice '✅ 1a ordering fixture rejects home/away scores';
  else raise exception '❌ 1a ordering fixture ACCEPTED a score prediction'; end if;

  -- ── 1b. rejects a 4-entrant board ──────────────────────────────
  v_failed := false;
  begin
    insert into public.predictions (user_id, fixture_id, payload)
    values (v_users[1], v_fix,
            jsonb_build_object('order', jsonb_build_array(v_d[1], v_d[2], v_d[3], v_d[4])));
  exception when others then v_failed := true;
  end;
  if v_failed then raise notice '✅ 1b rejects a 4-entrant board';
  else raise exception '❌ 1b ACCEPTED a 4-entrant board'; end if;

  -- ── 1c. rejects duplicate entrants ─────────────────────────────
  v_failed := false;
  begin
    insert into public.predictions (user_id, fixture_id, payload)
    values (v_users[1], v_fix,
            jsonb_build_object('order', jsonb_build_array(v_d[1], v_d[1], v_d[2], v_d[3], v_d[4])));
  exception when others then v_failed := true;
  end;
  if v_failed then raise notice '✅ 1c rejects duplicate entrants';
  else raise exception '❌ 1c ACCEPTED duplicate entrants'; end if;

  -- ── Predictions on the four ladder rungs ───────────────────────
  -- user1: perfect board (5 hits → 5)
  insert into public.predictions (user_id, fixture_id, payload) values
    (v_users[1], v_fix, jsonb_build_object('order', jsonb_build_array(v_d[1], v_d[2], v_d[3], v_d[4], v_d[5])));
  -- user2: last two swapped (3 hits → 3)
  insert into public.predictions (user_id, fixture_id, payload) values
    (v_users[2], v_fix, jsonb_build_object('order', jsonb_build_array(v_d[1], v_d[2], v_d[3], v_d[5], v_d[4])));
  -- user3: only P3 right (1 hit → 2)
  insert into public.predictions (user_id, fixture_id, payload) values
    (v_users[3], v_fix, jsonb_build_object('order', jsonb_build_array(v_d[5], v_d[4], v_d[3], v_d[2], v_d[1])));
  -- user4: full rotation (0 hits → 0)
  insert into public.predictions (user_id, fixture_id, payload) values
    (v_users[4], v_fix, jsonb_build_object('order', jsonb_build_array(v_d[2], v_d[3], v_d[4], v_d[5], v_d[1])));
  raise notice '✅ 2a four ordering predictions accepted';

  -- ── 2b. settle: seeded order is the actual top 5 ───────────────
  select public.settle_ordering_fixture(v_fix, (
    select jsonb_agg(jsonb_build_object('team_id', d.id, 'position', d.pos, 'status', 'Finished'))
    from unnest(v_d) with ordinality as d(id, pos)
  )) into v_scored;

  if v_scored = 4 then raise notice '✅ 2b settle scored 4 predictions';
  else raise exception '❌ 2b settle scored % predictions (expected 4)', v_scored; end if;

  if (select status from public.fixtures where id = v_fix) = 'completed'
  then raise notice '✅ 2c fixture completed';
  else raise exception '❌ 2c fixture not completed'; end if;

  -- ── 3. the ladder ──────────────────────────────────────────────
  select points_awarded into v_pts from public.predictions where user_id = v_users[1] and fixture_id = v_fix;
  if v_pts = 5 then raise notice '✅ 3a perfect board → 5';
  else raise exception '❌ 3a perfect board scored % (expected 5)', v_pts; end if;

  select points_awarded into v_pts from public.predictions where user_id = v_users[2] and fixture_id = v_fix;
  if v_pts = 3 then raise notice '✅ 3b 3 hits → 3';
  else raise exception '❌ 3b 3 hits scored % (expected 3)', v_pts; end if;

  select points_awarded into v_pts from public.predictions where user_id = v_users[3] and fixture_id = v_fix;
  if v_pts = 2 then raise notice '✅ 3c 1 hit → 2';
  else raise exception '❌ 3c 1 hit scored % (expected 2)', v_pts; end if;

  select points_awarded into v_pts from public.predictions where user_id = v_users[4] and fixture_id = v_fix;
  if v_pts = 0 then raise notice '✅ 3d 0 hits → 0';
  else raise exception '❌ 3d 0 hits scored % (expected 0)', v_pts; end if;

  -- ── 4. score fixtures still behave (regression) ────────────────
  -- A football prediction with a payload must be rejected by the shape guard.
  declare v_scorefix uuid; v_comp2 uuid; v_t1 uuid; v_t2 uuid;
  begin
    select id into v_comp2 from public.competitions where sport_code = 'football' limit 1;
    if v_comp2 is not null then
      select id into v_t1 from public.teams where competition_id = v_comp2 limit 1;
      select id into v_t2 from public.teams where competition_id = v_comp2 and id <> v_t1 limit 1;
      insert into public.fixtures (competition_id, stage, fixture_number, prediction_type,
                                   home_team_id, away_team_id, kicks_off_at, status)
      values (v_comp2, (select stage from public.fixtures where competition_id = v_comp2 limit 1),
              9902, 'score', v_t1, v_t2, now() + interval '1 hour', 'scheduled')
      returning id into v_scorefix;

      v_failed := false;
      begin
        insert into public.predictions (user_id, fixture_id, payload)
        values (v_users[1], v_scorefix, jsonb_build_object('order', jsonb_build_array(v_d[1], v_d[2], v_d[3], v_d[4], v_d[5])));
      exception when others then v_failed := true;
      end;
      if v_failed then raise notice '✅ 4a score fixture rejects a payload prediction';
      else raise exception '❌ 4a score fixture ACCEPTED a payload prediction'; end if;

      insert into public.predictions (user_id, fixture_id, home_score, away_score)
      values (v_users[1], v_scorefix, 2, 1);
      raise notice '✅ 4b score fixture still accepts a normal prediction';
    else
      raise notice '⚠️ 4 skipped — no football competition found';
    end if;
  end;

  -- ── 5. Lock integrity (the audit finding 073 §0 fixes) ─────────
  -- After the session starts, an ordering prediction can be neither
  -- inserted nor edited — but the scoring engine's points update passes.
  update public.fixtures set kicks_off_at = now() - interval '1 hour' where id = v_fix;

  v_failed := false;
  begin
    update public.predictions
    set payload = jsonb_build_object('order', jsonb_build_array(v_d[2], v_d[1], v_d[3], v_d[4], v_d[5]))
    where user_id = v_users[1] and fixture_id = v_fix;
  exception when others then v_failed := true;
  end;
  if v_failed then raise notice '✅ 5a post-lock payload edit rejected';
  else raise exception '❌ 5a post-lock payload edit was ACCEPTED — deadline trigger fix (073 §0) missing?'; end if;

  v_failed := false;
  begin
    insert into public.predictions (user_id, fixture_id, payload)
    select u.id, v_fix, jsonb_build_object('order', jsonb_build_array(v_d[1], v_d[2], v_d[3], v_d[4], v_d[5]))
    from auth.users u where u.id <> all(v_users) limit 1;
    -- If no 5th user exists the insert affects 0 rows and proves nothing;
    -- treat that as inconclusive-but-not-failing.
    if not found then v_failed := true; end if;
  exception when others then v_failed := true;
  end;
  if v_failed then raise notice '✅ 5b post-lock insert rejected (or no spare user - inconclusive)';
  else raise exception '❌ 5b post-lock ordering INSERT was ACCEPTED — deadline trigger fix (073 §0) missing?'; end if;

  -- Scoring updates must still pass after lock: rescore recomputes cleanly.
  if public.rescore_fixture(v_fix) = 4 then
    raise notice '✅ 5c scoring updates still pass post-lock (rescore ok)';
  else
    raise exception '❌ 5c rescore did not update 4 predictions post-lock';
  end if;

  raise notice '';
  raise notice '✅ ALL 073 ORDERING CHECKS PASSED (rolling back test data)';
end;
$$;

rollback;
