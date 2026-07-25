-- ============================================================
-- MIGRATION 039 — Fixture identity via provider fixture IDs
--
-- Competition Engine V2, Phase 1.1.  See docs/FIXTURE_IDENTITY_RISK.md.
--
-- ────────────────────────────────────────────────────────────
-- WHY
-- ────────────────────────────────────────────────────────────
-- Ingestion has no stable link between a provider fixture and a database
-- fixture. It infers one from kickoff-time proximity (±90 minutes), with
-- a team-name assist added later. That is safe for the World Cup only
-- because WC matches are >=3 hours apart — a property of the tournament,
-- not of the code.
--
-- Ten Premier League matches kick off at 15:00 on a Saturday. The ±90min
-- candidate set is then all ten, `Array.prototype.find` returns the FIRST
-- one, and a result lands on the wrong fixture — scoring the wrong
-- predictions and minting the wrong IQ, silently.
--
-- This migration adds the stable link. The code change that uses it is in
-- lib/ingestion.ts (findDbFixtureByProviderId).
--
-- ────────────────────────────────────────────────────────────
-- ORDER OF OPERATIONS — IMPORTANT
-- ────────────────────────────────────────────────────────────
--   1. This migration: add NULLABLE columns + a non-unique index. No
--      constraint yet. Nothing can fail.
--   2. Backfill:  POST /api/admin/backfill-provider-ids  (dry run first)
--   3. Verify:    scripts/verify-039-provider-ids.sql — must show 104/104
--                 for wc2026 and zero duplicates.
--   4. ONLY THEN: run part 2 at the bottom of this file to add the UNIQUE
--      constraint.
--
-- Adding the unique constraint before the backfill is verified would
-- either fail outright or lock in a bad mapping. Do not shortcut this.
--
-- WORLD CUP COMPATIBILITY
--   Total. Writes a new column. Touches no score, no prediction, no point.
--   WC ingestion is a no-op today anyway (isTournamentWindow() has been
--   false since 20 July 2026), so there is no concurrent writer. This is
--   the safest window this change will ever have.
--
-- DEPENDS ON: 037
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: alter table public.fixtures
--             drop column if exists provider_fixture_id,
--             drop column if exists provider;
--           …and revert lib/ingestion.ts. Kickoff matching still works.
-- ============================================================


-- ── PART 1 — additive, always safe ───────────────────────────

alter table public.fixtures add column if not exists provider            text;
alter table public.fixtures add column if not exists provider_fixture_id text;

comment on column public.fixtures.provider is
  'Result-provider key, e.g. ''api-football''. Null = never ingested (manual fixture).';
comment on column public.fixtures.provider_fixture_id is
  'The provider''s own immutable fixture id. THE identity used to match incoming '
  'results. Never match on kickoff time when this is populated.';

-- Non-unique for now: lookups get fast immediately, the constraint waits
-- for a verified backfill.
create index if not exists fixtures_provider_lookup_idx
  on public.fixtures (provider, provider_fixture_id)
  where provider_fixture_id is not null;

-- Reporting index: "which fixtures in this competition still lack an id?"
create index if not exists fixtures_missing_provider_idx
  on public.fixtures (competition_id)
  where provider_fixture_id is null;


-- ── PART 2 — UNIQUE CONSTRAINT — DO NOT RUN YET ──────────────
--
-- Run this ONLY after scripts/verify-039-provider-ids.sql reports
-- 104/104 mapped for wc2026 and zero duplicate provider ids.
--
-- Kept commented rather than guarded-and-automatic on purpose: this is a
-- constraint on the table that holds every prediction, and it should be
-- applied by a human who has just read the verification output.
--
-- ------------------------------------------------------------
-- create unique index concurrently if not exists fixtures_provider_uniq_idx
--   on public.fixtures (provider, provider_fixture_id)
--   where provider_fixture_id is not null;
--
-- -- `concurrently` cannot run inside a transaction block. In the Supabase
-- -- SQL editor run it as a single standalone statement.
-- --
-- -- Verify it took:
-- --   select indexname from pg_indexes
-- --    where tablename = 'fixtures' and indexname = 'fixtures_provider_uniq_idx';
-- ------------------------------------------------------------


insert into public.schema_migrations (version, name, notes)
values ('039', 'fixture_provider_identity',
        'Adds fixtures.provider + provider_fixture_id (nullable) and lookup indexes. '
        'UNIQUE constraint is deliberately NOT applied here — see PART 2.')
on conflict (version) do nothing;

do $$
begin
  raise notice 'Migration 039 applied (part 1 only — columns and indexes).';
  raise notice 'NEXT: backfill provider ids, then verify, THEN apply PART 2 by hand.';
end;
$$;
