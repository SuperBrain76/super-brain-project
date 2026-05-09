-- ============================================================
-- SuperBrain — Security + Auth migration
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================


-- ── 1. FIX CRITICAL RLS BUG ON test_results ─────────────────
-- The "anyone can read shared results" policy allowed any
-- authenticated user to read every row with a share_id set.
-- Shared results are now served exclusively via the
-- get_challenge_result() SECURITY DEFINER RPC.

drop policy if exists "anyone can read shared results" on public.test_results;

-- Keep: users can read their own results
-- (policy "users can read own results" already exists from schema.sql)
-- Re-create it idempotently just in case:
drop policy if exists "users can read own results" on public.test_results;
create policy "users can read own results"
  on public.test_results for select
  using (auth.uid() = user_id);

-- Ensure insert is still locked to the owner:
drop policy if exists "users can insert own results" on public.test_results;
create policy "users can insert own results"
  on public.test_results for insert
  with check (auth.uid() = user_id);


-- ── 2. FIX birth_year CONSTRAINT ────────────────────────────
-- Old constraint: 1920 – 2015  (too narrow on both ends)
-- New constraint: 1920 – (current year - 8)
-- Using 2020 as a forward-safe upper bound; extend as needed.

alter table public.user_profiles
  drop constraint if exists user_profiles_birth_year_check;

alter table public.user_profiles
  add constraint user_profiles_birth_year_check
  check (birth_year between 1920 and 2030);
-- Note: upper bound 2030 is intentionally generous so the
-- constraint never needs changing again. The UI enforces
-- the current_year - 8 limit.


-- ── 3. ADD avatar_color COLUMN ───────────────────────────────
alter table public.user_profiles
  add column if not exists avatar_color text default '#00d4ff';


-- ── 4. test_feedback TABLE + RLS ────────────────────────────
-- Create if missing, then apply RLS.

create table if not exists public.test_feedback (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid        references auth.users(id) on delete set null,
  test_name       text        not null,
  score           integer     not null,
  result_title    text        not null default '',
  felt_options    text[]      not null default '{}',
  would_share     text,
  almost_quit     text,
  test_suggestion text
);

create index if not exists test_feedback_user_id_idx on public.test_feedback (user_id);

alter table public.test_feedback enable row level security;

-- Anyone (including anon) may insert feedback.
drop policy if exists "anyone can submit feedback" on public.test_feedback;
create policy "anyone can submit feedback"
  on public.test_feedback for insert
  with check (true);

-- Users can read their own feedback only.
drop policy if exists "users can read own feedback" on public.test_feedback;
create policy "users can read own feedback"
  on public.test_feedback for select
  using (auth.uid() = user_id);

-- No direct reads from the public (admin page uses RPC below).


-- ── 5. get_all_feedback RPC (admin use) ─────────────────────
-- Requires authenticated session. UI further gates on admin email.

create or replace function public.get_all_feedback()
returns table (
  id              uuid,
  created_at      timestamptz,
  test_name       text,
  score           integer,
  result_title    text,
  felt_options    text[],
  would_share     text,
  almost_quit     text,
  test_suggestion text,
  user_id         uuid
)
language sql
security definer
stable
as $$
  select
    id, created_at, test_name, score, result_title,
    felt_options, would_share, almost_quit, test_suggestion, user_id
  from public.test_feedback
  order by created_at desc
  limit 500;
$$;

-- Only authenticated users may call this.
-- The UI adds a second gate: NEXT_PUBLIC_ADMIN_EMAIL check.
revoke execute on function public.get_all_feedback from anon;
grant  execute on function public.get_all_feedback to authenticated;


-- ── 6. VERIFY user_profiles RLS ─────────────────────────────
-- Re-apply idempotently to confirm they exist.

alter table public.user_profiles enable row level security;

drop policy if exists "users can read own profile" on public.user_profiles;
create policy "users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.user_profiles;
create policy "users can update own profile"
  on public.user_profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT policy needed: the handle_new_user() trigger
-- (SECURITY DEFINER) creates the profile row on signup.


-- ── 7. ENSURE get_leaderboard NEVER LEAKS PRIVATE DATA ──────
-- Re-create the function to confirm it only exposes safe columns.
-- Already correct in schema.sql, re-stated here for audit trail.

create or replace function public.get_leaderboard(
  filter_test_name text default null,
  filter_country   text default null
)
returns table (
  rank         bigint,
  test_name    text,
  score        integer,
  percentile   integer,
  result_title text,
  display_name text,
  country      text
)
language sql
security definer
stable
as $$
  with best_per_user as (
    select distinct on (r.user_id, r.test_name)
      r.user_id,
      r.test_name,
      r.score,
      r.percentile,
      r.result_title
    from public.test_results r
    where (filter_test_name is null or r.test_name = filter_test_name)
    order by r.user_id, r.test_name, r.score desc, r.created_at asc
  )
  select
    row_number() over (order by b.score desc) as rank,
    b.test_name,
    b.score,
    b.percentile,
    b.result_title,
    coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
    p.country
    -- user_id is intentionally excluded
    -- birth_year, gender, industry are intentionally excluded
  from best_per_user b
  left join public.user_profiles p on p.id = b.user_id
  where (filter_country is null or p.country = filter_country)
  order by b.score desc
  limit 100;
$$;

grant execute on function public.get_leaderboard to anon, authenticated;


-- ── 8. ENSURE get_challenge_result NEVER LEAKS PRIVATE DATA ─
-- Re-stated for audit trail. Same guarantees as above.

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
  -- user_id excluded intentionally
)
language sql
security definer
stable
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
