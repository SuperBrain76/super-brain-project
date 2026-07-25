-- ============================================================
-- MIGRATION 051 — Competition lifecycle + archive read-only
--
-- Deployment of the Competition Engine v1.
--
-- Adds a single operational control — the competition LIFECYCLE:
--
--     draft → internal → public → archived
--
--   draft     built, admins only, not launched
--   internal  admins-only preview (test the PL privately for a few days)
--   public    live to everyone — the active competition
--   archived  read-only, permanent, listed under "Past Competitions"
--
-- One admin dropdown moves a competition through these states with NO
-- deployment. The World Cup becomes 'archived'; the Premier League ships as
-- 'draft' and is flipped to 'public' when you're ready.
--
-- ────────────────────────────────────────────────────────────
-- ARCHIVE ENFORCEMENT — additive triggers only
-- ────────────────────────────────────────────────────────────
-- Read-only is enforced in the DATABASE, not just the UI. The triggers here
-- block, for an archived competition:
--   • new predictions        (INSERT on predictions)
--   • new private leagues     (INSERT on prediction_leagues)
--   • new league joins        (INSERT on prediction_league_members)
--
-- ⚠️ They fire on INSERT ONLY. They deliberately do NOT touch
-- enforce_prediction_deadline or any scoring path: scoring writes
-- points_awarded via UPDATE, and the repo's deadline trigger is known to
-- differ from production (see docs/SCHEMA_DRIFT_REPORT.md). Blocking only
-- INSERTs makes archive read-only without risking the proven scoring path.
-- For the World Cup this is belt-and-suspenders anyway: every fixture has
-- already kicked off, so predictions are closed regardless.
--
-- DEPENDS ON: 043 (settings), 049 (readiness helpers)
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. lifecycle setting definition ──────────────────────────

insert into public.competition_setting_defs
  (key, value_type, default_value, label, description, group_name, sort_order, is_secret, required)
values
  ('lifecycle', 'string', '"draft"'::jsonb, 'Lifecycle status',
   'draft = admins only, not launched · internal = admin preview · '
   'public = live to everyone (the active competition) · '
   'archived = read-only, listed under Past Competitions.',
   'visibility', 5, false, false)
on conflict (key) do update set
  default_value = excluded.default_value,
  label         = excluded.label,
  description   = excluded.description,
  group_name    = excluded.group_name,
  sort_order    = excluded.sort_order;


-- ── 2. lifecycle resolver ────────────────────────────────────
-- Reads the setting, falling back to a value derived from the old flags so a
-- competition that predates this migration still resolves sensibly.

create or replace function public.competition_lifecycle(p_competition_id uuid)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v text;
  v_status text;
  v_visible boolean;
begin
  select (public.get_competition_setting(p_competition_id, 'lifecycle'))::text
    into v;
  v := trim(both '"' from coalesce(v, ''));

  if v in ('draft', 'internal', 'public', 'archived') then
    return v;
  end if;

  -- Derive from legacy flags: completed → archived; visible → public; else draft.
  select status into v_status from public.competitions where id = p_competition_id;
  select coalesce((public.get_competition_setting(p_competition_id, 'visible'))::text::boolean, false)
    into v_visible;

  if v_status = 'completed' then return 'archived'; end if;
  if v_visible then return 'public'; end if;
  return 'draft';
end;
$$;

grant execute on function public.competition_lifecycle(uuid) to anon, authenticated;


-- ── 3. Set the World Cup to archived ─────────────────────────
-- Permanent. Read-only. Still fully accessible.

do $$
declare v_wc uuid;
begin
  select id into v_wc from public.competitions where slug = 'wc2026';
  if v_wc is null then
    raise notice '051: wc2026 not found — nothing to archive.';
    return;
  end if;

  insert into public.competition_settings (competition_id, key, value) values
    (v_wc, 'lifecycle', '"archived"'::jsonb),
    (v_wc, 'visible',   'true'::jsonb)      -- archived is publicly viewable
  on conflict (competition_id, key) do update set value = excluded.value;

  -- Reflect it in the competition row too, for anything that reads status.
  update public.competitions set status = 'completed' where id = v_wc and status <> 'completed';

  raise notice '051: World Cup archived (read-only, still accessible).';
end;
$$;

-- If the Premier League seed has already run, make sure it starts as draft.
do $$
declare v_pl uuid;
begin
  select id into v_pl from public.competitions where slug = 'premier-league';
  if v_pl is not null then
    insert into public.competition_settings (competition_id, key, value)
    values (v_pl, 'lifecycle', '"draft"'::jsonb)
    on conflict (competition_id, key) do nothing;   -- don't clobber a later flip
    raise notice '051: Premier League lifecycle initialised to draft (if unset).';
  end if;
end;
$$;


-- ── 4. Archive read-only guards (INSERT-only, additive) ──────

create or replace function public.block_write_if_archived()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_comp uuid;
begin
  -- Resolve the competition for the row being inserted.
  if tg_table_name = 'predictions' then
    select f.competition_id into v_comp
    from public.fixtures f where f.id = new.fixture_id;
  elsif tg_table_name = 'prediction_leagues' then
    v_comp := new.competition_id;
  elsif tg_table_name = 'prediction_league_members' then
    select l.competition_id into v_comp
    from public.prediction_leagues l where l.id = new.league_id;
  end if;

  if v_comp is not null and public.competition_lifecycle(v_comp) = 'archived' then
    raise exception 'This competition is archived and read-only. No new % are allowed.',
      tg_table_name using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists archive_guard_predictions on public.predictions;
create trigger archive_guard_predictions
  before insert on public.predictions
  for each row execute function public.block_write_if_archived();

drop trigger if exists archive_guard_leagues on public.prediction_leagues;
create trigger archive_guard_leagues
  before insert on public.prediction_leagues
  for each row execute function public.block_write_if_archived();

drop trigger if exists archive_guard_league_members on public.prediction_league_members;
create trigger archive_guard_league_members
  before insert on public.prediction_league_members
  for each row execute function public.block_write_if_archived();


insert into public.schema_migrations (version, name, notes)
values ('051', 'competition_lifecycle',
        'lifecycle setting (draft/internal/public/archived) + competition_lifecycle() '
        'resolver + INSERT-only archive guards. WC → archived, PL → draft.')
on conflict (version) do nothing;

do $$
begin
  raise notice '';
  raise notice 'Migration 051 complete.';
  raise notice '  World Cup: ARCHIVED (read-only, accessible).';
  raise notice '  Premier League: DRAFT (flip to public from /admin/competitions when ready).';
end;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop trigger if exists archive_guard_league_members on public.prediction_league_members;
-- drop trigger if exists archive_guard_leagues        on public.prediction_leagues;
-- drop trigger if exists archive_guard_predictions    on public.predictions;
-- drop function if exists public.block_write_if_archived();
-- drop function if exists public.competition_lifecycle(uuid);
-- delete from public.competition_settings     where key = 'lifecycle';
-- delete from public.competition_setting_defs where key = 'lifecycle';
-- -- (World Cup remains accessible; it simply loses the archived guard.)
-- ============================================================
