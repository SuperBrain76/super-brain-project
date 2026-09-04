-- AUTO-GENERATED seed — Champions League 2026/27 league phase
-- 144 fixtures / 8 matchdays / 36 clubs, from football-data.org
-- (structure) cross-matched to TheSportsDB (idEvent, for live results).
-- Idempotent: fixtures matched on provider_fixture_id and updated in place.
insert into public.sports (code, name, has_draw, default_prediction_type, icon)
values ('football', 'Football', true, 'score', '⚽') on conflict (code) do nothing;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0; v_fix uuid;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('Champions League', 'champions-league', 'football', 'active', '2026-09-08T16:45:00Z', '2027-01-27T20:00:00Z')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='champions-league'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'league', 'Matchday', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, 'ucl-2026-27', '2026/27', 'active', true, '2026-09-08T16:45:00Z', '2027-01-27T20:00:00Z')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='ucl-2026-27';

  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Matchday"'::jsonb),
    (v_comp,'round_label_plural','"Matchdays"'::jsonb),
    (v_comp,'provider','"thesportsdb"'::jsonb),
    (v_comp,'provider_league_id','4480'::jsonb),
    (v_comp,'provider_season','"2026-2027"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"public"'::jsonb),
    (v_comp,'visible','true'::jsonb),
    (v_comp,'timezone','"Europe/Zurich"'::jsonb),
    (v_comp,'display_order','6'::jsonb)
  on conflict (competition_id, key) do update set value = excluded.value;

  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'AEK Athens', 'AEK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Arsenal', 'ARS', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Atlético Madrid', 'ATM', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Aston Villa', 'AVL', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Barcelona', 'BAR', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Bayern Munich', 'BAY', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Real Betis', 'BET', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Bodø/Glimt', 'BOD', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Club Brugge', 'BRU', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Como', 'COM', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Borussia Dortmund', 'DOR', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Fenerbahçe', 'FEN', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Feyenoord', 'FEY', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Galatasaray', 'GAL', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Inter Milan', 'INT', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'LASK', 'LAS', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Lens', 'LEN', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Lille', 'LIL', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Liverpool', 'LIV', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Manchester City', 'MCI', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Manchester United', 'MUN', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Napoli', 'NAP', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Porto', 'POR', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Paris Saint-Germain', 'PSG', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'PSV Eindhoven', 'PSV', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'RB Leipzig', 'RBL', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Real Madrid', 'RMA', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Roma', 'ROM', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Sabah', 'SAB', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Shakhtar Donetsk', 'SHK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Slavia Prague', 'SLA', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Slovan Bratislava', 'SLB', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Sporting CP', 'SPO', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Stuttgart', 'STU', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Viking', 'VIK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Villarreal', 'VIL', null) on conflict (competition_id, code) do update set name = excluded.name;

  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md1', 'Matchday 1', 'MD1', 1, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md1';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594644');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BRU'), (select id from public.teams where competition_id=v_comp and code='AVL'), '2026-09-08T16:45:00Z', 'Jan Breydel Stadium', 'scheduled', '2594644');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-08T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594650');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AEK'), (select id from public.teams where competition_id=v_comp and code='LAS'), '2026-09-08T16:45:00Z', 'OPAP Arena', 'scheduled', '2594650');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-08T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594629');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RMA'), (select id from public.teams where competition_id=v_comp and code='INT'), '2026-09-08T19:00:00Z', '', 'scheduled', '2594629');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-08T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594591');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='POR'), (select id from public.teams where competition_id=v_comp and code='MCI'), '2026-09-08T19:00:00Z', 'Estádio do Dragão', 'scheduled', '2594591');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-08T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594572');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DOR'), (select id from public.teams where competition_id=v_comp and code='VIL'), '2026-09-08T19:00:00Z', '', 'scheduled', '2594572');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-08T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594556');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIL'), (select id from public.teams where competition_id=v_comp and code='BET'), '2026-09-08T19:00:00Z', '', 'scheduled', '2594556');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-08T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594617');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAR'), (select id from public.teams where competition_id=v_comp and code='FEY'), '2026-09-09T16:45:00Z', '', 'scheduled', '2594617');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-09T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594578');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='STU'), (select id from public.teams where competition_id=v_comp and code='VIK'), '2026-09-09T16:45:00Z', '', 'scheduled', '2594578');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-09T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594541');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIV'), (select id from public.teams where competition_id=v_comp and code='ATM'), '2026-09-09T19:00:00Z', '', 'scheduled', '2594541');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-09T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594562');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSG'), (select id from public.teams where competition_id=v_comp and code='SLB'), '2026-09-09T19:00:00Z', '', 'scheduled', '2594562');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-09T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594603');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='NAP'), (select id from public.teams where competition_id=v_comp and code='ARS'), '2026-09-09T19:00:00Z', '', 'scheduled', '2594603');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-09T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594597');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SPO'), (select id from public.teams where competition_id=v_comp and code='GAL'), '2026-09-09T19:00:00Z', 'Estádio José Alvalade', 'scheduled', '2594597');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-09T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594652');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEN'), (select id from public.teams where competition_id=v_comp and code='ROM'), '2026-09-10T16:45:00Z', 'Şükrü Saracoğlu Stadium', 'scheduled', '2594652');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-10T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594585');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSV'), (select id from public.teams where competition_id=v_comp and code='SHK'), '2026-09-10T16:45:00Z', 'Philips Stadion', 'scheduled', '2594585');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-10T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594568');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAY'), (select id from public.teams where competition_id=v_comp and code='BOD'), '2026-09-10T19:00:00Z', '', 'scheduled', '2594568');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-10T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594538');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MUN'), (select id from public.teams where competition_id=v_comp and code='SAB'), '2026-09-10T19:00:00Z', '', 'scheduled', '2594538');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-10T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594669');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='COM'), (select id from public.teams where competition_id=v_comp and code='RBL'), '2026-09-10T19:00:00Z', '', 'scheduled', '2594669');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-10T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594641');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLA'), (select id from public.teams where competition_id=v_comp and code='LEN'), '2026-09-10T19:00:00Z', 'Eden Arena', 'scheduled', '2594641');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-10T19:00:00Z' where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md2', 'Matchday 2', 'MD2', 2, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md2';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594564');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LEN'), (select id from public.teams where competition_id=v_comp and code='SPO'), '2026-10-13T16:45:00Z', '', 'scheduled', '2594564');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594678');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SAB'), (select id from public.teams where competition_id=v_comp and code='SLA'), '2026-10-13T16:45:00Z', 'Bank Respublika Arena', 'scheduled', '2594678');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594614');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='INT'), (select id from public.teams where competition_id=v_comp and code='BRU'), '2026-10-13T19:00:00Z', '', 'scheduled', '2594614');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594658');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAL'), (select id from public.teams where competition_id=v_comp and code='BAR'), '2026-10-13T19:00:00Z', 'Rams Park', 'scheduled', '2594658');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594619');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ATM'), (select id from public.teams where competition_id=v_comp and code='MUN'), '2026-10-13T19:00:00Z', '', 'scheduled', '2594619');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594543');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ARS'), (select id from public.teams where competition_id=v_comp and code='LIL'), '2026-10-13T19:00:00Z', '', 'scheduled', '2594543');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594663');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIK'), (select id from public.teams where competition_id=v_comp and code='BAY'), '2026-10-13T19:00:00Z', 'SR-Bank Arena', 'scheduled', '2594663');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594581');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RBL'), (select id from public.teams where competition_id=v_comp and code='PSV'), '2026-10-13T19:00:00Z', '', 'scheduled', '2594581');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594625');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIL'), (select id from public.teams where competition_id=v_comp and code='NAP'), '2026-10-13T19:00:00Z', '', 'scheduled', '2594625');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-13T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594671');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LAS'), (select id from public.teams where competition_id=v_comp and code='LIV'), '2026-10-14T16:45:00Z', 'Raiffeisen Arena', 'scheduled', '2594671');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594590');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEY'), (select id from public.teams where competition_id=v_comp and code='COM'), '2026-10-14T16:45:00Z', 'De Kuip', 'scheduled', '2594590');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594609');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ROM'), (select id from public.teams where competition_id=v_comp and code='RMA'), '2026-10-14T19:00:00Z', '', 'scheduled', '2594609');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594547');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MCI'), (select id from public.teams where competition_id=v_comp and code='PSG'), '2026-10-14T19:00:00Z', '', 'scheduled', '2594547');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594600');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BOD'), (select id from public.teams where competition_id=v_comp and code='DOR'), '2026-10-14T19:00:00Z', 'Aspmyra Stadion', 'scheduled', '2594600');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594553');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AVL'), (select id from public.teams where competition_id=v_comp and code='FEN'), '2026-10-14T19:00:00Z', '', 'scheduled', '2594553');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594633');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BET'), (select id from public.teams where competition_id=v_comp and code='POR'), '2026-10-14T19:00:00Z', '', 'scheduled', '2594633');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594637');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SHK'), (select id from public.teams where competition_id=v_comp and code='AEK'), '2026-10-14T19:00:00Z', 'Arena Lviv', 'scheduled', '2594637');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594659');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLB'), (select id from public.teams where competition_id=v_comp and code='STU'), '2026-10-14T19:00:00Z', 'Tehelné pole', 'scheduled', '2594659');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-14T19:00:00Z' where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md3', 'Matchday 3', 'MD3', 3, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md3';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594675');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SAB'), (select id from public.teams where competition_id=v_comp and code='DOR'), '2026-10-20T16:45:00Z', 'Bank Respublika Arena', 'scheduled', '2594675');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594654');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEN'), (select id from public.teams where competition_id=v_comp and code='SLA'), '2026-10-20T16:45:00Z', 'Şükrü Saracoğlu Stadium', 'scheduled', '2594654');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594550');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MCI'), (select id from public.teams where competition_id=v_comp and code='AEK'), '2026-10-20T19:00:00Z', '', 'scheduled', '2594550');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594576');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='STU'), (select id from public.teams where competition_id=v_comp and code='ATM'), '2026-10-20T19:00:00Z', '', 'scheduled', '2594576');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594542');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIV'), (select id from public.teams where competition_id=v_comp and code='VIL'), '2026-10-20T19:00:00Z', '', 'scheduled', '2594542');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594610');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ROM'), (select id from public.teams where competition_id=v_comp and code='SLB'), '2026-10-20T19:00:00Z', '', 'scheduled', '2594610');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594592');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='POR'), (select id from public.teams where competition_id=v_comp and code='PSV'), '2026-10-20T19:00:00Z', 'Estádio do Dragão', 'scheduled', '2594592');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594604');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='NAP'), (select id from public.teams where competition_id=v_comp and code='BOD'), '2026-10-20T19:00:00Z', '', 'scheduled', '2594604');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594560');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSG'), (select id from public.teams where competition_id=v_comp and code='BAR'), '2026-10-20T19:00:00Z', '', 'scheduled', '2594560');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-20T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594667');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='COM'), (select id from public.teams where competition_id=v_comp and code='MUN'), '2026-10-21T16:45:00Z', '', 'scheduled', '2594667');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594557');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIL'), (select id from public.teams where competition_id=v_comp and code='GAL'), '2026-10-21T16:45:00Z', '', 'scheduled', '2594557');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T16:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594627');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RMA'), (select id from public.teams where competition_id=v_comp and code='RBL'), '2026-10-21T19:00:00Z', '', 'scheduled', '2594627');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594613');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='INT'), (select id from public.teams where competition_id=v_comp and code='SHK'), '2026-10-21T19:00:00Z', '', 'scheduled', '2594613');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594567');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAY'), (select id from public.teams where competition_id=v_comp and code='ARS'), '2026-10-21T19:00:00Z', '', 'scheduled', '2594567');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594645');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BRU'), (select id from public.teams where competition_id=v_comp and code='LEN'), '2026-10-21T19:00:00Z', 'Jan Breydel Stadium', 'scheduled', '2594645');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594554');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AVL'), (select id from public.teams where competition_id=v_comp and code='VIK'), '2026-10-21T19:00:00Z', '', 'scheduled', '2594554');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594598');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SPO'), (select id from public.teams where competition_id=v_comp and code='LAS'), '2026-10-21T19:00:00Z', 'Estádio José Alvalade', 'scheduled', '2594598');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T19:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594632');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BET'), (select id from public.teams where competition_id=v_comp and code='FEY'), '2026-10-21T19:00:00Z', '', 'scheduled', '2594632');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-21T19:00:00Z' where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md4', 'Matchday 4', 'MD4', 4, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md4';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594635');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SHK'), (select id from public.teams where competition_id=v_comp and code='SPO'), '2026-11-03T17:45:00Z', 'Arena Lviv', 'scheduled', '2594635');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594656');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAL'), (select id from public.teams where competition_id=v_comp and code='STU'), '2026-11-03T17:45:00Z', 'Rams Park', 'scheduled', '2594656');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594589');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEY'), (select id from public.teams where competition_id=v_comp and code='INT'), '2026-11-03T20:00:00Z', 'De Kuip', 'scheduled', '2594589');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594616');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAR'), (select id from public.teams where competition_id=v_comp and code='AVL'), '2026-11-03T20:00:00Z', '', 'scheduled', '2594616');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594620');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ATM'), (select id from public.teams where competition_id=v_comp and code='BAY'), '2026-11-03T20:00:00Z', '', 'scheduled', '2594620');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594624');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIL'), (select id from public.teams where competition_id=v_comp and code='PSG'), '2026-11-03T20:00:00Z', '', 'scheduled', '2594624');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594537');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MUN'), (select id from public.teams where competition_id=v_comp and code='ROM'), '2026-11-03T20:00:00Z', '', 'scheduled', '2594537');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594599');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BOD'), (select id from public.teams where competition_id=v_comp and code='LIL'), '2026-11-03T20:00:00Z', 'Aspmyra Stadion', 'scheduled', '2594599');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594674');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LAS'), (select id from public.teams where competition_id=v_comp and code='SLB'), '2026-11-03T20:00:00Z', 'Raiffeisen Arena', 'scheduled', '2594674');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-03T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594648');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AEK'), (select id from public.teams where competition_id=v_comp and code='RMA'), '2026-11-04T17:45:00Z', 'OPAP Arena', 'scheduled', '2594648');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594651');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEN'), (select id from public.teams where competition_id=v_comp and code='LIV'), '2026-11-04T17:45:00Z', 'Şükrü Saracoğlu Stadium', 'scheduled', '2594651');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594579');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RBL'), (select id from public.teams where competition_id=v_comp and code='MCI'), '2026-11-04T20:00:00Z', '', 'scheduled', '2594579');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594639');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLA'), (select id from public.teams where competition_id=v_comp and code='ARS'), '2026-11-04T20:00:00Z', 'Eden Arena', 'scheduled', '2594639');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594586');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSV'), (select id from public.teams where competition_id=v_comp and code='BRU'), '2026-11-04T20:00:00Z', 'Philips Stadion', 'scheduled', '2594586');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594573');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DOR'), (select id from public.teams where competition_id=v_comp and code='BET'), '2026-11-04T20:00:00Z', '', 'scheduled', '2594573');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594593');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='POR'), (select id from public.teams where competition_id=v_comp and code='NAP'), '2026-11-04T20:00:00Z', 'Estádio do Dragão', 'scheduled', '2594593');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594566');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LEN'), (select id from public.teams where competition_id=v_comp and code='COM'), '2026-11-04T20:00:00Z', '', 'scheduled', '2594566');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594666');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIK'), (select id from public.teams where competition_id=v_comp and code='SAB'), '2026-11-04T20:00:00Z', 'SR-Bank Arena', 'scheduled', '2594666');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-04T20:00:00Z' where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md5', 'Matchday 5', 'MD5', 5, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md5';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594655');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAL'), (select id from public.teams where competition_id=v_comp and code='AVL'), '2026-11-24T17:45:00Z', 'Rams Park', 'scheduled', '2594655');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594602');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BOD'), (select id from public.teams where competition_id=v_comp and code='LAS'), '2026-11-24T17:45:00Z', 'Aspmyra Stadion', 'scheduled', '2594602');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594628');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RMA'), (select id from public.teams where competition_id=v_comp and code='PSV'), '2026-11-24T20:00:00Z', '', 'scheduled', '2594628');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594549');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MCI'), (select id from public.teams where competition_id=v_comp and code='NAP'), '2026-11-24T20:00:00Z', '', 'scheduled', '2594549');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594544');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ARS'), (select id from public.teams where competition_id=v_comp and code='DOR'), '2026-11-24T20:00:00Z', '', 'scheduled', '2594544');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594588');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEY'), (select id from public.teams where competition_id=v_comp and code='POR'), '2026-11-24T20:00:00Z', 'De Kuip', 'scheduled', '2594588');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594661');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLB'), (select id from public.teams where competition_id=v_comp and code='BET'), '2026-11-24T20:00:00Z', 'Tehelné pole', 'scheduled', '2594661');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594580');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RBL'), (select id from public.teams where competition_id=v_comp and code='LEN'), '2026-11-24T20:00:00Z', '', 'scheduled', '2594580');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594670');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='COM'), (select id from public.teams where competition_id=v_comp and code='AEK'), '2026-11-24T20:00:00Z', '', 'scheduled', '2594670');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-24T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594677');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SAB'), (select id from public.teams where competition_id=v_comp and code='BAR'), '2026-11-25T17:45:00Z', 'Bank Respublika Arena', 'scheduled', '2594677');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594642');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLA'), (select id from public.teams where competition_id=v_comp and code='VIL'), '2026-11-25T17:45:00Z', 'Eden Arena', 'scheduled', '2594642');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594612');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='INT'), (select id from public.teams where competition_id=v_comp and code='STU'), '2026-11-25T20:00:00Z', '', 'scheduled', '2594612');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594622');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ATM'), (select id from public.teams where competition_id=v_comp and code='VIK'), '2026-11-25T20:00:00Z', '', 'scheduled', '2594622');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594559');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSG'), (select id from public.teams where competition_id=v_comp and code='ROM'), '2026-11-25T20:00:00Z', '', 'scheduled', '2594559');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594643');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BRU'), (select id from public.teams where competition_id=v_comp and code='LIV'), '2026-11-25T20:00:00Z', 'Jan Breydel Stadium', 'scheduled', '2594643');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594555');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIL'), (select id from public.teams where competition_id=v_comp and code='BAY'), '2026-11-25T20:00:00Z', '', 'scheduled', '2594555');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594595');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SPO'), (select id from public.teams where competition_id=v_comp and code='MUN'), '2026-11-25T20:00:00Z', 'Estádio José Alvalade', 'scheduled', '2594595');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594638');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SHK'), (select id from public.teams where competition_id=v_comp and code='FEN'), '2026-11-25T20:00:00Z', 'Arena Lviv', 'scheduled', '2594638');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-25T20:00:00Z' where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md6', 'Matchday 6', 'MD6', 6, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md6';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594626');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIL'), (select id from public.teams where competition_id=v_comp and code='SAB'), '2026-12-08T17:45:00Z', '', 'scheduled', '2594626');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594665');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIK'), (select id from public.teams where competition_id=v_comp and code='FEY'), '2026-12-08T17:45:00Z', 'SR-Bank Arena', 'scheduled', '2594665');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594615');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAR'), (select id from public.teams where competition_id=v_comp and code='MCI'), '2026-12-08T20:00:00Z', '', 'scheduled', '2594615');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594551');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AVL'), (select id from public.teams where competition_id=v_comp and code='PSG'), '2026-12-08T20:00:00Z', '', 'scheduled', '2594551');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594570');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAY'), (select id from public.teams where competition_id=v_comp and code='SLA'), '2026-12-08T20:00:00Z', '', 'scheduled', '2594570');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594605');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='NAP'), (select id from public.teams where competition_id=v_comp and code='BRU'), '2026-12-08T20:00:00Z', '', 'scheduled', '2594605');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594608');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ROM'), (select id from public.teams where competition_id=v_comp and code='SPO'), '2026-12-08T20:00:00Z', '', 'scheduled', '2594608');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594536');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MUN'), (select id from public.teams where competition_id=v_comp and code='RBL'), '2026-12-08T20:00:00Z', '', 'scheduled', '2594536');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594649');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AEK'), (select id from public.teams where competition_id=v_comp and code='GAL'), '2026-12-08T20:00:00Z', 'OPAP Arena', 'scheduled', '2594649');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-08T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594634');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BET'), (select id from public.teams where competition_id=v_comp and code='COM'), '2026-12-09T17:45:00Z', '', 'scheduled', '2594634');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594662');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLB'), (select id from public.teams where competition_id=v_comp and code='SHK'), '2026-12-09T17:45:00Z', 'Tehelné pole', 'scheduled', '2594662');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594545');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ARS'), (select id from public.teams where competition_id=v_comp and code='RMA'), '2026-12-09T20:00:00Z', '', 'scheduled', '2594545');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594571');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DOR'), (select id from public.teams where competition_id=v_comp and code='INT'), '2026-12-09T20:00:00Z', '', 'scheduled', '2594571');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594584');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSV'), (select id from public.teams where competition_id=v_comp and code='ATM'), '2026-12-09T20:00:00Z', 'Philips Stadion', 'scheduled', '2594584');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594540');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIV'), (select id from public.teams where competition_id=v_comp and code='POR'), '2026-12-09T20:00:00Z', '', 'scheduled', '2594540');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594565');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LEN'), (select id from public.teams where competition_id=v_comp and code='BOD'), '2026-12-09T20:00:00Z', '', 'scheduled', '2594565');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594673');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LAS'), (select id from public.teams where competition_id=v_comp and code='FEN'), '2026-12-09T20:00:00Z', 'Raiffeisen Arena', 'scheduled', '2594673');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594575');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='STU'), (select id from public.teams where competition_id=v_comp and code='LIL'), '2026-12-09T20:00:00Z', '', 'scheduled', '2594575');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-12-09T20:00:00Z' where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md7', 'Matchday 7', 'MD7', 7, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md7';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594601');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BOD'), (select id from public.teams where competition_id=v_comp and code='ATM'), '2027-01-19T17:45:00Z', 'Aspmyra Stadion', 'scheduled', '2594601');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594657');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAL'), (select id from public.teams where competition_id=v_comp and code='FEY'), '2027-01-19T17:45:00Z', 'Rams Park', 'scheduled', '2594657');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594630');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RMA'), (select id from public.teams where competition_id=v_comp and code='LAS'), '2027-01-19T20:00:00Z', '', 'scheduled', '2594630');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594611');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='INT'), (select id from public.teams where competition_id=v_comp and code='LIV'), '2027-01-19T20:00:00Z', '', 'scheduled', '2594611');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594577');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='STU'), (select id from public.teams where competition_id=v_comp and code='BRU'), '2027-01-19T20:00:00Z', '', 'scheduled', '2594577');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594552');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AVL'), (select id from public.teams where competition_id=v_comp and code='DOR'), '2027-01-19T20:00:00Z', '', 'scheduled', '2594552');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594647');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AEK'), (select id from public.teams where competition_id=v_comp and code='ROM'), '2027-01-19T20:00:00Z', 'OPAP Arena', 'scheduled', '2594647');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594594');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='POR'), (select id from public.teams where competition_id=v_comp and code='SLA'), '2027-01-19T20:00:00Z', 'Estádio do Dragão', 'scheduled', '2594594');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594558');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIL'), (select id from public.teams where competition_id=v_comp and code='SLB'), '2027-01-19T20:00:00Z', '', 'scheduled', '2594558');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-19T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594653');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEN'), (select id from public.teams where competition_id=v_comp and code='VIL'), '2027-01-20T17:45:00Z', 'Şükrü Saracoğlu Stadium', 'scheduled', '2594653');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594676');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SAB'), (select id from public.teams where competition_id=v_comp and code='NAP'), '2027-01-20T17:45:00Z', 'Bank Respublika Arena', 'scheduled', '2594676');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T17:45:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594563');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LEN'), (select id from public.teams where competition_id=v_comp and code='MCI'), '2027-01-20T20:00:00Z', '', 'scheduled', '2594563');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594596');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SPO'), (select id from public.teams where competition_id=v_comp and code='BAR'), '2027-01-20T20:00:00Z', 'Estádio José Alvalade', 'scheduled', '2594596');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594668');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='COM'), (select id from public.teams where competition_id=v_comp and code='PSG'), '2027-01-20T20:00:00Z', '', 'scheduled', '2594668');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594631');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BET'), (select id from public.teams where competition_id=v_comp and code='ARS'), '2027-01-20T20:00:00Z', '', 'scheduled', '2594631');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594535');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MUN'), (select id from public.teams where competition_id=v_comp and code='BAY'), '2027-01-20T20:00:00Z', '', 'scheduled', '2594535');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594664');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIK'), (select id from public.teams where competition_id=v_comp and code='PSV'), '2027-01-20T20:00:00Z', 'SR-Bank Arena', 'scheduled', '2594664');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594582');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='RBL'), (select id from public.teams where competition_id=v_comp and code='SHK'), '2027-01-20T20:00:00Z', '', 'scheduled', '2594582');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-20T20:00:00Z' where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'md8', 'Matchday 8', 'MD8', 8, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set label = excluded.label;
  select id into v_round from public.rounds where season_id = v_season and code = 'md8';
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594636');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SHK'), (select id from public.teams where competition_id=v_comp and code='RMA'), '2027-01-27T20:00:00Z', 'Arena Lviv', 'scheduled', '2594636');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594548');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MCI'), (select id from public.teams where competition_id=v_comp and code='SPO'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594548');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594660');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLB'), (select id from public.teams where competition_id=v_comp and code='INT'), '2027-01-27T20:00:00Z', 'Tehelné pole', 'scheduled', '2594660');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594618');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAR'), (select id from public.teams where competition_id=v_comp and code='COM'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594618');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594621');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ATM'), (select id from public.teams where competition_id=v_comp and code='FEN'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594621');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594561');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSG'), (select id from public.teams where competition_id=v_comp and code='GAL'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594561');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594539');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LIV'), (select id from public.teams where competition_id=v_comp and code='LEN'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594539');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594546');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ARS'), (select id from public.teams where competition_id=v_comp and code='SAB'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594546');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594569');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BAY'), (select id from public.teams where competition_id=v_comp and code='BET'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594569');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594646');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BRU'), (select id from public.teams where competition_id=v_comp and code='BOD'), '2027-01-27T20:00:00Z', 'Jan Breydel Stadium', 'scheduled', '2594646');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594574');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DOR'), (select id from public.teams where competition_id=v_comp and code='AEK'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594574');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594640');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SLA'), (select id from public.teams where competition_id=v_comp and code='AVL'), '2027-01-27T20:00:00Z', 'Eden Arena', 'scheduled', '2594640');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594607');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ROM'), (select id from public.teams where competition_id=v_comp and code='LIL'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594607');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594672');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='LAS'), (select id from public.teams where competition_id=v_comp and code='POR'), '2027-01-27T20:00:00Z', 'Raiffeisen Arena', 'scheduled', '2594672');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594623');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VIL'), (select id from public.teams where competition_id=v_comp and code='MUN'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594623');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594583');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='PSV'), (select id from public.teams where competition_id=v_comp and code='STU'), '2027-01-27T20:00:00Z', 'Philips Stadion', 'scheduled', '2594583');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594587');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='FEY'), (select id from public.teams where competition_id=v_comp and code='RBL'), '2027-01-27T20:00:00Z', 'De Kuip', 'scheduled', '2594587');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  v_num := v_num + 1;
  v_fix := (select id from public.fixtures where season_id = v_season and provider_fixture_id = '2594606');
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='NAP'), (select id from public.teams where competition_id=v_comp and code='VIK'), '2027-01-27T20:00:00Z', '', 'scheduled', '2594606');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2027-01-27T20:00:00Z' where id = v_fix;
  end if;
  raise notice 'Champions League: % fixtures / 8 matchdays', v_num;
end $$;
