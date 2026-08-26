-- ============================================================
-- MIGRATION 075 — Prediction write privileges (adversarial audit)
--
-- 🔴 FOUND BY THE PRE-LAUNCH ADVERSARIAL AUDIT (26 Aug 2026).
--
-- Supabase's default grants give `authenticated` full column access to
-- public tables; RLS then gates ROWS, not COLUMNS. The predictions UPDATE
-- policy allows a user to update their own rows — with no column
-- restriction. Combined with the deadline trigger's deliberate
-- scores/payload short-circuit (which must let the scoring engine write
-- points_awarded), an ordinary authenticated player could, via direct
-- PostgREST calls:
--
--   · set their own points_awarded to any value, on any of their
--     predictions, at any time — including after settlement. Leaderboards
--     sum points_awarded, so this is direct leaderboard forgery. (The IQ
--     economy is keyed to amount_map values, so a forged 999 mints nothing,
--     but a forged 5 both forges the leaderboard AND mints IQ at the next
--     economy reconciliation of that fixture.)
--   · set is_banker directly, bypassing set_banker's one-per-round rule
--     (several bankers in one round → several ×2 multipliers).
--   · retarget an already-scored prediction to a different fixture
--     (fixture_id is user-writable and unchanged scores pass the deadline
--     short-circuit), carrying phantom points until that fixture settles.
--
-- This is NOT F1-specific — it applies to football today — but F1's launch
-- audit is when it was proven, so it is closed before that launch.
--
-- Fix, two layers:
--   1. COLUMN PRIVILEGES — clients may write exactly the columns the app's
--      only two write paths use (lib/predictor.ts upsertPrediction /
--      upsertOrderingPrediction): user_id, fixture_id, home_score,
--      away_score, payload, updated_at. points_awarded, is_banker,
--      submitted_at and id are no longer writable by anon/authenticated.
--      SECURITY DEFINER functions (scoring, settle_ordering_fixture,
--      set_banker, admin RPCs) run as the owner and are unaffected.
--      NOTE: user_id and fixture_id STAY grantable because PostgREST
--      upserts emit `on conflict … do update set` over every supplied
--      column — revoking them would break every prediction upsert. The
--      trigger below is what actually pins them.
--   2. IDENTITY PIN — a trigger rejects any UPDATE that changes user_id or
--      fixture_id. Upserts are unaffected (the conflict target guarantees
--      the "new" values equal the old ones); only genuine retargeting dies.
--
-- DEPENDS ON: 045 (payload), 055 (set_banker), 073 (ordering shape).
-- SAFE TO RE-RUN: yes (grants/revokes and create-or-replace are idempotent).
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. Column privileges ─────────────────────────────────────

revoke insert, update on public.predictions from anon, authenticated;

grant insert (user_id, fixture_id, home_score, away_score, payload, updated_at)
  on public.predictions to authenticated;

grant update (user_id, fixture_id, home_score, away_score, payload, updated_at)
  on public.predictions to authenticated;

-- anon keeps nothing writable: RLS already blocked it (auth.uid() is null),
-- the grant layer now agrees.


-- ── 2. Identity pin ──────────────────────────────────────────

create or replace function public.enforce_prediction_identity()
returns trigger
language plpgsql
security definer set search_path to 'public'
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.fixture_id is distinct from old.fixture_id then
    raise exception 'A prediction cannot be moved to another user or fixture.';
  end if;
  return new;
end;
$$;

drop trigger if exists prediction_identity_check on public.predictions;
create trigger prediction_identity_check
  before update on public.predictions
  for each row execute function public.enforce_prediction_identity();


insert into public.schema_migrations (version, name, notes)
values ('075', 'prediction_write_privileges',
        'Adversarial audit: clients could write points_awarded/is_banker '
        'directly and retarget scored predictions. Column grants narrowed to '
        'the two client write paths; user_id/fixture_id pinned by trigger.')
on conflict (version) do nothing;

do $$
begin
  raise notice 'Migration 075 applied.';
  raise notice 'ACCEPTANCE: run scripts/verify-075-privileges.sql — as role';
  raise notice 'authenticated, writes to points_awarded/is_banker must be';
  raise notice 'permission-denied, while the app''s own insert/update column';
  raise notice 'set still works and set_banker still toggles via the RPC.';
end;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop trigger if exists prediction_identity_check on public.predictions;
-- drop function if exists public.enforce_prediction_identity();
-- grant insert, update on public.predictions to authenticated;
-- grant insert, update on public.predictions to anon;
-- (restores the pre-075 Supabase default table-level grants)
-- ============================================================
