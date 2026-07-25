-- ============================================================
-- PREFLIGHT — what is already applied in production?
--
-- READ-ONLY. Safe to run anytime, including under freeze.
-- Answers deployment step 1: "are migrations 037–050 applied?"
--
-- Paste the whole file into the Supabase SQL editor and read the four
-- blocks. It needs no arguments.
-- ============================================================


\echo '=== BLOCK A — migration ledger (versions recorded by 037+) ==='
-- schema_migrations is created by 037. If this errors with "relation does
-- not exist", then 037 has NOT been applied and you are starting from zero.

select version, name, applied_at
from public.schema_migrations
order by version;
-- EXPECTED for a fully-prepared production: rows for 037 through 052.
-- Whatever is MISSING here is what you still need to apply.


\echo '=== BLOCK B — key objects, existence probe (catches partial/manual applies) ==='
-- The ledger only covers 037+. This probes the actual objects each migration
-- creates, so you can tell a real partial apply from a missing ledger row.

select
  to_regclass('public.schema_migrations')        is not null as has_037_ledger,
  exists(select 1 from information_schema.columns
         where table_name='fixtures' and column_name='provider_fixture_id') as has_039_provider_id,
  to_regclass('public.competition_stages')       is not null as has_040_stages,
  to_regclass('public.seasons')                  is not null as has_041_seasons,
  to_regclass('public.rounds')                   is not null as has_042_rounds,
  to_regclass('public.competition_settings')     is not null as has_043_settings,
  to_regclass('public.scoring_rules')            is not null as has_044_scoring,
  to_regclass('public.sports')                   is not null as has_045_sports,
  to_regclass('public.competition_economy_rules') is not null as has_048_economy,
  to_regclass('public.competition_templates')    is not null as has_049_wizard,
  to_regclass('public.round_editorial')          is not null as has_050_editorial,
  exists(select 1 from pg_proc where proname='block_write_if_archived')      as has_051_lifecycle,
  exists(select 1 from pg_proc where proname='get_my_competition_history')   as has_052_history;
-- EVERY column false → production is on the pre-engine (World Cup) schema:
--   apply 037 → 052 in order.
-- Some true, some false → partial: apply only the missing ones, in order.
-- All true → engine + lifecycle already applied; skip to the PL seed.


\echo '=== BLOCK C — the 040 constraint (the risky one) ==='
-- Migration 040 replaces the fixtures.stage CHECK with an FK to
-- competition_stages. This tells you which state 040 is in.

select
  exists(select 1 from pg_constraint c
         join pg_class r on r.oid=c.conrelid
         where r.relname='fixtures' and c.contype='c'
           and pg_get_constraintdef(c.oid) ilike '%stage%'
           and pg_get_constraintdef(c.oid) ilike '%group%')  as stage_check_still_present,
  exists(select 1 from pg_constraint where conname='fixtures_stage_fk') as stage_fk_present;
-- Before 040: stage_check_still_present = true,  stage_fk_present = false.
-- After  040: stage_check_still_present = false, stage_fk_present = true.
-- If the check is gone but the FK is absent, 040 half-applied — investigate
-- (the migration is written so the system still works in that state).


\echo '=== BLOCK D — current competitions and their lifecycle ==='
-- Where the World Cup and (if seeded) Premier League currently stand.

select
  c.slug, c.name, c.status,
  (select value from public.competition_settings s
     where s.competition_id=c.id and s.key='lifecycle') as lifecycle,
  (select value from public.competition_settings s
     where s.competition_id=c.id and s.key='visible')   as visible,
  (select count(*) from public.fixtures f where f.competition_id=c.id) as fixtures
from public.competitions c
order by c.created_at;
-- Note: if BLOCK B showed competition_settings does not exist yet, this
-- block's subqueries will error — that itself confirms 043 is not applied.
-- EXPECTED end state: wc2026 lifecycle "archived"; premier-league "draft".
