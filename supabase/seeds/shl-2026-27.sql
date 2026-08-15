-- AUTO-GENERATED seed — SHL 2026-2027 (364 fixtures / 58 gamedays) from TheSportsDB
-- Ice hockey: first hockey competition. No draws (OT/SO decides).
insert into public.sports (code, name, has_draw, default_prediction_type, icon)
values ('ice_hockey', 'Ice Hockey', false, 'score', '🏒')
on conflict (code) do nothing;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('SHL', 'shl', 'ice_hockey', 'active', '2026-09-19T13:15:00Z', '2027-03-16T18:00:00Z')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='shl'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'Gameday', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, 'shl-2026-27', '2026/27', 'upcoming', true, '2026-09-19T13:15:00Z', '2027-03-16T18:00:00Z')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='shl-2026-27';

  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Gameday"'::jsonb),
    (v_comp,'round_label_plural','"Gamedays"'::jsonb),
    (v_comp,'provider','"thesportsdb"'::jsonb),
    (v_comp,'provider_league_id','4419'::jsonb),
    (v_comp,'provider_season','"2026-2027"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"public"'::jsonb),
    (v_comp,'visible','true'::jsonb),
    (v_comp,'timezone','"Europe/Stockholm"'::jsonb),
    (v_comp,'display_order','10'::jsonb)
  on conflict (competition_id, key) do update set value = excluded.value;

  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Brynäs IF', 'BRY', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Djurgårdens IF', 'DIF', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Färjestad BK', 'FBK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Frölunda HC', 'FRL', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'HV71', 'HV7', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'IF Björklöven', 'BJO', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Linköpings HC', 'LHC', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Luleå HF', 'LUL', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Malmö Redhawks', 'MRH', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Örebro HK', 'ORE', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Rögle BK', 'ROG', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Skellefteå AIK', 'SKE', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Timrå IK', 'TIM', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Växjö Lakers', 'VAX', null) on conflict (competition_id, code) do update set name = excluded.name;

  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  delete from public.fixtures where season_id = v_season;
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd1', 'Gameday 1', 'GD1', 1, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd1';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-09-19T13:15:00Z', 'Scandinavium', 'scheduled', '2476493');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-09-19T13:15:00Z', 'Husqvarna Garden', 'scheduled', '2476494');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-09-19T13:15:00Z', 'Saab Arena', 'scheduled', '2476495');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-09-19T16:00:00Z', 'Löfbergs Arena', 'scheduled', '2476496');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-09-19T16:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476497');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-09-19T16:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476498');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-09-19T16:00:00Z', 'Hovet', 'scheduled', '2476499');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd2', 'Gameday 2', 'GD2', 2, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd2';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-09-22T17:00:00Z', 'Catena Arena', 'scheduled', '2476500');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-09-22T17:00:00Z', 'VIDA Arena', 'scheduled', '2476501');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-09-22T17:00:00Z', 'Saab Arena', 'scheduled', '2476502');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-09-22T17:00:00Z', 'Scandinavium', 'scheduled', '2476503');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-09-22T17:00:00Z', 'SCA Arena', 'scheduled', '2476504');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd3', 'Gameday 3', 'GD3', 3, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd3';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-09-24T17:00:00Z', 'Hovet', 'scheduled', '2476505');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-09-24T17:00:00Z', 'Löfbergs Arena', 'scheduled', '2476506');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-09-24T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476507');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-09-24T17:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476508');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-09-24T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476509');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd4', 'Gameday 4', 'GD4', 4, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd4';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-09-26T13:15:00Z', 'Monitor ERP Arena', 'scheduled', '2476510');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-09-26T13:15:00Z', 'Winpos Arena', 'scheduled', '2476511');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-09-26T13:15:00Z', 'Catena Arena', 'scheduled', '2476512');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-09-26T16:00:00Z', 'VIDA Arena', 'scheduled', '2476513');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-09-26T16:00:00Z', 'SCA Arena', 'scheduled', '2476514');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-09-26T16:00:00Z', 'Malmö Arena', 'scheduled', '2476515');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-09-26T16:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476516');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd5', 'Gameday 5', 'GD5', 5, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd5';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-09-29T17:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476517');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-09-29T17:00:00Z', 'Winpos Arena', 'scheduled', '2476518');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-09-29T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476519');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd6', 'Gameday 6', 'GD6', 6, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd6';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-10-01T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476520');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-10-01T17:00:00Z', 'Catena Arena', 'scheduled', '2476521');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-10-01T17:00:00Z', 'Saab Arena', 'scheduled', '2476522');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-10-01T17:00:00Z', 'Winpos Arena', 'scheduled', '2476523');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-10-01T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476524');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-10-01T17:00:00Z', 'Scandinavium', 'scheduled', '2476525');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-10-01T17:00:00Z', 'Hovet', 'scheduled', '2476526');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd7', 'Gameday 7', 'GD7', 7, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd7';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-10-03T13:15:00Z', 'Scandinavium', 'scheduled', '2476527');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-10-03T13:15:00Z', 'Malmö Arena', 'scheduled', '2476528');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-10-03T13:15:00Z', 'SCA Arena', 'scheduled', '2476529');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-10-03T13:15:00Z', 'VIDA Arena', 'scheduled', '2476530');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-10-03T16:00:00Z', 'Löfbergs Arena', 'scheduled', '2476531');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-10-03T16:00:00Z', 'Saab Arena', 'scheduled', '2476532');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-10-03T16:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476533');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd8', 'Gameday 8', 'GD8', 8, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd8';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-10-08T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476534');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-10-08T17:00:00Z', 'VIDA Arena', 'scheduled', '2476535');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-10-08T17:00:00Z', 'SCA Arena', 'scheduled', '2476536');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-10-08T17:00:00Z', 'Catena Arena', 'scheduled', '2476537');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-10-08T17:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476538');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-10-08T17:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476539');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-10-08T17:00:00Z', 'Hovet', 'scheduled', '2476540');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd9', 'Gameday 9', 'GD9', 9, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd9';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-10-10T13:15:00Z', 'Löfbergs Arena', 'scheduled', '2476541');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-10-10T13:15:00Z', 'Husqvarna Garden', 'scheduled', '2476542');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-10-10T13:15:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476543');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-10-10T13:15:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476544');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-10-10T16:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476545');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-10-10T16:00:00Z', 'Winpos Arena', 'scheduled', '2476546');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-10-10T16:00:00Z', 'Hovet', 'scheduled', '2476547');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd10', 'Gameday 10', 'GD10', 10, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd10';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-10-15T17:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476548');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-10-15T17:00:00Z', 'Winpos Arena', 'scheduled', '2476549');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-10-15T17:00:00Z', 'Saab Arena', 'scheduled', '2476550');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-10-15T17:00:00Z', 'Malmö Arena', 'scheduled', '2476551');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-10-15T17:00:00Z', 'SCA Arena', 'scheduled', '2476552');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-10-15T17:00:00Z', 'VIDA Arena', 'scheduled', '2476553');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-10-15T17:00:00Z', 'Löfbergs Arena', 'scheduled', '2476554');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd11', 'Gameday 11', 'GD11', 11, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd11';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-10-17T13:15:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476555');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-10-17T13:15:00Z', 'Catena Arena', 'scheduled', '2476556');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-10-17T13:15:00Z', 'Saab Arena', 'scheduled', '2476557');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-10-17T13:15:00Z', 'Hovet', 'scheduled', '2476558');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-10-17T16:00:00Z', 'SCA Arena', 'scheduled', '2476559');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-10-17T16:00:00Z', 'Scandinavium', 'scheduled', '2476560');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-10-17T16:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476561');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd12', 'Gameday 12', 'GD12', 12, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd12';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-10-20T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476562');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-10-20T17:00:00Z', 'Scandinavium', 'scheduled', '2476563');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd13', 'Gameday 13', 'GD13', 13, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd13';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-10-22T17:00:00Z', 'Winpos Arena', 'scheduled', '2476564');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-10-22T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476565');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-10-22T17:00:00Z', 'Catena Arena', 'scheduled', '2476566');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-10-22T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476567');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-10-22T17:00:00Z', 'SCA Arena', 'scheduled', '2476568');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-10-22T17:00:00Z', 'VIDA Arena', 'scheduled', '2476569');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd14', 'Gameday 14', 'GD14', 14, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd14';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-10-24T13:15:00Z', 'Malmö Arena', 'scheduled', '2476570');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-10-24T13:15:00Z', 'Löfbergs Arena', 'scheduled', '2476571');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-10-24T13:15:00Z', 'Winpos Arena', 'scheduled', '2476572');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-10-24T16:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476573');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-10-24T16:00:00Z', 'Husqvarna Garden', 'scheduled', '2476574');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-10-24T16:00:00Z', 'Saab Arena', 'scheduled', '2476575');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-10-24T16:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476576');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd15', 'Gameday 15', 'GD15', 15, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd15';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-10-27T18:00:00Z', 'Scandinavium', 'scheduled', '2476577');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-10-27T18:00:00Z', 'Malmö Arena', 'scheduled', '2476578');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd16', 'Gameday 16', 'GD16', 16, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd16';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-10-29T18:00:00Z', 'Catena Arena', 'scheduled', '2476579');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-10-29T18:00:00Z', 'SCA Arena', 'scheduled', '2476580');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-10-29T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476581');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-10-29T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476582');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-10-29T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476583');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-10-29T18:00:00Z', 'Hovet', 'scheduled', '2476584');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-10-29T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476585');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd17', 'Gameday 17', 'GD17', 17, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd17';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-10-31T14:15:00Z', 'Scandinavium', 'scheduled', '2476586');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-10-31T14:15:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476587');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-10-31T14:15:00Z', 'VIDA Arena', 'scheduled', '2476588');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-10-31T17:00:00Z', 'Hovet', 'scheduled', '2476589');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-10-31T17:00:00Z', 'Malmö Arena', 'scheduled', '2476590');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-10-31T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476591');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-10-31T17:00:00Z', 'SCA Arena', 'scheduled', '2476592');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd18', 'Gameday 18', 'GD18', 18, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd18';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-11-12T18:00:00Z', 'Winpos Arena', 'scheduled', '2476593');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-11-12T18:00:00Z', 'VIDA Arena', 'scheduled', '2476594');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-11-12T18:00:00Z', 'Saab Arena', 'scheduled', '2476595');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-11-12T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476596');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-11-12T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476597');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-11-12T18:00:00Z', 'Scandinavium', 'scheduled', '2476598');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-11-12T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476599');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd19', 'Gameday 19', 'GD19', 19, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd19';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-11-14T14:15:00Z', 'Husqvarna Garden', 'scheduled', '2476600');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-11-14T14:15:00Z', 'Malmö Arena', 'scheduled', '2476601');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-11-14T14:15:00Z', 'Catena Arena', 'scheduled', '2476602');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-11-14T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476603');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-11-14T17:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476604');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-11-14T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476605');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-11-14T17:00:00Z', 'Winpos Arena', 'scheduled', '2476606');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd20', 'Gameday 20', 'GD20', 20, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd20';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-11-19T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476607');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-11-19T18:00:00Z', 'Hovet', 'scheduled', '2476608');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-11-19T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476609');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-11-19T18:00:00Z', 'Saab Arena', 'scheduled', '2476610');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-11-19T18:00:00Z', 'Malmö Arena', 'scheduled', '2476611');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-11-19T18:00:00Z', 'SCA Arena', 'scheduled', '2476612');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-11-19T18:00:00Z', 'VIDA Arena', 'scheduled', '2476613');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd21', 'Gameday 21', 'GD21', 21, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd21';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-11-21T14:15:00Z', 'Catena Arena', 'scheduled', '2476614');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-11-21T14:15:00Z', 'Scandinavium', 'scheduled', '2476615');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-11-21T14:15:00Z', 'Hovet', 'scheduled', '2476616');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-11-21T17:00:00Z', 'Löfbergs Arena', 'scheduled', '2476617');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-11-21T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476618');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-11-21T17:00:00Z', 'Winpos Arena', 'scheduled', '2476619');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-11-21T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476620');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd22', 'Gameday 22', 'GD22', 22, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd22';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-11-24T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476621');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-11-24T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476622');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd23', 'Gameday 23', 'GD23', 23, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd23';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-11-26T18:00:00Z', 'VIDA Arena', 'scheduled', '2476623');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-11-26T18:00:00Z', 'SCA Arena', 'scheduled', '2476624');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-11-26T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476625');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-11-26T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476626');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-11-26T18:00:00Z', 'Scandinavium', 'scheduled', '2476627');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-11-26T18:00:00Z', 'Saab Arena', 'scheduled', '2476628');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd24', 'Gameday 24', 'GD24', 24, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd24';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-11-28T14:15:00Z', 'Monitor ERP Arena', 'scheduled', '2476629');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-11-28T14:15:00Z', 'Malmö Arena', 'scheduled', '2476630');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-11-28T14:15:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476631');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-11-28T14:15:00Z', 'SCA Arena', 'scheduled', '2476632');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-11-28T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476633');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-11-28T17:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476634');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-11-28T17:00:00Z', 'VIDA Arena', 'scheduled', '2476635');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd25', 'Gameday 25', 'GD25', 25, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd25';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-12-03T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476636');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-12-03T18:00:00Z', 'SCA Arena', 'scheduled', '2476637');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-12-03T18:00:00Z', 'Catena Arena', 'scheduled', '2476638');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-12-03T18:00:00Z', 'Winpos Arena', 'scheduled', '2476639');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-12-03T18:00:00Z', 'Malmö Arena', 'scheduled', '2476640');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-12-03T18:00:00Z', 'Saab Arena', 'scheduled', '2476641');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-12-03T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476642');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd26', 'Gameday 26', 'GD26', 26, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd26';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-12-05T14:15:00Z', 'Hovet', 'scheduled', '2476643');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-12-05T14:15:00Z', 'Winpos Arena', 'scheduled', '2476644');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-12-05T14:15:00Z', 'Behrn Arena Ishall', 'scheduled', '2476645');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-12-05T14:15:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476646');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-12-05T17:00:00Z', 'VIDA Arena', 'scheduled', '2476647');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-12-05T17:00:00Z', 'Catena Arena', 'scheduled', '2476648');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-12-05T17:00:00Z', 'Löfbergs Arena', 'scheduled', '2476649');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd27', 'Gameday 27', 'GD27', 27, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd27';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-12-17T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476650');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-12-17T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476651');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-12-17T18:00:00Z', 'Winpos Arena', 'scheduled', '2476652');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-12-17T18:00:00Z', 'Saab Arena', 'scheduled', '2476653');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-12-17T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476654');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-12-17T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476655');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-12-17T18:00:00Z', 'SCA Arena', 'scheduled', '2476656');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd28', 'Gameday 28', 'GD28', 28, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd28';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-12-19T14:15:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476657');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2026-12-19T14:15:00Z', 'Husqvarna Garden', 'scheduled', '2476658');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-12-19T14:15:00Z', 'Hovet', 'scheduled', '2476659');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-12-19T14:15:00Z', 'Monitor ERP Arena', 'scheduled', '2476660');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-12-19T17:00:00Z', 'Saab Arena', 'scheduled', '2476661');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-12-19T17:00:00Z', 'Malmö Arena', 'scheduled', '2476662');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-12-19T17:00:00Z', 'SCA Arena', 'scheduled', '2476663');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd29', 'Gameday 29', 'GD29', 29, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd29';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-12-26T14:15:00Z', 'Monitor ERP Arena', 'scheduled', '2476664');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-12-26T14:15:00Z', 'Malmö Arena', 'scheduled', '2476665');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2026-12-26T17:00:00Z', 'Löfbergs Arena', 'scheduled', '2476666');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2026-12-26T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476667');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-12-26T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476668');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-12-26T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476669');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd30', 'Gameday 30', 'GD30', 30, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd30';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2026-12-28T18:00:00Z', 'Catena Arena', 'scheduled', '2476670');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-12-28T18:00:00Z', 'SCA Arena', 'scheduled', '2476671');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2026-12-28T18:00:00Z', 'VIDA Arena', 'scheduled', '2476672');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2026-12-28T18:00:00Z', 'Saab Arena', 'scheduled', '2476673');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2026-12-28T18:00:00Z', 'Winpos Arena', 'scheduled', '2476674');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2026-12-28T18:00:00Z', 'Hovet', 'scheduled', '2476675');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd31', 'Gameday 31', 'GD31', 31, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd31';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2026-12-30T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476676');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2026-12-30T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476677');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2026-12-30T18:00:00Z', 'Winpos Arena', 'scheduled', '2476678');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2026-12-30T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476679');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2026-12-30T18:00:00Z', 'Malmö Arena', 'scheduled', '2476680');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2026-12-30T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476681');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd32', 'Gameday 32', 'GD32', 32, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd32';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-01-02T14:15:00Z', 'Hovet', 'scheduled', '2476682');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-01-02T14:15:00Z', 'Löfbergs Arena', 'scheduled', '2476683');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-01-02T14:15:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476684');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-01-02T17:00:00Z', 'Saab Arena', 'scheduled', '2476685');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-01-02T17:00:00Z', 'Catena Arena', 'scheduled', '2476686');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-01-02T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476687');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-01-02T17:00:00Z', 'VIDA Arena', 'scheduled', '2476688');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd33', 'Gameday 33', 'GD33', 33, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd33';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-01-05T18:00:00Z', 'Winpos Arena', 'scheduled', '2476689');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-01-05T18:00:00Z', 'Malmö Arena', 'scheduled', '2476690');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-01-05T18:00:00Z', 'Catena Arena', 'scheduled', '2476691');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-01-05T18:00:00Z', 'Scandinavium', 'scheduled', '2476692');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-01-05T18:00:00Z', 'Hovet', 'scheduled', '2476693');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-01-05T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476694');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-01-05T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476695');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd34', 'Gameday 34', 'GD34', 34, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd34';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-01-07T18:00:00Z', 'Malmö Arena', 'scheduled', '2476696');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-01-07T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476697');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-01-07T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476698');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-01-07T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476699');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-01-07T18:00:00Z', 'Saab Arena', 'scheduled', '2476700');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-01-07T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476701');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-01-07T18:00:00Z', 'Winpos Arena', 'scheduled', '2476702');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd35', 'Gameday 35', 'GD35', 35, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd35';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-01-09T14:15:00Z', 'SCA Arena', 'scheduled', '2476703');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-01-09T14:15:00Z', 'Catena Arena', 'scheduled', '2476704');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-01-09T14:15:00Z', 'Husqvarna Garden', 'scheduled', '2476705');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-01-09T14:15:00Z', 'Scandinavium', 'scheduled', '2476706');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-01-09T17:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476707');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-01-09T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476708');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-01-09T17:00:00Z', 'VIDA Arena', 'scheduled', '2476709');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd36', 'Gameday 36', 'GD36', 36, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd36';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-01-14T18:00:00Z', 'Hovet', 'scheduled', '2476710');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-01-14T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476711');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-01-14T18:00:00Z', 'Winpos Arena', 'scheduled', '2476712');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-01-14T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476713');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-01-14T18:00:00Z', 'Malmö Arena', 'scheduled', '2476714');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-01-14T18:00:00Z', 'SCA Arena', 'scheduled', '2476715');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-01-14T18:00:00Z', 'VIDA Arena', 'scheduled', '2476716');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd37', 'Gameday 37', 'GD37', 37, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd37';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-01-16T14:15:00Z', 'Catena Arena', 'scheduled', '2476717');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-01-16T14:15:00Z', 'Husqvarna Garden', 'scheduled', '2476718');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-01-16T14:15:00Z', 'Behrn Arena Ishall', 'scheduled', '2476719');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-01-16T14:15:00Z', 'Winpos Arena', 'scheduled', '2476720');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-01-16T17:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476721');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-01-16T17:00:00Z', 'Löfbergs Arena', 'scheduled', '2476722');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-01-16T17:00:00Z', 'Saab Arena', 'scheduled', '2476723');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd38', 'Gameday 38', 'GD38', 38, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd38';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-01-21T18:00:00Z', 'Catena Arena', 'scheduled', '2476724');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-01-21T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476725');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-01-21T18:00:00Z', 'SCA Arena', 'scheduled', '2476726');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-01-21T18:00:00Z', 'Malmö Arena', 'scheduled', '2476727');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-01-21T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476728');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-01-21T18:00:00Z', 'Scandinavium', 'scheduled', '2476729');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-01-21T18:00:00Z', 'Hovet', 'scheduled', '2476730');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd39', 'Gameday 39', 'GD39', 39, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd39';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-01-23T14:15:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476731');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-01-23T14:15:00Z', 'Malmö Arena', 'scheduled', '2476732');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-01-23T14:15:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476733');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-01-23T14:15:00Z', 'SCA Arena', 'scheduled', '2476734');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-01-23T17:00:00Z', 'Winpos Arena', 'scheduled', '2476735');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-01-23T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476736');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-01-23T17:00:00Z', 'VIDA Arena', 'scheduled', '2476737');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd40', 'Gameday 40', 'GD40', 40, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd40';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-01-26T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476738');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd41', 'Gameday 41', 'GD41', 41, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd41';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-01-28T18:00:00Z', 'Saab Arena', 'scheduled', '2476739');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-01-28T18:00:00Z', 'VIDA Arena', 'scheduled', '2476740');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-01-28T18:00:00Z', 'Catena Arena', 'scheduled', '2476741');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-01-28T18:00:00Z', 'Hovet', 'scheduled', '2476742');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-01-28T18:00:00Z', 'Scandinavium', 'scheduled', '2476743');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-01-28T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476744');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-01-28T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476745');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd42', 'Gameday 42', 'GD42', 42, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd42';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-01-30T14:15:00Z', 'Löfbergs Arena', 'scheduled', '2476746');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-01-30T14:15:00Z', 'Scandinavium', 'scheduled', '2476747');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-01-30T14:15:00Z', 'Saab Arena', 'scheduled', '2476748');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-01-30T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476749');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-01-30T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476750');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-01-30T17:00:00Z', 'Winpos Arena', 'scheduled', '2476751');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-01-30T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476752');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd43', 'Gameday 43', 'GD43', 43, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd43';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-02-02T18:00:00Z', 'Hovet', 'scheduled', '2476753');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-02-02T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476754');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-02-02T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476755');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-02-02T18:00:00Z', 'Malmö Arena', 'scheduled', '2476756');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-02-02T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476757');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-02-02T18:00:00Z', 'Catena Arena', 'scheduled', '2476758');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-02-02T18:00:00Z', 'SCA Arena', 'scheduled', '2476759');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd44', 'Gameday 44', 'GD44', 44, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd44';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-02-04T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476760');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-02-04T18:00:00Z', 'Catena Arena', 'scheduled', '2476761');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-02-04T18:00:00Z', 'VIDA Arena', 'scheduled', '2476762');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-02-04T18:00:00Z', 'Saab Arena', 'scheduled', '2476763');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-02-04T18:00:00Z', 'Scandinavium', 'scheduled', '2476764');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-02-04T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476765');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd45', 'Gameday 45', 'GD45', 45, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd45';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-02-06T14:15:00Z', 'Scandinavium', 'scheduled', '2476766');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-02-06T14:15:00Z', 'Malmö Arena', 'scheduled', '2476767');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-02-06T14:15:00Z', 'SCA Arena', 'scheduled', '2476768');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-02-06T17:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476769');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-02-06T17:00:00Z', 'Hovet', 'scheduled', '2476770');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-02-06T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476771');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-02-06T17:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476772');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd46', 'Gameday 46', 'GD46', 46, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd46';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-02-16T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476773');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-02-16T18:00:00Z', 'Catena Arena', 'scheduled', '2476774');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-02-16T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476775');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-02-16T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476776');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-02-16T18:00:00Z', 'Saab Arena', 'scheduled', '2476777');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-02-16T18:00:00Z', 'Winpos Arena', 'scheduled', '2476778');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-02-16T18:00:00Z', 'Hovet', 'scheduled', '2476779');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd47', 'Gameday 47', 'GD47', 47, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd47';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-02-18T18:00:00Z', 'Scandinavium', 'scheduled', '2476780');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-02-18T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476781');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-02-18T18:00:00Z', 'Saab Arena', 'scheduled', '2476782');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-02-18T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476783');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-02-18T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476784');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-02-18T18:00:00Z', 'SCA Arena', 'scheduled', '2476785');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-02-18T18:00:00Z', 'VIDA Arena', 'scheduled', '2476786');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd48', 'Gameday 48', 'GD48', 48, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd48';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-02-20T14:15:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476787');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-02-20T14:15:00Z', 'Scandinavium', 'scheduled', '2476788');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-02-20T14:15:00Z', 'Husqvarna Garden', 'scheduled', '2476789');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-02-20T14:15:00Z', 'Löfbergs Arena', 'scheduled', '2476790');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-02-20T17:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476791');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-02-20T17:00:00Z', 'SCA Arena', 'scheduled', '2476792');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-02-20T17:00:00Z', 'Catena Arena', 'scheduled', '2476793');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd49', 'Gameday 49', 'GD49', 49, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd49';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-02-25T18:00:00Z', 'Malmö Arena', 'scheduled', '2476794');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-02-25T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476795');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-02-25T18:00:00Z', 'VIDA Arena', 'scheduled', '2476796');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-02-25T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476797');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-02-25T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476798');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-02-25T18:00:00Z', 'Hovet', 'scheduled', '2476799');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-02-25T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476800');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd50', 'Gameday 50', 'GD50', 50, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd50';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-02-27T14:15:00Z', 'Catena Arena', 'scheduled', '2476801');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-02-27T14:15:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476802');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-02-27T14:15:00Z', 'Winpos Arena', 'scheduled', '2476803');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-02-27T17:00:00Z', 'Hovet', 'scheduled', '2476804');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-02-27T17:00:00Z', 'Saab Arena', 'scheduled', '2476805');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-02-27T17:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476806');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-02-27T17:00:00Z', 'Malmö Arena', 'scheduled', '2476807');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd51', 'Gameday 51', 'GD51', 51, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd51';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-03-02T18:00:00Z', 'Saab Arena', 'scheduled', '2476808');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-03-02T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476809');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-03-02T18:00:00Z', 'Malmö Arena', 'scheduled', '2476810');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-03-02T18:00:00Z', 'Scandinavium', 'scheduled', '2476811');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-03-02T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476812');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-03-02T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476813');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-03-02T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476814');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd52', 'Gameday 52', 'GD52', 52, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd52';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-03-04T18:00:00Z', 'Winpos Arena', 'scheduled', '2476815');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-03-04T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476816');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-03-04T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476817');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-03-04T18:00:00Z', 'VIDA Arena', 'scheduled', '2476818');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-03-04T18:00:00Z', 'Scandinavium', 'scheduled', '2476819');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-03-04T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476820');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-03-04T18:00:00Z', 'Hovet', 'scheduled', '2476821');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd53', 'Gameday 53', 'GD53', 53, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd53';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-03-06T14:15:00Z', 'Winpos Arena', 'scheduled', '2476822');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-03-06T14:15:00Z', 'VIDA Arena', 'scheduled', '2476823');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-03-06T14:15:00Z', 'Scandinavium', 'scheduled', '2476824');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-03-06T17:00:00Z', 'Hovet', 'scheduled', '2476825');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-03-06T17:00:00Z', 'Saab Arena', 'scheduled', '2476826');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-03-06T17:00:00Z', 'Catena Arena', 'scheduled', '2476827');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd54', 'Gameday 54', 'GD54', 54, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd54';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-03-07T15:00:00Z', 'Malmö Arena', 'scheduled', '2476828');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd55', 'Gameday 55', 'GD55', 55, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd55';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-03-09T18:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476829');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-03-09T18:00:00Z', 'SCA Arena', 'scheduled', '2476830');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-03-09T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476831');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='VAX'), '2027-03-09T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476832');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-03-09T18:00:00Z', 'Scandinavium', 'scheduled', '2476833');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-03-09T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476834');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-03-09T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476835');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd56', 'Gameday 56', 'GD56', 56, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd56';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FBK'), (select id from public.teams where competition_id=v_comp and code='BRY'), '2027-03-11T18:00:00Z', 'Löfbergs Arena', 'scheduled', '2476836');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-03-11T18:00:00Z', 'Scandinavium', 'scheduled', '2476837');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BJO'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-03-11T18:00:00Z', 'Winpos Arena', 'scheduled', '2476838');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LHC'), (select id from public.teams where competition_id=v_comp and code='HV7'), '2027-03-11T18:00:00Z', 'Saab Arena', 'scheduled', '2476839');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-03-11T18:00:00Z', 'Malmö Arena', 'scheduled', '2476840');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIM'), (select id from public.teams where competition_id=v_comp and code='ROG'), '2027-03-11T18:00:00Z', 'SCA Arena', 'scheduled', '2476841');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-03-11T18:00:00Z', 'VIDA Arena', 'scheduled', '2476842');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd57', 'Gameday 57', 'GD57', 57, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd57';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='SKE'), '2027-03-13T14:15:00Z', 'Catena Arena', 'scheduled', '2476843');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='DIF'), (select id from public.teams where competition_id=v_comp and code='LUL'), '2027-03-13T14:15:00Z', 'Hovet', 'scheduled', '2476844');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='FRL'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-03-13T14:15:00Z', 'Scandinavium', 'scheduled', '2476845');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='MRH'), '2027-03-13T14:15:00Z', 'Monitor ERP Arena', 'scheduled', '2476846');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-03-13T17:00:00Z', 'Husqvarna Garden', 'scheduled', '2476847');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ORE'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-03-13T17:00:00Z', 'Behrn Arena Ishall', 'scheduled', '2476848');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-03-13T17:00:00Z', 'VIDA Arena', 'scheduled', '2476849');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'gd58', 'Gameday 58', 'GD58', 58, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'gd58';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRY'), (select id from public.teams where competition_id=v_comp and code='FRL'), '2027-03-16T18:00:00Z', 'Monitor ERP Arena', 'scheduled', '2476850');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HV7'), (select id from public.teams where competition_id=v_comp and code='FBK'), '2027-03-16T18:00:00Z', 'Husqvarna Garden', 'scheduled', '2476851');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='LUL'), (select id from public.teams where competition_id=v_comp and code='ORE'), '2027-03-16T18:00:00Z', 'Coop Norrbotten Arena', 'scheduled', '2476852');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='MRH'), (select id from public.teams where competition_id=v_comp and code='BJO'), '2027-03-16T18:00:00Z', 'Malmö Arena', 'scheduled', '2476853');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='ROG'), (select id from public.teams where competition_id=v_comp and code='LHC'), '2027-03-16T18:00:00Z', 'Catena Arena', 'scheduled', '2476854');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SKE'), (select id from public.teams where competition_id=v_comp and code='TIM'), '2027-03-16T18:00:00Z', 'Skellefteå Kraft Arena', 'scheduled', '2476855');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='VAX'), (select id from public.teams where competition_id=v_comp and code='DIF'), '2027-03-16T18:00:00Z', 'VIDA Arena', 'scheduled', '2476856');
  raise notice 'SHL: % fixtures / % gamedays', v_num, 58;
end $$;
