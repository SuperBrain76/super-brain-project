-- ============================================================================
-- MIGRATION 034 — NETWORK: PER-INVITEE REFERRAL LIST
-- ============================================================================
-- Idempotent. Lets a user see exactly who they invited, each invitee's status
-- (Pending / Active / Elite), when they joined, and the IQ that invitee has
-- generated. SECURITY DEFINER, scoped to referrer_id = auth.uid(); never leaks
-- user_id or private profile fields.
--
-- Status:
--   pending  → referral not yet qualified
--   active   → qualified (invitee became active)
--   elite    → qualified AND invitee has earned ≥ network_elite_iq (config)
-- ============================================================================

insert into public.economy_config (key, value, description) values
  ('network_elite_iq', '1000'::jsonb, 'IQ an active invitee must have earned to count as an Elite referral')
on conflict (key) do nothing;

create or replace function public.get_my_referrals()
returns table (
  referred_name text,
  country       text,
  status        text,
  joined_at     timestamptz,
  qualified_at  timestamptz,
  iq_generated  bigint
)
language sql
stable
security definer set search_path = public
as $$
  with elite as (select public.economy_config_num('network_elite_iq', 1000) as t)
  select
    coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as referred_name,
    p.country,
    case
      when r.status <> 'qualified' then 'pending'
      when coalesce(gen.iq, 0) >= (select t from elite) then 'elite'
      else 'active'
    end as status,
    r.created_at   as joined_at,
    r.qualified_at as qualified_at,
    coalesce(gen.iq, 0)::bigint as iq_generated
  from public.referrals r
  left join public.user_profiles p on p.id = r.referred_user_id
  left join lateral (
    select sum(l.delta) as iq
    from public.economy_ledger l
    where l.user_id = r.referred_user_id
      and l.delta > 0
      and coalesce(l.event_code, '') <> 'referral_welcome'
  ) gen on true
  where r.referrer_id = auth.uid()
  order by
    case when r.status = 'qualified' then 0 else 1 end,
    coalesce(gen.iq, 0) desc,
    r.created_at desc;
$$;

grant execute on function public.get_my_referrals() to authenticated;
