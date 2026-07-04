-- SuperBrain: image storage (033) + network referral list (034). Paste once, Run.

-- ============================================================================
-- MIGRATION 033 — PROFILE IMAGE STORAGE (avatars + banners)
-- ============================================================================
-- Idempotent. Creates a public Storage bucket for user-uploaded avatar/banner
-- images and RLS on storage.objects so each user can only write inside their
-- own folder ({user_id}/...). Public read so images render anywhere.
--
-- Replaces the old developer-only "paste an https URL" fields with real uploads.
-- ============================================================================

-- Public bucket, 5 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images', 'profile-images', true, 5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Anyone can read (bucket is public; explicit select policy for clarity).
drop policy if exists "profile-images public read" on storage.objects;
create policy "profile-images public read"
  on storage.objects for select
  using (bucket_id = 'profile-images');

-- A user may write ONLY inside their own uid-named folder.
drop policy if exists "profile-images user insert" on storage.objects;
create policy "profile-images user insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile-images user update" on storage.objects;
create policy "profile-images user update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile-images user delete" on storage.objects;
create policy "profile-images user delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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
