-- ============================================================
-- MIGRATION 048 — Configurable economy, per competition AND per event
--
-- Competition Engine V2.
--
-- ────────────────────────────────────────────────────────────
-- WHY
-- ────────────────────────────────────────────────────────────
-- Approved requirement: "don't hardcode the economy multiplier. Make it
-- configurable per competition and per scoring event so IQ rewards can be
-- tuned without code changes."
--
-- Today IQ amounts live in ONE global table, economy_event_types, keyed by
-- event code:
--
--   ('prediction_score', 'IQ', …, '{"5":50,"3":15,"2":8,"0":0}')
--
-- Every competition mints identically. Three consequences:
--
--   1. Three simultaneous competitions triple the IQ supply against an
--      economy tuned for one 104-match tournament.
--   2. A 380-fixture league mints ~3.7× what a 104-fixture tournament does,
--      for the same effort per prediction.
--   3. Tuning any of it means editing a seed and redeploying.
--
-- The `economy_multiplier` setting added in migration 043 was a placeholder:
-- one number per competition, and nothing read it. This replaces it with a
-- real per-competition, per-event resolution chain.
--
-- ────────────────────────────────────────────────────────────
-- RESOLUTION ORDER
-- ────────────────────────────────────────────────────────────
--   1. competition_economy_rules.amount_map   (full override for this
--                                              competition + event)
--   2. economy_event_types.amount_map         (the global default)
--   then × competition_economy_rules.multiplier (default 1.0)
--   then × 0 if the rule is disabled, or if the competition has
--          economy_enabled = false
--
-- With NO rows in competition_economy_rules, every competition resolves to
-- the global amount_map × 1.0 — which is byte-identical to today. That is
-- the zero-delta argument, and scripts/verify-048-economy.sql proves it.
--
-- ⚠️ Rounding is `round()` (half away from zero) applied AFTER the
--    multiplier. A 0.5× multiplier on 15 IQ yields 8, not 7. Stated
--    explicitly because it is the kind of detail that silently differs
--    between environments.
--
-- WORLD CUP COMPATIBILITY
--   Total, PROVIDED no rule row is inserted for wc2026. This migration
--   inserts none. economy_award_fixture continues to RECONCILE deltas, so
--   even a later tuning change corrects balances rather than double-minting.
--
-- DEPENDS ON: 021 (economy core), 043 (settings), 044 (scoring rules)
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. Per-competition, per-event economy rules ──────────────

create table if not exists public.competition_economy_rules (
  competition_id uuid    not null references public.competitions(id) on delete cascade,
  event_code     text    not null references public.economy_event_types(code) on update cascade,

  -- Scales whatever the resolved amount is. 1.0 = unchanged.
  multiplier     numeric not null default 1.0 check (multiplier >= 0),

  -- Optional FULL override of the event's amount_map for this competition.
  -- Null = inherit the global map and only apply the multiplier.
  amount_map     jsonb,

  -- Optional cap on total IQ from this event, per user, per competition.
  -- Null = uncapped. Reserved: not yet enforced (see note below).
  user_cap       bigint,

  enabled        boolean not null default true,

  notes          text,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null,

  primary key (competition_id, event_code)
);

create index if not exists competition_economy_rules_comp_idx
  on public.competition_economy_rules (competition_id);

alter table public.competition_economy_rules enable row level security;

drop policy if exists "public read economy rules" on public.competition_economy_rules;
create policy "public read economy rules"
  on public.competition_economy_rules for select using (true);

drop policy if exists "admins write economy rules" on public.competition_economy_rules;
create policy "admins write economy rules"
  on public.competition_economy_rules for all
  using    (exists (select 1 from public.app_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins where user_id = auth.uid()));

comment on table public.competition_economy_rules is
  'Per-competition, per-event IQ tuning. Empty table = every competition uses '
  'the global economy_event_types amounts, which is the pre-048 behaviour.';
comment on column public.competition_economy_rules.user_cap is
  'RESERVED — not enforced yet. Enforcing it requires a per-user running total '
  'inside the set-based award statement; that is a separate change with its own '
  'performance characteristics, and shipping an unenforced column is honest '
  'whereas shipping a half-enforced cap is not.';


-- ── 2. Resolve one award amount ──────────────────────────────
-- The single place the chain is expressed. Everything else calls this.

create or replace function public.economy_resolve_amount(
  p_competition_id uuid,
  p_event_code     text,
  p_bucket         text        -- amount_map key, e.g. '5' for a 5-point prediction
)
returns bigint
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_base_map    jsonb;
  v_base_amount bigint;
  v_rule        record;
  v_amount      numeric;
  v_econ_on     boolean;
begin
  -- Global default for the event.
  select amount_map, base_amount
    into v_base_map, v_base_amount
  from public.economy_event_types
  where code = p_event_code and active;

  -- Inactive or unknown event: mint nothing. Same as today.
  if not found then return 0; end if;

  -- Competition-level master switch (migration 043).
  select coalesce(
    (public.get_competition_setting(p_competition_id, 'economy_enabled'))::text::boolean,
    true
  ) into v_econ_on;

  if not v_econ_on then return 0; end if;

  select * into v_rule
  from public.competition_economy_rules
  where competition_id = p_competition_id and event_code = p_event_code;

  if found and not v_rule.enabled then return 0; end if;

  -- Amount: competition override map → global map → base_amount.
  v_amount := coalesce(
    case when found and v_rule.amount_map is not null
         then (v_rule.amount_map ->> p_bucket)::numeric end,
    (v_base_map ->> p_bucket)::numeric,
    v_base_amount,
    0
  );

  if found then
    v_amount := v_amount * v_rule.multiplier;
  end if;

  -- round() is half-away-from-zero in Postgres for numeric. Documented in
  -- the header because it is observable: 15 * 0.5 → 8, not 7.
  return round(v_amount)::bigint;
end;
$$;

grant execute on function public.economy_resolve_amount(uuid, text, text) to authenticated;


-- ── 3. Rewire the fixture award to use it ────────────────────
-- Structurally identical to migration 021's version. The ONLY change is
-- that the target amount comes from economy_resolve_amount() instead of
-- reading economy_event_types.amount_map directly.
--
-- It remains SET-BASED and it remains RECONCILING: it writes the delta
-- between the target amount and what has already been awarded per
-- prediction, so first scoring, rescoring and re-tuning all converge
-- rather than accumulate.

create or replace function public.economy_award_fixture(p_fixture_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_comp uuid;
begin
  select competition_id into v_comp from public.fixtures where id = p_fixture_id;
  if v_comp is null then return; end if;

  insert into public.economy_ledger
    (user_id, currency_code, event_code, delta, source_ref, reason, meta)
  select
    pr.user_id,
    'IQ',
    'prediction_score',
    tgt.amount - coalesce(led.net, 0),                      -- correcting delta
    pr.id::text,
    'prediction scored',
    jsonb_build_object(
      'fixture_id',     p_fixture_id,
      'competition_id', v_comp,
      'points',         pr.points_awarded
    )
  from public.predictions pr
  cross join lateral (
    select public.economy_resolve_amount(
             v_comp, 'prediction_score', pr.points_awarded::text
           ) as amount
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


-- ── 4. Retire the placeholder setting ────────────────────────
-- competition_settings.economy_multiplier was added in 043 and never read.
-- Leaving a live-looking knob that does nothing is worse than removing it:
-- someone will eventually set it and wonder why nothing changed.

update public.competition_setting_defs
set description = 'DEPRECATED — superseded by competition_economy_rules, which tunes '
                  'per event rather than per competition. Not read by any code. '
                  'Use the Economy step of the competition wizard instead.',
    label       = 'IQ multiplier (deprecated)'
where key = 'economy_multiplier';

-- economy_enabled stays: it is a real master switch and IS read, by
-- economy_resolve_amount above.
update public.competition_setting_defs
set description = 'Master switch. False mints no IQ at all for this competition, '
                  'whatever competition_economy_rules says.'
where key = 'economy_enabled';


-- ── 5. Seed nothing ──────────────────────────────────────────
-- Deliberately no rows for wc2026 or any other competition. An empty
-- competition_economy_rules means every competition resolves to the global
-- amounts × 1.0 — identical to pre-048 behaviour. Zero-delta by
-- construction rather than by careful seeding.


insert into public.schema_migrations (version, name, notes)
values ('048', 'competition_economy',
        'Per-competition, per-event IQ rules + economy_resolve_amount(). '
        'economy_award_fixture rewired. NO rules seeded — zero-delta by '
        'construction. Deprecates the unread economy_multiplier setting.')
on conflict (version) do nothing;

do $$
begin
  raise notice 'Migration 048 applied.';
  raise notice 'competition_economy_rules is EMPTY — every competition still mints';
  raise notice 'the global amounts. Verify with scripts/verify-048-economy.sql.';
end;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- Re-apply migration 021's economy_award_fixture (it is create-or-replace
-- and self-contained), then:
--   drop function if exists public.economy_resolve_amount(uuid, text, text);
--   drop table    if exists public.competition_economy_rules;
-- ============================================================
