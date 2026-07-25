-- ============================================================
-- MIGRATION 040 — Competition stages: replace the closed CHECK  🔴 HIGH RISK
--
-- Competition Engine V2, Phase 1.2.
--
-- ⚠️ THIS IS THE RISKIEST MIGRATION IN THE ENTIRE PLAN. ⚠️
-- It alters a constraint on `fixtures` — the table every prediction
-- points at. DO NOT RUN IT AGAINST PRODUCTION WITHOUT A STAGING
-- REHEARSAL. See PRODUCTION_FREEZE.md §3.
--
-- ────────────────────────────────────────────────────────────
-- WHY
-- ────────────────────────────────────────────────────────────
--   fixtures.stage text not null
--     check (stage in ('group','r32','r16','qf','sf','3rd','final'))
--
-- A Premier League fixture has no valid value here. The insert fails.
-- This single constraint is what blocks every league-format competition.
--
-- Replacing it with a wider CHECK would just move the problem. Instead
-- stages become DATA: one row per stage per competition, carrying the
-- display label and the two behavioural flags the UI actually branches on
-- (`has_table` for standings, `is_knockout` for the bracket).
--
-- ────────────────────────────────────────────────────────────
-- STEP ORDER IS LOAD-BEARING
-- ────────────────────────────────────────────────────────────
--   1. Create competition_stages
--   2. Seed the World Cup's 7 codes VERBATIM from the CHECK
--   3. Seed default stages for every other existing competition
--   4. VERIFY every existing fixture's stage resolves to a row
--        → if this fails, the migration ABORTS before touching anything
--   5. Drop the CHECK
--   6. Add the FK
--
-- If step 6 fails, step 5 alone is harmless — the system keeps working
-- with no constraint, which is strictly more permissive than before.
-- If step 4 fails, nothing has been changed at all.
--
-- WORLD CUP COMPATIBILITY
--   Full, PROVIDED step 4 passes. `fixtures.stage` values are not
--   modified — they simply point at rows now. stageLabel() output must be
--   byte-identical for all 7 codes; that is asserted in
--   tests/competition-stages.test.ts.
--
-- DEPENDS ON: 037
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: see the block at the foot of this file. Safe ONLY while no
--           league-format fixture exists — which is exactly why this
--           lands before any Premier League data.
-- ============================================================


-- ── 1. The table ─────────────────────────────────────────────

create table if not exists public.competition_stages (
  id             uuid    primary key default gen_random_uuid(),
  competition_id uuid    not null references public.competitions(id) on delete cascade,

  code           text    not null,   -- 'group' | 'r16' | 'league' | 'playoff' …
  label          text    not null,   -- 'Group Stage' | 'Round of 16' | 'Matchweek'
  sort_order     integer not null default 0,

  -- Behaviour flags. These are what the UI branches on — never the code.
  has_table      boolean not null default false,  -- renders a standings table
  is_knockout    boolean not null default false,  -- bracket + advance-knockout cron

  created_at     timestamptz not null default now(),

  unique (competition_id, code)
);

create index if not exists competition_stages_comp_idx
  on public.competition_stages (competition_id, sort_order);

alter table public.competition_stages enable row level security;

drop policy if exists "public read competition stages" on public.competition_stages;
create policy "public read competition stages"
  on public.competition_stages for select using (true);

comment on table public.competition_stages is
  'Stages of a competition, as data. Replaces the hardcoded fixtures.stage CHECK. '
  'Adding a competition format = inserting rows here, not editing a constraint.';
comment on column public.competition_stages.has_table is
  'True when fixtures in this stage feed a standings table (WC groups, league season). '
  'components/predictor/GroupStandings.tsx filters on THIS, not on code = ''group''.';
comment on column public.competition_stages.is_knockout is
  'True for single-elimination stages. Gates the bracket UI and the '
  'advance-knockout cron. MUST be false for every Premier League stage.';


-- ── 2. Seed the World Cup's stages, verbatim ─────────────────
-- Codes exactly as the CHECK declares them. Labels exactly as
-- lib/predictor.ts stageLabel() returns them today — copied character for
-- character, because any difference is a visible regression on historical
-- World Cup pages.

do $$
declare
  v_comp uuid;
begin
  select id into v_comp from public.competitions where slug = 'wc2026';

  if v_comp is null then
    raise notice '040: wc2026 not found — skipping World Cup stage seed.';
  else
    insert into public.competition_stages
      (competition_id, code, label, sort_order, has_table, is_knockout)
    values
      (v_comp, 'group', 'Group Stage',    1, true,  false),
      (v_comp, 'r32',   'Round of 32',    2, false, true),
      (v_comp, 'r16',   'Round of 16',    3, false, true),
      (v_comp, 'qf',    'Quarter-final',  4, false, true),
      (v_comp, 'sf',    'Semi-final',     5, false, true),
      (v_comp, '3rd',   'Third Place',    6, false, true),
      (v_comp, 'final', 'Final',          7, false, true)
    on conflict (competition_id, code) do nothing;

    raise notice '040: seeded 7 World Cup stages.';
  end if;
end;
$$;


-- ── 3. Seed stages for any other existing competition ────────
-- Defensive: derive rows from whatever stage values actually exist, so
-- step 4 cannot fail because of a competition nobody remembered.

do $$
declare
  r record;
begin
  for r in
    select distinct f.competition_id, f.stage
    from public.fixtures f
    left join public.competition_stages cs
           on cs.competition_id = f.competition_id and cs.code = f.stage
    where cs.id is null
  loop
    insert into public.competition_stages
      (competition_id, code, label, sort_order, has_table, is_knockout)
    values (
      r.competition_id,
      r.stage,
      initcap(replace(r.stage, '_', ' ')),
      0,
      r.stage in ('group', 'league'),
      r.stage in ('r32', 'r16', 'qf', 'sf', '3rd', 'final', 'playoff')
    )
    on conflict (competition_id, code) do nothing;

    raise notice '040: derived stage row for competition % code % — REVIEW its label and flags.',
                 r.competition_id, r.stage;
  end loop;
end;
$$;


-- ── 4. VERIFY — abort before changing anything if unresolved ─

do $$
declare
  v_unresolved integer;
begin
  select count(*) into v_unresolved
  from public.fixtures f
  left join public.competition_stages cs
         on cs.competition_id = f.competition_id and cs.code = f.stage
  where cs.id is null;

  if v_unresolved > 0 then
    raise exception
      '040 ABORTED: % fixture(s) have a stage with no matching competition_stages row. '
      'Nothing has been changed. Investigate with: '
      'select distinct competition_id, stage from public.fixtures f where not exists '
      '(select 1 from public.competition_stages cs where cs.competition_id = f.competition_id '
      'and cs.code = f.stage);', v_unresolved;
  end if;

  raise notice '040: verification passed — every fixture stage resolves.';
end;
$$;


-- ── 5. Drop the CHECK ────────────────────────────────────────
-- Constraint name is the Postgres default for an inline column CHECK.
-- Discovered defensively rather than assumed, because a hand-applied
-- database may carry a different name.

do $$
declare
  v_name text;
begin
  select con.conname into v_name
  from pg_constraint con
  join pg_class     rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'fixtures'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%stage%'
    and pg_get_constraintdef(con.oid) ilike '%group%'
  limit 1;

  if v_name is null then
    raise notice '040: no stage CHECK found (already dropped, or never named as expected).';
  else
    execute format('alter table public.fixtures drop constraint %I', v_name);
    raise notice '040: dropped stage CHECK constraint %.', v_name;
  end if;
end;
$$;


-- ── 6. Add the FK ────────────────────────────────────────────
-- (competition_id, stage) → competition_stages(competition_id, code).
-- NOT VALID first, then VALIDATE: takes a weaker lock and lets a
-- validation failure be diagnosed without holding up the table.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fixtures_stage_fk'
  ) then
    alter table public.fixtures
      add constraint fixtures_stage_fk
      foreign key (competition_id, stage)
      references public.competition_stages (competition_id, code)
      on update cascade
      not valid;

    alter table public.fixtures validate constraint fixtures_stage_fk;

    raise notice '040: added and validated fixtures_stage_fk.';
  else
    raise notice '040: fixtures_stage_fk already present.';
  end if;
exception when others then
  raise warning '040: FK creation failed (%). The CHECK is already dropped, so the '
                'system remains FUNCTIONAL and strictly more permissive than before. '
                'Investigate and add the FK separately — do NOT re-add the CHECK.', sqlerrm;
end;
$$;


insert into public.schema_migrations (version, name, notes)
values ('040', 'competition_stages',
        'Stages become data. Drops fixtures.stage CHECK, adds FK to competition_stages. '
        'HIGH RISK — required staging rehearsal.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK  (safe ONLY while no league-format fixture exists)
-- ============================================================
-- alter table public.fixtures drop constraint if exists fixtures_stage_fk;
-- alter table public.fixtures add constraint fixtures_stage_check
--   check (stage in ('group','r32','r16','qf','sf','3rd','final'));
-- drop table if exists public.competition_stages;
--
-- Re-adding the CHECK FAILS if any fixture already uses a league stage
-- code. That failure is correct and protective: it means rolling back
-- would orphan real data. Delete those fixtures first, or do not roll back.
-- ============================================================
