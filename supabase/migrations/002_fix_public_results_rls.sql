-- ============================================================
-- MIGRATION 002 — Fix critical RLS vulnerability on test_results
-- ============================================================
--
-- ROOT CAUSE
-- ----------
-- The original schema.sql contained:
--
--   create policy "anyone can read shared results"
--     on public.test_results for select
--     using (share_id is not null);
--
-- Because saveResult() ALWAYS generates a share_id for every result,
-- this policy makes EVERY row in test_results publicly readable by
-- anyone — including other users' private results.
--
-- FIX
-- ---
-- 1. Drop the permissive policy.
-- 2. Keep only the "own results" policy (auth.uid() = user_id).
-- 3. Shared results are accessed exclusively via the SECURITY DEFINER
--    RPC get_challenge_result(p_share_id), which:
--      • Requires a valid share_id (not enumerable)
--      • Never returns user_id
--      • Never exposes birth_year, gender, or industry
--
-- ALSO FIXES
-- ----------
-- 4. Expand birth_year constraint (was 1920–2015, now 1920–2030)
--    so users born after 2015 can save their birth year.
-- 5. Add avatar_color column if missing (idempotent).
--
-- HOW TO APPLY
-- ------------
-- Supabase Dashboard → SQL Editor → paste → Run
-- Safe to run multiple times (idempotent).
-- ============================================================


-- ── 1. Drop the bad policy ────────────────────────────────────

drop policy if exists "anyone can read shared results" on public.test_results;


-- ── 2. Re-affirm the correct own-results policy ───────────────
-- Drop + recreate makes this idempotent.

drop policy if exists "users can read own results" on public.test_results;

create policy "users can read own results"
  on public.test_results for select
  using (auth.uid() = user_id);


-- ── 3. Ensure insert policy exists ───────────────────────────

drop policy if exists "users can insert own results" on public.test_results;

create policy "users can insert own results"
  on public.test_results for insert
  with check (auth.uid() = user_id);


-- ── 4. Fix birth_year constraint ─────────────────────────────

alter table public.user_profiles
  drop constraint if exists user_profiles_birth_year_check;

alter table public.user_profiles
  add constraint user_profiles_birth_year_check
  check (birth_year between 1920 and 2030);


-- ── 5. Ensure avatar_color column exists ─────────────────────

alter table public.user_profiles
  add column if not exists avatar_color text default '#00d4ff';


-- ── 6. Re-affirm user_profiles RLS policies ──────────────────
-- Paranoia check: ensure no permissive read-all policy crept in.

drop policy if exists "users can read own profile" on public.user_profiles;

create policy "users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.user_profiles;

create policy "users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ── 7. Verify RLS is enabled on both tables ──────────────────
-- (No-ops if already enabled; included for completeness.)

alter table public.test_results    enable row level security;
alter table public.user_profiles   enable row level security;


-- ── 8. Re-create get_challenge_result to explicitly NOT expose user_id ──

create or replace function public.get_challenge_result(p_share_id text)
returns table (
  id           uuid,
  test_name    text,
  score        integer,
  percentile   integer,
  result_title text,
  share_id     text,
  created_at   timestamptz,
  display_name text,
  country      text
  -- user_id is intentionally EXCLUDED
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.test_name,
    r.score,
    r.percentile,
    r.result_title,
    r.share_id,
    r.created_at,
    coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
    p.country
  from public.test_results r
  left join public.user_profiles p on p.id = r.user_id
  where r.share_id = p_share_id
  limit 1;
$$;

grant execute on function public.get_challenge_result to anon, authenticated;


-- ── 9. Audit log: record that this migration was applied ──────

do $$
begin
  raise notice 'Migration 002 applied: critical RLS fix on test_results';
  raise notice 'Dropped policy: "anyone can read shared results"';
  raise notice 'Retained policy: "users can read own results" (auth.uid() = user_id)';
  raise notice 'Shared results now served exclusively via get_challenge_result() RPC';
end;
$$;
