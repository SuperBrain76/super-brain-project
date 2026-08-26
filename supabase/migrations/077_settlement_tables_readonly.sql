-- ============================================================
-- MIGRATION 077 — Settlement-authority tables are client-read-only
--
-- 🔴 FOUND BY verify-075-privileges.sql ON THE PRODUCTION DB (26 Aug 2026):
--   has_table_privilege('authenticated','public.fixture_entrant_results','UPDATE')
--   returned TRUE.
--
-- Supabase's default privileges grant the `authenticated` (and `anon`) role
-- table-level INSERT/UPDATE/DELETE on every new public table. Migrations 073
-- created fixture_entrant_results and competition_standings with RLS enabled
-- and only a SELECT policy, so a direct client write is BLOCKED BY RLS in
-- practice — but the table GRANT should not exist at all on settlement-
-- authority tables. Same posture 075 established for predictions (there via
-- column grants). This makes the grant layer agree with RLS: defense in
-- depth, not either-or.
--
-- Scope — three tables that decide scoring/settlement and that NO client
-- writes (verified: every writer is a SECURITY DEFINER RPC running as owner,
-- or a service-role server route that bypasses grants; the only browser-
-- client fixtures write, adminUpdateFixtureTeams, is dead code with zero
-- callers):
--   · fixtures                 — scores here drive scoring
--   · fixture_entrant_results  — the F1 classification (settlement input)
--   · competition_standings    — ingested championship tables
-- SELECT stays granted (public read via RLS). Only write grants are revoked.
--
-- DEPENDS ON: 073 (settlement tables). SAFE TO RE-RUN: yes (revoke is idempotent).
-- ROLLBACK: at the foot of this file.
-- ============================================================

revoke insert, update, delete on public.fixtures                from anon, authenticated;
revoke insert, update, delete on public.fixture_entrant_results from anon, authenticated;
revoke insert, update, delete on public.competition_standings   from anon, authenticated;

insert into public.schema_migrations (version, name, notes)
values ('077', 'settlement_tables_readonly',
        'Revoke client INSERT/UPDATE/DELETE on fixtures, '
        'fixture_entrant_results, competition_standings (settlement authority). '
        'No client writes them — every writer is SECURITY DEFINER or service '
        'role. SELECT (public read) unchanged. Found by verify-075.')
on conflict (version) do nothing;

do $$
begin
  raise notice 'Migration 077 applied.';
  raise notice 'ACCEPTANCE: verify-075-privileges.sql — the fixture_entrant_results';
  raise notice 'and fixtures UPDATE checks now pass; public read still works and';
  raise notice 'the ingest cron (service role) still writes results/standings.';
end;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- grant insert, update, delete on public.fixtures                to anon, authenticated;
-- grant insert, update, delete on public.fixture_entrant_results to anon, authenticated;
-- grant insert, update, delete on public.competition_standings   to anon, authenticated;
-- (restores Supabase's default table-level write grants)
-- ============================================================
