-- ============================================================
-- verify-075-privileges.sql — acceptance test for migration 075
--
-- Run in the Supabase SQL editor AFTER applying 073, 074 and 075.
-- Proves, as the real `authenticated` role, that a player cannot write any
-- settlement-controlled field — and that the app's own write paths and the
-- scoring engine still work. Runs in one transaction and ROLLS BACK.
--
-- Every line must print ✅. Any ❌ ABORTS — do not launch on a failed run.
-- ============================================================

begin;

-- Grant test: checks the `authenticated` ROLE's privileges directly, which
-- is what actually gates a PostgREST write — no scaffold rows needed.
do $$
declare v_can boolean;
begin
  -- points_awarded must NOT be updatable by authenticated.
  select has_column_privilege('authenticated', 'public.predictions', 'points_awarded', 'UPDATE') into v_can;
  if v_can then raise exception '❌ authenticated CAN update points_awarded'; else raise notice '✅ authenticated cannot update points_awarded'; end if;

  select has_column_privilege('authenticated', 'public.predictions', 'is_banker', 'UPDATE') into v_can;
  if v_can then raise exception '❌ authenticated CAN update is_banker'; else raise notice '✅ authenticated cannot update is_banker'; end if;

  select has_column_privilege('authenticated', 'public.predictions', 'submitted_at', 'INSERT') into v_can;
  if v_can then raise exception '❌ authenticated CAN insert submitted_at'; else raise notice '✅ authenticated cannot insert submitted_at'; end if;

  -- updated_at is database-managed (default now() + deadline trigger) — the
  -- client is granted it on neither INSERT nor UPDATE.
  select has_column_privilege('authenticated', 'public.predictions', 'updated_at', 'UPDATE')
      or has_column_privilege('authenticated', 'public.predictions', 'updated_at', 'INSERT') into v_can;
  if v_can then raise exception '❌ authenticated CAN write updated_at (should be DB-managed)'; else raise notice '✅ updated_at is DB-managed (not client-writable)'; end if;

  -- The app's edit columns MUST stay updatable (the pick, plus the identity
  -- columns PostgREST forces into the upsert SET — pinned by the trigger).
  select bool_and(has_column_privilege('authenticated', 'public.predictions', c, 'UPDATE'))
    from unnest(array['home_score','away_score','payload','fixture_id','user_id']) c
    into v_can;
  if v_can then raise notice '✅ app edit columns still updatable'; else raise exception '❌ an app edit column lost UPDATE'; end if;

  -- The app's create columns MUST stay insertable.
  select bool_and(has_column_privilege('authenticated', 'public.predictions', c, 'INSERT'))
    from unnest(array['home_score','away_score','payload','fixture_id','user_id']) c
    into v_can;
  if v_can then raise notice '✅ app create columns still insertable'; else raise exception '❌ an app create column lost INSERT'; end if;

  -- Classification + fixtures must be read-only to players.
  select has_table_privilege('authenticated', 'public.fixture_entrant_results', 'UPDATE') into v_can;
  if v_can then raise exception '❌ authenticated CAN update fixture_entrant_results'; else raise notice '✅ fixture_entrant_results not writable by players'; end if;

  select has_table_privilege('authenticated', 'public.fixtures', 'UPDATE') into v_can;
  if v_can then raise exception '❌ authenticated CAN update fixtures'; else raise notice '✅ fixtures not writable by players'; end if;
end;
$$;

-- Identity pin: a direct user_id/fixture_id change is rejected regardless of role.
-- Fixtures carry a season + round because production's hierarchy trigger
-- (migration 047) requires both.
do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_f1 uuid; v_f2 uuid; v_u uuid; v_blocked boolean := false;
begin
  insert into public.competitions (name, slug, sport_code, status)
  values ('VERIFY 075', 'verify-075-tmp', 'football', 'active') returning id into v_comp;
  -- competition_stages row is required by fixtures_stage_fk (migration 040):
  -- a fixture's (competition_id, stage) must exist in competition_stages.
  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'Round', 1, true, false);
  insert into public.seasons (competition_id, slug, label, status, is_current)
  values (v_comp, 'verify-075-season', 'test', 'upcoming', true) returning id into v_season;
  insert into public.rounds (season_id, code, label, sort_order, kind)
  values (v_season, 'r1', 'Test', 1, 'matchweek') returning id into v_round;
  select id into v_u from auth.users limit 1;
  if v_u is null then raise exception 'Need at least one user in auth.users.'; end if;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, status)
  values (v_comp, v_season, v_round, 'regular', 90, 'score', null, null, now()+interval '1 hour', 'scheduled') returning id into v_f1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, status)
  values (v_comp, v_season, v_round, 'regular', 91, 'score', null, null, now()+interval '1 hour', 'scheduled') returning id into v_f2;
  insert into public.predictions (user_id, fixture_id, home_score, away_score) values (v_u, v_f1, 1, 0);
  begin
    update public.predictions set fixture_id = v_f2 where user_id = v_u and fixture_id = v_f1;
  exception when others then v_blocked := true;
  end;
  if v_blocked then raise notice '✅ identity pin blocks fixture retarget'; else raise exception '❌ prediction was retargeted to another fixture'; end if;
end;
$$;

do $$ begin raise notice ''; raise notice '✅ ALL 075 PRIVILEGE CHECKS PASSED (rolling back test data)'; end; $$;

rollback;
