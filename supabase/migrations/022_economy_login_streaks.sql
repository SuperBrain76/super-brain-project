-- ============================================================================
-- MIGRATION 022 — ECONOMY: SHARED CONFIG + DAILY LOGIN & STREAKS
-- ============================================================================
-- Idempotent. Builds on 021_economy_core.sql.
--
-- Adds:
--   • economy_config      — global scalar tunables (data-driven, no deploy).
--   • user_streaks        — per-user login streak state.
--   • economy_daily_checkin() — the single client entry point for the daily
--     login + streak pillar. Mints daily_login IQ + streak-milestone IQ.
--
-- Retention over signups: login itself pays a little; the STREAK compounds via
-- milestone bonuses that are entirely configuration (economy_event_types.amount_map).
-- ============================================================================


-- ── SHARED CONFIG (reusable across all pillars) ─────────────────────────────
create table if not exists public.economy_config (
  key         text        primary key,
  value       jsonb       not null,
  description text        not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.economy_config enable row level security;
drop policy if exists "economy config public read" on public.economy_config;
create policy "economy config public read"
  on public.economy_config for select to anon, authenticated using (true);

-- Numeric config reader with fallback. Reused by referrals, achievements, etc.
create or replace function public.economy_config_num(p_key text, p_default numeric default 0)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select (value #>> '{}')::numeric from public.economy_config where key = p_key), p_default);
$$;

insert into public.economy_config (key, value, description) values
  ('referral_qualify_iq', '50'::jsonb, 'IQ a referred user must EARN (excl. welcome gift) before their referrer is rewarded'),
  ('referral_welcome_iq', '25'::jsonb, 'One-time welcome IQ granted to a newly-referred user on attach')
on conflict (key) do nothing;


-- ── STREAK STATE ────────────────────────────────────────────────────────────
create table if not exists public.user_streaks (
  user_id        uuid        primary key references auth.users(id) on delete cascade,
  current_streak integer     not null default 0,
  longest_streak integer     not null default 0,
  total_checkins integer     not null default 0,
  last_checkin   date,
  updated_at     timestamptz not null default now()
);

alter table public.user_streaks enable row level security;
drop policy if exists "streaks read own" on public.user_streaks;
create policy "streaks read own"
  on public.user_streaks for select to authenticated using (auth.uid() = user_id);
-- writes happen only inside economy_daily_checkin (SECURITY DEFINER)


-- ── STREAK EARNING RULE (data-driven milestones) ────────────────────────────
-- base_amount = per-day continuation bonus; amount_map = milestone bonuses keyed
-- by the streak-day reached. Tune freely by UPDATE — no code change.
insert into public.economy_event_types
  (code, currency_code, description, base_amount, amount_map, cooldown_seconds, daily_cap, per_source, active)
values
  ('daily_streak', 'IQ', 'Login streak bonus', 2,
    '{"3":20,"7":50,"14":120,"30":300,"60":600,"100":1200,"365":5000}'::jsonb,
    0, null, false, true)
on conflict (code) do nothing;


-- ── RPC: economy_daily_checkin ──────────────────────────────────────────────
-- Client calls this once per app session. Idempotent per UTC day.
create or replace function public.economy_daily_checkin()
returns table (
  current_streak     integer,
  longest_streak     integer,
  minted_login       bigint,
  minted_streak      bigint,
  already_checked_in boolean
)
language plpgsql
security definer set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  today      date := (now() at time zone 'utc')::date;
  st         public.user_streaks%rowtype;
  new_streak integer;
  m_login    bigint := 0;
  m_streak   bigint := 0;
  streak_amt bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into st from public.user_streaks where user_id = uid for update;

  -- Already checked in today → report state, mint nothing.
  if st.user_id is not null and st.last_checkin = today then
    return query select st.current_streak, st.longest_streak, 0::bigint, 0::bigint, true;
    return;
  end if;

  -- Compute new streak: consecutive day continues, gap resets.
  if st.user_id is null then
    new_streak := 1;
  elsif st.last_checkin = today - 1 then
    new_streak := st.current_streak + 1;
  else
    new_streak := 1;
  end if;

  insert into public.user_streaks (user_id, current_streak, longest_streak, total_checkins, last_checkin, updated_at)
  values (uid, new_streak, greatest(new_streak, 1), 1, today, now())
  on conflict (user_id) do update set
    current_streak = new_streak,
    longest_streak = greatest(public.user_streaks.longest_streak, new_streak),
    total_checkins = public.user_streaks.total_checkins + 1,
    last_checkin   = today,
    updated_at     = now();

  -- Daily login IQ (once per UTC day via idempotency key).
  m_login := public.economy_emit(
    uid, 'daily_login', null, null, null, '{}'::jsonb,
    'daily_login:' || uid::text || ':' || today::text
  );

  -- Streak bonus: milestone if configured, else the continuation base_amount.
  select coalesce((amount_map ->> new_streak::text)::bigint, base_amount)
    into streak_amt
  from public.economy_event_types where code = 'daily_streak';

  m_streak := public.economy_emit(
    uid, 'daily_streak', uid::text || ':' || today::text, streak_amt, null,
    jsonb_build_object('streak', new_streak),
    'daily_streak:' || uid::text || ':' || today::text
  );

  return query select new_streak, greatest(new_streak, 1), m_login, m_streak, false;
end;
$$;

grant execute on function public.economy_daily_checkin() to authenticated;

-- Read helper for the signed-in user's streak.
create or replace function public.get_my_streak()
returns table (current_streak integer, longest_streak integer, total_checkins integer, last_checkin date)
language sql stable security definer set search_path = public
as $$
  select current_streak, longest_streak, total_checkins, last_checkin
  from public.user_streaks where user_id = auth.uid();
$$;
grant execute on function public.get_my_streak() to authenticated;
