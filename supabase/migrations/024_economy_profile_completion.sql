-- ============================================================================
-- MIGRATION 024 — ECONOMY: PROFILE COMPLETION
-- ============================================================================
-- Idempotent. Builds on 021_economy_core.sql.
--
-- Grants a one-time IQ reward the moment a user's profile_complete flips to
-- true. Trigger-driven on user_profiles (insert OR update) — no client change.
-- per_source on the user id + idempotency key guarantee it pays exactly once,
-- even if the flag is toggled off and on again.
-- ============================================================================

-- Earning rule for the "fill out your profile" action (distinct from the
-- career cognitive profile test, which uses career_profile_complete).
insert into public.economy_event_types
  (code, currency_code, description, base_amount, amount_map, cooldown_seconds, daily_cap, per_source, active)
values
  ('profile_complete', 'IQ', 'Completed account profile', 30, '{}'::jsonb, 0, null, true, true)
on conflict (code) do nothing;

create or replace function public.award_profile_completion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Fire only on the false→true transition (insert: treat missing OLD as false).
  if new.profile_complete is true
     and (tg_op = 'INSERT' or coalesce(old.profile_complete, false) = false) then
    begin
      perform public.economy_emit(
        new.id, 'profile_complete', new.id::text, null, null, '{}'::jsonb,
        'profile_complete:' || new.id::text
      );
    exception when others then
      raise warning 'economy profile_complete emit failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists economy_award_profile_complete_ins on public.user_profiles;
create trigger economy_award_profile_complete_ins
  after insert on public.user_profiles
  for each row execute function public.award_profile_completion();

drop trigger if exists economy_award_profile_complete_upd on public.user_profiles;
create trigger economy_award_profile_complete_upd
  after update of profile_complete on public.user_profiles
  for each row execute function public.award_profile_completion();
