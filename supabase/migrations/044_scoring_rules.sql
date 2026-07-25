-- ============================================================
-- MIGRATION 044 — Competition-level scoring rules
--
-- Competition Engine V2, Phase 1.5.
--
-- ⚠️ EXTRACT, DO NOT MODIFY. ⚠️
-- The 5/3/2/0 model is not being changed, improved or tuned here. It is
-- being moved from two hardcoded copies into one table plus one function.
-- Any behavioural difference is a BUG, not a feature.
--
-- ────────────────────────────────────────────────────────────
-- WHY
-- ────────────────────────────────────────────────────────────
-- The identical CASE expression is written twice today:
--   predictor-schema.sql:266-276   score_fixture_predictions (trigger)
--   predictor-schema.sql:338-348   rescore_fixture (admin RPC)
-- and migration 021 re-declares the first one again, so there are really
-- three copies to keep in sync. A competition that scores differently
-- (Champions League, a cricket format) cannot be expressed at all.
--
-- ────────────────────────────────────────────────────────────
-- DESIGN — why one function, not one CASE with variables
-- ────────────────────────────────────────────────────────────
-- Reading four values into local variables and repeating the CASE in both
-- functions would keep the rules in one TABLE while leaving the LOGIC
-- duplicated — which is the actual defect. So both callers now delegate to
-- a single `apply_fixture_scoring(fixture_id)`.
--
-- It stays SET-BASED: one UPDATE over all predictions for the fixture, with
-- the rule values substituted as scalars. It is NOT a per-row function
-- call, which would be materially slower across a Premier League matchweek.
--
-- ────────────────────────────────────────────────────────────
-- WORLD CUP COMPATIBILITY — PROVED, NOT ASSUMED
-- ────────────────────────────────────────────────────────────
-- The seeded values are today's literals: exact 5, gd 3, result 2, wrong 0.
-- The acceptance test is a full World Cup rescore producing ZERO changed
-- rows against the closure snapshot. That single test is the entire
-- justification for this migration. See scripts/verify-044-scoring.sql.
--
-- DEPENDS ON: 037, 043
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file — `create or replace` back to the
--           duplicated implementations. No stored data is touched by
--           either version, so reverting restores prior behaviour exactly.
-- ============================================================


-- ── 1. The rules ─────────────────────────────────────────────

create table if not exists public.scoring_rules (
  id             uuid    primary key default gen_random_uuid(),
  competition_id uuid    not null references public.competitions(id) on delete cascade,

  rule_code      text    not null
                 check (rule_code in ('exact', 'gd', 'result', 'wrong')),
  points         integer not null,
  sort_order     integer not null default 0,   -- evaluation order; first match wins

  created_at     timestamptz not null default now(),

  unique (competition_id, rule_code)
);

create index if not exists scoring_rules_comp_idx on public.scoring_rules (competition_id);

alter table public.scoring_rules enable row level security;

drop policy if exists "public read scoring rules" on public.scoring_rules;
create policy "public read scoring rules"
  on public.scoring_rules for select using (true);

comment on table public.scoring_rules is
  'Points per outcome class, per competition. exact > gd > result > wrong, '
  'evaluated in that order. Absent rows fall back to the 5/3/2/0 default so a '
  'competition scores correctly before anyone configures it.';


-- ── 2. Seed — today's literals, exactly ──────────────────────

insert into public.scoring_rules (competition_id, rule_code, points, sort_order)
select c.id, v.rule_code, v.points, v.sort_order
from public.competitions c
cross join (values
  ('exact',  5, 1),   -- predictor-schema.sql:268
  ('gd',     3, 2),   -- predictor-schema.sql:269
  ('result', 2, 3),   -- predictor-schema.sql:274
  ('wrong',  0, 4)    -- predictor-schema.sql:275
) as v(rule_code, points, sort_order)
on conflict (competition_id, rule_code) do nothing;


-- ── 3. The one implementation ────────────────────────────────

create or replace function public.apply_fixture_scoring(p_fixture_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_comp        uuid;
  actual_home   integer;
  actual_away   integer;
  actual_gd     integer;
  actual_result text;
  p_exact       integer;
  p_gd          integer;
  p_result      integer;
  p_wrong       integer;
  updated_count integer;
begin
  select competition_id, home_score, away_score
    into v_comp, actual_home, actual_away
  from public.fixtures
  where id = p_fixture_id;

  if actual_home is null or actual_away is null then
    return 0;
  end if;

  -- Rule lookup, with the historical literals as the fallback. A missing
  -- row must never mean "zero points" — that would silently void a
  -- competition rather than fail loudly.
  select
    coalesce(max(points) filter (where rule_code = 'exact'),  5),
    coalesce(max(points) filter (where rule_code = 'gd'),     3),
    coalesce(max(points) filter (where rule_code = 'result'), 2),
    coalesce(max(points) filter (where rule_code = 'wrong'),  0)
  into p_exact, p_gd, p_result, p_wrong
  from public.scoring_rules
  where competition_id = v_comp;

  actual_gd     := actual_home - actual_away;
  actual_result := case
    when actual_home > actual_away then 'home'
    when actual_away > actual_home then 'away'
    else 'draw'
  end;

  -- Structurally identical to predictor-schema.sql:266-276. The only
  -- difference is that the four integers are variables rather than
  -- literals. Order of evaluation is unchanged and load-bearing:
  -- exact → gd → result → wrong.
  update public.predictions
  set
    points_awarded = case
      when home_score = actual_home
       and away_score = actual_away             then p_exact
      when (home_score - away_score) = actual_gd then p_gd
      when (case
              when home_score > away_score then 'home'
              when away_score > home_score then 'away'
              else 'draw'
            end) = actual_result                then p_result
      else                                           p_wrong
    end,
    updated_at = now()
  where fixture_id = p_fixture_id;

  get diagnostics updated_count = row_count;

  -- Economy stays exactly where it was: after points are set, wrapped so a
  -- failure can NEVER block match scoring (predictor-schema.sql:283-287).
  begin
    perform public.economy_award_fixture(p_fixture_id);
  exception when others then
    raise warning 'economy_award_fixture failed for fixture %: %', p_fixture_id, sqlerrm;
  end;

  return updated_count;
end;
$$;

revoke all on function public.apply_fixture_scoring(uuid) from public, anon, authenticated;


-- ── 4. Trigger delegates ─────────────────────────────────────
-- The "score unchanged" guard stays HERE rather than moving into
-- apply_fixture_scoring: it is a property of the UPDATE that fired the
-- trigger (old vs new), not of the fixture. rescore_fixture must be able
-- to recompute unconditionally, and does.

create or replace function public.score_fixture_predictions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.home_score is null or new.away_score is null then return new; end if;
  if old.home_score = new.home_score and old.away_score = new.away_score then return new; end if;

  perform public.apply_fixture_scoring(new.id);

  return new;
end;
$$;

drop trigger if exists auto_score_predictions on public.fixtures;
create trigger auto_score_predictions
  after update of home_score, away_score on public.fixtures
  for each row
  when (new.home_score is not null and new.away_score is not null)
  execute function public.score_fixture_predictions();


-- ── 5. rescore_fixture delegates ─────────────────────────────

create or replace function public.rescore_fixture(p_fixture_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  actual_home integer;
  actual_away integer;
begin
  select home_score, away_score into actual_home, actual_away
  from public.fixtures where id = p_fixture_id;

  if actual_home is null or actual_away is null then
    raise exception 'Cannot rescore: fixture % has no result yet.', p_fixture_id;
  end if;

  return public.apply_fixture_scoring(p_fixture_id);
end;
$$;

grant execute on function public.rescore_fixture to authenticated;

-- rescore_competition is unchanged — it loops calling rescore_fixture and
-- therefore inherits the shared implementation for free.


insert into public.schema_migrations (version, name, notes)
values ('044', 'scoring_rules',
        'Extracts 5/3/2/0 into scoring_rules + apply_fixture_scoring(). Trigger and '
        'rescore_fixture both delegate. MUST be zero-delta on a full WC rescore.')
on conflict (version) do nothing;

do $$
begin
  raise notice 'Migration 044 applied.';
  raise notice 'ACCEPTANCE TEST: rescore the completed World Cup and assert ZERO';
  raise notice 'rows differ from the closure snapshot. See scripts/verify-044-scoring.sql.';
end;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- Re-apply predictor-schema.sql (its score_fixture_predictions and
-- rescore_fixture are `create or replace` and self-contained), then:
--   drop function if exists public.apply_fixture_scoring(uuid);
--   drop table if exists public.scoring_rules;
-- Note migration 021 also re-declares score_fixture_predictions; re-apply
-- it AFTER predictor-schema.sql to restore the economy call.
-- ============================================================
