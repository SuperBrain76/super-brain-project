-- ════════════════════════════════════════════════════════════
-- SuperBrain Predictor — Generic Prediction Engine Schema
-- Generic naming: competitions / teams / fixtures / predictions
-- Safe to re-run (idempotent via IF NOT EXISTS + OR REPLACE).
-- Run in Supabase Dashboard → SQL Editor after 002_fix_public_results_rls.sql
-- ════════════════════════════════════════════════════════════


-- ── COMPETITIONS ─────────────────────────────────────────────
-- One row per tournament. Reusable for WC, Euros, Copa América, etc.

create table if not exists public.competitions (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,                     -- "FIFA World Cup 2026"
  slug        text        not null unique,              -- "wc2026"
  status      text        not null default 'upcoming'   -- upcoming | active | completed
              check (status in ('upcoming', 'active', 'completed')),
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);


-- ── TEAMS ────────────────────────────────────────────────────

create table if not exists public.teams (
  id             uuid  primary key default gen_random_uuid(),
  competition_id uuid  not null references public.competitions(id) on delete cascade,
  name           text  not null,   -- "Brazil"
  code           text  not null,   -- "BRA"
  flag_emoji     text,             -- "🇧🇷"
  group_name     text              -- "Group A" — null for TBD knockout entries
);

create index if not exists teams_competition_idx on public.teams(competition_id);
create unique index if not exists teams_comp_code_idx on public.teams(competition_id, code);


-- ── FIXTURES ─────────────────────────────────────────────────

create table if not exists public.fixtures (
  id             uuid        primary key default gen_random_uuid(),
  competition_id uuid        not null references public.competitions(id) on delete cascade,
  stage          text        not null   -- 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final'
                 check (stage in ('group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final')),
  group_name     text,                  -- "Group A" — null for knockouts
  fixture_number integer     not null,  -- sequential (1–104), used for display ordering
  home_team_id   uuid        references public.teams(id),   -- null = TBD (knockout)
  away_team_id   uuid        references public.teams(id),
  home_score     integer     check (home_score >= 0),       -- null until played
  away_score     integer     check (away_score >= 0),
  kicks_off_at   timestamptz not null,  -- ALL TIMES STORED IN UTC
  venue          text,
  status         text        not null default 'scheduled'
                 check (status in ('scheduled', 'live', 'completed', 'postponed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists fixtures_competition_idx  on public.fixtures(competition_id);
create index if not exists fixtures_kicks_off_at_idx on public.fixtures(kicks_off_at);
create index if not exists fixtures_status_idx       on public.fixtures(status);
create index if not exists fixtures_number_idx       on public.fixtures(competition_id, fixture_number);


-- ── PREDICTIONS ──────────────────────────────────────────────
-- One row per (user, fixture). Locked before kickoff via trigger.

create table if not exists public.predictions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  fixture_id     uuid        not null references public.fixtures(id) on delete cascade,
  home_score     integer     not null check (home_score >= 0 and home_score <= 20),
  away_score     integer     not null check (away_score >= 0 and away_score <= 20),
  points_awarded integer,              -- null until fixture completed + scored
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (user_id, fixture_id)
);

create index if not exists predictions_user_idx    on public.predictions(user_id);
create index if not exists predictions_fixture_idx on public.predictions(fixture_id);


-- ── PREDICTION LEAGUES ───────────────────────────────────────

create table if not exists public.prediction_leagues (
  id             uuid  primary key default gen_random_uuid(),
  competition_id uuid  not null references public.competitions(id) on delete cascade,
  name           text  not null,
  -- 8-char uppercase invite code, generated from UUID
  invite_code    text  not null unique
                 default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by     uuid  not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index if not exists leagues_competition_idx  on public.prediction_leagues(competition_id);
create index if not exists leagues_invite_code_idx  on public.prediction_leagues(invite_code);
create index if not exists leagues_created_by_idx   on public.prediction_leagues(created_by);


-- ── LEAGUE MEMBERS ───────────────────────────────────────────

create table if not exists public.prediction_league_members (
  id         uuid  primary key default gen_random_uuid(),
  league_id  uuid  not null references public.prediction_leagues(id) on delete cascade,
  user_id    uuid  not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),

  unique (league_id, user_id)
);

create index if not exists league_members_league_idx on public.prediction_league_members(league_id);
create index if not exists league_members_user_idx   on public.prediction_league_members(user_id);


-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

alter table public.competitions              enable row level security;
alter table public.teams                     enable row level security;
alter table public.fixtures                  enable row level security;
alter table public.predictions               enable row level security;
alter table public.prediction_leagues        enable row level security;
alter table public.prediction_league_members enable row level security;

-- ── Public read (no PII) ──────────────────────────────────────
drop policy if exists "public read competitions" on public.competitions;
create policy "public read competitions"
  on public.competitions for select using (true);

drop policy if exists "public read teams" on public.teams;
create policy "public read teams"
  on public.teams for select using (true);

drop policy if exists "public read fixtures" on public.fixtures;
create policy "public read fixtures"
  on public.fixtures for select using (true);

-- ── Predictions ───────────────────────────────────────────────
-- Own predictions: always readable by owner.
-- Pre-deadline: other users' predictions are NOT readable (prevents peeking).
-- Post-deadline: visible only via leaderboard RPCs (aggregated, never raw scores).

drop policy if exists "users read own predictions" on public.predictions;
create policy "users read own predictions"
  on public.predictions for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own predictions" on public.predictions;
create policy "users insert own predictions"
  on public.predictions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own predictions" on public.predictions;
create policy "users update own predictions"
  on public.predictions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Leagues ───────────────────────────────────────────────────
drop policy if exists "public read leagues" on public.prediction_leagues;
create policy "public read leagues"
  on public.prediction_leagues for select using (true);

drop policy if exists "authenticated create league" on public.prediction_leagues;
create policy "authenticated create league"
  on public.prediction_leagues for insert
  with check (auth.uid() = created_by);

-- ── League members ────────────────────────────────────────────
drop policy if exists "authenticated read league members" on public.prediction_league_members;
create policy "authenticated read league members"
  on public.prediction_league_members for select
  using (auth.uid() is not null);

drop policy if exists "join league" on public.prediction_league_members;
create policy "join league"
  on public.prediction_league_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "leave league" on public.prediction_league_members;
create policy "leave league"
  on public.prediction_league_members for delete
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- TRIGGER: DEADLINE ENFORCEMENT
-- Predictions cannot be submitted after a fixture kicks off.
-- Enforced at DB level — client-side checks are not sufficient.
-- ════════════════════════════════════════════════════════════

create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  kicks_off timestamptz;
begin
  select kicks_off_at into kicks_off
  from public.fixtures
  where id = new.fixture_id;

  if kicks_off is null then
    raise exception 'Fixture not found.';
  end if;

  if now() >= kicks_off then
    raise exception 'Prediction deadline has passed for this fixture. Kickoff was at %.', kicks_off;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prediction_deadline_check on public.predictions;
create trigger prediction_deadline_check
  before insert or update on public.predictions
  for each row execute function public.enforce_prediction_deadline();


-- ════════════════════════════════════════════════════════════
-- TRIGGER: AUTO-SCORING
-- Fires when admin sets home_score + away_score on a fixture.
-- Updates points_awarded on all predictions for that fixture.
--
-- Scoring model:
--   Exact score      → 5 pts
--   Correct GD only  → 3 pts  (e.g. predicted 2-0, actual 3-1: both GD=+2)
--   Correct result   → 2 pts  (right winner/draw, wrong GD)
--   Wrong            → 0 pts
-- ════════════════════════════════════════════════════════════

create or replace function public.score_fixture_predictions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actual_home   integer := new.home_score;
  actual_away   integer := new.away_score;
  actual_gd     integer;
  actual_result text;
begin
  -- Only score when both scores are set (guard against partial updates)
  if actual_home is null or actual_away is null then return new; end if;

  -- Skip if score hasn't changed from previous (prevents re-scoring on unrelated updates)
  if old.home_score = actual_home and old.away_score = actual_away then return new; end if;

  actual_gd     := actual_home - actual_away;
  actual_result := case
    when actual_home > actual_away then 'home'
    when actual_away > actual_home then 'away'
    else 'draw'
  end;

  update public.predictions
  set
    points_awarded = case
      when home_score = actual_home
       and away_score = actual_away        then 5   -- exact score
      when (home_score - away_score) = actual_gd then 3   -- correct goal difference
      when (case
              when home_score > away_score then 'home'
              when away_score > home_score then 'away'
              else 'draw'
            end) = actual_result           then 2   -- correct result only
      else                                      0   -- wrong
    end,
    updated_at = now()
  where fixture_id = new.id;

  return new;
end;
$$;

drop trigger if exists auto_score_predictions on public.fixtures;
create trigger auto_score_predictions
  after update of home_score, away_score on public.fixtures
  for each row
  when (new.home_score is not null and new.away_score is not null)
  execute function public.score_fixture_predictions();


-- ════════════════════════════════════════════════════════════
-- ADMIN FUNCTION: MANUAL RESCORE
-- Called from the admin panel "Rescore" button.
-- Safe to call multiple times (idempotent recalculation).
-- Returns the number of predictions updated.
-- ════════════════════════════════════════════════════════════

create or replace function public.rescore_fixture(p_fixture_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  actual_home   integer;
  actual_away   integer;
  actual_gd     integer;
  actual_result text;
  updated_count integer;
begin
  select home_score, away_score
  into actual_home, actual_away
  from public.fixtures
  where id = p_fixture_id;

  if actual_home is null or actual_away is null then
    raise exception 'Cannot rescore: fixture % has no result yet.', p_fixture_id;
  end if;

  actual_gd     := actual_home - actual_away;
  actual_result := case
    when actual_home > actual_away then 'home'
    when actual_away > actual_home then 'away'
    else 'draw'
  end;

  update public.predictions
  set
    points_awarded = case
      when home_score = actual_home
       and away_score = actual_away        then 5
      when (home_score - away_score) = actual_gd then 3
      when (case
              when home_score > away_score then 'home'
              when away_score > home_score then 'away'
              else 'draw'
            end) = actual_result           then 2
      else                                      0
    end,
    updated_at = now()
  where fixture_id = p_fixture_id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.rescore_fixture to authenticated;


-- ════════════════════════════════════════════════════════════
-- ADMIN FUNCTION: RESCORE ENTIRE COMPETITION
-- Rescores all completed fixtures in a competition.
-- Use after changing scoring rules or fixing a data error.
-- Returns total predictions updated.
-- ════════════════════════════════════════════════════════════

create or replace function public.rescore_competition(p_competition_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  fix           record;
  total_updated integer := 0;
  batch_updated integer;
begin
  for fix in
    select id, home_score, away_score
    from public.fixtures
    where competition_id = p_competition_id
      and home_score is not null
      and away_score is not null
  loop
    select public.rescore_fixture(fix.id) into batch_updated;
    total_updated := total_updated + batch_updated;
  end loop;

  return total_updated;
end;
$$;

grant execute on function public.rescore_competition to authenticated;


-- ════════════════════════════════════════════════════════════
-- RPC: GLOBAL PREDICTOR LEADERBOARD
-- Returns top 200 users by points for a competition.
-- SECURITY DEFINER: bypasses RLS but never exposes user_id, email,
-- birth_year, gender, or industry.
-- ════════════════════════════════════════════════════════════

create or replace function public.get_predictor_leaderboard(
  p_competition_id uuid
)
returns table (
  rank         bigint,
  display_name text,
  country      text,
  total_points bigint,
  predictions  bigint,
  exact_scores bigint
)
language sql
security definer stable set search_path = public
as $$
  select
    row_number() over (order by coalesce(sum(p.points_awarded), 0) desc) as rank,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous')             as display_name,
    pr.country,
    coalesce(sum(p.points_awarded), 0)                                   as total_points,
    count(p.id)                                                          as predictions,
    count(case when p.points_awarded = 5 then 1 end)                     as exact_scores
  from public.predictions p
  join public.fixtures f      on f.id = p.fixture_id
  join public.user_profiles pr on pr.id = p.user_id
  where f.competition_id = p_competition_id
    and p.points_awarded is not null
  group by p.user_id, pr.display_name, pr.country
  order by total_points desc
  limit 200;
$$;

grant execute on function public.get_predictor_leaderboard to anon, authenticated;


-- ════════════════════════════════════════════════════════════
-- RPC: LEAGUE LEADERBOARD
-- Scoped to a private league's members.
-- Includes user_id so frontend can highlight the current user's row.
-- (user_id is a UUID — no PII directly exposed.)
-- ════════════════════════════════════════════════════════════

create or replace function public.get_league_leaderboard(
  p_league_id uuid
)
returns table (
  rank         bigint,
  user_id      uuid,
  display_name text,
  country      text,
  total_points bigint,
  predictions  bigint,
  exact_scores bigint
)
language sql
security definer stable set search_path = public
as $$
  select
    row_number() over (order by coalesce(sum(p.points_awarded), 0) desc) as rank,
    lm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous')             as display_name,
    pr.country,
    coalesce(sum(p.points_awarded), 0)                                   as total_points,
    count(p.id)                                                          as predictions,
    count(case when p.points_awarded = 5 then 1 end)                     as exact_scores
  from public.prediction_league_members lm
  join public.prediction_leagues l       on l.id = lm.league_id
  join public.user_profiles pr           on pr.id = lm.user_id
  left join public.predictions p         on p.user_id = lm.user_id
  left join public.fixtures f            on f.id = p.fixture_id
                                        and f.competition_id = l.competition_id
                                        and p.points_awarded is not null
  where lm.league_id = p_league_id
  group by lm.user_id, pr.display_name, pr.country
  order by total_points desc;
$$;

grant execute on function public.get_league_leaderboard to authenticated;


-- ════════════════════════════════════════════════════════════
-- RPC: GET USER PREDICTOR STATS
-- Returns a single user's stats for a competition.
-- Used to show "your position" even if outside top 200.
-- ════════════════════════════════════════════════════════════

create or replace function public.get_my_predictor_stats(
  p_competition_id uuid
)
returns table (
  total_points bigint,
  predictions  bigint,
  exact_scores bigint,
  global_rank  bigint
)
language sql
security definer stable set search_path = public
as $$
  with all_scores as (
    select
      p.user_id,
      coalesce(sum(p.points_awarded), 0) as pts
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where f.competition_id = p_competition_id
      and p.points_awarded is not null
    group by p.user_id
  ),
  my_stats as (
    select
      coalesce(sum(p.points_awarded), 0)               as total_points,
      count(p.id)                                       as predictions,
      count(case when p.points_awarded = 5 then 1 end)  as exact_scores
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where f.competition_id = p_competition_id
      and p.user_id = auth.uid()
  )
  select
    ms.total_points,
    ms.predictions,
    ms.exact_scores,
    (select count(*) + 1 from all_scores where pts > ms.total_points) as global_rank
  from my_stats ms;
$$;

grant execute on function public.get_my_predictor_stats to authenticated;


do $$
begin
  raise notice 'Predictor schema applied successfully.';
  raise notice 'Tables: competitions, teams, fixtures, predictions, prediction_leagues, prediction_league_members';
  raise notice 'Triggers: prediction_deadline_check, auto_score_predictions';
  raise notice 'RPCs: get_predictor_leaderboard, get_league_leaderboard, get_my_predictor_stats';
  raise notice 'Admin tools: rescore_fixture(uuid), rescore_competition(uuid)';
end;
$$;
