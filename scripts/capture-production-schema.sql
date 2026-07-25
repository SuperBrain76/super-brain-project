-- ============================================================================
-- PRODUCTION SCHEMA CAPTURE — read-only inventory
-- ----------------------------------------------------------------------------
-- Purpose: produce the sanitized production schema baseline required by Phase 0.
--
-- SAFETY
--   • Every statement is a SELECT against system catalogs. Nothing is created,
--     altered, dropped or written. Safe to run during the production freeze.
--   • Returns SCHEMA ONLY. No user rows, predictions, emails, tokens or secrets.
--   • Run in: Supabase Dashboard → SQL Editor. Run each block, export each
--     result to CSV/JSON, and commit the combined output as:
--         supabase/schema-production-baseline-2026-07.sql
--
-- WHY THIS EXISTS
--   The repository is known NOT to describe production. Confirmed evidence:
--     - teams.fifa_ranking          — queried at lib/predictor.ts:275, in no repo SQL
--     - get_user_public_predictions — called at lib/predictor.ts:1253, in no repo SQL
--     - get_leaderboard_stats       — called at lib/leaderboard.ts:65,  in no repo SQL
--   Block 10 below is the decisive one: it answers "what exists in production
--   that source control has never seen?"
--
--   The preferred alternative, if you have the Supabase CLI and the DB password,
--   is a single command that produces a far better artifact than this script:
--
--       supabase db dump --db-url "<CONNECTION_STRING>" --schema public -f \
--         supabase/schema-production-baseline-2026-07.sql
--
--   Use the CLI if you can. Use this script if you only have dashboard access.
--   NEVER paste a connection string or password into a file that is committed.
-- ============================================================================


-- ── 1. TABLES ───────────────────────────────────────────────────────────────
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;


-- ── 2. COLUMNS — types, nullability, defaults ───────────────────────────────
-- Compare this output against the repo DDL. Any row here that the repo does not
-- declare is drift. Start with teams.fifa_ranking.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  coalesce(character_maximum_length::text, numeric_precision::text, '') as size,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- ── 3. PRIMARY KEYS & UNIQUE CONSTRAINTS ────────────────────────────────────
select
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.table_schema    = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
group by tc.table_name, tc.constraint_type, tc.constraint_name
order by tc.table_name, tc.constraint_type;


-- ── 4. FOREIGN KEYS (incl. delete rules) ────────────────────────────────────
-- The delete rules matter: account deletion currently relies on ON DELETE CASCADE
-- to auth.users. See docs/SCHEMA_DRIFT_REPORT.md §Account deletion.
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name  as references_table,
  ccu.column_name as references_column,
  rc.delete_rule,
  rc.update_rule,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name, kcu.column_name;


-- ── 5. CHECK CONSTRAINTS ────────────────────────────────────────────────────
-- CRITICAL for Phase 1. Confirm the exact live definition of:
--   fixtures.stage   — expected: ('group','r32','r16','qf','sf','3rd','final')
--   fixtures.status  — expected: ('scheduled','live','completed','postponed')
-- If production differs from the repo, the Phase 1 migration plan changes.
select
  rel.relname   as table_name,
  con.conname   as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public'
  and con.contype = 'c'
order by rel.relname, con.conname;


-- ── 6. INDEXES ──────────────────────────────────────────────────────────────
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;


-- ── 7. FUNCTIONS & RPCs (full source) ───────────────────────────────────────
-- This is the highest-value block. It reveals every function that exists in
-- production, including any never committed to source control.
-- Expect to find get_user_public_predictions and get_leaderboard_stats here.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  case p.prosecdef when true then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;


-- ── 8. TRIGGERS ─────────────────────────────────────────────────────────────
-- Confirm exactly two on fixtures/predictions: auto_score_predictions and
-- prediction_deadline_check. Anything else is unexpected and must be explained.
select
  c.relname as table_name,
  t.tgname  as trigger_name,
  pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;


-- ── 9. ROW LEVEL SECURITY ───────────────────────────────────────────────────
select
  c.relname as table_name,
  c.relrowsecurity  as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

select
  schemaname, tablename, policyname,
  permissive, roles, cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ── 10. VIEWS & MATERIALIZED VIEWS ──────────────────────────────────────────
select table_name, view_definition
from information_schema.views
where table_schema = 'public'
order by table_name;

select matviewname, definition
from pg_matviews
where schemaname = 'public'
order by matviewname;


-- ── 11. GRANTS (anon / authenticated / service_role) ────────────────────────
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  coalesce(array_to_string(p.proacl, ' | '), 'default (public execute)') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;


-- ── 12. SUPABASE MIGRATION HISTORY (may not exist) ──────────────────────────
-- If this errors with "relation does not exist", that IS the finding: migrations
-- were applied by hand and production has no migration ledger.
-- See docs/MIGRATION_HISTORY_ASSESSMENT.md.
select version, name, statements is not null as has_statements
from supabase_migrations.schema_migrations
order by version;


-- ── 13. STORAGE BUCKETS (config only, no objects) ───────────────────────────
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;


-- ── 14. ROW COUNTS — SANITY ONLY, NO CONTENT ────────────────────────────────
-- Volumetrics for migration planning. Counts only; no rows are read out.
select
  'competitions' as t, count(*) from public.competitions union all
select 'teams',        count(*) from public.teams        union all
select 'fixtures',     count(*) from public.fixtures     union all
select 'predictions',  count(*) from public.predictions  union all
select 'bonus_questions', count(*) from public.bonus_questions
order by 1;


-- ============================================================================
-- AFTER RUNNING
--   1. Export each block's output.
--   2. Assemble into supabase/schema-production-baseline-2026-07.sql.
--   3. Confirm the file contains NO rows from user_profiles, predictions,
--      test_results, economy_ledger or auth.*, and no keys or connection strings.
--   4. Commit it as documentation. DO NOT APPLY IT TO ANY DATABASE.
--   5. Complete the Production column in docs/SCHEMA_DRIFT_REPORT.md.
-- ============================================================================
