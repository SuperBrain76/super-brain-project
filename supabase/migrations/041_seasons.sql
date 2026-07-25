-- ============================================================
-- MIGRATION 041 — Seasons
--
-- Competition Engine V2, Phase 1.3.
--
-- ────────────────────────────────────────────────────────────
-- WHY
-- ────────────────────────────────────────────────────────────
-- "Premier League" is permanent. "Premier League 2026/27" is one instance
-- of it. Without that distinction there is nowhere to put next season, and
-- a private league called "The Office" cannot survive into 2027/28.
--
-- ────────────────────────────────────────────────────────────
-- THE SAFETY ARGUMENT — READ THIS
-- ────────────────────────────────────────────────────────────
-- This migration is INERT BY CONSTRUCTION. It creates a table, adds three
-- NULLABLE columns, and backfills them. **Nothing reads season_id yet.**
-- No RPC, no query, no component. `competition_id` remains the working key
-- on every table and every query — permanently, not temporarily.
--
-- Both FKs coexist by design. Nothing is removed and nothing is renamed.
-- That is the whole reason this phase cannot break the World Cup: there is
-- no code path in which the new column participates.
--
-- ────────────────────────────────────────────────────────────
-- DECIDED 17 Jul 2026 — private leagues across seasons
-- ────────────────────────────────────────────────────────────
-- prediction_leagues deliberately gets NO season_id. A league belongs to a
-- COMPETITION — that is what lets it outlive a season. Season participation
-- is a MEMBERSHIP concern and lands later as a nullable
-- prediction_league_members.season_id (null = legacy/all-seasons member).
-- Adding prediction_leagues.season_id would be the wrong grain and would
-- force a new league row per season, destroying the persistent identity
-- that was explicitly asked for.
--
-- DEPENDS ON: 037
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: drop the three columns, drop the table. Nothing reads it, so
--           nothing breaks.
-- ============================================================


-- ── 1. seasons ───────────────────────────────────────────────

create table if not exists public.seasons (
  id             uuid    primary key default gen_random_uuid(),
  competition_id uuid    not null references public.competitions(id) on delete cascade,

  slug           text    not null unique,     -- 'pl-2026-27', 'wc2026'
  label          text    not null,            -- '2026/27', '2026'

  status         text    not null default 'upcoming'
                 check (status in ('upcoming', 'active', 'completed', 'archived')),

  -- Exactly one current season per competition — enforced by the partial
  -- unique index below, not by convention.
  is_current     boolean not null default false,

  starts_at      timestamptz,
  ends_at        timestamptz,

  created_at     timestamptz not null default now(),

  unique (competition_id, label)
);

create index if not exists seasons_competition_idx
  on public.seasons (competition_id, status);

-- At most one is_current season per competition. A partial unique index is
-- the only way to say this that the database will actually enforce.
create unique index if not exists seasons_one_current_per_competition_idx
  on public.seasons (competition_id)
  where is_current;

alter table public.seasons enable row level security;

drop policy if exists "public read seasons" on public.seasons;
create policy "public read seasons"
  on public.seasons for select using (true);

comment on table public.seasons is
  'One instance of a competition. Multiple seasons of the same competition may '
  'coexist; at most one is_current. Private leagues attach to the COMPETITION, '
  'never to the season — see migration 041 header.';


-- ── 2. Nullable season_id on the three owning tables ─────────
-- Nullable on purpose. Legacy rows and manually created rows are allowed
-- to have no season.

alter table public.fixtures        add column if not exists season_id uuid references public.seasons(id) on delete set null;
alter table public.teams           add column if not exists season_id uuid references public.seasons(id) on delete set null;
alter table public.bonus_questions add column if not exists season_id uuid references public.seasons(id) on delete set null;

create index if not exists fixtures_season_idx        on public.fixtures (season_id);
create index if not exists teams_season_idx           on public.teams (season_id);
create index if not exists bonus_questions_season_idx on public.bonus_questions (season_id);


-- ── 3. Backfill the World Cup ────────────────────────────────

do $$
declare
  v_comp   record;
  v_season uuid;
  v_fix    integer;
  v_teams  integer;
  v_bonus  integer;
begin
  select id, name, status, starts_at, ends_at into v_comp
  from public.competitions where slug = 'wc2026';

  if v_comp.id is null then
    raise notice '041: wc2026 not found — nothing to backfill.';
    return;
  end if;

  insert into public.seasons
    (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (
    v_comp.id,
    'wc2026',
    '2026',
    -- The World Cup is over. If the competition row has not been flipped to
    -- 'completed' yet (closure checklist item 11 does that LAST), record the
    -- season as completed anyway — the final was played on 19 July 2026.
    'completed',
    false,          -- not current: the WC is finished
    v_comp.starts_at,
    v_comp.ends_at
  )
  on conflict (slug) do nothing;

  select id into v_season from public.seasons where slug = 'wc2026';

  update public.fixtures        set season_id = v_season
   where competition_id = v_comp.id and season_id is null;
  get diagnostics v_fix = row_count;

  update public.teams           set season_id = v_season
   where competition_id = v_comp.id and season_id is null;
  get diagnostics v_teams = row_count;

  update public.bonus_questions set season_id = v_season
   where competition_id = v_comp.id and season_id is null;
  get diagnostics v_bonus = row_count;

  raise notice '041: backfilled wc2026 season — % fixtures, % teams, % bonus questions.',
               v_fix, v_teams, v_bonus;
  raise notice '041: EXPECTED 104 fixtures, 48 teams, 6 bonus questions. Verify.';
end;
$$;


-- ── 4. Verify the backfill left nothing behind ───────────────

do $$
declare
  v_orphans integer;
begin
  select count(*) into v_orphans
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id
  where c.slug = 'wc2026' and f.season_id is null;

  if v_orphans > 0 then
    raise warning '041: % wc2026 fixture(s) still have no season_id. '
                  'Not fatal (nothing reads the column yet) but investigate '
                  'before Phase 2 starts reading it.', v_orphans;
  else
    raise notice '041: every wc2026 fixture carries a season_id.';
  end if;
end;
$$;


insert into public.schema_migrations (version, name, notes)
values ('041', 'seasons',
        'Adds seasons + nullable season_id on fixtures/teams/bonus_questions. '
        'INERT — nothing reads season_id in this migration.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table public.fixtures        drop column if exists season_id;
-- alter table public.teams           drop column if exists season_id;
-- alter table public.bonus_questions drop column if exists season_id;
-- drop table if exists public.seasons;
-- ============================================================
