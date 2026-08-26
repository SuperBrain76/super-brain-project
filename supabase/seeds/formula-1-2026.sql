-- AUTO-GENERATED seed — Formula 1 2026, rounds 13-23 (22 fixtures / 11 GP rounds) from Jolpica
-- Ordering sport: 2 fixtures per GP (qualifying + race), NULL team columns,
-- prediction_type 'ordering', provider ids f1-2026-<round>-<q|r>.
-- Requires migration 073 before predictions open. Lands draft/hidden.

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('Formula 1', 'formula-1', 'motorsport', 'active', '2026-09-05T14:00:00Z', '2026-12-06T13:00:00Z')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='formula-1'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'Grand Prix', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, 'f1-2026', '2026', 'upcoming', true, '2026-09-05T14:00:00Z', '2026-12-06T13:00:00Z')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='f1-2026';

  -- Standard values on purpose: apply_ordering_scoring maps hit counts onto
  -- these same rows (5 hits->exact, 3-4->gd, 1-2->result), which keeps the
  -- IQ amount_map keys aligned — the economy needs no F1 configuration.
  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Grand Prix"'::jsonb),
    (v_comp,'round_label_plural','"Grands Prix"'::jsonb),
    (v_comp,'provider','"jolpica"'::jsonb),
    (v_comp,'provider_league_id','2026'::jsonb),
    (v_comp,'provider_season','"2026"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"draft"'::jsonb),
    (v_comp,'visible','false'::jsonb),
    (v_comp,'timezone','"Europe/London"'::jsonb),
    (v_comp,'display_order','13'::jsonb)
  on conflict (competition_id, key) do nothing;

  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Lando Norris', 'NOR', 'McLaren') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Oscar Piastri', 'PIA', 'McLaren') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Andrea Kimi Antonelli', 'ANT', 'Mercedes') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'George Russell', 'RUS', 'Mercedes') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Lewis Hamilton', 'HAM', 'Ferrari') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Charles Leclerc', 'LEC', 'Ferrari') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Max Verstappen', 'VER', 'Red Bull') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Liam Lawson', 'LAW', 'Red Bull') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Pierre Gasly', 'GAS', 'Alpine') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Franco Colapinto', 'COL', 'Alpine') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Alexander Albon', 'ALB', 'Williams') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Carlos Sainz', 'SAI', 'Williams') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Fernando Alonso', 'ALO', 'Aston Martin') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Lance Stroll', 'STR', 'Aston Martin') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Yuki Tsunoda', 'TSU', 'Racing Bulls') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Arvid Lindblad', 'LIN', 'Racing Bulls') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Oliver Bearman', 'BEA', 'Haas') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Esteban Ocon', 'OCO', 'Haas') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Nico Hulkenberg', 'HUL', 'Audi') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Gabriel Bortoleto', 'BOR', 'Audi') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Sergio Perez', 'PER', 'Cadillac') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Valtteri Bottas', 'BOT', 'Cadillac') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Isack Hadjar', 'HAD', 'Red Bull') on conflict (competition_id, code) do update set name = excluded.name, group_name = excluded.group_name;

  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  -- 🔴 RE-SEED GUARD (pre-production audit, 26 Aug 2026): deleting fixtures
  -- CASCADES to predictions. Re-running this seed after anyone has predicted
  -- would silently wipe their entries. Schedule changes on a live season are
  -- made with targeted UPDATEs (see docs/F1_LAUNCH_RUNBOOK.md), never by
  -- re-seeding.
  if exists (
    select 1 from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where f.season_id = v_season
  ) then
    raise exception 'REFUSING to re-seed: predictions exist for this season. Use targeted UPDATEs for schedule changes (docs/F1_LAUNCH_RUNBOOK.md).';
  end if;

  delete from public.fixtures where season_id = v_season;
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r13', 'Italian Grand Prix', 'R13', 13, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r13';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-09-05T14:00:00Z', 'Autodromo Nazionale di Monza — Qualifying', 'scheduled', 'f1-2026-13-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-09-06T13:00:00Z', 'Autodromo Nazionale di Monza — Race', 'scheduled', 'f1-2026-13-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r14', 'Spanish Grand Prix', 'R14', 14, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r14';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-09-12T14:00:00Z', 'Madring — Qualifying', 'scheduled', 'f1-2026-14-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-09-13T13:00:00Z', 'Madring — Race', 'scheduled', 'f1-2026-14-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r15', 'Azerbaijan Grand Prix', 'R15', 15, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r15';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-09-25T12:00:00Z', 'Baku City Circuit — Qualifying', 'scheduled', 'f1-2026-15-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-09-26T11:00:00Z', 'Baku City Circuit — Race', 'scheduled', 'f1-2026-15-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r16', 'Bahrain Grand Prix in Malaysia', 'R16', 16, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r16';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-10-03T08:00:00Z', 'Sepang International Circuit — Qualifying', 'scheduled', 'f1-2026-16-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-10-04T07:00:00Z', 'Sepang International Circuit — Race', 'scheduled', 'f1-2026-16-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r17', 'Singapore Grand Prix', 'R17', 17, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r17';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-10-10T13:00:00Z', 'Marina Bay Street Circuit — Qualifying', 'scheduled', 'f1-2026-17-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-10-11T12:00:00Z', 'Marina Bay Street Circuit — Race', 'scheduled', 'f1-2026-17-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r18', 'United States Grand Prix', 'R18', 18, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r18';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-10-24T21:00:00Z', 'Circuit of the Americas — Qualifying', 'scheduled', 'f1-2026-18-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-10-25T20:00:00Z', 'Circuit of the Americas — Race', 'scheduled', 'f1-2026-18-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r19', 'Mexico City Grand Prix', 'R19', 19, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r19';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-10-31T21:00:00Z', 'Autódromo Hermanos Rodríguez — Qualifying', 'scheduled', 'f1-2026-19-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-11-01T20:00:00Z', 'Autódromo Hermanos Rodríguez — Race', 'scheduled', 'f1-2026-19-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r20', 'Brazilian Grand Prix', 'R20', 20, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r20';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-11-07T18:00:00Z', 'Autódromo José Carlos Pace — Qualifying', 'scheduled', 'f1-2026-20-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-11-08T17:00:00Z', 'Autódromo José Carlos Pace — Race', 'scheduled', 'f1-2026-20-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r21', 'Las Vegas Grand Prix', 'R21', 21, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r21';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-11-21T04:00:00Z', 'Las Vegas Strip Street Circuit — Qualifying', 'scheduled', 'f1-2026-21-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-11-22T04:00:00Z', 'Las Vegas Strip Street Circuit — Race', 'scheduled', 'f1-2026-21-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r22', 'Qatar Grand Prix', 'R22', 22, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r22';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-11-28T18:00:00Z', 'Losail International Circuit — Qualifying', 'scheduled', 'f1-2026-22-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-11-29T16:00:00Z', 'Losail International Circuit — Race', 'scheduled', 'f1-2026-22-r');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r23', 'Abu Dhabi Grand Prix', 'R23', 23, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r23';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-12-05T14:00:00Z', 'Yas Marina Circuit — Qualifying', 'scheduled', 'f1-2026-23-q');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, prediction_type, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, 'ordering', null, null, '2026-12-06T13:00:00Z', 'Yas Marina Circuit — Race', 'scheduled', 'f1-2026-23-r');
  raise notice 'Formula 1: % fixtures / % GP rounds', v_num, 11;
end $$;
