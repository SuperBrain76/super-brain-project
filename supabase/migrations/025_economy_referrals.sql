-- ============================================================================
-- MIGRATION 025 — ECONOMY: REFERRAL ENGINE
-- ============================================================================
-- Idempotent. Builds on 021_economy_core.sql + 022 (economy_config).
--
-- Philosophy: reward ACTIVE, QUALIFIED referrals — never bare registrations.
--   1. Each user has a stable referral code (get_my_referral_code).
--   2. A new user attaches a code once (economy_attach_referral) → a 'pending'
--      referral row + a small welcome gift to the NEW user.
--   3. The referrer is paid ONLY once the referred user has EARNED enough IQ
--      through real activity (referral_qualify_iq, excluding the welcome gift).
--      Qualification is evaluated by economy_qualify_referrals, called from the
--      central activity orchestrator (migration 027) on every earning event.
-- ============================================================================

-- ── TABLES ──────────────────────────────────────────────────────────────────
create table if not exists public.referral_codes (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  code       text        not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id               uuid        primary key default gen_random_uuid(),
  referrer_id      uuid        not null references auth.users(id) on delete cascade,
  referred_user_id uuid        not null unique references auth.users(id) on delete cascade,
  code             text        not null,
  status           text        not null default 'pending'
                     check (status in ('pending','qualified','rejected')),
  created_at       timestamptz not null default now(),
  qualified_at     timestamptz,
  check (referrer_id <> referred_user_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
create index if not exists referrals_status_idx   on public.referrals (status);

alter table public.referral_codes enable row level security;
alter table public.referrals      enable row level security;

drop policy if exists "referral code read own" on public.referral_codes;
create policy "referral code read own"
  on public.referral_codes for select to authenticated using (auth.uid() = user_id);

-- A referrer may see their referrals; a referred user may see their own row.
drop policy if exists "referrals read own" on public.referrals;
create policy "referrals read own"
  on public.referrals for select to authenticated
  using (auth.uid() = referrer_id or auth.uid() = referred_user_id);
-- all writes via SECURITY DEFINER RPCs only

-- ── EARNING RULES ───────────────────────────────────────────────────────────
insert into public.economy_event_types
  (code, currency_code, description, base_amount, amount_map, cooldown_seconds, daily_cap, per_source, active)
values
  ('referral_welcome',   'IQ', 'Welcome bonus for joining via a referral', 25, '{}'::jsonb, 0, null, true, true),
  ('referral_qualified', 'IQ', 'Referred user became active',              100,'{}'::jsonb, 0, null, true, true)
on conflict (code) do update set base_amount = excluded.base_amount;
-- (referral_qualified was seeded in 021; upsert keeps a single source of truth)


-- ── RPC: get_my_referral_code (creates one on first call) ───────────────────
create or replace function public.get_my_referral_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  c    text;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select code into c from public.referral_codes where user_id = uid;
  if c is not null then return c; end if;

  -- Generate a short, unique, unambiguous code. Retry on the rare collision.
  for i in 1..10 loop
    c := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=lIO01', 'XYZABCDEF'), 1, 7));
    begin
      insert into public.referral_codes (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      -- code or user race — re-check user, else retry with a new code
      select code into c from public.referral_codes where user_id = uid;
      if c is not null then return c; end if;
    end;
  end loop;
  raise exception 'could not allocate referral code';
end;
$$;
grant execute on function public.get_my_referral_code() to authenticated;


-- ── RPC: economy_attach_referral ────────────────────────────────────────────
-- Called by a new user (client) once, e.g. right after signup with a code.
-- Creates the pending referral + grants the welcome gift. Returns true if
-- attached, false if ineligible (self-referral, unknown code, already referred).
create or replace function public.economy_attach_referral(p_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  ref_owner uuid;
  norm      text := upper(trim(p_code));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if norm is null or norm = '' then return false; end if;

  -- Already referred? (referred_user_id is unique) — one attribution per user.
  if exists (select 1 from public.referrals where referred_user_id = uid) then
    return false;
  end if;

  select user_id into ref_owner from public.referral_codes where code = norm;
  if ref_owner is null or ref_owner = uid then
    return false;                      -- unknown code or self-referral
  end if;

  insert into public.referrals (referrer_id, referred_user_id, code, status)
  values (ref_owner, uid, norm, 'pending')
  on conflict (referred_user_id) do nothing;

  -- Welcome gift to the newcomer (does NOT count toward their qualification).
  begin
    perform public.economy_emit(
      uid, 'referral_welcome', uid::text, null, null,
      jsonb_build_object('referrer', ref_owner), 'referral_welcome:' || uid::text
    );
  exception when others then
    raise warning 'referral_welcome emit failed for %: %', uid, sqlerrm;
  end;

  return true;
end;
$$;
grant execute on function public.economy_attach_referral(text) to authenticated;


-- ── FUNCTION: economy_qualify_referrals (internal) ──────────────────────────
-- If the given user has a pending referral and has now EARNED enough IQ through
-- real activity (excluding the welcome gift and referral rewards), promote the
-- referral to 'qualified' and pay the referrer. Idempotent.
create or replace function public.economy_qualify_referrals(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  threshold  numeric := public.economy_config_num('referral_qualify_iq', 50);
  earned     bigint;
  ref        record;
begin
  if p_user_id is null then return; end if;

  -- Fast exit: nothing pending for this user.
  select * into ref from public.referrals
  where referred_user_id = p_user_id and status = 'pending'
  for update skip locked;
  if not found then return; end if;

  -- "Active" = IQ earned from genuine activity, excluding gifts/referral payouts.
  select coalesce(sum(delta), 0) into earned
  from public.economy_ledger
  where user_id = p_user_id
    and delta > 0
    and coalesce(event_code, '') not in ('referral_welcome', 'referral_qualified');

  if earned < threshold then return; end if;

  update public.referrals
    set status = 'qualified', qualified_at = now()
  where id = ref.id and status = 'pending';

  -- Reward the referrer (idempotent on the referral id).
  perform public.economy_emit(
    ref.referrer_id, 'referral_qualified', ref.id::text, null, null,
    jsonb_build_object('referred_user', p_user_id),
    'referral_qualified:' || ref.id::text
  );

  -- Let the referrer's own achievements (e.g. "Connector") react immediately.
  begin
    perform public.economy_check_achievements(ref.referrer_id);
  exception when undefined_function then
    null;   -- achievements module (026) not yet installed; safe to skip
  end;
end;
$$;
revoke all on function public.economy_qualify_referrals(uuid) from public, anon, authenticated;


-- ── READ RPC: get_my_referral_stats ─────────────────────────────────────────
create or replace function public.get_my_referral_stats()
returns table (total integer, qualified integer, pending integer, earned_iq bigint)
language sql stable security definer set search_path = public
as $$
  select
    count(*)::integer,
    count(*) filter (where status = 'qualified')::integer,
    count(*) filter (where status = 'pending')::integer,
    coalesce((select sum(delta) from public.economy_ledger
              where user_id = auth.uid() and event_code = 'referral_qualified'), 0)::bigint
  from public.referrals where referrer_id = auth.uid();
$$;
grant execute on function public.get_my_referral_stats() to authenticated;
