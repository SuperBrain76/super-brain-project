-- ============================================================================
-- MIGRATION 031 — DAILY MISSIONS ENGINE
-- ============================================================================
-- Idempotent. Builds on 021–030.
--
-- Fully CONFIGURATION-DRIVEN missions: each mission is a row in `missions`.
-- Add / remove / retune a mission by INSERT / UPDATE / DELETE — no code deploy.
-- Supports daily, weekly, and event (windowed / one-time) cadences.
--
-- Progress is DERIVED on read from the single source of truth (economy_ledger)
-- plus a few source tables — no per-tick writes. Because every earning action
-- funnels through economy_ledger with an event_code, an `event_count` /
-- `event_sum` mission over ANY event_code makes every current and FUTURE economy
-- event mission-able through config alone.
--
-- Completion = progress ≥ target. Claiming persists in `mission_claims` (one per
-- user × mission × period) and mints the reward via economy_emit (idempotent).
-- ============================================================================

-- ── MISSION DEFINITIONS (config) ────────────────────────────────────────────
create table if not exists public.missions (
  code            text        primary key,
  title           text        not null,
  description     text        not null default '',
  icon            text        not null default '🎯',
  cadence         text        not null default 'daily' check (cadence in ('daily','weekly','event')),
  requirement     jsonb       not null,          -- {type, event|events, distinct}
  target          numeric     not null default 1,
  reward_currency text        not null default 'IQ' references public.economy_currencies(code),
  reward_amount   bigint      not null default 0,
  starts_at       timestamptz,                    -- event missions (null = always)
  ends_at         timestamptz,
  sort            integer     not null default 0,
  active          boolean     not null default true,
  created_at      timestamptz not null default now()
);

-- ── CLAIM LEDGER (per user × mission × period) ──────────────────────────────
create table if not exists public.mission_claims (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  mission_code text        not null references public.missions(code) on delete cascade,
  period_key   text        not null,             -- '2026-07-04' | '2026W27' | 'event'
  amount       bigint      not null default 0,
  claimed_at   timestamptz not null default now(),
  primary key (user_id, mission_code, period_key)
);
create index if not exists mission_claims_user_idx on public.mission_claims (user_id);

alter table public.missions       enable row level security;
alter table public.mission_claims enable row level security;

drop policy if exists "missions public read" on public.missions;
create policy "missions public read" on public.missions for select to anon, authenticated using (true);

drop policy if exists "mission claims read own" on public.mission_claims;
create policy "mission claims read own" on public.mission_claims for select to authenticated using (auth.uid() = user_id);

-- Reward event (amount comes from the mission row via override).
insert into public.economy_event_types
  (code, currency_code, description, base_amount, amount_map, cooldown_seconds, daily_cap, per_source, active)
values
  ('mission_reward', 'IQ', 'Mission reward', 0, '{}'::jsonb, 0, null, false, true)
on conflict (code) do nothing;


-- ── MEASUREMENT (data-driven progress within a window) ──────────────────────
-- Supported requirement types (extend here to add a new measurable metric;
-- new MISSIONS never need code — only new metric *types* do):
--   {"type":"event_count","event":"prediction_score"}  ledger rows (delta>0)
--   {"type":"event_count","events":["a","b"]}          any of several events
--   {"type":"event_sum","event":"daily_streak"}        sum of deltas
--   {"type":"iq_earned"}                               sum of positive deltas
--   {"type":"predictions_made"}                        predictions submitted
--   {"type":"tests_completed","distinct":"true"}       cognitive tests taken
--   {"type":"profile_complete"}                        1 when profile complete
--   {"type":"referrals_qualified"}                     active referrals gained
create or replace function public._mission_progress(
  p_user uuid, p_req jsonb, p_since timestamptz, p_until timestamptz, p_currency text
)
returns numeric
language plpgsql
stable
security definer set search_path = public
as $$
declare
  t   text := p_req ->> 'type';
  evs text[];
  val numeric := 0;
begin
  if t is null or p_user is null then return 0; end if;

  if p_req ? 'events' then
    select array_agg(x) into evs from jsonb_array_elements_text(p_req -> 'events') x;
  elsif (p_req ->> 'event') is not null then
    evs := array[p_req ->> 'event'];
  end if;

  if t = 'event_count' then
    select count(*) into val from public.economy_ledger
    where user_id = p_user and delta > 0 and created_at >= p_since and created_at <= p_until
      and (evs is null or event_code = any(evs));

  elsif t = 'event_sum' then
    select coalesce(sum(delta), 0) into val from public.economy_ledger
    where user_id = p_user and created_at >= p_since and created_at <= p_until
      and (evs is null or event_code = any(evs));

  elsif t = 'iq_earned' then
    select coalesce(sum(delta), 0) into val from public.economy_ledger
    where user_id = p_user and delta > 0 and currency_code = p_currency
      and created_at >= p_since and created_at <= p_until;

  elsif t = 'predictions_made' then
    select count(*) into val from public.predictions
    where user_id = p_user and submitted_at >= p_since and submitted_at <= p_until;

  elsif t = 'tests_completed' then
    if coalesce(p_req ->> 'distinct', '') = 'true' then
      select count(distinct test_name) into val from public.test_results
      where user_id = p_user and created_at >= p_since and created_at <= p_until;
    else
      select count(*) into val from public.test_results
      where user_id = p_user and created_at >= p_since and created_at <= p_until;
    end if;

  elsif t = 'profile_complete' then
    select case when profile_complete then 1 else 0 end into val
    from public.user_profiles where id = p_user;

  elsif t = 'referrals_qualified' then
    select count(*) into val from public.referrals
    where referrer_id = p_user and status = 'qualified'
      and qualified_at >= p_since and qualified_at <= p_until;

  else
    val := 0;
  end if;

  return coalesce(val, 0);
end;
$$;
revoke all on function public._mission_progress(uuid, jsonb, timestamptz, timestamptz, text) from public, anon, authenticated;


-- ── Period helpers (inline in RPCs; kept here for reference) ────────────────
-- daily  → since = UTC midnight,     period_key = 'YYYY-MM-DD'
-- weekly → since = ISO week Monday,  period_key = 'IYYY"W"IW'  (e.g. 2026W27)
-- event  → since = starts_at|-inf,   period_key = 'event'  (claim once per window)


-- ── RPC: get_missions ───────────────────────────────────────────────────────
create or replace function public.get_missions(p_currency text default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  cur     record;
  m       record;
  utcnow  timestamp := now() at time zone 'utc';
  since   timestamptz;
  pkey    text;
  prog    numeric;
  claimed boolean;
  arr     jsonb := '[]'::jsonb;
begin
  if uid is null then return jsonb_build_object('authenticated', false); end if;

  select * into cur from public.economy_currencies
  where active and code = coalesce(p_currency, code) order by (code = 'IQ') desc, code limit 1;

  for m in
    select * from public.missions where active
    order by case cadence when 'daily' then 0 when 'weekly' then 1 else 2 end, sort, code
  loop
    if m.cadence = 'daily' then
      since := date_trunc('day', utcnow) at time zone 'utc';
      pkey  := to_char(utcnow, 'YYYY-MM-DD');
    elsif m.cadence = 'weekly' then
      since := date_trunc('week', utcnow) at time zone 'utc';
      pkey  := to_char(utcnow, 'IYYY"W"IW');
    else
      if (m.starts_at is not null and now() < m.starts_at)
         or (m.ends_at is not null and now() > m.ends_at) then
        continue;                                   -- outside event window
      end if;
      since := coalesce(m.starts_at, '-infinity'::timestamptz);
      pkey  := 'event';
    end if;

    prog := public._mission_progress(uid, m.requirement, since, now(), cur.code);
    claimed := exists (
      select 1 from public.mission_claims c
      where c.user_id = uid and c.mission_code = m.code and c.period_key = pkey
    );

    arr := arr || jsonb_build_object(
      'code', m.code, 'title', m.title, 'description', m.description, 'icon', m.icon,
      'cadence', m.cadence, 'target', m.target,
      'progress', least(prog, m.target), 'raw_progress', prog,
      'completed', prog >= m.target, 'claimed', claimed,
      'reward', jsonb_build_object('amount', m.reward_amount, 'currency', m.reward_currency),
      'period_key', pkey
    );
  end loop;

  return jsonb_build_object(
    'authenticated', true,
    'currency', jsonb_build_object('code', cur.code, 'name', cur.name, 'symbol', cur.symbol),
    'missions', arr
  );
end;
$$;
grant execute on function public.get_missions(text) to authenticated;


-- ── RPC: claim_mission ──────────────────────────────────────────────────────
create or replace function public.claim_mission(p_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  m      record;
  utcnow timestamp := now() at time zone 'utc';
  since  timestamptz;
  pkey   text;
  prog   numeric;
  amt    bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into m from public.missions where code = p_code and active;
  if not found then return jsonb_build_object('claimed', false, 'error', 'unknown mission'); end if;

  if m.cadence = 'daily' then
    since := date_trunc('day', utcnow) at time zone 'utc';
    pkey  := to_char(utcnow, 'YYYY-MM-DD');
  elsif m.cadence = 'weekly' then
    since := date_trunc('week', utcnow) at time zone 'utc';
    pkey  := to_char(utcnow, 'IYYY"W"IW');
  else
    if (m.starts_at is not null and now() < m.starts_at)
       or (m.ends_at is not null and now() > m.ends_at) then
      return jsonb_build_object('claimed', false, 'error', 'mission not active');
    end if;
    since := coalesce(m.starts_at, '-infinity'::timestamptz);
    pkey  := 'event';
  end if;

  if exists (select 1 from public.mission_claims where user_id = uid and mission_code = m.code and period_key = pkey) then
    return jsonb_build_object('claimed', false, 'error', 'already claimed');
  end if;

  prog := public._mission_progress(uid, m.requirement, since, now(), coalesce(m.reward_currency, 'IQ'));
  if prog < m.target then
    return jsonb_build_object('claimed', false, 'error', 'not complete', 'progress', prog, 'target', m.target);
  end if;

  amt := public.economy_emit(
    uid, 'mission_reward', m.code || ':' || pkey, m.reward_amount, null,
    jsonb_build_object('mission', m.code, 'period', pkey),
    'mission:' || m.code || ':' || pkey
  );

  insert into public.mission_claims (user_id, mission_code, period_key, amount)
  values (uid, m.code, pkey, amt)
  on conflict do nothing;

  return jsonb_build_object('claimed', true, 'amount', amt, 'mission', m.code);
end;
$$;
grant execute on function public.claim_mission(text) to authenticated;


-- ── SEED: starter mission set (all data — tunable / removable) ──────────────
insert into public.missions (code, title, description, icon, cadence, requirement, target, reward_amount, sort) values
  -- DAILY
  ('daily_login',      'Show Up',        'Log in today to keep your momentum.',        '☀️', 'daily',
     '{"type":"event_count","event":"daily_login"}'::jsonb, 1, 10, 10),
  ('daily_predict',    'Make Your Picks','Submit 3 match predictions today.',           '⚽', 'daily',
     '{"type":"predictions_made"}'::jsonb, 3, 25, 20),
  ('daily_test',       'Train Your Brain','Complete a cognitive test today.',           '🧠', 'daily',
     '{"type":"tests_completed"}'::jsonb, 1, 20, 30),
  ('daily_earn',       'Daily Grind',    'Earn 100 IQ today from any activity.',        '⚡', 'daily',
     '{"type":"iq_earned"}'::jsonb, 100, 30, 40),
  -- WEEKLY
  ('weekly_streak',    'Consistency',    'Log in on 5 days this week.',                 '🔥', 'weekly',
     '{"type":"event_count","event":"daily_login"}'::jsonb, 5, 100, 10),
  ('weekly_predictor', 'Sharp Predictor','Score on 10 predictions this week.',          '🎯', 'weekly',
     '{"type":"event_count","event":"prediction_score"}'::jsonb, 10, 120, 20),
  ('weekly_scholar',   'Scholar',        'Set 3 new personal bests this week.',         '📚', 'weekly',
     '{"type":"event_count","event":"test_personal_best"}'::jsonb, 3, 110, 30),
  ('weekly_recruiter', 'Recruiter',      'Bring in an active referral this week.',      '🤝', 'weekly',
     '{"type":"event_count","event":"referral_qualified"}'::jsonb, 1, 150, 40),
  -- EVENT (one-time, always active until done)
  ('onboard_profile',  'Get Set Up',     'Complete your account profile.',              '📝', 'event',
     '{"type":"profile_complete"}'::jsonb, 1, 40, 10)
on conflict (code) do nothing;
