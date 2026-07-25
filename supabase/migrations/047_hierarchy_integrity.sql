-- ============================================================
-- MIGRATION 047 — Hierarchy integrity
--
-- Competition Engine V2, Phase 2 close-out.
--
-- ────────────────────────────────────────────────────────────
-- THE HIERARCHY
-- ────────────────────────────────────────────────────────────
--
--   Sport → Competition → Season → Round → Fixture
--
-- Migrations 041–045 created every level. Nothing yet ENFORCES the chain,
-- so a fixture can currently claim a season belonging to a different
-- competition, or a round belonging to a different season. Both would
-- produce a leaderboard that is silently wrong rather than an error.
--
-- This is exactly the class of bug a Create Competition wizard will
-- eventually introduce, because it writes all five levels in one go. The
-- database should reject it, not the form.
--
-- ────────────────────────────────────────────────────────────
-- WHY A TRIGGER AND NOT `NOT NULL` + FK
-- ────────────────────────────────────────────────────────────
-- Foreign keys prove a season EXISTS. They cannot prove it is the RIGHT
-- season — that a fixture's season belongs to the fixture's own
-- competition. That is a cross-row invariant, and a trigger is the only
-- way to state it.
--
-- `season_id` and `round_id` also stay NULLABLE. Making them NOT NULL would
-- rewrite the whole fixtures table and would reject any legacy row the
-- backfill missed. Instead the trigger requires them on NEW rows only —
-- strict going forward, tolerant of history. Once
-- scripts/verify-047-hierarchy.sql reports zero legacy nulls, the NOT NULL
-- constraints can be added; the block is prepared at the foot of this file.
--
-- WORLD CUP COMPATIBILITY
--   Full. The trigger fires on INSERT and on UPDATE OF the hierarchy
--   columns only. Nothing in the World Cup path writes those columns —
--   ingestion writes status, scores and kicks_off_at. Migrations 041 and
--   042 already backfilled all 104 fixtures, so they satisfy the rules
--   anyway; scripts/verify-047-hierarchy.sql proves it before this runs.
--
-- DEPENDS ON: 041, 042, 045
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: drop the trigger and function. Nothing else changes.
-- ============================================================


-- ── 1. The invariant ─────────────────────────────────────────

create or replace function public.enforce_fixture_hierarchy()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_season_comp uuid;
  v_round_season uuid;
  v_legacy      boolean;
begin
  -- A row is "legacy" if it predates the engine: no season and no round.
  -- Those are left exactly as they are. Everything else must be complete.
  v_legacy := (tg_op = 'UPDATE'
               and old.season_id is null
               and old.round_id  is null
               and new.season_id is null
               and new.round_id  is null);

  if v_legacy then
    return new;
  end if;

  -- ── Season is required, and must belong to THIS competition ──
  if new.season_id is null then
    raise exception
      'Fixture % has no season_id. Every fixture must belong to a season '
      '(Sport → Competition → Season → Round → Fixture).', coalesce(new.id::text, '(new)');
  end if;

  select competition_id into v_season_comp
  from public.seasons where id = new.season_id;

  if v_season_comp is null then
    raise exception 'Fixture references season % which does not exist.', new.season_id;
  end if;

  if v_season_comp <> new.competition_id then
    raise exception
      'HIERARCHY VIOLATION: fixture belongs to competition % but its season % '
      'belongs to competition %. A fixture''s season must belong to the '
      'fixture''s own competition.',
      new.competition_id, new.season_id, v_season_comp;
  end if;

  -- ── Round is required, and must belong to THIS season ────────
  if new.round_id is null then
    raise exception
      'Fixture % has no round_id. Every fixture must belong to a round — '
      'rounds are the unit for challenges, matchweek leaderboards, '
      'notifications and locking.', coalesce(new.id::text, '(new)');
  end if;

  select season_id into v_round_season
  from public.rounds where id = new.round_id;

  if v_round_season is null then
    raise exception 'Fixture references round % which does not exist.', new.round_id;
  end if;

  if v_round_season <> new.season_id then
    raise exception
      'HIERARCHY VIOLATION: fixture is in season % but its round % belongs to '
      'season %. A fixture''s round must belong to the fixture''s own season.',
      new.season_id, new.round_id, v_round_season;
  end if;

  return new;
end;
$$;

drop trigger if exists fixture_hierarchy_check on public.fixtures;
create trigger fixture_hierarchy_check
  before insert or update of competition_id, season_id, round_id on public.fixtures
  for each row execute function public.enforce_fixture_hierarchy();

comment on function public.enforce_fixture_hierarchy is
  'Enforces Sport → Competition → Season → Round → Fixture. A foreign key can '
  'prove a season exists; only this can prove it is the RIGHT season.';


-- ── 2. Same invariant one level up: teams ────────────────────
-- A season_teams row must link a team to a season of that team's own
-- competition. Otherwise a Premier League season could list a World Cup
-- national side, and standings would silently include it.

create or replace function public.enforce_season_team_hierarchy()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_team_comp   uuid;
  v_season_comp uuid;
begin
  select competition_id into v_team_comp   from public.teams   where id = new.team_id;
  select competition_id into v_season_comp from public.seasons where id = new.season_id;

  if v_team_comp is distinct from v_season_comp then
    raise exception
      'HIERARCHY VIOLATION: team % belongs to competition % but season % belongs '
      'to competition %.', new.team_id, v_team_comp, new.season_id, v_season_comp;
  end if;

  return new;
end;
$$;

drop trigger if exists season_team_hierarchy_check on public.season_teams;
create trigger season_team_hierarchy_check
  before insert or update on public.season_teams
  for each row execute function public.enforce_season_team_hierarchy();


-- ── 3. One current season per competition, and it must be sane ─
-- 041 already enforces "at most one is_current" with a partial unique
-- index. This adds the other half: a completed season cannot be current.

create or replace function public.enforce_season_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_current and new.status in ('completed', 'archived') then
    raise exception
      'Season % is marked is_current but its status is "%". A finished season '
      'cannot be the current one.', new.slug, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists season_status_check on public.seasons;
create trigger season_status_check
  before insert or update of status, is_current on public.seasons
  for each row execute function public.enforce_season_status();


-- ── 4. The hierarchy, readable ───────────────────────────────
-- One row per fixture with every ancestor resolved. Used by the admin
-- panel and by scripts/verify-047-hierarchy.sql. Cheap to query and the
-- fastest way to see the shape of a competition at a glance.

create or replace view public.v_competition_hierarchy as
select
  sp.code            as sport_code,
  sp.name            as sport_name,
  c.id               as competition_id,
  c.slug             as competition_slug,
  c.name             as competition_name,
  s.id               as season_id,
  s.slug             as season_slug,
  s.label            as season_label,
  s.is_current       as season_is_current,
  r.id               as round_id,
  r.code             as round_code,
  r.label            as round_label,
  r.sort_order       as round_order,
  r.locks_at         as round_locks_at,
  f.id               as fixture_id,
  f.fixture_number,
  f.stage,
  f.kicks_off_at,
  f.status           as fixture_status,
  f.provider_fixture_id
from public.competitions c
join public.sports sp   on sp.code = c.sport_code
left join public.seasons s on s.competition_id = c.id
left join public.rounds  r on r.season_id      = s.id
left join public.fixtures f on f.round_id      = r.id;

comment on view public.v_competition_hierarchy is
  'Sport → Competition → Season → Round → Fixture, flattened. Left joins '
  'throughout so an empty competition still appears — which is what makes it '
  'useful for spotting a half-built one.';


insert into public.schema_migrations (version, name, notes)
values ('047', 'hierarchy_integrity',
        'Enforces Sport→Competition→Season→Round→Fixture with cross-row triggers. '
        'Legacy fixtures (null season AND round) are exempt. Adds '
        'v_competition_hierarchy.')
on conflict (version) do nothing;


-- ============================================================
-- LATER — tighten to NOT NULL
-- ============================================================
-- Run scripts/verify-047-hierarchy.sql first. When it reports ZERO
-- fixtures with a null season_id or round_id, these become safe and the
-- trigger's legacy exemption becomes dead code:
--
--   alter table public.fixtures alter column season_id set not null;
--   alter table public.fixtures alter column round_id  set not null;
--
-- Deliberately not automatic: both rewrite the table that holds every
-- prediction, and neither is reversible without another rewrite.
-- ============================================================

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop view    if exists public.v_competition_hierarchy;
-- drop trigger if exists season_status_check        on public.seasons;
-- drop trigger if exists season_team_hierarchy_check on public.season_teams;
-- drop trigger if exists fixture_hierarchy_check    on public.fixtures;
-- drop function if exists public.enforce_season_status();
-- drop function if exists public.enforce_season_team_hierarchy();
-- drop function if exists public.enforce_fixture_hierarchy();
-- ============================================================
