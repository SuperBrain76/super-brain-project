-- ============================================================
-- MIGRATION 073 — Ordering predictions (Formula 1)
--
-- The first reader of the columns migration 045 reserved:
-- fixtures.prediction_type = 'ordering' and predictions.payload.
--
-- ────────────────────────────────────────────────────────────
-- WHAT THIS ADDS
-- ────────────────────────────────────────────────────────────
-- F1 spec (owner-locked 26 Aug 2026): two fixtures per Grand Prix —
-- Qualifying (Saturday) and Race (Sunday). A prediction is the top FIVE
-- entrants in order, stored as payload {"order": [team_id x5]} with
-- home_score/away_score NULL. Entrants are `teams` rows (drivers).
--
--   1. predictions: scores become nullable; a shape CHECK + a fixture-aware
--      trigger keep every row either a score prediction or an ordering one.
--   2. fixture_entrant_results — the classification a race/quali produces
--      (a result is a ranked list, not two integers).
--   3. competition_standings — ingested driver/constructor championship
--      tables (points systems are NOT reimplemented locally).
--   4. apply_ordering_scoring() — exact-position hits mapped onto the
--      existing scoring_rules values:  5 hits→exact, 3–4→gd, 1–2→result,
--      0→wrong. With the standard 5/3/2/0 rows this keeps the IQ economy's
--      amount_map ("5"/"3"/"2"/"0") aligned — economy untouched by design.
--   5. settle_ordering_fixture() — the atomic write path for the ingestion
--      adapter: results + status + scoring in one transaction.
--   6. rescore_fixture() learns to route ordering fixtures.
--
-- WHAT THIS DOES NOT TOUCH: football/hockey/rugby behaviour. Score
-- predictions keep NOT-NULL-equivalent enforcement via the shape trigger;
-- auto_score_predictions, the deadline trigger and the 072 bounds trigger
-- are unchanged (072's comparison is NULL-safe for ordering rows).
--
-- DEPENDS ON: 044 (scoring_rules), 045 (sports/payload), 072.
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 0. Deadline trigger learns about payload ─────────────────
-- 🔴 FOUND IN THE PRE-PRODUCTION AUDIT (26 Aug 2026, PGlite replay of the
-- Dutch GP against the LIVE trigger body from
-- prod-rollback/live-functions-2026-07-25.sql).
--
-- The live enforce_prediction_deadline short-circuits when home_score and
-- away_score are unchanged — that is how the scoring engine's
-- points_awarded updates pass through. But an ordering prediction's score
-- columns are ALWAYS null and never change, so under the live body:
--   · INSERT after session start passes (OLD is a null record, so
--     null IS NOT DISTINCT FROM null short-circuits), and
--   · a payload-only UPDATE after session start passes.
-- Both would let a user predict qualifying AFTER watching it. Football is
-- unaffected (real scores are always distinct from null).
--
-- Fix: a payload change counts as a prediction change. Scoring updates
-- (points_awarded only) and banker toggles still pass, exactly as today.

create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
security definer set search_path to 'public'
as $$
declare
  fixture_kickoff timestamptz;
begin
  -- Allow system updates (points_awarded, is_banker) — only block when the
  -- user's actual prediction is being changed: scores OR payload.
  if (old.home_score is not distinct from new.home_score and
      old.away_score is not distinct from new.away_score and
      old.payload    is not distinct from new.payload) then
    new.updated_at := now();
    return new;
  end if;

  select kicks_off_at
    into fixture_kickoff
    from public.fixtures
   where id = new.fixture_id;

  if fixture_kickoff is null then
    raise exception 'Fixture not found.';
  end if;

  if now() >= fixture_kickoff then
    raise exception 'Prediction deadline has passed. This fixture has already kicked off.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;


-- ── 1. predictions: allow the ordering shape ────────────────

alter table public.predictions alter column home_score drop not null;
alter table public.predictions alter column away_score drop not null;

-- A row is a score prediction OR a payload prediction — never empty, and
-- never both. (Fixture-aware validation lives in the trigger below; a table
-- CHECK cannot reference fixtures.)
alter table public.predictions drop constraint if exists predictions_shape_check;
alter table public.predictions
  add constraint predictions_shape_check check (
    (home_score is not null and away_score is not null and payload is null)
    or
    (payload is not null and home_score is null and away_score is null)
  );

-- Fixture-aware shape enforcement. Predictions are written straight from
-- the client under RLS, so — as with the deadline and bounds triggers —
-- the database is the only server-side gate.
create or replace function public.enforce_prediction_shape()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_type text;
  v_comp uuid;
  v_len  integer;
  v_ok   integer;
begin
  select prediction_type, competition_id into v_type, v_comp
  from public.fixtures where id = new.fixture_id;

  if v_type is null then
    raise exception 'Fixture not found.';
  end if;

  if v_type = 'score' then
    if new.payload is not null then
      raise exception 'This fixture takes a score prediction, not a payload.';
    end if;
    if new.home_score is null or new.away_score is null then
      raise exception 'Score prediction requires both scores.';
    end if;
    return new;
  end if;

  if v_type = 'ordering' then
    if new.payload is null or jsonb_typeof(new.payload -> 'order') is distinct from 'array' then
      raise exception 'Ordering prediction requires payload {"order": [...]}.';
    end if;
    if new.home_score is not null or new.away_score is not null then
      raise exception 'Ordering prediction must not carry home/away scores.';
    end if;
    if (select count(*) from jsonb_object_keys(new.payload)) <> 1 then
      raise exception 'Ordering payload must contain exactly the "order" key.';
    end if;

    v_len := jsonb_array_length(new.payload -> 'order');
    if v_len <> 5 then
      raise exception 'Ordering prediction must name exactly 5 entrants (got %).', v_len;
    end if;

    -- All five must be DISTINCT teams of this fixture's competition.
    -- Compared as text against t.id::text so malformed input cannot raise
    -- a cast error before this clearer message does.
    select count(distinct e.value) into v_ok
    from jsonb_array_elements_text(new.payload -> 'order') e
    join public.teams t on t.id::text = e.value and t.competition_id = v_comp;

    if v_ok <> 5 then
      raise exception 'Ordering prediction must list 5 distinct entrants of this competition.';
    end if;
    return new;
  end if;

  -- 'outcome' / 'custom' remain reserved and unwritable.
  raise exception 'Prediction type "%" is not implemented.', v_type;
end;
$$;

drop trigger if exists prediction_shape_check on public.predictions;
create trigger prediction_shape_check
  before insert or update on public.predictions
  for each row execute function public.enforce_prediction_shape();


-- ── 2. fixture_entrant_results ───────────────────────────────
-- The classification of an ordering fixture. Written only by the settlement
-- path (service role); publicly readable like fixtures/teams.

create table if not exists public.fixture_entrant_results (
  id         uuid        primary key default gen_random_uuid(),
  fixture_id uuid        not null references public.fixtures(id) on delete cascade,
  team_id    uuid        not null references public.teams(id)    on delete cascade,
  position   integer     not null check (position >= 1),
  status     text,                              -- 'Finished', 'Retired', '+1 Lap', …
  created_at timestamptz not null default now(),

  unique (fixture_id, position),
  unique (fixture_id, team_id)
);

create index if not exists fer_fixture_idx on public.fixture_entrant_results (fixture_id);

alter table public.fixture_entrant_results enable row level security;

drop policy if exists "public read entrant results" on public.fixture_entrant_results;
create policy "public read entrant results"
  on public.fixture_entrant_results for select using (true);

comment on table public.fixture_entrant_results is
  'Ranked classification of an ordering fixture (F1 qualifying/race). '
  'Written only by settle_ordering_fixture (service role).';


-- ── 3. competition_standings ─────────────────────────────────
-- Championship tables INGESTED from the provider (Jolpica). Points systems
-- (sprint points, countbacks, post-race penalties) are the provider's
-- problem, not ours — same reasoning as rugby declining to derive the try
-- bonus locally.

create table if not exists public.competition_standings (
  id             uuid        primary key default gen_random_uuid(),
  competition_id uuid        not null references public.competitions(id) on delete cascade,
  scope          text        not null check (scope in ('driver', 'constructor')),
  position       integer     not null check (position >= 1),
  name           text        not null,
  code           text,                          -- FIA code for drivers; null for constructors
  team_id        uuid        references public.teams(id) on delete set null,
  points         numeric     not null default 0,
  wins           integer     not null default 0,
  through_round  integer,                       -- provider round the table reflects
  updated_at     timestamptz not null default now(),

  unique (competition_id, scope, position)
);

create index if not exists standings_comp_idx on public.competition_standings (competition_id, scope);

alter table public.competition_standings enable row level security;

drop policy if exists "public read standings" on public.competition_standings;
create policy "public read standings"
  on public.competition_standings for select using (true);


-- ── 4. Scoring an ordering fixture ───────────────────────────
-- Exact-position hits across the five slots, mapped onto the SAME
-- scoring_rules values every sport uses (evaluation order: best rung first):
--   5 hits → 'exact'   (default 5)
--   3–4    → 'gd'      (default 3)   -- "most of the board right"
--   1–2    → 'result'  (default 2)
--   0      → 'wrong'   (default 0)
-- Rationale: monotone in hits, pub-explainable, and any points value it can
-- emit is already a key in the economy amount_map — so IQ minting works
-- with zero economy changes (economy_award_fixture keys on points_awarded).

create or replace function public.apply_ordering_scoring(p_fixture_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_comp        uuid;
  v_positions   integer;
  p_exact       integer;
  p_gd          integer;
  p_result      integer;
  p_wrong       integer;
  updated_count integer;
begin
  select competition_id into v_comp
  from public.fixtures where id = p_fixture_id;

  -- Refuse to score a partial classification: all five scored positions
  -- must exist, or predictions would be judged against an incomplete board.
  select count(*) into v_positions
  from public.fixture_entrant_results
  where fixture_id = p_fixture_id and position between 1 and 5;

  if v_positions < 5 then
    return 0;
  end if;

  -- Same rule lookup + fallback literals as apply_fixture_scoring (044):
  -- a missing row must never mean "zero points".
  select
    coalesce(max(points) filter (where rule_code = 'exact'),  5),
    coalesce(max(points) filter (where rule_code = 'gd'),     3),
    coalesce(max(points) filter (where rule_code = 'result'), 2),
    coalesce(max(points) filter (where rule_code = 'wrong'),  0)
  into p_exact, p_gd, p_result, p_wrong
  from public.scoring_rules
  where competition_id = v_comp;

  update public.predictions pr
  set points_awarded = case
        when h.hits = 5  then p_exact
        when h.hits >= 3 then p_gd
        when h.hits >= 1 then p_result
        else                  p_wrong
      end,
      updated_at = now()
  from (
    select pr2.id,
           (select count(*)
              from public.fixture_entrant_results r
             where r.fixture_id = p_fixture_id
               and r.position between 1 and 5
               and pr2.payload -> 'order' ->> (r.position - 1) = r.team_id::text
           ) as hits
    from public.predictions pr2
    where pr2.fixture_id = p_fixture_id
      and jsonb_typeof(pr2.payload -> 'order') = 'array'
  ) h
  where pr.id = h.id;

  get diagnostics updated_count = row_count;

  -- Economy exactly as 044: after points, wrapped so a failure can never
  -- block scoring.
  begin
    perform public.economy_award_fixture(p_fixture_id);
  exception when others then
    raise warning 'economy_award_fixture failed for fixture %: %', p_fixture_id, sqlerrm;
  end;

  return updated_count;
end;
$$;

revoke all on function public.apply_ordering_scoring(uuid) from public, anon, authenticated;


-- ── 5. The settlement write path ─────────────────────────────
-- One atomic transaction for the ingestion adapter: classification in,
-- status flipped, predictions scored. Jolpica is not a live feed, so there
-- is no partial/live write path — a session settles exactly once, when the
-- full classification is available (idempotent to re-run: results are
-- replaced and scoring recomputes to the same values).
--
-- p_results: [{"team_id": "<uuid>", "position": 1, "status": "Finished"}, …]

create or replace function public.settle_ordering_fixture(
  p_fixture_id uuid,
  p_results    jsonb
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_type text;
  v_comp uuid;
  v_rows integer;
  v_bad  integer;
begin
  select prediction_type, competition_id into v_type, v_comp
  from public.fixtures where id = p_fixture_id;

  if v_type is null then
    raise exception 'Fixture % not found.', p_fixture_id;
  end if;
  if v_type <> 'ordering' then
    raise exception 'Fixture % is %, not ordering — use the score path.', p_fixture_id, v_type;
  end if;
  if jsonb_typeof(p_results) is distinct from 'array' then
    raise exception 'p_results must be a JSON array.';
  end if;

  -- Every named entrant must be a team of this competition. An unmapped
  -- entrant is a registry gap — fail loudly, never settle a wrong board.
  select count(*) into v_bad
  from jsonb_array_elements(p_results) e
  left join public.teams t
    on t.id::text = e ->> 'team_id' and t.competition_id = v_comp
  where t.id is null;

  if v_bad > 0 then
    raise exception '% entrant(s) in the classification are not teams of this competition.', v_bad;
  end if;

  delete from public.fixture_entrant_results where fixture_id = p_fixture_id;

  insert into public.fixture_entrant_results (fixture_id, team_id, position, status)
  select p_fixture_id,
         (e ->> 'team_id')::uuid,
         (e ->> 'position')::integer,
         e ->> 'status'
  from jsonb_array_elements(p_results) e;

  get diagnostics v_rows = row_count;
  if v_rows < 5 then
    raise exception 'Classification has only % entrants — need at least the top 5.', v_rows;
  end if;

  update public.fixtures
  set status = 'completed', updated_at = now()
  where id = p_fixture_id;

  return public.apply_ordering_scoring(p_fixture_id);
end;
$$;

revoke all on function public.settle_ordering_fixture(uuid, jsonb) from public, anon, authenticated;


-- ── 6. rescore_fixture routes ordering fixtures ──────────────
-- Same admin entry point for every sport (rescore_competition loops this).

create or replace function public.rescore_fixture(p_fixture_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_type      text;
  actual_home integer;
  actual_away integer;
begin
  select prediction_type, home_score, away_score
    into v_type, actual_home, actual_away
  from public.fixtures where id = p_fixture_id;

  if v_type = 'ordering' then
    if not exists (
      select 1 from public.fixture_entrant_results
      where fixture_id = p_fixture_id and position between 1 and 5
    ) then
      raise exception 'Cannot rescore: fixture % has no classification yet.', p_fixture_id;
    end if;
    return public.apply_ordering_scoring(p_fixture_id);
  end if;

  if actual_home is null or actual_away is null then
    raise exception 'Cannot rescore: fixture % has no result yet.', p_fixture_id;
  end if;

  return public.apply_fixture_scoring(p_fixture_id);
end;
$$;

grant execute on function public.rescore_fixture to authenticated;


insert into public.schema_migrations (version, name, notes)
values ('073', 'f1_ordering',
        'Ordering predictions (F1): deadline trigger learns payload (audit '
        'finding — ordering rows were lockable-after-start under the live '
        'body), nullable prediction scores + shape trigger, '
        'fixture_entrant_results, competition_standings, apply_ordering_scoring '
        '(exact-hit ladder on scoring_rules values), settle_ordering_fixture, '
        'rescore_fixture routing. Score sports unchanged.')
on conflict (version) do nothing;

do $$
begin
  raise notice 'Migration 073 applied.';
  raise notice 'ACCEPTANCE: (1) a football prediction with payload, or missing a score, is rejected;';
  raise notice '(2) an ordering prediction with 5 distinct competition teams is accepted, wrong shapes rejected;';
  raise notice '(3) settle_ordering_fixture on a seeded test fixture scores 5/3-4/1-2/0 hits as 5/3/2/0 and mints IQ;';
  raise notice '(4) re-run scripts/verify-phase2-isolation.sql with the F1 competition present.';
end;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- Restore enforce_prediction_deadline from
-- prod-rollback/live-functions-2026-07-25.sql (the pre-073 live body).
-- drop trigger if exists prediction_shape_check on public.predictions;
-- drop function if exists public.enforce_prediction_shape();
-- drop function if exists public.settle_ordering_fixture(uuid, jsonb);
-- drop function if exists public.apply_ordering_scoring(uuid);
-- -- restore migration 044's rescore_fixture (score-only) by re-running 044 §5
-- drop table if exists public.competition_standings;
-- drop table if exists public.fixture_entrant_results;
-- alter table public.predictions drop constraint if exists predictions_shape_check;
-- -- Only after deleting any payload predictions:
-- -- alter table public.predictions alter column home_score set not null;
-- -- alter table public.predictions alter column away_score set not null;
-- ============================================================
