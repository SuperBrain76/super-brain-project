-- ============================================================
-- MIGRATION 076 — Admin-gate rescore RPCs + search_path cleanup
--
-- 🔴 PRE-PRODUCTION SECURITY CLEANUP (26 Aug 2026).
--
-- Two independent fixes, both found in the privilege sanity audit:
--
--   1. rescore_fixture / rescore_competition are ADMIN tools (only the
--      /admin/fixtures page calls them, via adminRescoreFixture /
--      adminRescoreCompetition) but were granted to `authenticated` with NO
--      admin check — so any logged-in player could invoke them directly
--      through Supabase. Post-075 they can only recompute points to their
--      CORRECT values (no forgery), but administrative scoring/reconciliation
--      RPCs must not be player-invocable. This adds the same assert_admin()
--      gate every other admin RPC already uses (admin_set_fixture_result,
--      admin_create_competition, …): EXECUTE stays with `authenticated`
--      because that is the only role an admin's browser session has, and the
--      body rejects non-admins via the app_admins membership check. The admin
--      page keeps working; a direct call by a non-admin now raises.
--
--      rescore_fixture's body is otherwise IDENTICAL to migration 073 (the
--      ordering-routing version); rescore_competition's loop is unchanged.
--      auth.uid() persists across the nested SECURITY DEFINER call, so
--      rescore_competition → rescore_fixture still passes for an admin.
--
--   2. get_leaderboard and get_all_feedback are SECURITY DEFINER but lacked
--      an explicit search_path (a definer function without one is a general
--      privilege-escalation surface). Re-declared verbatim — SAME body, SAME
--      grants — with `set search_path = public` added. No behaviour change.
--
-- DEPENDS ON: 049 (assert_admin / app_admins), 073 (rescore_fixture ordering).
-- SAFE TO RE-RUN: yes (create or replace).
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. rescore_fixture — admin-gated (073 body + assert_admin) ──

create or replace function public.rescore_fixture(p_fixture_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_type      text;
  actual_home integer;
  actual_away integer;
begin
  perform public.assert_admin();

  select prediction_type, home_score, away_score
    into v_type, actual_home, actual_away
  from public.fixtures where id = p_fixture_id;

  if v_type = 'ordering' then
    if not exists (
      select 1 from public.fixture_entrant_results
      where fixture_id = p_fixture_id and position between 1 and 5
    ) then
      raise exception 'Cannot rescore: fixture % has no classification yet.', p_fixture_id;
    end if;
    return public.apply_ordering_scoring(p_fixture_id);
  end if;

  if actual_home is null or actual_away is null then
    raise exception 'Cannot rescore: fixture % has no result yet.', p_fixture_id;
  end if;

  return public.apply_fixture_scoring(p_fixture_id);
end;
$$;

grant execute on function public.rescore_fixture(uuid) to authenticated;


-- ── 2. rescore_competition — admin-gated (unchanged loop) ──────

create or replace function public.rescore_competition(p_competition_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  fix           record;
  total_updated integer := 0;
  batch_updated integer;
begin
  perform public.assert_admin();

  for fix in
    select id, home_score, away_score
    from public.fixtures
    where competition_id = p_competition_id
      and home_score is not null
      and away_score is not null
  loop
    select public.rescore_fixture(fix.id) into batch_updated;
    total_updated := total_updated + batch_updated;
  end loop;

  return total_updated;
end;
$$;

grant execute on function public.rescore_competition(uuid) to authenticated;


-- ── 3. search_path on two legacy SECURITY DEFINER read RPCs ────
-- Verbatim bodies from migration 001; only `set search_path = public` added.
-- Grants restated exactly as 001 to keep this migration self-contained and
-- idempotent (no permission change).

create or replace function public.get_all_feedback()
returns table (
  id              uuid,
  created_at      timestamptz,
  test_name       text,
  score           integer,
  result_title    text,
  felt_options    text[],
  would_share     text,
  almost_quit     text,
  test_suggestion text,
  user_id         uuid
)
language sql
security definer
stable
set search_path = public
as $$
  select
    id, created_at, test_name, score, result_title,
    felt_options, would_share, almost_quit, test_suggestion, user_id
  from public.test_feedback
  order by created_at desc
  limit 500;
$$;

revoke execute on function public.get_all_feedback from anon;
grant  execute on function public.get_all_feedback to authenticated;


create or replace function public.get_leaderboard(
  filter_test_name text default null,
  filter_country   text default null
)
returns table (
  rank         bigint,
  test_name    text,
  score        integer,
  percentile   integer,
  result_title text,
  display_name text,
  country      text
)
language sql
security definer
stable
set search_path = public
as $$
  with best_per_user as (
    select distinct on (r.user_id, r.test_name)
      r.user_id,
      r.test_name,
      r.score,
      r.percentile,
      r.result_title
    from public.test_results r
    where (filter_test_name is null or r.test_name = filter_test_name)
    order by r.user_id, r.test_name, r.score desc, r.created_at asc
  )
  select
    row_number() over (order by b.score desc) as rank,
    b.test_name,
    b.score,
    b.percentile,
    b.result_title,
    coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
    p.country
  from best_per_user b
  left join public.user_profiles p on p.id = b.user_id
  where (filter_country is null or p.country = filter_country)
  order by b.score desc
  limit 100;
$$;

grant execute on function public.get_leaderboard to anon, authenticated;


insert into public.schema_migrations (version, name, notes)
values ('076', 'rescore_admin_only',
        'assert_admin() gate on rescore_fixture/rescore_competition (were '
        'player-invocable); explicit search_path on get_leaderboard and '
        'get_all_feedback. No behaviour/permission change to the read RPCs.')
on conflict (version) do nothing;

do $$
begin
  raise notice 'Migration 076 applied.';
  raise notice 'ACCEPTANCE: a non-admin authenticated caller of rescore_fixture';
  raise notice 'gets "Admin privileges required."; an app_admins member (the';
  raise notice '/admin/fixtures user) still rescores successfully.';
end;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- Re-apply migration 073's rescore_fixture (no assert_admin) and
-- predictor-schema.sql's rescore_competition; re-apply migration 001's
-- get_all_feedback / get_leaderboard (no search_path). No stored data is
-- touched by any of these definitions.
-- ============================================================
