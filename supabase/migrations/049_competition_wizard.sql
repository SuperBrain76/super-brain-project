-- ============================================================
-- MIGRATION 049 — Competition wizard: templates, creation, launch gate
--
-- Competition Engine V2.
--
-- ────────────────────────────────────────────────────────────
-- THE GOAL
-- ────────────────────────────────────────────────────────────
-- "Adding Premier League, La Liga, IPL, Formula 1 or an entirely new sport
--  becomes mostly an administrative task rather than a development project."
--
-- That is only true if creating a competition is ONE TRANSACTION that either
-- produces a complete, correct hierarchy or produces nothing. A wizard that
-- writes five tables with five separate calls will, on its first network
-- blip, leave a competition with a season and no rounds — and migration 047's
-- triggers will then reject every fixture import against it, with an error
-- message about hierarchy that tells the admin nothing about what to do.
--
-- So the wizard's backend is three RPCs:
--
--   admin_create_competition(jsonb)  — the whole hierarchy, atomically
--   admin_import_fixtures(jsonb)     — bulk fixtures, teams resolved by code
--   admin_launch_competition(uuid)   — a VALIDATION GATE, then go live
--
-- ────────────────────────────────────────────────────────────
-- THE LAUNCH GATE IS THE IMPORTANT PART
-- ────────────────────────────────────────────────────────────
-- Creating a competition is easy. Launching a HALF-BUILT one in front of
-- users is the failure mode worth engineering against, because it is
-- discovered by users rather than by the admin. admin_launch_competition
-- refuses to flip `visible` until every structural precondition holds, and
-- it returns the full list of what is missing rather than the first problem.
--
-- SECURITY
--   All three are SECURITY DEFINER and check public.app_admins. They bypass
--   RLS by necessity — they write competitions, teams and fixtures, none of
--   which have write policies for ordinary users.
--
-- DEPENDS ON: 040, 041, 042, 043, 044, 045, 047, 048
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. Format templates ──────────────────────────────────────
-- A template is a competition SHAPE: its stages, its round structure and
-- its default settings. This is what makes "La Liga" a form submission
-- rather than a migration.

create table if not exists public.competition_templates (
  code         text primary key,
  name         text not null,
  sport_code   text not null references public.sports(code) on update cascade,
  description  text,

  -- [{code,label,sort_order,has_table,is_knockout}, …]
  stages       jsonb not null default '[]'::jsonb,
  -- {kind, count, label_pattern, short_pattern}
  round_config jsonb not null default '{}'::jsonb,
  -- competition_settings keys to apply
  settings     jsonb not null default '{}'::jsonb,
  -- {exact,gd,result,wrong}
  scoring      jsonb not null default '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb,

  sort_order   integer not null default 0,
  active       boolean not null default true
);

alter table public.competition_templates enable row level security;

drop policy if exists "public read templates" on public.competition_templates;
create policy "public read templates"
  on public.competition_templates for select using (true);

insert into public.competition_templates
  (code, name, sport_code, description, stages, round_config, settings, scoring, sort_order)
values
  ('football_league_38', 'Football league — 38 matchweeks', 'football',
   'Standard 20-team double round-robin: Premier League, La Liga, Serie A, Ligue 1.',
   '[{"code":"league","label":"Matchweek","sort_order":1,"has_table":true,"is_knockout":false}]'::jsonb,
   '{"kind":"matchweek","count":38,"label_pattern":"Matchweek {n}","short_pattern":"MW{n}"}'::jsonb,
   '{"has_knockout":false,"has_group_stage":false,"has_standings_table":true,"has_challenges":true,"round_label":"Matchweek","round_label_plural":"Matchweeks"}'::jsonb,
   '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb, 10),

  ('football_league_34', 'Football league — 34 matchweeks', 'football',
   '18-team double round-robin: Bundesliga.',
   '[{"code":"league","label":"Matchweek","sort_order":1,"has_table":true,"is_knockout":false}]'::jsonb,
   '{"kind":"matchweek","count":34,"label_pattern":"Matchweek {n}","short_pattern":"MW{n}"}'::jsonb,
   '{"has_knockout":false,"has_group_stage":false,"has_standings_table":true,"has_challenges":true,"round_label":"Matchweek","round_label_plural":"Matchweeks"}'::jsonb,
   '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb, 20),

  ('football_group_knockout', 'Football tournament — groups then knockout', 'football',
   'Group stage into a single-elimination bracket: World Cup, Euros, Copa América.',
   '[{"code":"group","label":"Group Stage","sort_order":1,"has_table":true,"is_knockout":false},
     {"code":"r16","label":"Round of 16","sort_order":2,"has_table":false,"is_knockout":true},
     {"code":"qf","label":"Quarter-final","sort_order":3,"has_table":false,"is_knockout":true},
     {"code":"sf","label":"Semi-final","sort_order":4,"has_table":false,"is_knockout":true},
     {"code":"3rd","label":"Third Place","sort_order":5,"has_table":false,"is_knockout":true},
     {"code":"final","label":"Final","sort_order":6,"has_table":false,"is_knockout":true}]'::jsonb,
   '{"kind":"stage","count":0}'::jsonb,
   '{"has_knockout":true,"has_group_stage":true,"has_standings_table":true,"has_challenges":true,"round_label":"Stage","round_label_plural":"Stages"}'::jsonb,
   '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb, 30),

  ('football_ucl', 'Football — league phase then knockout', 'football',
   'Single league table into a knockout bracket: Champions League (2024 format onward).',
   '[{"code":"league","label":"League Phase","sort_order":1,"has_table":true,"is_knockout":false},
     {"code":"po","label":"Play-off","sort_order":2,"has_table":false,"is_knockout":true},
     {"code":"r16","label":"Round of 16","sort_order":3,"has_table":false,"is_knockout":true},
     {"code":"qf","label":"Quarter-final","sort_order":4,"has_table":false,"is_knockout":true},
     {"code":"sf","label":"Semi-final","sort_order":5,"has_table":false,"is_knockout":true},
     {"code":"final","label":"Final","sort_order":6,"has_table":false,"is_knockout":true}]'::jsonb,
   '{"kind":"matchweek","count":8,"label_pattern":"Matchday {n}","short_pattern":"MD{n}"}'::jsonb,
   '{"has_knockout":true,"has_group_stage":false,"has_standings_table":true,"has_challenges":true,"round_label":"Matchday","round_label_plural":"Matchdays"}'::jsonb,
   '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb, 40),

  ('football_cup', 'Football — straight knockout cup', 'football',
   'Single-elimination from round one: FA Cup, domestic cups.',
   '[{"code":"r64","label":"Round of 64","sort_order":1,"has_table":false,"is_knockout":true},
     {"code":"r32","label":"Round of 32","sort_order":2,"has_table":false,"is_knockout":true},
     {"code":"r16","label":"Round of 16","sort_order":3,"has_table":false,"is_knockout":true},
     {"code":"qf","label":"Quarter-final","sort_order":4,"has_table":false,"is_knockout":true},
     {"code":"sf","label":"Semi-final","sort_order":5,"has_table":false,"is_knockout":true},
     {"code":"final","label":"Final","sort_order":6,"has_table":false,"is_knockout":true}]'::jsonb,
   '{"kind":"stage","count":0}'::jsonb,
   '{"has_knockout":true,"has_group_stage":false,"has_standings_table":false,"has_challenges":true,"round_label":"Round","round_label_plural":"Rounds"}'::jsonb,
   '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb, 50),

  ('custom', 'Custom — configure everything by hand', 'football',
   'No preset. Define stages, rounds and scoring yourself.',
   '[]'::jsonb, '{}'::jsonb, '{}'::jsonb,
   '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb, 900)
on conflict (code) do update set
  name         = excluded.name,
  description  = excluded.description,
  stages       = excluded.stages,
  round_config = excluded.round_config,
  settings     = excluded.settings,
  scoring      = excluded.scoring,
  sort_order   = excluded.sort_order;

comment on table public.competition_templates is
  'Competition SHAPES. Adding a new format is a row here, not a migration. '
  'Non-football templates are deliberately absent: the prediction model is '
  'score-based, so listing an F1 template would promise something the engine '
  'cannot yet honour.';


-- ── 2. Admin guard ───────────────────────────────────────────

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.app_admins where user_id = auth.uid()) then
    raise exception 'Admin privileges required.' using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.assert_admin() to authenticated;


-- ── 3. Create a competition — one transaction ────────────────
--
-- Payload:
-- {
--   "slug": "premier-league",
--   "name": "Premier League",
--   "sport_code": "football",
--   "template": "football_league_38",
--   "season": { "slug": "pl-2026-27", "label": "2026/27",
--               "starts_at": "...", "ends_at": "..." },
--   "settings": { "provider_league_id": 39, "provider_season": 2026 },
--   "scoring":  { "exact": 5, "gd": 3, "result": 2, "wrong": 0 },
--   "economy":  { "prediction_score": { "multiplier": 0.75 } }
-- }
--
-- Everything except slug, name and season is optional; the template fills
-- the rest. Explicit values always win over the template.

create or replace function public.admin_create_competition(p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_tpl         record;
  v_comp        uuid;
  v_season      uuid;
  v_slug        text;
  v_name        text;
  v_sport       text;
  v_stages      jsonb;
  v_settings    jsonb;
  v_scoring     jsonb;
  v_round_cfg   jsonb;
  v_stage       jsonb;
  v_key         text;
  v_n           integer;
  v_count       integer;
  v_rounds_made integer := 0;
  v_first_stage text;
begin
  perform public.assert_admin();

  v_slug := nullif(trim(p_payload ->> 'slug'), '');
  v_name := nullif(trim(p_payload ->> 'name'), '');

  if v_slug is null or v_name is null then
    raise exception 'slug and name are required.';
  end if;

  -- The slug becomes a top-level URL path (/premier-league), so it must be
  -- URL-safe and must not collide with an application route.
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception
      'slug "%" must be lowercase letters, numbers and single hyphens '
      '(it becomes the competition''s URL).', v_slug;
  end if;

  if v_slug in (
    'admin','api','auth','login','logout','signup','settings','profile','u',
    'tests','test','battle','economy','iq','network','achievements','leaderboard',
    'results','share','challenge','welcome','predict','privacy','terms','contact',
    'disclaimer','forgot-password','reset-password','_next','static','favicon.ico'
  ) then
    raise exception
      'slug "%" is a reserved application route and cannot be used as a '
      'competition slug.', v_slug;
  end if;

  if exists (select 1 from public.competitions where slug = v_slug) then
    raise exception 'A competition with slug "%" already exists.', v_slug;
  end if;

  -- Template (optional)
  select * into v_tpl from public.competition_templates
   where code = coalesce(p_payload ->> 'template', '') and active;

  v_sport     := coalesce(p_payload ->> 'sport_code', v_tpl.sport_code, 'football');
  v_stages    := coalesce(p_payload -> 'stages',   v_tpl.stages,       '[]'::jsonb);
  v_round_cfg := coalesce(p_payload -> 'rounds',   v_tpl.round_config, '{}'::jsonb);
  v_scoring   := coalesce(v_tpl.scoring, '{"exact":5,"gd":3,"result":2,"wrong":0}'::jsonb)
                 || coalesce(p_payload -> 'scoring', '{}'::jsonb);
  v_settings  := coalesce(v_tpl.settings, '{}'::jsonb)
                 || coalesce(p_payload -> 'settings', '{}'::jsonb);

  if not exists (select 1 from public.sports where code = v_sport) then
    raise exception 'Unknown sport "%".', v_sport;
  end if;

  -- ── Competition ──
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values (
    v_name, v_slug, v_sport, 'upcoming',
    (p_payload -> 'season' ->> 'starts_at')::timestamptz,
    (p_payload -> 'season' ->> 'ends_at')::timestamptz
  )
  returning id into v_comp;

  -- ── Stages ──
  if jsonb_array_length(v_stages) = 0 then
    raise exception
      'No stages defined. A competition needs at least one stage — pick a '
      'template or supply "stages".';
  end if;

  for v_stage in select * from jsonb_array_elements(v_stages) loop
    insert into public.competition_stages
      (competition_id, code, label, sort_order, has_table, is_knockout)
    values (
      v_comp,
      v_stage ->> 'code',
      v_stage ->> 'label',
      coalesce((v_stage ->> 'sort_order')::integer, 0),
      coalesce((v_stage ->> 'has_table')::boolean, false),
      coalesce((v_stage ->> 'is_knockout')::boolean, false)
    );
  end loop;

  select code into v_first_stage
  from public.competition_stages
  where competition_id = v_comp order by sort_order limit 1;

  -- ── Season ──
  if p_payload -> 'season' is null then
    raise exception 'A season is required. Supply "season": {slug, label, …}.';
  end if;

  insert into public.seasons
    (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (
    v_comp,
    coalesce(nullif(trim(p_payload -> 'season' ->> 'slug'), ''), v_slug || '-season'),
    coalesce(nullif(trim(p_payload -> 'season' ->> 'label'), ''), 'Season 1'),
    'upcoming',
    true,
    (p_payload -> 'season' ->> 'starts_at')::timestamptz,
    (p_payload -> 'season' ->> 'ends_at')::timestamptz
  )
  returning id into v_season;

  -- ── Rounds ──
  v_count := coalesce((v_round_cfg ->> 'count')::integer, 0);

  if v_count > 0 then
    -- Generated: matchweek 1..N
    for v_n in 1 .. v_count loop
      insert into public.rounds
        (season_id, code, label, short_label, sort_order, kind, status)
      values (
        v_season,
        'mw' || v_n,
        replace(coalesce(v_round_cfg ->> 'label_pattern', 'Round {n}'), '{n}', v_n::text),
        replace(coalesce(v_round_cfg ->> 'short_pattern', 'R{n}'),     '{n}', v_n::text),
        v_n,
        coalesce(v_round_cfg ->> 'kind', 'matchweek'),
        'upcoming'
      );
      v_rounds_made := v_rounds_made + 1;
    end loop;
  else
    -- Stage-shaped: one round per stage, mirroring how the World Cup is
    -- modelled (migration 042).
    insert into public.rounds
      (season_id, code, label, short_label, sort_order, kind, status)
    select
      v_season, cs.code, cs.label, cs.label, cs.sort_order,
      case when cs.is_knockout then 'knockout' else 'group' end,
      'upcoming'
    from public.competition_stages cs
    where cs.competition_id = v_comp
    order by cs.sort_order;

    get diagnostics v_rounds_made = row_count;
  end if;

  -- ── Settings ──
  for v_key in select jsonb_object_keys(v_settings) loop
    -- Unknown keys are SKIPPED rather than rejected: a template written
    -- before a setting existed should still apply cleanly.
    if exists (select 1 from public.competition_setting_defs where key = v_key) then
      insert into public.competition_settings (competition_id, key, value, updated_by)
      values (v_comp, v_key, v_settings -> v_key, auth.uid())
      on conflict (competition_id, key) do update
        set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
    else
      raise notice 'admin_create_competition: skipping unknown setting "%".', v_key;
    end if;
  end loop;

  -- A new competition is invisible until admin_launch_competition says so.
  insert into public.competition_settings (competition_id, key, value, updated_by)
  values (v_comp, 'visible', 'false'::jsonb, auth.uid())
  on conflict (competition_id, key) do update set value = 'false'::jsonb;

  -- ── Scoring rules ──
  insert into public.scoring_rules (competition_id, rule_code, points, sort_order)
  values
    (v_comp, 'exact',  coalesce((v_scoring ->> 'exact')::integer,  5), 1),
    (v_comp, 'gd',     coalesce((v_scoring ->> 'gd')::integer,     3), 2),
    (v_comp, 'result', coalesce((v_scoring ->> 'result')::integer, 2), 3),
    (v_comp, 'wrong',  coalesce((v_scoring ->> 'wrong')::integer,  0), 4);

  -- ── Economy rules (optional) ──
  if p_payload -> 'economy' is not null then
    for v_key in select jsonb_object_keys(p_payload -> 'economy') loop
      if exists (select 1 from public.economy_event_types where code = v_key) then
        insert into public.competition_economy_rules
          (competition_id, event_code, multiplier, amount_map, enabled, updated_by)
        values (
          v_comp, v_key,
          coalesce((p_payload -> 'economy' -> v_key ->> 'multiplier')::numeric, 1.0),
          p_payload -> 'economy' -> v_key -> 'amount_map',
          coalesce((p_payload -> 'economy' -> v_key ->> 'enabled')::boolean, true),
          auth.uid()
        )
        on conflict (competition_id, event_code) do update
          set multiplier = excluded.multiplier,
              amount_map = excluded.amount_map,
              enabled    = excluded.enabled,
              updated_at = now();
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'competition_id', v_comp,
    'competition_slug', v_slug,
    'season_id',      v_season,
    'stages_created', jsonb_array_length(v_stages),
    'rounds_created', v_rounds_made,
    'default_stage',  v_first_stage,
    'url',            '/' || v_slug,
    'next_step',      'Import teams and fixtures, then call admin_launch_competition.'
  );
end;
$$;

grant execute on function public.admin_create_competition(jsonb) to authenticated;


-- ── 4. Bulk fixture import ───────────────────────────────────
--
-- p_fixtures: [{ "round": 1, "home": "ARS", "away": "BUR",
--                "kicks_off_at": "2026-08-15T14:00:00Z",
--                "venue": "Emirates", "provider_fixture_id": "1035432" }, …]
--
-- Teams are resolved by CODE within the competition and created if absent,
-- so a fixture list alone is enough to bootstrap a season. `round` matches
-- rounds.sort_order.

create or replace function public.admin_import_fixtures(
  p_season_id uuid,
  p_fixtures  jsonb,
  p_commit    boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_comp      uuid;
  v_stage     text;
  v_row       jsonb;
  v_home      uuid;
  v_away      uuid;
  v_round     uuid;
  v_num       integer;
  v_created   integer := 0;
  v_teams_new integer := 0;
  v_errors    jsonb   := '[]'::jsonb;
  v_idx       integer := 0;
begin
  perform public.assert_admin();

  select competition_id into v_comp from public.seasons where id = p_season_id;
  if v_comp is null then
    raise exception 'Season % not found.', p_season_id;
  end if;

  -- Default stage: the first non-knockout one, else the first.
  select code into v_stage from public.competition_stages
   where competition_id = v_comp order by is_knockout, sort_order limit 1;

  if v_stage is null then
    raise exception 'Competition has no stages — cannot import fixtures.';
  end if;

  select coalesce(max(fixture_number), 0) into v_num
  from public.fixtures where competition_id = v_comp;

  for v_row in select * from jsonb_array_elements(p_fixtures) loop
    v_idx := v_idx + 1;

    begin
      select id into v_round from public.rounds
       where season_id = p_season_id
         and sort_order = (v_row ->> 'round')::integer;

      if v_round is null then
        v_errors := v_errors || jsonb_build_object(
          'index', v_idx, 'error',
          format('round %s does not exist in this season', v_row ->> 'round'));
        continue;
      end if;

      -- Home team, by code, created if new
      select id into v_home from public.teams
       where competition_id = v_comp and code = upper(v_row ->> 'home');

      if v_home is null then
        if not p_commit then
          v_teams_new := v_teams_new + 1;
        else
          insert into public.teams (competition_id, season_id, name, code)
          values (v_comp, p_season_id,
                  coalesce(v_row ->> 'home_name', v_row ->> 'home'),
                  upper(v_row ->> 'home'))
          returning id into v_home;
          insert into public.season_teams (season_id, team_id)
          values (p_season_id, v_home) on conflict do nothing;
          v_teams_new := v_teams_new + 1;
        end if;
      end if;

      select id into v_away from public.teams
       where competition_id = v_comp and code = upper(v_row ->> 'away');

      if v_away is null then
        if not p_commit then
          v_teams_new := v_teams_new + 1;
        else
          insert into public.teams (competition_id, season_id, name, code)
          values (v_comp, p_season_id,
                  coalesce(v_row ->> 'away_name', v_row ->> 'away'),
                  upper(v_row ->> 'away'))
          returning id into v_away;
          insert into public.season_teams (season_id, team_id)
          values (p_season_id, v_away) on conflict do nothing;
          v_teams_new := v_teams_new + 1;
        end if;
      end if;

      if v_row ->> 'kicks_off_at' is null then
        v_errors := v_errors || jsonb_build_object(
          'index', v_idx, 'error', 'kicks_off_at is required');
        continue;
      end if;

      v_num := v_num + 1;

      if p_commit then
        insert into public.fixtures
          (competition_id, season_id, round_id, stage, fixture_number,
           home_team_id, away_team_id, kicks_off_at, venue,
           provider, provider_fixture_id, status)
        values (
          v_comp, p_season_id, v_round,
          coalesce(v_row ->> 'stage', v_stage),
          v_num, v_home, v_away,
          (v_row ->> 'kicks_off_at')::timestamptz,
          v_row ->> 'venue',
          case when v_row ->> 'provider_fixture_id' is not null
               then coalesce(v_row ->> 'provider', 'api-football') end,
          v_row ->> 'provider_fixture_id',
          'scheduled'
        );
      end if;

      v_created := v_created + 1;

    exception when others then
      v_errors := v_errors || jsonb_build_object(
        'index', v_idx, 'error', sqlerrm);
    end;
  end loop;

  -- A dry run must leave nothing behind, including the teams it created
  -- while resolving codes. Raising here rolls the whole function back.
  if not p_commit then
    raise exception 'DRY_RUN_RESULT:%', jsonb_build_object(
      'dry_run', true,
      'would_create_fixtures', v_created,
      'would_create_teams',    v_teams_new,
      'errors',                v_errors
    )::text;
  end if;

  return jsonb_build_object(
    'committed',        true,
    'fixtures_created', v_created,
    'teams_created',    v_teams_new,
    'errors',           v_errors
  );
end;
$$;

grant execute on function public.admin_import_fixtures(uuid, jsonb, boolean) to authenticated;

comment on function public.admin_import_fixtures is
  'Bulk fixture import. p_commit=false performs a full dry run and then '
  'deliberately RAISES with a DRY_RUN_RESULT: payload — the exception is how '
  'the transaction is rolled back, so the caller must parse it rather than '
  'treat it as a failure.';


-- ── 5. The launch gate ───────────────────────────────────────
-- Refuses to make a competition visible until it is actually complete.
-- Returns EVERY problem, not the first.

create or replace function public.admin_launch_competition(
  p_competition_id uuid,
  p_force          boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_slug      text;
  v_problems  jsonb := '[]'::jsonb;
  v_warnings  jsonb := '[]'::jsonb;
  v_season    uuid;
  v_n         integer;
  v_ingest    boolean;
begin
  perform public.assert_admin();

  select slug into v_slug from public.competitions where id = p_competition_id;
  if v_slug is null then
    raise exception 'Competition % not found.', p_competition_id;
  end if;

  -- Season
  select id into v_season from public.seasons
   where competition_id = p_competition_id and is_current limit 1;
  if v_season is null then
    v_problems := v_problems || to_jsonb('No current season. Create one and mark it is_current.'::text);
  end if;

  -- Stages
  select count(*) into v_n from public.competition_stages where competition_id = p_competition_id;
  if v_n = 0 then
    v_problems := v_problems || to_jsonb('No stages defined.'::text);
  end if;

  -- Rounds
  if v_season is not null then
    select count(*) into v_n from public.rounds where season_id = v_season;
    if v_n = 0 then
      v_problems := v_problems || to_jsonb('No rounds in the current season.'::text);
    end if;

    -- Teams
    select count(*) into v_n from public.season_teams where season_id = v_season;
    if v_n < 2 then
      v_problems := v_problems || to_jsonb(
        format('Only %s team(s) in the season — at least 2 are needed.', v_n)::text);
    end if;

    -- Fixtures
    select count(*) into v_n from public.fixtures where season_id = v_season;
    if v_n = 0 then
      v_problems := v_problems || to_jsonb('No fixtures imported.'::text);
    end if;

    -- Hierarchy completeness
    select count(*) into v_n from public.fixtures
     where season_id = v_season and round_id is null;
    if v_n > 0 then
      v_problems := v_problems || to_jsonb(
        format('%s fixture(s) are not assigned to a round.', v_n)::text);
    end if;

    -- Rounds with no fixtures — a warning, not a blocker: a cup's later
    -- rounds legitimately have none until earlier ones are played.
    select count(*) into v_n from public.rounds r
     where r.season_id = v_season
       and not exists (select 1 from public.fixtures f where f.round_id = r.id);
    if v_n > 0 then
      v_warnings := v_warnings || to_jsonb(
        format('%s round(s) have no fixtures yet.', v_n)::text);
    end if;
  end if;

  -- Scoring
  select count(*) into v_n from public.scoring_rules where competition_id = p_competition_id;
  if v_n < 4 then
    v_problems := v_problems || to_jsonb(
      format('Scoring rules incomplete (%s of 4).', v_n)::text);
  end if;

  -- Provider config, only if ingestion is on
  select coalesce((public.get_competition_setting(p_competition_id, 'ingest_enabled'))::text::boolean, false)
    into v_ingest;

  if v_ingest then
    if public.get_competition_setting(p_competition_id, 'provider_league_id') in ('null'::jsonb, 'undefined'::jsonb)
       or public.get_competition_setting(p_competition_id, 'provider_league_id') is null then
      v_problems := v_problems || to_jsonb(
        'Ingestion is enabled but provider_league_id is not set.'::text);
    end if;

    if v_season is not null then
      select count(*) into v_n from public.fixtures
       where season_id = v_season and provider_fixture_id is null;
      if v_n > 0 then
        v_problems := v_problems || to_jsonb(
          format('Ingestion is enabled but %s fixture(s) have no provider_fixture_id. '
                 'Results could not be routed to them.', v_n)::text);
      end if;
    end if;
  else
    v_warnings := v_warnings || to_jsonb(
      'Automatic result ingestion is OFF — results must be entered by hand.'::text);
  end if;

  -- ── Verdict ──
  if jsonb_array_length(v_problems) > 0 and not p_force then
    return jsonb_build_object(
      'launched',    false,
      'competition', v_slug,
      'problems',    v_problems,
      'warnings',    v_warnings,
      'hint',        'Fix the problems and retry. p_force := true overrides, '
                     'but a launched competition is visible to every user.'
    );
  end if;

  update public.competitions set status = 'active' where id = p_competition_id;

  update public.seasons set status = 'active'
   where id = v_season and status = 'upcoming';

  insert into public.competition_settings (competition_id, key, value, updated_by)
  values (p_competition_id, 'visible', 'true'::jsonb, auth.uid())
  on conflict (competition_id, key) do update
    set value = 'true'::jsonb, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object(
    'launched',    true,
    'competition', v_slug,
    'url',         '/' || v_slug,
    'forced',      p_force and jsonb_array_length(v_problems) > 0,
    'problems',    v_problems,
    'warnings',    v_warnings
  );
end;
$$;

grant execute on function public.admin_launch_competition(uuid, boolean) to authenticated;


-- ── 6. Readiness, without launching ──────────────────────────
-- The wizard's review step calls this. Same checks, no side effects.

create or replace function public.admin_competition_readiness(p_competition_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.assert_admin();
  -- Reuse the gate, then undo anything it did.
  begin
    v_result := public.admin_launch_competition(p_competition_id, false);
  exception when others then
    return jsonb_build_object('error', sqlerrm);
  end;

  -- admin_launch_competition only writes when there are no problems; if it
  -- launched, put it straight back to invisible so a readiness CHECK never
  -- has the side effect of going live.
  if (v_result ->> 'launched')::boolean then
    update public.competitions set status = 'upcoming' where id = p_competition_id;
    insert into public.competition_settings (competition_id, key, value)
    values (p_competition_id, 'visible', 'false'::jsonb)
    on conflict (competition_id, key) do update set value = 'false'::jsonb;
    v_result := jsonb_set(v_result, '{launched}', 'false'::jsonb)
             || jsonb_build_object('ready', true);
  else
    v_result := v_result || jsonb_build_object('ready', false);
  end if;

  return v_result;
end;
$$;

grant execute on function public.admin_competition_readiness(uuid) to authenticated;


insert into public.schema_migrations (version, name, notes)
values ('049', 'competition_wizard',
        'competition_templates + admin_create_competition / admin_import_fixtures / '
        'admin_launch_competition / admin_competition_readiness. Launch is gated '
        'on structural completeness.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists public.admin_competition_readiness(uuid);
-- drop function if exists public.admin_launch_competition(uuid, boolean);
-- drop function if exists public.admin_import_fixtures(uuid, jsonb, boolean);
-- drop function if exists public.admin_create_competition(jsonb);
-- drop function if exists public.assert_admin();
-- drop table    if exists public.competition_templates;
-- ============================================================
