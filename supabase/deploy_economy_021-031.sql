-- ============================================================================
-- SUPERBRAIN ECONOMY — COMBINED DEPLOY (migrations 021–031, in order)
-- Generated 2026-07-04 19:05. Idempotent & additive. Paste once, Run.
-- ============================================================================


-- ▼▼▼ ==================  021_economy_core.sql  ================== ▼▼▼

-- ============================================================================
-- MIGRATION 021 — SUPERBRAIN ECONOMY CORE  (currency: "IQ")
-- ============================================================================
-- Idempotent, safe to re-run.
--
-- The Economy is the foundation that every platform feature plugs into:
-- predictions, cognitive tests, battles, engagement, and referrals all
-- *emit events* that mint a soft currency called IQ. Nothing here changes
-- existing scoring, leaderboards, or rankings — the economy is purely
-- ADDITIVE and reads existing points as inputs.
--
-- Design principles (per platform mandate):
--   • DATA-DRIVEN   — earning rules live in economy_event_types rows, not
--                     in code. Any future action becomes an IQ-earning event
--                     by INSERTing a config row. No deploy required.
--   • AUDITABLE     — economy_ledger is APPEND-ONLY. Balances are a VIEW
--                     (sum of deltas), never a mutable integer. Every mint
--                     and spend is a permanent, inspectable row.
--   • SAFE          — all mutations go through SECURITY DEFINER RPCs. Clients
--                     have NO insert/update/delete on the ledger. RLS is
--                     default-deny; users may only READ their own rows.
--   • IDEMPOTENT    — economy_emit dedupes on idempotency_key; prediction
--                     scoring uses economy_reconcile so re-scoring a fixture
--                     corrects (never doubles) an award.
--   • FUTURE-PROOF  — currencies carry an is_redeemable flag so a cashable
--                     tier can be switched on later without schema change.
-- ============================================================================


-- ── 1. CURRENCIES ───────────────────────────────────────────────────────────
-- Multi-currency by design. Launch ships one soft currency (IQ).
-- is_redeemable = false today; flip to true (or add a new currency) when a
-- cashable/withdrawable tier is introduced — no schema migration needed.

create table if not exists public.economy_currencies (
  code          text        primary key,                 -- e.g. 'IQ'
  name          text        not null,                     -- 'IQ Points'
  symbol        text        not null default '',          -- display glyph/emoji
  decimals      integer     not null default 0,           -- 0 = whole units
  is_spendable  boolean     not null default true,        -- can be spent in-app
  is_redeemable boolean     not null default false,       -- future: cash/withdraw
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);


-- ── 2. EVENT TYPES (the data-driven earning rulebook) ───────────────────────
-- Each row defines how one kind of action mints currency. Add a new earning
-- source by inserting a row here — that is the entire integration surface for
-- config-only sources.
--
--   base_amount   flat award when no quality tier applies
--   amount_map    JSONB tier map keyed by a "quality bucket" string, e.g.
--                 {"5":50,"3":15,"2":8,"0":0} for prediction points.
--                 When present and the bucket matches, it overrides base_amount.
--   cooldown_seconds  minimum seconds between two awards of this event for a
--                     user (shapes retention: e.g. daily_login = 86400).
--   daily_cap     max currency a user can earn from this event per UTC day
--                 (null = uncapped). Rewards quality over farming.
--   per_source    when true, each distinct source_ref may only be awarded once
--                 (reconciled). Prevents paying twice for the same prediction.

create table if not exists public.economy_event_types (
  code             text        primary key,               -- e.g. 'prediction_score'
  currency_code    text        not null references public.economy_currencies(code),
  description      text        not null default '',
  base_amount      bigint      not null default 0,
  amount_map       jsonb       not null default '{}'::jsonb,
  cooldown_seconds integer     not null default 0,
  daily_cap        bigint,                                 -- null = uncapped
  per_source       boolean     not null default false,
  active           boolean     not null default true,
  created_at       timestamptz not null default now()
);


-- ── 3. LEDGER (append-only source of truth) ─────────────────────────────────
-- One row per mint (+delta) or spend (−delta). Never updated, never deleted
-- in normal operation. Balance = SUM(delta). idempotency_key is UNIQUE so a
-- retried emit is a no-op.

create table if not exists public.economy_ledger (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  currency_code   text        not null references public.economy_currencies(code),
  event_code      text        references public.economy_event_types(code),  -- null for manual/spend
  delta           bigint      not null,                    -- +earn / −spend
  source_ref      text,                                    -- e.g. prediction id, 'signup'
  idempotency_key text        unique,                      -- dedupes emits (null allowed)
  reason          text,
  meta            jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists economy_ledger_user_currency_idx
  on public.economy_ledger (user_id, currency_code);
create index if not exists economy_ledger_event_source_idx
  on public.economy_ledger (event_code, source_ref);
create index if not exists economy_ledger_created_idx
  on public.economy_ledger (created_at);


-- ── 4. BALANCES (view — never write a balance directly) ─────────────────────

create or replace view public.economy_balances as
  select
    user_id,
    currency_code,
    coalesce(sum(delta), 0)::bigint as balance
  from public.economy_ledger
  group by user_id, currency_code;


-- ── 5. RLS ──────────────────────────────────────────────────────────────────
-- Config tables (currencies, event_types) are world-readable — they are not
-- sensitive and clients render them. The ledger is private: a user may read
-- ONLY their own rows. NO client may INSERT/UPDATE/DELETE the ledger; all
-- writes happen through SECURITY DEFINER RPCs (or the service-role key).

alter table public.economy_currencies  enable row level security;
alter table public.economy_event_types enable row level security;
alter table public.economy_ledger       enable row level security;

drop policy if exists "currencies public read" on public.economy_currencies;
create policy "currencies public read"
  on public.economy_currencies for select
  to anon, authenticated using (true);

drop policy if exists "event types public read" on public.economy_event_types;
create policy "event types public read"
  on public.economy_event_types for select
  to anon, authenticated using (true);

drop policy if exists "ledger read own" on public.economy_ledger;
create policy "ledger read own"
  on public.economy_ledger for select
  to authenticated using (auth.uid() = user_id);
-- (intentionally NO insert/update/delete policies — definer RPCs only)


-- ── 6. RPC: economy_emit ────────────────────────────────────────────────────
-- The universal minting entry point. Any feature calls this to award currency.
-- Enforces active/cooldown/daily_cap/idempotency from the event's config row.
-- Returns the amount actually minted (0 if skipped by a rule or dedupe).

create or replace function public.economy_emit(
  p_user_id         uuid,
  p_event_code      text,
  p_source_ref      text    default null,
  p_amount_override bigint  default null,   -- explicit amount (bypasses config amount)
  p_quality         text    default null,   -- bucket key into amount_map
  p_meta            jsonb   default '{}'::jsonb,
  p_idempotency_key text    default null
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  ev      public.economy_event_types%rowtype;
  amt     bigint;
  key     text;
  earned_today bigint;
begin
  if p_user_id is null then return 0; end if;

  select * into ev from public.economy_event_types where code = p_event_code;
  if not found or not ev.active then return 0; end if;

  -- Resolve amount: override > quality tier > base
  amt := coalesce(
    p_amount_override,
    (ev.amount_map ->> coalesce(p_quality, ''))::bigint,
    ev.base_amount
  );
  if amt is null or amt = 0 then return 0; end if;

  -- Idempotency key: explicit, else per-source, else uniquely generated
  key := coalesce(
    p_idempotency_key,
    case when p_source_ref is not null
         then p_event_code || ':' || p_source_ref end,
    p_event_code || ':' || gen_random_uuid()::text
  );

  -- Dedupe: if this key already exists, do nothing
  if exists (select 1 from public.economy_ledger where idempotency_key = key) then
    return 0;
  end if;

  -- Per-source guard (extra safety even if key differs)
  if ev.per_source and p_source_ref is not null
     and exists (
       select 1 from public.economy_ledger
       where event_code = p_event_code and source_ref = p_source_ref
     ) then
    return 0;
  end if;

  -- Cooldown: block if user earned this event within the window
  if ev.cooldown_seconds > 0
     and exists (
       select 1 from public.economy_ledger
       where user_id = p_user_id and event_code = p_event_code
         and created_at > now() - make_interval(secs => ev.cooldown_seconds)
     ) then
    return 0;
  end if;

  -- Daily cap: clamp so today's total for this event stays within cap
  if ev.daily_cap is not null then
    select coalesce(sum(delta), 0) into earned_today
    from public.economy_ledger
    where user_id = p_user_id and event_code = p_event_code
      and created_at >= date_trunc('day', now() at time zone 'utc');
    amt := least(amt, greatest(ev.daily_cap - earned_today, 0));
    if amt <= 0 then return 0; end if;
  end if;

  insert into public.economy_ledger
    (user_id, currency_code, event_code, delta, source_ref, idempotency_key, reason, meta)
  values
    (p_user_id, ev.currency_code, p_event_code, amt, p_source_ref, key, ev.description, p_meta);

  return amt;
end;
$$;

revoke all on function public.economy_emit(uuid,text,text,bigint,text,jsonb,text) from public, anon, authenticated;
-- Callable only by definer functions / service role — never directly by clients.


-- ── 7. RPC: economy_reconcile ───────────────────────────────────────────────
-- Sets the NET awarded amount for a (event, source_ref, user) to a target,
-- writing only the correcting delta. Used by scoring paths that can re-run
-- (e.g. a fixture rescored from 2 pts to 5 pts). Idempotent by construction.

create or replace function public.economy_reconcile(
  p_user_id     uuid,
  p_event_code  text,
  p_source_ref  text,
  p_target      bigint
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  cur_currency text;
  current_net  bigint;
  diff         bigint;
begin
  if p_user_id is null or p_source_ref is null then return 0; end if;

  select currency_code into cur_currency
  from public.economy_event_types where code = p_event_code;
  if cur_currency is null then return 0; end if;

  select coalesce(sum(delta), 0) into current_net
  from public.economy_ledger
  where event_code = p_event_code and source_ref = p_source_ref and user_id = p_user_id;

  diff := coalesce(p_target, 0) - current_net;
  if diff = 0 then return 0; end if;

  insert into public.economy_ledger
    (user_id, currency_code, event_code, delta, source_ref, reason, meta)
  values
    (p_user_id, cur_currency, p_event_code, diff, p_source_ref,
     'reconcile', jsonb_build_object('target', p_target, 'prev_net', current_net));

  return diff;
end;
$$;

revoke all on function public.economy_reconcile(uuid,text,text,bigint) from public, anon, authenticated;


-- ── 8. RPC: economy_spend ───────────────────────────────────────────────────
-- Atomically debit a user's balance. Raises if insufficient funds or currency
-- is not spendable. Callable by authenticated users (spends are always the
-- caller's own balance — auth.uid() is enforced, p_user_id is ignored for
-- clients but honored for service-role/back-office use is handled via RLS-free
-- definer context; here we bind to auth.uid() for safety).

create or replace function public.economy_spend(
  p_currency_code   text,
  p_amount          bigint,
  p_reason          text    default null,
  p_source_ref      text    default null,
  p_idempotency_key text    default null
)
returns bigint            -- returns new balance
language plpgsql
security definer set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  bal      bigint;
  spendable boolean;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select is_spendable into spendable
  from public.economy_currencies where code = p_currency_code and active;
  if spendable is null then raise exception 'unknown currency %', p_currency_code; end if;
  if not spendable then raise exception 'currency % is not spendable', p_currency_code; end if;

  -- Idempotent spend: if the key was already used, return current balance
  if p_idempotency_key is not null
     and exists (select 1 from public.economy_ledger where idempotency_key = p_idempotency_key) then
    select coalesce(sum(delta),0) into bal from public.economy_ledger
      where user_id = uid and currency_code = p_currency_code;
    return bal;
  end if;

  -- Lock the user's rows to serialize concurrent spends, then check balance
  perform 1 from public.economy_ledger
    where user_id = uid and currency_code = p_currency_code for update;

  select coalesce(sum(delta),0) into bal from public.economy_ledger
    where user_id = uid and currency_code = p_currency_code;

  if bal < p_amount then
    raise exception 'insufficient % balance: have %, need %', p_currency_code, bal, p_amount;
  end if;

  insert into public.economy_ledger
    (user_id, currency_code, event_code, delta, source_ref, idempotency_key, reason)
  values
    (uid, p_currency_code, null, -p_amount, p_source_ref, p_idempotency_key,
     coalesce(p_reason, 'spend'));

  return bal - p_amount;
end;
$$;

grant execute on function public.economy_spend(text,bigint,text,text,text) to authenticated;


-- ── 9. RPC: get_my_balance ──────────────────────────────────────────────────
-- Convenience read for the signed-in user (also directly readable via the
-- economy_balances view under RLS, but this returns all currencies tidily).

create or replace function public.get_my_balance()
returns table (currency_code text, balance bigint)
language sql
security definer set search_path = public
stable
as $$
  select c.code,
         coalesce((select sum(l.delta) from public.economy_ledger l
                   where l.user_id = auth.uid() and l.currency_code = c.code), 0)::bigint
  from public.economy_currencies c
  where c.active
  order by c.code;
$$;

grant execute on function public.get_my_balance() to authenticated;


-- ── 10. RPC: get_contribution_leaderboard ───────────────────────────────────
-- Ranks users by IQ balance. SECURITY DEFINER, mirrors get_leaderboard: never
-- exposes user_id or private profile fields — only display_name + country.

create or replace function public.get_contribution_leaderboard(
  p_currency_code text default 'IQ'
)
returns table (
  rank         bigint,
  display_name text,
  country      text,
  balance      bigint
)
language sql
security definer set search_path = public
stable
as $$
  with bal as (
    select user_id, sum(delta)::bigint as balance
    from public.economy_ledger
    where currency_code = p_currency_code
    group by user_id
    having sum(delta) > 0
  )
  select
    row_number() over (order by b.balance desc) as rank,
    coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
    p.country,
    b.balance
  from bal b
  left join public.user_profiles p on p.id = b.user_id
  order by b.balance desc
  limit 100;
$$;

grant execute on function public.get_contribution_leaderboard(text) to anon, authenticated;


-- ── 11. SEED: currency + earning rulebook ───────────────────────────────────
-- IQ soft currency. is_redeemable=false today (future cashable tier flips it).

insert into public.economy_currencies (code, name, symbol, is_spendable, is_redeemable)
values ('IQ', 'IQ Points', '🧠', true, false)
on conflict (code) do nothing;

-- Earning rulebook. Philosophy encoded in config, not code:
--   • QUALITY over quantity   — exact predictions/personal bests pay the most.
--   • RETENTION over signups  — daily_login uses a 20h cooldown + streak hooks;
--                               login itself pays little, the habit compounds.
--   • ACTIVE referrals        — referral pays only on a QUALIFYING action of the
--                               invitee (per_source on the invitee id), never on
--                               a bare registration.
-- All amounts/caps are tunable by UPDATE — no deploy needed. Add new sources by
-- INSERTing rows here; that is the whole integration for config-only earning.
insert into public.economy_event_types
  (code, currency_code, description, base_amount, amount_map, cooldown_seconds, daily_cap, per_source, active)
values
  -- Prediction accuracy (WIRED LIVE this migration). Bucket = points_awarded.
  ('prediction_score', 'IQ', 'Match prediction scored', 0,
     '{"5":50,"3":15,"2":8,"0":0}'::jsonb, 0, null, true, true),

  -- Bonus questions (same tier idea; wire when bonus scoring emits).
  ('bonus_score', 'IQ', 'Bonus question scored', 0,
     '{}'::jsonb, 0, null, true, true),

  -- Cognitive tests: reward NEW personal bests, scaled by percentile bucket.
  ('test_personal_best', 'IQ', 'New personal-best cognitive test score', 10,
     '{"elite":60,"high":30,"mid":15,"low":10}'::jsonb, 0, 300, true, true),

  ('career_profile_complete', 'IQ', 'Completed career cognitive profile', 40,
     '{}'::jsonb, 0, null, true, true),

  -- Battle head-to-head outcome.
  ('battle_win', 'IQ', 'Won a head-to-head battle', 25, '{}'::jsonb, 0, 500, true, true),

  -- Engagement / retention. Login pays a little; streaks (future) multiply.
  ('daily_login', 'IQ', 'Daily active login', 5, '{}'::jsonb, 72000, 5, false, true),

  -- Social growth: paid only when an invitee performs a qualifying action.
  ('referral_qualified', 'IQ', 'Referred user completed a qualifying action', 100,
     '{}'::jsonb, 0, null, true, true)
on conflict (code) do nothing;


-- ── 12. PILLAR WIRING: PREDICTION ACCURACY → IQ ─────────────────────────────
-- economy_award_fixture reconciles IQ for every scored prediction on a fixture
-- from the 'prediction_score' amount_map, keyed by points_awarded. Because it
-- RECONCILES (writes only the delta vs. what was already awarded per prediction),
-- it is safe to run on first scoring AND on every rescore — a 2pt→5pt rescore
-- tops up +42 IQ; a 5pt→0pt correction claws back. Set-based, single statement.

create or replace function public.economy_award_fixture(p_fixture_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.economy_ledger
    (user_id, currency_code, event_code, delta, source_ref, reason, meta)
  select
    pr.user_id,
    'IQ',
    'prediction_score',
    tgt.amount - coalesce(led.net, 0),                      -- correcting delta
    pr.id::text,
    'prediction scored',
    jsonb_build_object('fixture_id', p_fixture_id, 'points', pr.points_awarded)
  from public.predictions pr
  cross join lateral (
    select coalesce(
      (et.amount_map ->> pr.points_awarded::text)::bigint, 0
    ) as amount
    from public.economy_event_types et
    where et.code = 'prediction_score' and et.active
  ) tgt
  left join (
    select source_ref, sum(delta) as net
    from public.economy_ledger
    where event_code = 'prediction_score'
    group by source_ref
  ) led on led.source_ref = pr.id::text
  where pr.fixture_id = p_fixture_id
    and pr.points_awarded is not null
    and (tgt.amount - coalesce(led.net, 0)) <> 0;      -- skip no-op rows
end;
$$;

revoke all on function public.economy_award_fixture(uuid) from public, anon, authenticated;


-- Re-define the auto-scoring trigger fn to award IQ AFTER points are set.
-- The economy call is wrapped so a failure there can NEVER block match scoring.
create or replace function public.score_fixture_predictions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actual_home   integer := new.home_score;
  actual_away   integer := new.away_score;
  actual_gd     integer;
  actual_result text;
begin
  if actual_home is null or actual_away is null then return new; end if;
  if old.home_score = actual_home and old.away_score = actual_away then return new; end if;

  actual_gd     := actual_home - actual_away;
  actual_result := case
    when actual_home > actual_away then 'home'
    when actual_away > actual_home then 'away'
    else 'draw'
  end;

  update public.predictions
  set
    points_awarded = case
      when home_score = actual_home
       and away_score = actual_away        then 5
      when (home_score - away_score) = actual_gd then 3
      when (case
              when home_score > away_score then 'home'
              when away_score > home_score then 'away'
              else 'draw'
            end) = actual_result           then 2
      else                                      0
    end,
    updated_at = now()
  where fixture_id = new.id;

  -- Economy (additive, fire-and-forget): mint IQ for scored predictions.
  begin
    perform public.economy_award_fixture(new.id);
  exception when others then
    raise warning 'economy_award_fixture failed for fixture %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists auto_score_predictions on public.fixtures;
create trigger auto_score_predictions
  after update of home_score, away_score on public.fixtures
  for each row
  when (new.home_score is not null and new.away_score is not null)
  execute function public.score_fixture_predictions();


-- Re-define manual rescore to also reconcile IQ (idempotent top-up/clawback).
create or replace function public.rescore_fixture(p_fixture_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  actual_home   integer;
  actual_away   integer;
  actual_gd     integer;
  actual_result text;
  updated_count integer;
begin
  select home_score, away_score
  into actual_home, actual_away
  from public.fixtures
  where id = p_fixture_id;

  if actual_home is null or actual_away is null then
    raise exception 'Cannot rescore: fixture % has no result yet.', p_fixture_id;
  end if;

  actual_gd     := actual_home - actual_away;
  actual_result := case
    when actual_home > actual_away then 'home'
    when actual_away > actual_home then 'away'
    else 'draw'
  end;

  update public.predictions
  set
    points_awarded = case
      when home_score = actual_home
       and away_score = actual_away        then 5
      when (home_score - away_score) = actual_gd then 3
      when (case
              when home_score > away_score then 'home'
              when away_score > home_score then 'away'
              else 'draw'
            end) = actual_result           then 2
      else                                      0
    end,
    updated_at = now()
  where fixture_id = p_fixture_id;

  get diagnostics updated_count = row_count;

  begin
    perform public.economy_award_fixture(p_fixture_id);
  exception when others then
    raise warning 'economy_award_fixture failed for fixture %: %', p_fixture_id, sqlerrm;
  end;

  return updated_count;
end;
$$;

grant execute on function public.rescore_fixture to authenticated;


-- ── 13. BACKFILL ────────────────────────────────────────────────────────────
-- Award IQ for any fixtures already scored before this migration ran.
-- Idempotent: reconcile makes a second run a no-op.
do $$
declare fix record;
begin
  for fix in
    select id from public.fixtures
    where home_score is not null and away_score is not null
  loop
    perform public.economy_award_fixture(fix.id);
  end loop;
end $$;

-- ▲▲▲ ==================  end 021_economy_core.sql  ================== ▲▲▲


-- ▼▼▼ ==================  022_economy_login_streaks.sql  ================== ▼▼▼

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

-- ▲▲▲ ==================  end 022_economy_login_streaks.sql  ================== ▲▲▲


-- ▼▼▼ ==================  023_economy_test_personal_bests.sql  ================== ▼▼▼

-- ============================================================================
-- MIGRATION 023 — ECONOMY: COGNITIVE TEST PERSONAL BESTS
-- ============================================================================
-- Idempotent. Builds on 021_economy_core.sql.
--
-- Rewards QUALITY: a user earns IQ only when they set a NEW personal best on a
-- cognitive test, scaled by percentile. No client change — a trigger on
-- test_results insert handles every existing and future save path.
--
-- Quality buckets (percentile): elite ≥98 · high ≥85 · mid ≥50 · low otherwise.
-- Amounts + daily_cap live in economy_event_types('test_personal_best').
-- ============================================================================

create or replace function public.award_test_personal_best()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  prev_best integer;
  bucket    text;
begin
  -- Previous best for this (user, test), excluding the row just inserted.
  select max(score) into prev_best
  from public.test_results
  where user_id = new.user_id
    and test_name = new.test_name
    and id <> new.id;

  -- Only reward a genuine new personal best (or first-ever attempt).
  if prev_best is not null and new.score <= prev_best then
    return new;
  end if;

  bucket := case
    when new.percentile >= 98 then 'elite'
    when new.percentile >= 85 then 'high'
    when new.percentile >= 50 then 'mid'
    else 'low'
  end;

  -- Guarded: an economy fault must never block saving a test result.
  begin
    perform public.economy_emit(
      new.user_id,
      'test_personal_best',
      new.id::text,          -- per-result source_ref (per_source=true → once)
      null,
      bucket,                -- quality → amount_map[bucket]
      jsonb_build_object('test_name', new.test_name, 'score', new.score, 'percentile', new.percentile),
      null
    );
  exception when others then
    raise warning 'economy test_personal_best emit failed for result %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists economy_award_test_pb on public.test_results;
create trigger economy_award_test_pb
  after insert on public.test_results
  for each row execute function public.award_test_personal_best();

-- ▲▲▲ ==================  end 023_economy_test_personal_bests.sql  ================== ▲▲▲


-- ▼▼▼ ==================  024_economy_profile_completion.sql  ================== ▼▼▼

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

-- ▲▲▲ ==================  end 024_economy_profile_completion.sql  ================== ▲▲▲


-- ▼▼▼ ==================  025_economy_referrals.sql  ================== ▼▼▼

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

-- ▲▲▲ ==================  end 025_economy_referrals.sql  ================== ▲▲▲


-- ▼▼▼ ==================  026_economy_achievements.sql  ================== ▼▼▼

-- ============================================================================
-- MIGRATION 026 — ECONOMY: ACHIEVEMENT ENGINE
-- ============================================================================
-- Idempotent. Builds on 021 (+022 streaks, 023 tests, 025 referrals).
--
-- Achievements are DATA. Each row in `achievements` declares a reward and a
-- JSONB `criteria`. A generic evaluator (economy_meets_criteria) checks the
-- criteria against the ledger / streaks / test_results / referrals. New badges
-- ship by INSERTing a row — no code deploy.
--
-- Supported criteria types (extend the evaluator to add more):
--   {"type":"iq_earned","gte":N}                       total positive IQ earned
--   {"type":"iq_total","gte":N}                         current IQ balance
--   {"type":"event_count","event":"prediction_score","gte":N}   # positive rows
--   {"type":"streak","gte":N}                           longest login streak
--   {"type":"tests_completed","gte":N}                  distinct cognitive tests
--   {"type":"test_best","test":"reaction","score_gte":N}
--   {"type":"referrals_qualified","gte":N}              active referrals made
-- ============================================================================

-- ── TABLES ──────────────────────────────────────────────────────────────────
create table if not exists public.achievements (
  code          text        primary key,
  name          text        not null,
  description   text        not null default '',
  icon          text        not null default '🏆',
  currency_code text        not null default 'IQ' references public.economy_currencies(code),
  reward_amount bigint      not null default 0,
  criteria      jsonb       not null default '{}'::jsonb,
  sort          integer     not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.user_achievements (
  user_id          uuid        not null references auth.users(id) on delete cascade,
  achievement_code text        not null references public.achievements(code) on delete cascade,
  unlocked_at      timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

create index if not exists user_achievements_user_idx on public.user_achievements (user_id);

alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "achievements public read" on public.achievements;
create policy "achievements public read"
  on public.achievements for select to anon, authenticated using (true);

drop policy if exists "user achievements read own" on public.user_achievements;
create policy "user achievements read own"
  on public.user_achievements for select to authenticated using (auth.uid() = user_id);
-- unlocks written only by economy_check_achievements (SECURITY DEFINER)

-- Reward event: amount comes from the achievement row (override).
insert into public.economy_event_types
  (code, currency_code, description, base_amount, amount_map, cooldown_seconds, daily_cap, per_source, active)
values
  ('achievement_unlocked', 'IQ', 'Unlocked an achievement', 0, '{}'::jsonb, 0, null, false, true)
on conflict (code) do nothing;


-- ── EVALUATOR (data-driven) ─────────────────────────────────────────────────
create or replace function public.economy_meets_criteria(p_user_id uuid, p_criteria jsonb)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  ctype text := p_criteria ->> 'type';
  gte   numeric := coalesce((p_criteria ->> 'gte')::numeric, 0);
  val   numeric := 0;
begin
  if ctype is null then return false; end if;

  case ctype
    when 'iq_earned' then
      select coalesce(sum(delta),0) into val from public.economy_ledger
        where user_id = p_user_id and delta > 0;
    when 'iq_total' then
      select coalesce(sum(delta),0) into val from public.economy_ledger
        where user_id = p_user_id and currency_code = coalesce(p_criteria->>'currency','IQ');
    when 'event_count' then
      select count(*) into val from public.economy_ledger
        where user_id = p_user_id and delta > 0
          and event_code = (p_criteria ->> 'event');
    when 'streak' then
      select coalesce(longest_streak,0) into val from public.user_streaks
        where user_id = p_user_id;
    when 'tests_completed' then
      select count(distinct test_name) into val from public.test_results
        where user_id = p_user_id;
    when 'test_best' then
      return exists (
        select 1 from public.test_results
        where user_id = p_user_id
          and test_name = (p_criteria ->> 'test')
          and score >= coalesce((p_criteria ->> 'score_gte')::numeric, 0)
      );
    when 'referrals_qualified' then
      select count(*) into val from public.referrals
        where referrer_id = p_user_id and status = 'qualified';
    else
      return false;                     -- unknown criteria type
  end case;

  return val >= gte;
end;
$$;
revoke all on function public.economy_meets_criteria(uuid, jsonb) from public, anon, authenticated;


-- ── CHECK + UNLOCK (internal; called by the activity orchestrator) ──────────
create or replace function public.economy_check_achievements(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
begin
  if p_user_id is null then return; end if;

  for a in
    select ach.* from public.achievements ach
    where ach.active
      and not exists (
        select 1 from public.user_achievements ua
        where ua.user_id = p_user_id and ua.achievement_code = ach.code
      )
  loop
    if public.economy_meets_criteria(p_user_id, a.criteria) then
      insert into public.user_achievements (user_id, achievement_code)
      values (p_user_id, a.code)
      on conflict do nothing;

      if a.reward_amount > 0 then
        perform public.economy_emit(
          p_user_id, 'achievement_unlocked', a.code, a.reward_amount, null,
          jsonb_build_object('achievement', a.code, 'name', a.name),
          'achievement:' || p_user_id::text || ':' || a.code
        );
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.economy_check_achievements(uuid) from public, anon, authenticated;


-- ── READ RPC: get_my_achievements (all badges + unlocked flag) ──────────────
create or replace function public.get_my_achievements()
returns table (
  code text, name text, description text, icon text,
  reward_amount bigint, unlocked boolean, unlocked_at timestamptz, sort integer
)
language sql stable security definer set search_path = public
as $$
  select a.code, a.name, a.description, a.icon, a.reward_amount,
         (ua.user_id is not null) as unlocked, ua.unlocked_at, a.sort
  from public.achievements a
  left join public.user_achievements ua
    on ua.achievement_code = a.code and ua.user_id = auth.uid()
  where a.active
  order by a.sort, a.name;
$$;
grant execute on function public.get_my_achievements() to anon, authenticated;


-- ── SEED: starter achievement set (all tunable/removable via data) ──────────
insert into public.achievements (code, name, description, icon, reward_amount, criteria, sort) values
  ('first_steps',    'First Steps',     'Earn your first IQ on SuperBrain.',                '👣', 10,  '{"type":"iq_earned","gte":1}', 10),
  ('first_prediction','On the Board',   'Get your first match prediction scored.',         '⚽', 20,  '{"type":"event_count","event":"prediction_score","gte":1}', 20),
  ('sharp_shooter',  'Sharp Shooter',   'Have 10 predictions scored.',                     '🎯', 60,  '{"type":"event_count","event":"prediction_score","gte":10}', 30),
  ('quick_mind',     'Quick Mind',      'Complete 5 different cognitive tests.',           '🧠', 40,  '{"type":"tests_completed","gte":5}', 40),
  ('week_warrior',   'Week Warrior',    'Reach a 7-day login streak.',                     '🔥', 60,  '{"type":"streak","gte":7}', 50),
  ('unstoppable',    'Unstoppable',     'Reach a 30-day login streak.',                    '⚡', 250, '{"type":"streak","gte":30}', 60),
  ('century',        'Century',         'Earn 100 IQ.',                                    '💯', 25,  '{"type":"iq_earned","gte":100}', 70),
  ('iq_1000',        'Big Brain',       'Earn 1,000 IQ.',                                  '🌟', 150, '{"type":"iq_earned","gte":1000}', 80),
  ('connector',      'Connector',       'Bring in your first active referral.',            '🤝', 50,  '{"type":"referrals_qualified","gte":1}', 90),
  ('influencer',     'Influencer',      'Bring in 5 active referrals.',                    '📣', 300, '{"type":"referrals_qualified","gte":5}', 100)
on conflict (code) do nothing;

-- ▲▲▲ ==================  end 026_economy_achievements.sql  ================== ▲▲▲


-- ▼▼▼ ==================  027_economy_activity_orchestrator.sql  ================== ▼▼▼

-- ============================================================================
-- MIGRATION 027 — ECONOMY: ACTIVITY ORCHESTRATOR
-- ============================================================================
-- Idempotent. Requires 025 (referrals) + 026 (achievements).
--
-- The single, reusable hook that reacts to EVERY earning event: whenever IQ is
-- minted, we (a) check whether the earner now qualifies a pending referral, and
-- (b) check whether they've unlocked any achievements. Modules plug in here
-- rather than each pillar knowing about the others.
--
-- Recursion safety: the orchestrator only itself emits "reward" events
-- (referral_qualified, achievement_unlocked). The ledger trigger IGNORES those
-- event codes (and non-positive deltas), so an orchestrated reward cannot
-- re-trigger orchestration. Exactly one pass per genuine earning event.
-- ============================================================================

create or replace function public.economy_on_activity(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user_id is null then return; end if;

  begin
    perform public.economy_qualify_referrals(p_user_id);
  exception when others then
    raise warning 'economy_qualify_referrals failed for %: %', p_user_id, sqlerrm;
  end;

  begin
    perform public.economy_check_achievements(p_user_id);
  exception when others then
    raise warning 'economy_check_achievements failed for %: %', p_user_id, sqlerrm;
  end;
end;
$$;
revoke all on function public.economy_on_activity(uuid) from public, anon, authenticated;


create or replace function public.economy_ledger_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only genuine EARNING events drive orchestration. Skip spends (delta<=0) and
  -- the orchestrator's own reward payouts to prevent recursion.
  if new.delta <= 0
     or coalesce(new.event_code, '') in ('referral_qualified', 'achievement_unlocked') then
    return new;
  end if;

  perform public.economy_on_activity(new.user_id);
  return new;
end;
$$;

drop trigger if exists economy_ledger_activity on public.economy_ledger;
create trigger economy_ledger_activity
  after insert on public.economy_ledger
  for each row execute function public.economy_ledger_after_insert();


-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- Retroactively evaluate referrals + achievements for everyone who has already
-- earned IQ (e.g. from the prediction backfill in migration 021). Idempotent.
do $$
declare uid uuid;
begin
  for uid in
    select distinct user_id from public.economy_ledger where delta > 0
  loop
    perform public.economy_on_activity(uid);
  end loop;
end $$;

-- ▲▲▲ ==================  end 027_economy_activity_orchestrator.sql  ================== ▲▲▲


-- ▼▼▼ ==================  028_partner_dashboard.sql  ================== ▼▼▼

-- ============================================================================
-- MIGRATION 028 — PARTNER DASHBOARD (data-driven aggregation)
-- ============================================================================
-- Idempotent. Requires 021–027.
--
-- Adds:
--   • partner_levels        — DATA-DRIVEN partner tiers (name/threshold/perks).
--   • get_partner_dashboard() — a single SECURITY DEFINER RPC that returns the
--     WHOLE dashboard as one JSONB payload (one round trip, mobile-first):
--     currency, balance, partner level + progress, streak, daily-reward preview,
--     referral code + network stats, recent transactions, achievements,
--     contribution leaderboard position, and a ranked "Next Actions" list.
--
-- Nothing is hardcoded: currency, level thresholds, reward amounts, and the IQ
-- value of each "next action" are all read from existing economy config tables.
-- ============================================================================

-- ── PARTNER LEVELS (data) ───────────────────────────────────────────────────
create table if not exists public.partner_levels (
  level      integer     primary key,
  name       text        not null,
  min_earned bigint      not null,          -- lifetime IQ earned to reach tier
  icon       text        not null default '⭐',
  perks      jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.partner_levels enable row level security;
drop policy if exists "partner levels public read" on public.partner_levels;
create policy "partner levels public read"
  on public.partner_levels for select to anon, authenticated using (true);

insert into public.partner_levels (level, name, min_earned, icon) values
  (1, 'Rookie',    0,     '🌱'),
  (2, 'Bronze',    100,   '🥉'),
  (3, 'Silver',    500,   '🥈'),
  (4, 'Gold',      2000,  '🥇'),
  (5, 'Platinum',  5000,  '💎'),
  (6, 'Diamond',   15000, '🔷'),
  (7, 'Elite',     50000, '👑')
on conflict (level) do nothing;


-- ── RPC: get_partner_dashboard ──────────────────────────────────────────────
create or replace function public.get_partner_dashboard(p_currency text default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  uid              uuid := auth.uid();
  cur              record;
  bal              bigint := 0;
  lifetime         bigint := 0;
  lvl              record;
  nxt              record;
  progress         numeric := 0;
  st               record;
  today            date := (now() at time zone 'utc')::date;
  checked_in_today boolean := false;
  next_streak_day  integer := 1;
  login_preview    bigint := 0;
  streak_preview   bigint := 0;
  ref              record;
  ref_code         text;
  lb_rank          bigint;
  lb_total         bigint := 0;
  ach_total        integer := 0;
  ach_unlocked     integer := 0;
  recent           jsonb := '[]'::jsonb;
  recent_ach       jsonb := '[]'::jsonb;
  next_actions     jsonb := '[]'::jsonb;
  profile_done     boolean := false;
  upcoming_open    integer := 0;
begin
  if uid is null then
    return jsonb_build_object('authenticated', false);
  end if;

  -- Configurable currency: explicit arg, else IQ, else first active.
  select * into cur
  from public.economy_currencies
  where active and code = coalesce(p_currency, code)
  order by (code = 'IQ') desc, code
  limit 1;
  if cur.code is null then
    return jsonb_build_object('authenticated', true, 'error', 'no active currency');
  end if;

  -- Balance + lifetime earned (positive deltas only).
  select coalesce(sum(delta),0) into bal
    from public.economy_ledger where user_id = uid and currency_code = cur.code;
  select coalesce(sum(delta),0) into lifetime
    from public.economy_ledger where user_id = uid and currency_code = cur.code and delta > 0;

  -- Partner level from lifetime earned + progress to next.
  select * into lvl from public.partner_levels where min_earned <= lifetime order by min_earned desc limit 1;
  select * into nxt from public.partner_levels where min_earned >  lifetime order by min_earned asc  limit 1;
  if lvl.level is null then
    progress := 0;
  elsif nxt.level is null then
    progress := 100;
  else
    progress := round(((lifetime - lvl.min_earned)::numeric / nullif(nxt.min_earned - lvl.min_earned, 0)) * 100, 1);
  end if;

  -- Streak + today's reward preview (without minting).
  select * into st from public.user_streaks where user_id = uid;
  checked_in_today := coalesce(st.last_checkin = today, false);
  if st.user_id is null then
    next_streak_day := 1;
  elsif checked_in_today then
    next_streak_day := st.current_streak;
  elsif st.last_checkin = today - 1 then
    next_streak_day := st.current_streak + 1;
  else
    next_streak_day := 1;
  end if;
  select coalesce(base_amount,0) into login_preview from public.economy_event_types where code = 'daily_login';
  select coalesce((amount_map ->> next_streak_day::text)::bigint, base_amount, 0)
    into streak_preview from public.economy_event_types where code = 'daily_streak';

  -- Referral code + network stats.
  select code into ref_code from public.referral_codes where user_id = uid;
  select
    count(*)::integer                                        as total,
    count(*) filter (where status = 'qualified')::integer   as active,
    count(*) filter (where status = 'pending')::integer     as pending,
    coalesce((select sum(delta) from public.economy_ledger
              where user_id = uid and event_code = 'referral_qualified'), 0)::bigint as earned
  into ref
  from public.referrals where referrer_id = uid;

  -- Contribution leaderboard position.
  with bals as (
    select user_id, sum(delta) as b
    from public.economy_ledger where currency_code = cur.code
    group by user_id having sum(delta) > 0
  )
  select
    (select count(*) from bals),
    case when exists (select 1 from bals where user_id = uid)
         then (select count(*) + 1 from bals x where x.b > (select b from bals where user_id = uid))
         else null end
  into lb_total, lb_rank;

  -- Achievements.
  select count(*) into ach_total    from public.achievements where active;
  select count(*) into ach_unlocked from public.user_achievements where user_id = uid;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.unlocked_at desc), '[]'::jsonb) into recent_ach
  from (
    select a.code, a.name, a.icon, ua.unlocked_at
    from public.user_achievements ua
    join public.achievements a on a.code = ua.achievement_code
    where ua.user_id = uid
    order by ua.unlocked_at desc limit 5
  ) t;

  -- Recent transactions (human-labelled from event descriptions).
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into recent
  from (
    select
      l.created_at,
      l.delta,
      l.event_code,
      coalesce(et.description, l.reason, l.event_code, 'Adjustment') as label
    from public.economy_ledger l
    left join public.economy_event_types et on et.code = l.event_code
    where l.user_id = uid and l.currency_code = cur.code
    order by l.created_at desc limit 8
  ) t;

  -- Inputs for Next Actions.
  select coalesce(profile_complete, false) into profile_done
    from public.user_profiles where id = uid;
  select count(*) into upcoming_open
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id and c.status in ('upcoming','active')
  where f.kicks_off_at > now()
    and f.home_team_id is not null and f.away_team_id is not null
    and not exists (select 1 from public.predictions p where p.fixture_id = f.id and p.user_id = uid);

  -- Next Actions: highest-value things to do today (value read from config).
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into next_actions
  from (
    select code, title, subtitle, href, icon, iq
    from (
      values
        ('daily_checkin', 'Claim your daily reward', 'Keep your streak alive', '/iq', '🎁',
          (case when checked_in_today then 0 else (login_preview + streak_preview) end)::bigint,
          (not checked_in_today)),
        ('complete_profile', 'Complete your profile', 'One-time partner bonus', '/profile/complete', '📝',
          coalesce((select base_amount from public.economy_event_types where code = 'profile_complete'), 0)::bigint,
          (not profile_done)),
        ('make_predictions', 'Predict upcoming matches', 'Points for every correct call', '/predict', '⚽',
          (coalesce((select (amount_map ->> '5')::bigint from public.economy_event_types where code = 'prediction_score'), 0)
            * least(upcoming_open, 5))::bigint,
          (upcoming_open > 0)),
        ('beat_test', 'Set a new personal best', 'Beat your top cognitive score', '/tests', '🧠',
          coalesce((select (amount_map ->> 'elite')::bigint from public.economy_event_types where code = 'test_personal_best'), 0)::bigint,
          true),
        ('invite_friend', 'Invite a partner', 'Earn when they get active', '/iq', '🤝',
          coalesce((select base_amount from public.economy_event_types where code = 'referral_qualified'), 0)::bigint,
          true)
    ) as v(code, title, subtitle, href, icon, iq, available)
    where available and iq > 0
    order by iq desc
    limit 4
  ) t;

  -- Assemble the payload.
  return jsonb_build_object(
    'authenticated', true,
    'currency', jsonb_build_object('code', cur.code, 'name', cur.name, 'symbol', cur.symbol, 'decimals', cur.decimals),
    'balance', bal,
    'lifetime_earned', lifetime,
    'level', jsonb_build_object(
      'level', lvl.level, 'name', lvl.name, 'icon', lvl.icon, 'min_earned', lvl.min_earned,
      'next_name', nxt.name, 'next_at', nxt.min_earned, 'progress_pct', progress
    ),
    'streak', jsonb_build_object(
      'current', coalesce(st.current_streak, 0), 'longest', coalesce(st.longest_streak, 0),
      'total_checkins', coalesce(st.total_checkins, 0), 'checked_in_today', checked_in_today
    ),
    'daily_reward', jsonb_build_object(
      'available', not checked_in_today, 'login', login_preview, 'streak', streak_preview,
      'streak_day', next_streak_day, 'total', (login_preview + streak_preview)
    ),
    'referral', jsonb_build_object(
      'code', ref_code, 'total', ref.total, 'active', ref.active, 'pending', ref.pending, 'earned', ref.earned
    ),
    'leaderboard', jsonb_build_object('rank', lb_rank, 'total', lb_total),
    'achievements', jsonb_build_object('unlocked', ach_unlocked, 'total', ach_total, 'recent', recent_ach),
    'recent_transactions', recent,
    'next_actions', next_actions
  );
end;
$$;

grant execute on function public.get_partner_dashboard(text) to anon, authenticated;

-- ▲▲▲ ==================  end 028_partner_dashboard.sql  ================== ▲▲▲


-- ▼▼▼ ==================  029_public_profiles.sql  ================== ▼▼▼

-- ============================================================================
-- MIGRATION 029 — PUBLIC PROFILE SYSTEM
-- ============================================================================
-- Idempotent. Builds on 021–028.
--
-- Gives every user a shareable public profile at a configurable URL
-- (/u/<username>), assembled from the EXISTING economy/partner infrastructure:
-- partner level, currency balance, achievements, prediction stats, cognitive
-- test stats, leaderboard positions, network stats, referral link, and recent
-- public activity — with per-section PRIVACY controls the user owns.
--
-- Security model (unchanged pattern): anon has NO direct read on user_profiles
-- or the private economy tables. The ONLY public surface is
-- get_public_profile() — a SECURITY DEFINER RPC that returns solely safe,
-- privacy-filtered fields (never birth_year / gender / industry / email / raw
-- user_id). Everything is data-driven; nothing about the sections is hardcoded.
-- ============================================================================

-- ── PROFILE COLUMNS ─────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists username   text,
  add column if not exists bio        text,
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists is_public  boolean not null default true,
  add column if not exists privacy    jsonb   not null default
    '{"level":true,"balance":true,"achievements":true,"predictions":true,"tests":true,"network":true,"activity":true,"country":true,"referral":true}'::jsonb;

-- Case-insensitive unique handle. Partial: many NULLs (unset) are allowed.
create unique index if not exists user_profiles_username_key
  on public.user_profiles (lower(username)) where username is not null;


-- ── RESERVED HANDLES (data-driven) ──────────────────────────────────────────
create table if not exists public.reserved_usernames (name text primary key);
alter table public.reserved_usernames enable row level security;
drop policy if exists "reserved usernames public read" on public.reserved_usernames;
create policy "reserved usernames public read"
  on public.reserved_usernames for select to anon, authenticated using (true);

insert into public.reserved_usernames (name) values
  ('admin'),('administrator'),('api'),('auth'),('login'),('signup'),('logout'),
  ('settings'),('profile'),('u'),('user'),('users'),('me'),('predict'),('tests'),
  ('test'),('battle'),('iq'),('leaderboard'),('leaderboards'),('challenge'),('share'),
  ('www'),('help'),('support'),('about'),('terms'),('privacy'),('contact'),('disclaimer'),
  ('superbrain'),('root'),('system'),('null'),('undefined'),('static'),('_next')
on conflict (name) do nothing;


-- ── RPC: set_username ───────────────────────────────────────────────────────
-- Validates format + reserved + uniqueness, then claims the handle for the
-- signed-in user. Returns the normalized username.
create or replace function public.set_username(p_username text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  norm text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  norm := lower(trim(coalesce(p_username, '')));

  if norm !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3–20 characters: letters, numbers, or underscore.';
  end if;
  if exists (select 1 from public.reserved_usernames where name = norm) then
    raise exception 'That username is reserved.';
  end if;
  if exists (select 1 from public.user_profiles where lower(username) = norm and id <> uid) then
    raise exception 'That username is already taken.';
  end if;

  begin
    update public.user_profiles set username = norm, updated_at = now() where id = uid;
    if not found then
      insert into public.user_profiles (id, username) values (uid, norm)
      on conflict (id) do update set username = norm, updated_at = now();
    end if;
  exception when unique_violation then
    raise exception 'That username is already taken.';
  end;

  return norm;
end;
$$;
grant execute on function public.set_username(text) to authenticated;


-- ── RPC: update_public_profile ──────────────────────────────────────────────
-- Updates the caller's own customization + privacy. NULL args leave a field
-- unchanged; pass '' to clear text fields. Validates lengths and URL scheme.
create or replace function public.update_public_profile(
  p_bio        text    default null,
  p_avatar_url text    default null,
  p_banner_url text    default null,
  p_is_public  boolean default null,
  p_privacy    jsonb   default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;

  if p_bio is not null and length(p_bio) > 300 then
    raise exception 'Bio must be 300 characters or fewer.';
  end if;
  if p_avatar_url is not null and p_avatar_url <> '' and p_avatar_url !~ '^https://' then
    raise exception 'Avatar URL must start with https://';
  end if;
  if p_banner_url is not null and p_banner_url <> '' and p_banner_url !~ '^https://' then
    raise exception 'Banner URL must start with https://';
  end if;

  update public.user_profiles set
    bio        = coalesce(p_bio, bio),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    banner_url = coalesce(p_banner_url, banner_url),
    is_public  = coalesce(p_is_public, is_public),
    -- merge privacy so partial updates keep untouched keys
    privacy    = case when p_privacy is null then privacy else privacy || p_privacy end,
    updated_at = now()
  where id = uid;
end;
$$;
grant execute on function public.update_public_profile(text, text, text, boolean, jsonb) to authenticated;


-- ── RPC: get_my_profile_settings (editor prefill) ───────────────────────────
create or replace function public.get_my_profile_settings()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'username',     p.username,
    'display_name', p.display_name,
    'bio',          p.bio,
    'avatar_url',   p.avatar_url,
    'banner_url',   p.banner_url,
    'avatar_color', p.avatar_color,
    'country',      p.country,
    'is_public',    p.is_public,
    'privacy',      p.privacy
  )
  from public.user_profiles p where p.id = auth.uid();
$$;
grant execute on function public.get_my_profile_settings() to authenticated;


-- ── RPC: get_public_profile (the sole public surface) ───────────────────────
create or replace function public.get_public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  prof         record;
  pv           jsonb;
  cur          record;
  bal          bigint := 0;
  lifetime     bigint := 0;
  lvl          record;
  nxt          record;
  progress     numeric := 0;
  ach          jsonb := '[]'::jsonb;
  ach_unlocked integer := 0;
  ach_total    integer := 0;
  pred_points  bigint := 0;
  pred_count   bigint := 0;
  pred_exact   bigint := 0;
  pred_rank    bigint;
  tests_json   jsonb := '[]'::jsonb;
  tests_done   integer := 0;
  avg_pct      numeric;
  contrib_rank bigint;
  net_total    integer := 0;
  net_active   integer := 0;
  ref_code     text;
  activity     jsonb := '[]'::jsonb;
begin
  select * into prof from public.user_profiles where lower(username) = lower(trim(coalesce(p_username, '')));
  if prof.id is null then
    return jsonb_build_object('found', false);
  end if;

  -- Master toggle: private profiles expose only a minimal identity card.
  if prof.is_public is false then
    return jsonb_build_object(
      'found', true, 'is_public', false,
      'username', prof.username, 'display_name', prof.display_name,
      'avatar_url', prof.avatar_url, 'avatar_color', prof.avatar_color,
      'banner_url', prof.banner_url
    );
  end if;

  pv := coalesce(prof.privacy, '{}'::jsonb);

  -- Currency (configurable — default platform currency).
  select * into cur from public.economy_currencies where active order by (code = 'IQ') desc, code limit 1;

  if cur.code is not null then
    select coalesce(sum(delta),0) into bal
      from public.economy_ledger where user_id = prof.id and currency_code = cur.code;
    select coalesce(sum(delta),0) into lifetime
      from public.economy_ledger where user_id = prof.id and currency_code = cur.code and delta > 0;
  end if;

  -- Partner level.
  select * into lvl from public.partner_levels where min_earned <= lifetime order by min_earned desc limit 1;
  select * into nxt from public.partner_levels where min_earned >  lifetime order by min_earned asc  limit 1;
  if lvl.level is null then progress := 0;
  elsif nxt.level is null then progress := 100;
  else progress := round(((lifetime - lvl.min_earned)::numeric / nullif(nxt.min_earned - lvl.min_earned, 0)) * 100, 1);
  end if;

  -- Achievements (badges).
  select count(*) into ach_total    from public.achievements where active;
  select count(*) into ach_unlocked from public.user_achievements where user_id = prof.id;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.unlocked_at desc), '[]'::jsonb) into ach
  from (
    select a.code, a.name, a.icon, a.description, ua.unlocked_at
    from public.user_achievements ua
    join public.achievements a on a.code = ua.achievement_code
    where ua.user_id = prof.id
    order by ua.unlocked_at desc limit 24
  ) t;

  -- Prediction stats (global across competitions) + rank.
  select coalesce(sum(p.points_awarded),0), count(p.id), count(*) filter (where p.points_awarded = 5)
    into pred_points, pred_count, pred_exact
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where p.user_id = prof.id and p.points_awarded is not null;

  with scores as (
    select p.user_id, coalesce(sum(p.points_awarded),0) as pts
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where p.points_awarded is not null
    group by p.user_id
  )
  select case when exists (select 1 from scores where user_id = prof.id)
              then (select count(*) + 1 from scores x where x.pts > (select pts from scores where user_id = prof.id))
              else null end
    into pred_rank;

  -- Cognitive test stats: best score per test + averages.
  select count(distinct test_name) into tests_done from public.test_results where user_id = prof.id;
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tests_json
  from (
    select distinct on (test_name) test_name, score, percentile
    from public.test_results where user_id = prof.id
    order by test_name, score desc
  ) t;
  select round(avg(best_pct), 0) into avg_pct
  from (select max(percentile) as best_pct from public.test_results where user_id = prof.id group by test_name) q;

  -- Contribution leaderboard rank.
  if cur.code is not null then
    with bals as (
      select user_id, sum(delta) as b from public.economy_ledger
      where currency_code = cur.code group by user_id having sum(delta) > 0
    )
    select case when exists (select 1 from bals where user_id = prof.id)
                then (select count(*) + 1 from bals x where x.b > (select b from bals where user_id = prof.id))
                else null end
      into contrib_rank;
  end if;

  -- Network stats.
  select count(*), count(*) filter (where status = 'qualified')
    into net_total, net_active
  from public.referrals where referrer_id = prof.id;

  -- Referral code (for the "join via me" link).
  select code into ref_code from public.referral_codes where user_id = prof.id;

  -- Recent public activity: positive (earning) events only, human-labelled.
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into activity
  from (
    select l.created_at, l.delta,
           coalesce(et.description, l.reason, l.event_code, 'Activity') as label
    from public.economy_ledger l
    left join public.economy_event_types et on et.code = l.event_code
    where l.user_id = prof.id and l.delta > 0
    order by l.created_at desc limit 10
  ) t;

  -- Assemble, applying per-section privacy (default visible when key absent).
  return jsonb_build_object(
    'found', true,
    'is_public', true,
    'username', prof.username,
    'display_name', prof.display_name,
    'bio', prof.bio,
    'avatar_url', prof.avatar_url,
    'avatar_color', prof.avatar_color,
    'banner_url', prof.banner_url,
    'join_date', prof.created_at,
    'country', case when coalesce((pv->>'country')::boolean, true) then prof.country else null end,
    'currency', case when cur.code is not null
                     then jsonb_build_object('code', cur.code, 'name', cur.name, 'symbol', cur.symbol)
                     else null end,
    'level', case when coalesce((pv->>'level')::boolean, true)
                  then jsonb_build_object('level', lvl.level, 'name', lvl.name, 'icon', lvl.icon,
                                          'progress_pct', progress, 'next_name', nxt.name,
                                          'next_at', nxt.min_earned, 'lifetime_earned', lifetime)
                  else null end,
    'balance', case when coalesce((pv->>'balance')::boolean, true) then bal else null end,
    'achievements', case when coalesce((pv->>'achievements')::boolean, true)
                         then jsonb_build_object('unlocked', ach_unlocked, 'total', ach_total, 'list', ach)
                         else null end,
    'predictions', case when coalesce((pv->>'predictions')::boolean, true)
                        then jsonb_build_object('total_points', pred_points, 'predictions', pred_count,
                                                'exact_scores', pred_exact, 'rank', pred_rank)
                        else null end,
    'tests', case when coalesce((pv->>'tests')::boolean, true)
                  then jsonb_build_object('completed', tests_done, 'avg_percentile', avg_pct, 'best', tests_json)
                  else null end,
    'leaderboard', jsonb_build_object(
      'contribution_rank', case when coalesce((pv->>'balance')::boolean, true) then contrib_rank else null end,
      'predictor_rank',    case when coalesce((pv->>'predictions')::boolean, true) then pred_rank else null end
    ),
    'network', case when coalesce((pv->>'network')::boolean, true)
                    then jsonb_build_object('total', net_total, 'active', net_active)
                    else null end,
    'referral', case when coalesce((pv->>'referral')::boolean, true)
                     then jsonb_build_object('code', ref_code)
                     else null end,
    'activity', case when coalesce((pv->>'activity')::boolean, true) then activity else null end
  );
end;
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ▲▲▲ ==================  end 029_public_profiles.sql  ================== ▲▲▲


-- ▼▼▼ ==================  030_network_dashboard.sql  ================== ▼▼▼

-- ============================================================================
-- MIGRATION 030 — NETWORK DASHBOARD
-- ============================================================================
-- Idempotent. Builds on 021–029 (referral engine + economy + partner levels).
--
-- Turns the existing referral graph into a growth analytics surface that
-- rewards ACTIVE, HIGH-QUALITY networks — not raw referral counts. Every metric
-- is sourced from referrals + economy_ledger + user_profiles + partner_levels,
-- and thresholds/windows are data-driven via economy_config.
--
-- The referral engine is single-level (referrals.referred_user_id is globally
-- unique → one referrer per user), so a "network" is a user's direct referrals.
-- The headline numbers deliberately foreground QUALITY: active members, recent
-- engagement, conversion rate, and the IQ the network has actually earned.
-- ============================================================================

-- ── CONFIG (tunable, no deploy) ─────────────────────────────────────────────
insert into public.economy_config (key, value, description) values
  ('network_active_window_days', '30'::jsonb,  'Days window to count a network member as recently engaged'),
  ('network_growth_weeks',       '12'::jsonb,  'Weeks shown in the network growth chart'),
  ('network_top_contributors',   '10'::jsonb,  'Number of top network contributors returned'),
  ('network_leaderboard_limit',  '100'::jsonb, 'Rows in the global network leaderboard')
on conflict (key) do nothing;


-- ── RPC: get_network_dashboard ──────────────────────────────────────────────
create or replace function public.get_network_dashboard(p_currency text default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  cur        record;
  win        integer;
  weeks      integer;
  topn       integer;
  total      integer := 0;
  active     integer := 0;
  pending    integer := 0;
  engaged    integer := 0;
  net_earned bigint  := 0;
  conversion numeric := 0;
  countries  jsonb := '[]'::jsonb;
  growth     jsonb := '[]'::jsonb;
  top        jsonb := '[]'::jsonb;
  size_total bigint := 0;
  size_rank  bigint;
  iq_rank    bigint;
begin
  if uid is null then return jsonb_build_object('authenticated', false); end if;

  win   := public.economy_config_num('network_active_window_days', 30)::int;
  weeks := public.economy_config_num('network_growth_weeks', 12)::int;
  topn  := public.economy_config_num('network_top_contributors', 10)::int;

  select * into cur from public.economy_currencies
  where active and code = coalesce(p_currency, code)
  order by (code = 'IQ') desc, code limit 1;
  if cur.code is null then
    return jsonb_build_object('authenticated', true, 'error', 'no active currency');
  end if;

  -- Headline counts.
  select count(*),
         count(*) filter (where status = 'qualified'),
         count(*) filter (where status = 'pending')
    into total, active, pending
  from public.referrals where referrer_id = uid;

  -- Recently engaged: members who earned currency within the window.
  select count(distinct r.referred_user_id) into engaged
  from public.referrals r
  where r.referrer_id = uid
    and exists (
      select 1 from public.economy_ledger l
      where l.user_id = r.referred_user_id and l.delta > 0
        and l.currency_code = cur.code
        and l.created_at > now() - make_interval(days => win)
    );

  -- Currency the network has earned (its total contribution).
  select coalesce(sum(l.delta), 0) into net_earned
  from public.referrals r
  join public.economy_ledger l on l.user_id = r.referred_user_id
  where r.referrer_id = uid and l.delta > 0 and l.currency_code = cur.code;

  conversion := case when total > 0 then round(active::numeric / total * 100, 1) else 0 end;

  -- Countries represented.
  select coalesce(jsonb_agg(to_jsonb(t) order by t.count desc), '[]'::jsonb) into countries
  from (
    select coalesce(nullif(trim(p.country), ''), 'Unknown') as country, count(*)::int as count
    from public.referrals r
    left join public.user_profiles p on p.id = r.referred_user_id
    where r.referrer_id = uid
    group by coalesce(nullif(trim(p.country), ''), 'Unknown')
    order by count(*) desc
    limit 12
  ) t;

  -- Weekly growth: new members + cumulative, over the last :weeks weeks.
  with wk as (
    select date_trunc('week', r.created_at)::date as week, count(*)::int as new
    from public.referrals r where r.referrer_id = uid
    group by 1
  ),
  series as (
    select generate_series(
      date_trunc('week', now()) - make_interval(weeks => weeks - 1),
      date_trunc('week', now()),
      interval '1 week'
    )::date as week
  )
  select coalesce(jsonb_agg(to_jsonb(g) order by g.week), '[]'::jsonb) into growth
  from (
    select s.week,
           coalesce(w.new, 0) as new,
           (select count(*) from public.referrals r
            where r.referrer_id = uid and date_trunc('week', r.created_at)::date <= s.week)::int as cumulative
    from series s
    left join wk w on w.week = s.week
  ) g;

  -- Top contributors in the network (by IQ earned).
  select coalesce(jsonb_agg(to_jsonb(t) order by t.earned desc), '[]'::jsonb) into top
  from (
    select
      coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
      p.country,
      (r.status = 'qualified') as active,
      coalesce((select sum(l.delta) from public.economy_ledger l
                where l.user_id = r.referred_user_id and l.delta > 0 and l.currency_code = cur.code), 0)::bigint as earned,
      (select pl.name from public.partner_levels pl
       where pl.min_earned <= coalesce((select sum(l.delta) from public.economy_ledger l
                where l.user_id = r.referred_user_id and l.delta > 0 and l.currency_code = cur.code), 0)
       order by pl.min_earned desc limit 1) as level_name
    from public.referrals r
    left join public.user_profiles p on p.id = r.referred_user_id
    where r.referrer_id = uid
    order by earned desc
    limit topn
  ) t;

  -- Global rankings among all referrers (by active members and by network IQ).
  -- referred_user_id is unique, so the ledger join never inflates counts.
  with ref_agg as (
    select r.referrer_id,
           count(distinct r.referred_user_id) filter (where r.status = 'qualified') as active,
           coalesce(sum(l.delta), 0) as net_iq
    from public.referrals r
    left join public.economy_ledger l
      on l.user_id = r.referred_user_id and l.currency_code = cur.code and l.delta > 0
    group by r.referrer_id
  )
  select
    (select count(*) from ref_agg),
    case when exists (select 1 from ref_agg where referrer_id = uid)
         then (select count(*) + 1 from ref_agg a where a.active > (select active from ref_agg where referrer_id = uid))
         else null end,
    case when exists (select 1 from ref_agg where referrer_id = uid)
         then (select count(*) + 1 from ref_agg a where a.net_iq > (select net_iq from ref_agg where referrer_id = uid))
         else null end
  into size_total, size_rank, iq_rank;

  return jsonb_build_object(
    'authenticated', true,
    'currency', jsonb_build_object('code', cur.code, 'name', cur.name, 'symbol', cur.symbol),
    'total_size', total,
    'active_members', active,
    'pending', pending,
    'engaged_recent', engaged,
    'active_window_days', win,
    'conversion_rate', conversion,
    'network_earned', net_earned,
    'quality_score', conversion,     -- active / total, as a %
    'countries', countries,
    'growth', growth,
    'top_contributors', top,
    'rankings', jsonb_build_object(
      'size_rank', size_rank,        -- by active members
      'iq_rank', iq_rank,            -- by network IQ earned
      'referrer_pool', size_total
    )
  );
end;
$$;
grant execute on function public.get_network_dashboard(text) to authenticated;


-- ── RPC: get_network_leaderboard (global network rankings) ──────────────────
-- Ranks partners by ACTIVE network members then network IQ — quality first.
create or replace function public.get_network_leaderboard(p_currency text default null)
returns table (
  rank           bigint,
  display_name   text,
  country        text,
  active_members bigint,
  total_members  bigint,
  network_iq     bigint
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  cur_code text;
  lim      integer;
begin
  select code into cur_code from public.economy_currencies
  where active and code = coalesce(p_currency, code)
  order by (code = 'IQ') desc, code limit 1;
  lim := public.economy_config_num('network_leaderboard_limit', 100)::int;

  return query
  with ref_agg as (
    select r.referrer_id,
           count(distinct r.referred_user_id) filter (where r.status = 'qualified') as active,
           count(distinct r.referred_user_id) as total,
           coalesce(sum(l.delta), 0) as net_iq
    from public.referrals r
    left join public.economy_ledger l
      on l.user_id = r.referred_user_id and l.currency_code = cur_code and l.delta > 0
    group by r.referrer_id
  )
  select
    row_number() over (order by a.active desc, a.net_iq desc) as rank,
    coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
    p.country,
    a.active::bigint,
    a.total::bigint,
    a.net_iq::bigint
  from ref_agg a
  left join public.user_profiles p on p.id = a.referrer_id
  where a.total > 0
  order by a.active desc, a.net_iq desc
  limit lim;
end;
$$;
grant execute on function public.get_network_leaderboard(text) to anon, authenticated;

-- ▲▲▲ ==================  end 030_network_dashboard.sql  ================== ▲▲▲


-- ▼▼▼ ==================  031_daily_missions.sql  ================== ▼▼▼

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

-- ▲▲▲ ==================  end 031_daily_missions.sql  ================== ▲▲▲

