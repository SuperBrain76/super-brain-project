-- ============================================================
-- MIGRATION 037 — Schema reconciliation  🔴 GATE
--
-- Competition Engine V2, Phase 1.0.
--
-- PURPOSE
--   Make the repository an accurate description of production.
--   This migration is a DELIBERATE NO-OP against the live database:
--   every statement is `if not exists` / conditional. It declares what
--   production already has so that a FRESH database, built by replaying
--   supabase/ in documented order, reproduces production exactly.
--
--   If any statement in this file actually CHANGES production, that is a
--   finding — it means the object was missing and something was broken.
--   Every such statement raises a NOTICE saying so.
--
-- DEPENDS ON: predictor-schema.sql, migrations 001–036
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: none required — no destructive statement exists in this file.
--
-- ⚠️ BEFORE RUNNING: capture the production baseline first.
--    scripts/capture-production-schema.sql  →
--    supabase/schema-production-baseline-2026-07.sql
--    See docs/SCHEMA_DRIFT_REPORT.md.
-- ============================================================


-- ── 0. Migration ledger ──────────────────────────────────────
-- docs/MIGRATION_HISTORY_ASSESSMENT.md: there is no record anywhere of
-- which migrations have been applied. Migrations are pasted into the
-- Supabase SQL editor by hand and nothing is written down. From 037
-- onward, every migration records itself here as its last statement.
--
-- Rows 001–036 are NOT backfilled automatically: we do not know which
-- ones ran, and inventing that record is worse than admitting the gap.
-- Backfill by hand once the baseline confirms what production contains.

create table if not exists public.schema_migrations (
  version     text        primary key,
  name        text        not null,
  applied_at  timestamptz not null default now(),
  applied_by  text        not null default current_user,
  notes       text
);

alter table public.schema_migrations enable row level security;

-- No policies: service_role and the SQL editor bypass RLS; ordinary
-- clients have no business reading the migration ledger.

comment on table public.schema_migrations is
  'Applied-migration ledger. Written by each migration from 037 onward. '
  'Versions 001-036 predate the ledger and must be backfilled by hand '
  'against the production baseline — see docs/MIGRATION_HISTORY_ASSESSMENT.md.';


-- ── 1. Known drift: teams.fifa_ranking ───────────────────────
-- Referenced by lib/predictor.ts FIXTURE_SELECT on every fixtures query
-- and mapped into Team.fifaRanking. Present in production (if it were
-- absent, PostgREST would 400 and /predict would be broken — it is not).
-- Defined in NO repository file. This declares it.
--
-- Type note: declared integer/null to match how the application reads it
-- (`r.fifa_ranking as number | null`). If the production baseline shows a
-- different type or a default, correct THIS line to match production —
-- do not alter production to match this line.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teams' and column_name = 'fifa_ranking'
  ) then
    alter table public.teams add column fifa_ranking integer;
    raise notice '037 FINDING: teams.fifa_ranking was ABSENT and has been created. '
                 'Production differed from the documented assumption — investigate.';
  else
    raise notice '037 ok: teams.fifa_ranking already present (expected).';
  end if;
end;
$$;


-- ── 2. Known drift: get_user_public_predictions ──────────────
-- Called at lib/predictor.ts:1253 with (p_user_id, p_competition_id).
-- Migration 018 adds the supporting RLS policy and MENTIONS this function
-- in a comment, but never creates it.
--
-- The call site discards the error:
--     const { data: predData } = await supabase.rpc(...)
-- so if the function is absent, /predict/user/[userId] renders every
-- fixture with no predictions and NO error — indistinguishable from a
-- user who predicted nothing. It has possibly been failing invisibly.
--
-- ⚠️ CREATE ONLY IF ABSENT. We have never seen production's definition;
--    `create or replace` would silently overwrite a working function with
--    a guess. If it exists, this block leaves it completely alone and the
--    real definition must be captured into source control by hand.

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_user_public_predictions'
  ) then
    raise notice '037 ok: get_user_public_predictions exists in production. '
                 'CONFIRMED DRIFT — capture its definition into source control '
                 '(capture-production-schema.sql block 7). Not modified here.';
  else
    raise notice '037 FINDING: get_user_public_predictions is ABSENT. '
                 '/predict/user/[userId] has been silently broken. Creating it.';

    execute $fn$
      create function public.get_user_public_predictions(
        p_user_id        uuid,
        p_competition_id uuid
      )
      returns table (
        fixture_id     uuid,
        home_score     integer,
        away_score     integer,
        points_awarded integer
      )
      language sql
      security definer stable
      set search_path = public
      as $body$
        -- Only predictions on fixtures that have already kicked off are
        -- public. Enforced here, server-side, not by the caller.
        select p.fixture_id, p.home_score, p.away_score, p.points_awarded
        from public.predictions p
        join public.fixtures f on f.id = p.fixture_id
        where p.user_id = p_user_id
          and f.competition_id = p_competition_id
          and f.kicks_off_at <= now();
      $body$;
    $fn$;

    grant execute on function public.get_user_public_predictions(uuid, uuid) to anon, authenticated;
  end if;
end;
$$;


-- ── 3. Known drift: get_leaderboard_stats ────────────────────
-- Called at lib/leaderboard.ts:65 with (p_test_name). Cognitive-test
-- surface, not predictor — declared here for completeness because it is
-- the third confirmed drift object in docs/SCHEMA_DRIFT_REPORT.md.
-- Same create-only-if-absent rule.

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_leaderboard_stats'
  ) then
    raise notice '037 ok: get_leaderboard_stats exists in production. '
                 'CONFIRMED DRIFT — capture its definition into source control.';
  else
    raise notice '037 FINDING: get_leaderboard_stats is ABSENT — stats panel silently empty.';

    execute $fn$
      create function public.get_leaderboard_stats(p_test_name text)
      returns table (
        total_attempts bigint,
        total_players  bigint
      )
      language sql
      security definer stable
      set search_path = public
      as $body$
        select count(*)::bigint, count(distinct user_id)::bigint
        from public.test_results
        where test_name = p_test_name;
      $body$;
    $fn$;

    grant execute on function public.get_leaderboard_stats(text) to anon, authenticated;
  end if;
end;
$$;


-- ── 4. Record ────────────────────────────────────────────────

insert into public.schema_migrations (version, name, notes)
values ('037', 'schema_reconciliation',
        'Phase 1.0 gate. Declares fifa_ranking + 2 drifted RPCs. Adds this ledger. '
        'Intended as a no-op against production — read the NOTICEs.')
on conflict (version) do nothing;

do $$
begin
  raise notice '';
  raise notice '════════════════════════════════════════════════════';
  raise notice 'Migration 037 complete.';
  raise notice 'READ THE NOTICES ABOVE. Any line containing "FINDING"';
  raise notice 'means production differed from the repository and this';
  raise notice 'migration was NOT a no-op. Record it in the drift report.';
  raise notice '════════════════════════════════════════════════════';
end;
$$;
