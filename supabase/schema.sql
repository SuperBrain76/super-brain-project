-- ============================================================
-- SuperBrain — full schema (idempotent, safe to re-run)
-- Supabase dashboard → SQL editor → Run
-- ============================================================


-- ── 1. USER PROFILES ─────────────────────────────────────────
-- Stores optional demographic data collected post-signup.
-- Personal fields (birth_year, gender, industry) are private.
-- Only display_name and country are exposed publicly.

create table if not exists public.user_profiles (
  id               uuid        primary key references auth.users(id) on delete cascade,
  display_name     text        not null default 'Anonymous',
  country          text,                          -- optional
  birth_year       integer     check (birth_year between 1920 and 2030),  -- optional; upper bound is generous
  gender           text,                          -- optional: male|female|non_binary|prefer_not_to_say
  industry         text,                          -- optional: Technology|Finance|Healthcare|Education|Student|Other
  avatar_color     text        not null default '#00d4ff',
  profile_complete boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Trigger: auto-create profile row when a user signs up.
-- display_name is passed via options.data in the signUp call.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.user_profiles enable row level security;

create policy "users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ── 2. TEST RESULTS ──────────────────────────────────────────

create table if not exists public.test_results (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  test_name    text        not null,
  score        integer     not null check (score >= 0 and score <= 100),
  percentile   integer     not null default 0,
  result_title text        not null default '',
  share_id     text        unique,
  created_at   timestamptz not null default now()
);

create index if not exists test_results_user_id_idx on public.test_results (user_id);
create index if not exists test_results_share_id_idx on public.test_results (share_id);

alter table public.test_results enable row level security;

-- IMPORTANT: There is intentionally NO "anyone can read shared results" policy.
-- Shared results are served exclusively via the get_challenge_result() SECURITY
-- DEFINER RPC, which accepts a share_id and returns only safe public fields.
-- A permissive policy here would expose ALL results (every row has a share_id).

create policy "users can read own results"
  on public.test_results for select
  using (auth.uid() = user_id);

create policy "users can insert own results"
  on public.test_results for insert
  with check (auth.uid() = user_id);


-- ── 3. LEADERBOARD FUNCTION ──────────────────────────────────
-- SECURITY DEFINER bypasses RLS — safe because:
--   • raw user_id is never returned
--   • only display_name and country from user_profiles are exposed
--   • birth_year, gender, industry are never selected

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
  display_name text,   -- from user_profiles, public
  country      text    -- from user_profiles, public
)
language sql
security definer
stable
as $$
  with best_per_user as (
    -- One row per (user, test): best score only
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
  from best_per_user b
  left join public.user_profiles p on p.id = b.user_id
  where (filter_country is null or p.country = filter_country)
  order by b.score desc
  limit 100;
$$;

grant execute on function public.get_leaderboard to anon, authenticated;


-- ── 4. USER RANK ─────────────────────────────────────────────
-- Returns the rank (1 = best) a given score would achieve for a test.
-- Counts users whose personal best exceeds p_score, then adds 1.

create or replace function public.get_user_rank(
  p_test_name text,
  p_score     integer
)
returns integer
language sql
security definer
stable
as $$
  select cast(count(*) + 1 as integer)
  from (
    select distinct on (r.user_id)
      r.score
    from public.test_results r
    where r.test_name = p_test_name
    order by r.user_id, r.score desc
  ) best
  where best.score > p_score;
$$;

grant execute on function public.get_user_rank to anon, authenticated;


-- ── 5. CHALLENGE RESULT ──────────────────────────────────────
-- Returns a shared result with display_name included (bypasses
-- user_profiles RLS safely — only display_name + country exposed).

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
