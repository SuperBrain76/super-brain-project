-- ============================================================
-- MIGRATION 042 — Rounds / Matchweeks  ⭐ KEYSTONE
--
-- Competition Engine V2, Phase 2.2.
--
-- ────────────────────────────────────────────────────────────
-- WHY THIS IS THE KEYSTONE
-- ────────────────────────────────────────────────────────────
-- `fixtures` today has stage, group_name and fixture_number. Nothing says
-- "Matchweek 12". That single absence blocks FIVE things at once:
--
--   1. Matchweek navigation        — 380 fixtures cannot be one flat list
--   2. Matchday Challenges         — challenges are round-scoped by definition
--   3. Weekly leaderboards         — decided: "weekly" MEANS matchweek
--   4. Round-scoped fixture loading — the fix for loading everything at once
--   5. Notifications               — "Matchweek 12 locks in 2 hours"
--
-- So rounds land before any of them, and all five then read one entity.
--
-- ────────────────────────────────────────────────────────────
-- LOCKING — the important design decision
-- ────────────────────────────────────────────────────────────
-- rounds.locks_at is STORED, not derived at read time, and maintained by a
-- trigger whenever a fixture in the round is inserted, rescheduled or
-- removed.
--
-- Deriving it live (`select min(kicks_off_at) …`) looks tidier and is wrong:
-- if the opening match of a matchweek is postponed, a live-derived lock
-- time would JUMP FORWARD and silently RE-OPEN a challenge that users have
-- already seen locked — letting late entrants answer with information the
-- early ones did not have.
--
-- Storing it makes the lock an event that happened, not a value that
-- floats. `rounds_lock_is_pinned` records when a human has overridden it,
-- so an admin decision is never quietly undone by a reschedule.
--
-- NOTE: individual FIXTURE locking is unchanged and still enforced per
-- fixture by enforce_prediction_deadline (predictor-schema.sql). Round
-- locking governs CHALLENGES only. Match predictions lock at their own
-- kickoff, exactly as they do today.
--
-- DEPENDS ON: 041 (seasons)
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. rounds ────────────────────────────────────────────────

create table if not exists public.rounds (
  id          uuid    primary key default gen_random_uuid(),
  season_id   uuid    not null references public.seasons(id) on delete cascade,

  code        text    not null,          -- 'mw12', 'group', 'qf'
  label       text    not null,          -- 'Matchweek 12', 'Quarter-final'
  short_label text,                      -- 'MW12' — for chips and nav
  sort_order  integer not null,          -- 1..38 — THE ordering key

  kind        text    not null default 'matchweek'
              check (kind in ('matchweek', 'stage', 'group', 'knockout', 'other')),

  -- Window. All derived from fixtures unless pinned.
  starts_at   timestamptz,               -- first kickoff
  ends_at     timestamptz,               -- last kickoff
  locks_at    timestamptz,               -- = starts_at; when challenges close

  -- True once a human sets locks_at by hand. The recompute trigger then
  -- leaves it alone.
  lock_is_pinned boolean not null default false,

  status      text    not null default 'upcoming'
              check (status in ('upcoming', 'open', 'locked', 'completed')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (season_id, code),
  unique (season_id, sort_order)
);

create index if not exists rounds_season_order_idx on public.rounds (season_id, sort_order);
create index if not exists rounds_locks_at_idx     on public.rounds (locks_at);

alter table public.rounds enable row level security;

drop policy if exists "public read rounds" on public.rounds;
create policy "public read rounds"
  on public.rounds for select using (true);

comment on table public.rounds is
  'A matchweek, group phase or knockout round. The unit for challenges, '
  'weekly leaderboards, fixture navigation and notifications.';
comment on column public.rounds.locks_at is
  'When this round''s CHALLENGES close — the first kickoff of the round. '
  'STORED, not derived: see migration 042 header for why. Match predictions '
  'are unaffected and still lock at their own kickoff.';
comment on column public.rounds.lock_is_pinned is
  'True when an admin set locks_at by hand. Recompute then skips this round.';


-- ── 2. fixtures.round_id ─────────────────────────────────────
-- Nullable: World Cup fixtures are backfilled below, but a manually
-- created fixture is allowed to belong to no round.

alter table public.fixtures add column if not exists round_id uuid
  references public.rounds(id) on delete set null;

create index if not exists fixtures_round_idx on public.fixtures (round_id);

-- The covering index for round-scoped leaderboards and fixture lists.
create index if not exists fixtures_season_round_kickoff_idx
  on public.fixtures (season_id, round_id, kicks_off_at);


-- ── 3. season_teams — promotion and relegation ───────────────
-- `teams` stays keyed on competition_id so a club row PERSISTS across
-- relegation and promotion, and historical predictions keep resolving to a
-- real team. Which clubs actually played in a given season is a separate
-- fact, and this is it.

create table if not exists public.season_teams (
  season_id  uuid not null references public.seasons(id) on delete cascade,
  team_id    uuid not null references public.teams(id)   on delete cascade,
  group_name text,                    -- WC group; null for a flat league
  seed       integer,                 -- optional seeding / pot
  created_at timestamptz not null default now(),
  primary key (season_id, team_id)
);

create index if not exists season_teams_team_idx on public.season_teams (team_id);

alter table public.season_teams enable row level security;

drop policy if exists "public read season teams" on public.season_teams;
create policy "public read season teams"
  on public.season_teams for select using (true);

comment on table public.season_teams is
  'Which teams participated in which season. Lets a club be relegated and '
  'promoted without deleting the team row or orphaning old predictions.';


-- ── 4. Recompute a round's window from its fixtures ──────────

create or replace function public.recompute_round_window(p_round_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_first  timestamptz;
  v_last   timestamptz;
  v_pinned boolean;
begin
  if p_round_id is null then return; end if;

  select lock_is_pinned into v_pinned from public.rounds where id = p_round_id;
  if v_pinned is null then return; end if;   -- round no longer exists

  select min(kicks_off_at), max(kicks_off_at)
    into v_first, v_last
  from public.fixtures
  where round_id = p_round_id;

  update public.rounds
  set
    starts_at  = v_first,
    ends_at    = v_last,
    -- Only move the lock when it is not pinned. A postponed opening match
    -- must never silently reopen an already-locked challenge set.
    locks_at   = case when v_pinned then locks_at else v_first end,
    updated_at = now()
  where id = p_round_id;
end;
$$;

revoke all on function public.recompute_round_window(uuid) from public, anon;
grant execute on function public.recompute_round_window(uuid) to authenticated;


-- ── 5. Keep it current ───────────────────────────────────────

create or replace function public.fixtures_round_window_sync()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_round_window(old.round_id);
    return old;
  end if;

  perform public.recompute_round_window(new.round_id);

  -- Fixture moved between rounds: refresh the round it left, too.
  if tg_op = 'UPDATE'
     and old.round_id is distinct from new.round_id then
    perform public.recompute_round_window(old.round_id);
  end if;

  return new;
end;
$$;

drop trigger if exists fixtures_round_window_trigger on public.fixtures;
create trigger fixtures_round_window_trigger
  after insert or delete or update of kicks_off_at, round_id on public.fixtures
  for each row execute function public.fixtures_round_window_sync();

-- ⚠️ This trigger fires on kicks_off_at UPDATE — which the ingest cron does
-- on every run that syncs official kickoff times. It is deliberately cheap:
-- two aggregates over one indexed round. It does NOT touch predictions,
-- scores or points, and cannot interfere with auto_score_predictions, which
-- fires on `update of home_score, away_score` only.


-- ── 6. Backfill the World Cup — one round per stage ──────────
-- Stage-based rather than synthetic matchdays: the stage IS the World Cup's
-- natural round, it is derived from data already present rather than
-- invented, and it makes the historical WC render sensibly under
-- round-aware code without changing a single fixture's meaning.

do $$
declare
  v_season uuid;
  r        record;
  v_round  uuid;
  v_n      integer := 0;
begin
  select id into v_season from public.seasons where slug = 'wc2026';
  if v_season is null then
    raise notice '042: no wc2026 season (run 041 first) — skipping backfill.';
    return;
  end if;

  for r in
    select cs.code, cs.label, cs.sort_order, cs.is_knockout
    from public.competition_stages cs
    join public.competitions c on c.id = cs.competition_id
    where c.slug = 'wc2026'
    order by cs.sort_order
  loop
    insert into public.rounds
      (season_id, code, label, short_label, sort_order, kind, status)
    values (
      v_season, r.code, r.label, r.label, r.sort_order,
      case when r.is_knockout then 'knockout' else 'group' end,
      'completed'
    )
    on conflict (season_id, code) do nothing;

    select id into v_round from public.rounds
     where season_id = v_season and code = r.code;

    update public.fixtures f
       set round_id = v_round
     where f.season_id = v_season
       and f.stage = r.code
       and f.round_id is null;

    perform public.recompute_round_window(v_round);
    v_n := v_n + 1;
  end loop;

  raise notice '042: created % World Cup rounds and assigned fixtures.', v_n;
end;
$$;


-- ── 7. Backfill season_teams for the World Cup ───────────────

insert into public.season_teams (season_id, team_id, group_name)
select t.season_id, t.id, t.group_name
from public.teams t
join public.seasons s on s.id = t.season_id
where s.slug = 'wc2026'
on conflict (season_id, team_id) do nothing;


-- ── 8. Verify ────────────────────────────────────────────────

do $$
declare
  v_unassigned integer;
  v_rounds     integer;
begin
  select count(*) into v_rounds
  from public.rounds r join public.seasons s on s.id = r.season_id
  where s.slug = 'wc2026';

  select count(*) into v_unassigned
  from public.fixtures f join public.seasons s on s.id = f.season_id
  where s.slug = 'wc2026' and f.round_id is null;

  raise notice '042: wc2026 has % rounds; % fixtures without a round.', v_rounds, v_unassigned;

  if v_unassigned > 0 then
    raise warning '042: % wc2026 fixture(s) are not assigned to a round. '
                  'Not fatal — round_id is nullable and nothing reads it yet.', v_unassigned;
  end if;
end;
$$;


insert into public.schema_migrations (version, name, notes)
values ('042', 'rounds',
        'Rounds/matchweeks + fixtures.round_id + season_teams + stored round lock '
        'with recompute trigger. WC backfilled one round per stage.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop trigger if exists fixtures_round_window_trigger on public.fixtures;
-- drop function if exists public.fixtures_round_window_sync();
-- drop function if exists public.recompute_round_window(uuid);
-- alter table public.fixtures drop column if exists round_id;
-- drop table if exists public.season_teams;
-- drop table if exists public.rounds;
-- ============================================================
