-- ============================================================================
-- MIGRATION 035 — NEW-USER ONBOARDING STATUS
-- ============================================================================
-- Idempotent. Backs the /welcome onboarding flow. Step completion is DERIVED
-- from real data (no per-step flags to drift): avatar set, profile complete,
-- first reward claimed, a test taken, a prediction made. A single
-- onboarding_completed_at timestamp records finished/skipped.
-- ============================================================================

alter table public.user_profiles
  add column if not exists onboarding_completed_at timestamptz;

create or replace function public.get_onboarding_status()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  prof       record;
  cur        record;
  earned     bigint := 0;
  ref_code   text;
  has_test   boolean := false;
  has_pred   boolean := false;
  has_reward boolean := false;
begin
  if uid is null then return jsonb_build_object('authenticated', false); end if;

  select * into prof from public.user_profiles where id = uid;
  select * into cur from public.economy_currencies where active order by (code = 'IQ') desc, code limit 1;

  if cur.code is not null then
    select coalesce(sum(delta), 0) into earned
    from public.economy_ledger where user_id = uid and delta > 0 and currency_code = cur.code;
  end if;

  select exists (select 1 from public.test_results where user_id = uid) into has_test;
  select exists (select 1 from public.predictions where user_id = uid) into has_pred;
  select exists (
    select 1 from public.economy_ledger
    where user_id = uid and event_code in ('daily_login', 'daily_streak')
  ) into has_reward;

  select code into ref_code from public.referral_codes where user_id = uid;

  return jsonb_build_object(
    'authenticated', true,
    'completed_at', prof.onboarding_completed_at,
    'currency', jsonb_build_object('code', cur.code, 'symbol', cur.symbol),
    'iq_earned', earned,
    'username', prof.username,
    'referral_code', ref_code,
    'steps', jsonb_build_object(
      'avatar',     (prof.avatar_url is not null and prof.avatar_url <> ''),
      'profile',    coalesce(prof.profile_complete, false),
      'reward',     has_reward,
      'test',       has_test,
      'prediction', has_pred
    )
  );
end;
$$;
grant execute on function public.get_onboarding_status() to authenticated;

-- Mark onboarding finished/skipped (first call wins).
create or replace function public.set_onboarding_done()
returns void
language sql
security definer set search_path = public
as $$
  update public.user_profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
         updated_at = now()
   where id = auth.uid();
$$;
grant execute on function public.set_onboarding_done() to authenticated;
