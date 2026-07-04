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
