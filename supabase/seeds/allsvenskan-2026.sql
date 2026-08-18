-- AUTO-GENERATED seed — Allsvenskan 2026 (240 fixtures / 30 matchweeks, 135 already played) from TheSportsDB
-- Fixtures are matched on provider_fixture_id and updated in place, so re-running
-- this seed never deletes a fixture a user has already predicted.
insert into public.sports (code, name, has_draw, default_prediction_type, icon)
values ('football', 'Football', true, 'score', '⚽')
on conflict (code) do nothing;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0; v_fix uuid;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('Allsvenskan', 'allsvenskan', 'football', 'active', '2026-04-04T13:00:00Z', '2026-11-29T14:00:00Z')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='allsvenskan'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'league', 'Matchweek', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, 'allsvenskan-2026', '2026', 'active', true, '2026-04-04T13:00:00Z', '2026-11-29T14:00:00Z')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='allsvenskan-2026';

  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Matchweek"'::jsonb),
    (v_comp,'round_label_plural','"Matchweeks"'::jsonb),
    (v_comp,'provider','"thesportsdb"'::jsonb),
    (v_comp,'provider_league_id','4347'::jsonb),
    (v_comp,'provider_season','"2026"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"public"'::jsonb),
    (v_comp,'visible','true'::jsonb),
    (v_comp,'timezone','"Europe/Stockholm"'::jsonb),
    (v_comp,'display_order','15'::jsonb)
  on conflict (competition_id, key) do update set value = excluded.value;

  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'AIK', 'AIK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Brommapojkarna', 'BPO', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Degerfors', 'DEG', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Djurgården', 'DJU', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Elfsborg', 'ELF', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'GAIS', 'GAI', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Halmstad', 'HBK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Hammarby', 'HAM', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Häcken', 'HAK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'IFK Göteborg', 'IFG', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Kalmar', 'KFF', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Malmö', 'MFF', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Mjällby', 'MJA', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Sirius', 'SIR', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Västerås', 'VSK', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Örgryte', 'OIS', null) on conflict (competition_id, code) do update set name = excluded.name;

  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw1', 'Matchweek 1', 'MW1', 1, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw1';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398752';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-04-04T13:00:00Z', 'Stora Valla', 'completed', 0, 3, '2398752');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-04T13:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398756';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-04-04T13:00:00Z', 'Tele2 Arena', 'completed', 3, 0, '2398756');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-04T13:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398751';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-04-05T12:00:00Z', 'Strawberry Arena', 'completed', 2, 1, '2398751');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-05T12:00:00Z', venue = 'Strawberry Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398757';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-04-05T12:00:00Z', 'Guldfågeln Arena', 'completed', 0, 1, '2398757');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-05T12:00:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477903';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-04-05T14:30:00Z', 'Gamla Ullevi', 'completed', 1, 1, '2477903');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-05T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398753';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-04-06T12:00:00Z', 'Borås Arena', 'completed', 2, 0, '2398753');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-06T12:00:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477902';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-04-06T12:00:00Z', 'Bravida Arena', 'completed', 2, 2, '2477902');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-06T12:00:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398754';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-04-06T14:30:00Z', 'Gamla Ullevi', 'completed', 0, 1, '2398754');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-06T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw2', 'Matchweek 2', 'MW2', 2, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw2';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398764';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-04-11T13:00:00Z', 'Strandvallen', 'completed', 0, 2, '2398764');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-11T13:00:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398766';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-04-11T13:00:00Z', 'Hitachi Energy Arena', 'completed', 2, 2, '2398766');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-11T13:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477904';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-04-11T13:00:00Z', 'Gamla Ullevi', 'completed', 0, 2, '2477904');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-11T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398760';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-04-12T12:00:00Z', 'Tele2 Arena', 'completed', 3, 2, '2398760');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-12T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398762';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-04-12T12:00:00Z', 'Örjans Vall', 'completed', 0, 3, '2398762');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-12T12:00:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477905';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-04-12T14:30:00Z', 'Eleda Stadion', 'completed', 3, 1, '2477905');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-12T14:30:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398759';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-04-13T17:00:00Z', 'Grimsta IP', 'completed', 2, 2, '2398759');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-13T17:00:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398765';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-04-13T17:00:00Z', 'Studenternas IP', 'completed', 2, 0, '2398765');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-13T17:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw3', 'Matchweek 3', 'MW3', 3, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw3';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398768';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-04-17T17:00:00Z', 'Stora Valla', 'completed', 0, 1, '2398768');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-17T17:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477906';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-04-17T17:00:00Z', 'Tele2 Arena', 'completed', 0, 1, '2477906');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-17T17:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398771';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-04-18T13:00:00Z', 'Örjans Vall', 'completed', 1, 1, '2398771');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-18T13:00:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398772';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-04-18T13:00:00Z', 'Tele2 Arena', 'completed', 8, 1, '2398772');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-18T13:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(8, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398773';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-04-18T13:00:00Z', 'Strandvallen', 'completed', 3, 0, '2398773');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-18T13:00:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398774';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-04-18T13:00:00Z', 'Studenternas IP', 'completed', 4, 1, '2398774');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-18T13:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398767';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-04-19T12:00:00Z', 'Strawberry Arena', 'completed', 1, 0, '2398767');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-19T12:00:00Z', venue = 'Strawberry Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477907';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-04-19T14:30:00Z', 'Bravida Arena', 'completed', 2, 1, '2477907');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-19T14:30:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw4', 'Matchweek 4', 'MW4', 4, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw4';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398776';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-04-22T17:00:00Z', 'Borås Arena', 'completed', 2, 1, '2398776');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-22T17:00:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398778';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-04-22T17:00:00Z', 'Tele2 Arena', 'completed', 1, 1, '2398778');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-22T17:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398781';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-04-22T17:00:00Z', 'Gamla Ullevi', 'completed', 1, 2, '2398781');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-22T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477909';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-04-22T17:00:00Z', 'Hitachi Energy Arena', 'completed', 3, 3, '2477909');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-22T17:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398775';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-04-23T17:00:00Z', 'Stora Valla', 'completed', 2, 1, '2398775');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-23T17:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398777';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-04-23T17:00:00Z', 'Gamla Ullevi', 'completed', 0, 0, '2398777');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-23T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398779';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-04-23T17:00:00Z', 'Guldfågeln Arena', 'completed', 1, 1, '2398779');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-23T17:00:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477908';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-04-23T17:00:00Z', 'Eleda Stadion', 'completed', 2, 3, '2477908');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-23T17:00:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw5', 'Matchweek 5', 'MW5', 5, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw5';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398785';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-04-26T12:00:00Z', 'Tele2 Arena', 'completed', 1, 1, '2398785');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-26T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398784';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-04-26T14:30:00Z', 'Grimsta IP', 'completed', 1, 2, '2398784');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-26T14:30:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398786';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-04-26T14:30:00Z', 'Gamla Ullevi', 'completed', 2, 2, '2398786');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-26T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398788';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-04-27T17:00:00Z', 'Guldfågeln Arena', 'completed', 2, 1, '2398788');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-27T17:00:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398789';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-04-27T17:00:00Z', 'Strandvallen', 'completed', 2, 0, '2398789');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-27T17:00:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398790';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-04-27T17:00:00Z', 'Gamla Ullevi', 'completed', 1, 1, '2398790');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-27T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477910';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-04-27T17:00:00Z', 'Strawberry Arena', 'completed', 0, 1, '2477910');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-27T17:00:00Z', venue = 'Strawberry Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477911';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-04-27T17:00:00Z', 'Bravida Arena', 'completed', 2, 2, '2477911');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-04-27T17:00:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw6', 'Matchweek 6', 'MW6', 6, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw6';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398798';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-05-02T13:00:00Z', 'Studenternas IP', 'completed', 3, 2, '2398798');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-02T13:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477912';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-05-02T13:00:00Z', 'Stora Valla', 'completed', 1, 1, '2477912');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-02T13:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398796';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-05-03T12:00:00Z', 'Tele2 Arena', 'completed', 3, 0, '2398796');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-03T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477913';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-05-03T12:00:00Z', 'Eleda Stadion', 'completed', 2, 3, '2477913');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-03T12:00:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398793';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-05-03T14:30:00Z', 'Borås Arena', 'completed', 1, 1, '2398793');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-03T14:30:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398794';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-05-03T14:30:00Z', 'Gamla Ullevi', 'completed', 4, 0, '2398794');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-03T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398792';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-05-04T17:00:00Z', 'Tele2 Arena', 'completed', 6, 0, '2398792');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-04T17:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(6, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398795';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-05-04T17:00:00Z', 'Örjans Vall', 'completed', 1, 3, '2398795');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-04T17:00:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw7', 'Matchweek 7', 'MW7', 7, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw7';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398801';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-05-08T17:00:00Z', 'Borås Arena', 'completed', 2, 0, '2398801');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-08T17:00:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398800';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-05-09T13:00:00Z', 'Stora Valla', 'completed', 1, 4, '2398800');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-09T13:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(4, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398802';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-05-09T13:00:00Z', 'Gamla Ullevi', 'completed', 0, 1, '2398802');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-09T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398806';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-05-09T13:00:00Z', 'Hitachi Energy Arena', 'completed', 0, 1, '2398806');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-09T13:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398799';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-05-10T12:00:00Z', 'Strawberry Arena', 'completed', 2, 4, '2398799');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-10T12:00:00Z', venue = 'Strawberry Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(4, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398804';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-05-10T12:00:00Z', 'Guldfågeln Arena', 'completed', 2, 0, '2398804');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-10T12:00:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477914';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-05-10T14:30:00Z', 'Bravida Arena', 'completed', 3, 2, '2477914');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-10T14:30:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398805';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-05-11T17:00:00Z', 'Studenternas IP', 'completed', 2, 0, '2398805');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-11T17:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw8', 'Matchweek 8', 'MW8', 8, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw8';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398809';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-05-16T13:00:00Z', 'Gamla Ullevi', 'completed', 1, 1, '2398809');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-16T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398810';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-05-16T13:00:00Z', 'Örjans Vall', 'completed', 1, 1, '2398810');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-16T13:00:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398807';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-05-17T12:00:00Z', 'Grimsta IP', 'completed', 1, 0, '2398807');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-17T12:00:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477915';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-05-17T12:00:00Z', 'Tele2 Arena', 'completed', 4, 1, '2477915');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-17T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398814';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-05-17T14:30:00Z', 'Hitachi Energy Arena', 'completed', 1, 1, '2398814');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-17T14:30:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477916';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-05-17T14:30:00Z', 'Strandvallen', 'completed', 0, 1, '2477916');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-17T14:30:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398808';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-05-18T17:00:00Z', 'Tele2 Arena', 'completed', 2, 3, '2398808');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-18T17:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398813';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-05-19T13:00:00Z', 'Gamla Ullevi', 'completed', 2, 3, '2398813');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-19T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw9', 'Matchweek 9', 'MW9', 9, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw9';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398815';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-05-22T17:00:00Z', 'Tele2 Arena', 'completed', 1, 2, '2398815');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-22T17:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398818';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-05-23T13:00:00Z', 'Örjans Vall', 'completed', 2, 0, '2398818');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-23T13:00:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398820';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-05-23T13:00:00Z', 'Guldfågeln Arena', 'completed', 2, 1, '2398820');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-23T13:00:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398819';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-05-24T12:00:00Z', 'Tele2 Arena', 'completed', 1, 2, '2398819');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-24T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398822';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-05-24T12:00:00Z', 'Studenternas IP', 'completed', 2, 1, '2398822');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-24T12:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477918';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-05-24T14:30:00Z', 'Eleda Stadion', 'completed', 2, 3, '2477918');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-24T14:30:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398817';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-05-25T17:00:00Z', 'Gamla Ullevi', 'completed', 1, 1, '2398817');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-25T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477917';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-05-25T17:00:00Z', 'Borås Arena', 'completed', 1, 1, '2477917');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-25T17:00:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw10', 'Matchweek 10', 'MW10', 10, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw10';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398829';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-05-29T17:00:00Z', 'Gamla Ullevi', 'completed', 2, 2, '2398829');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-29T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398823';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-05-30T13:00:00Z', 'Strawberry Arena', 'completed', 0, 3, '2398823');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-30T13:00:00Z', venue = 'Strawberry Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398825';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-05-30T13:00:00Z', 'Gamla Ullevi', 'completed', 3, 0, '2398825');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-30T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477920';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-05-30T13:00:00Z', 'Eleda Stadion', 'completed', 5, 2, '2477920');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-30T13:00:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(5, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398824';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-05-31T12:00:00Z', 'Stora Valla', 'completed', 2, 2, '2398824');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-31T12:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398830';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-05-31T12:00:00Z', 'Hitachi Energy Arena', 'completed', 4, 5, '2398830');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-31T12:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(5, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477919';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-05-31T12:00:00Z', 'Bravida Arena', 'completed', 3, 2, '2477919');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-31T12:00:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398828';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-09-03T17:00:00Z', 'Strandvallen', 'scheduled', null, null, '2398828');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-03T17:00:00Z', venue = 'Strandvallen',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw11', 'Matchweek 11', 'MW11', 11, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw11';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398838';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-07-03T17:00:00Z', 'Studenternas IP', 'completed', 4, 4, '2398838');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-03T17:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(4, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398836';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-07-04T13:00:00Z', 'Örjans Vall', 'completed', 1, 3, '2398836');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-04T13:00:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477921';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-07-04T13:00:00Z', 'Stora Valla', 'completed', 0, 1, '2477921');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-04T13:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398834';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-07-05T12:00:00Z', 'Gamla Ullevi', 'completed', 1, 2, '2398834');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-05T12:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398837';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-07-05T12:00:00Z', 'Guldfågeln Arena', 'completed', 3, 0, '2398837');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-05T12:00:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398833';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-07-05T14:30:00Z', 'Borås Arena', 'completed', 1, 2, '2398833');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-05T14:30:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398831';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-07-06T17:00:00Z', 'Grimsta IP', 'completed', 1, 1, '2398831');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-06T17:00:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477922';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-07-06T17:00:00Z', 'Bravida Arena', 'completed', 2, 4, '2477922');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-06T17:00:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(4, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw12', 'Matchweek 12', 'MW12', 12, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw12';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398844';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-07-11T13:00:00Z', 'Strandvallen', 'completed', 1, 2, '2398844');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-11T13:00:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477924';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-07-11T15:30:00Z', 'Gamla Ullevi', 'completed', 4, 3, '2477924');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-11T15:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398842';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-07-12T12:00:00Z', 'Tele2 Arena', 'completed', 2, 0, '2398842');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-12T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398846';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-07-12T12:00:00Z', 'Hitachi Energy Arena', 'completed', 2, 0, '2398846');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-12T12:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477923';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-07-12T12:00:00Z', 'Eleda Stadion', 'completed', 4, 0, '2477923');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-12T12:00:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398839';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-07-12T14:30:00Z', 'Grimsta IP', 'completed', 1, 2, '2398839');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-12T14:30:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398841';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-07-12T14:30:00Z', 'Gamla Ullevi', 'completed', 1, 0, '2398841');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-12T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398840';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-07-13T17:00:00Z', 'Tele2 Arena', 'completed', 3, 0, '2398840');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-13T17:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw13', 'Matchweek 13', 'MW13', 13, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw13';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398849';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-07-17T17:00:00Z', 'Gamla Ullevi', 'completed', 2, 1, '2398849');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-17T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398853';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-07-17T17:00:00Z', 'Strandvallen', 'completed', 0, 0, '2398853');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-17T17:00:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398847';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-07-18T13:00:00Z', 'Strawberry Arena', 'completed', 2, 0, '2398847');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-18T13:00:00Z', venue = 'Strawberry Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398848';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-07-19T14:30:00Z', 'Borås Arena', 'completed', 1, 3, '2398848');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-19T14:30:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398851';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-07-19T14:30:00Z', 'Tele2 Arena', 'completed', 4, 0, '2398851');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-19T14:30:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477925';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-07-19T14:30:00Z', 'Örjans Vall', 'completed', 0, 2, '2477925');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-19T14:30:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398854';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-07-20T17:00:00Z', 'Gamla Ullevi', 'completed', 0, 0, '2398854');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-20T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477926';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-07-20T17:00:00Z', 'Guldfågeln Arena', 'completed', 2, 2, '2477926');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-20T17:00:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw14', 'Matchweek 14', 'MW14', 14, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw14';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398862';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-07-24T17:00:00Z', 'Hitachi Energy Arena', 'completed', 2, 0, '2398862');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-24T17:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398856';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-07-25T13:00:00Z', 'Stora Valla', 'completed', 0, 1, '2398856');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-25T13:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398859';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-07-25T15:30:00Z', 'Guldfågeln Arena', 'completed', 2, 1, '2398859');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-25T15:30:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398855';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-07-26T12:00:00Z', 'Grimsta IP', 'completed', 1, 1, '2398855');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-26T12:00:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398861';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-07-26T12:00:00Z', 'Studenternas IP', 'completed', 4, 1, '2398861');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-26T12:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398857';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-07-26T14:30:00Z', 'Gamla Ullevi', 'completed', 1, 1, '2398857');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-26T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477928';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-07-26T14:30:00Z', 'Eleda Stadion', 'completed', 1, 2, '2477928');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-26T14:30:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477927';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-07-27T17:00:00Z', 'Bravida Arena', 'completed', 0, 0, '2477927');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-07-27T17:00:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw15', 'Matchweek 15', 'MW15', 15, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw15';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398867';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-05-20T17:00:00Z', 'Gamla Ullevi', 'completed', 2, 0, '2398867');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-20T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398866';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-05-21T17:00:00Z', 'Borås Arena', 'completed', 1, 1, '2398866');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-05-21T17:00:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477930';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-08-01T13:00:00Z', 'Bravida Arena', 'completed', 1, 1, '2477930');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-01T13:00:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398868';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-08-02T12:00:00Z', 'Gamla Ullevi', 'completed', 2, 0, '2398868');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-02T12:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477929';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-08-02T12:00:00Z', 'Grimsta IP', 'completed', 1, 2, '2477929');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-02T12:00:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398863';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-08-02T14:30:00Z', 'Strawberry Arena', 'completed', 0, 3, '2398863');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-02T14:30:00Z', venue = 'Strawberry Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398865';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-08-03T17:00:00Z', 'Tele2 Arena', 'completed', 6, 0, '2398865');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-03T17:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(6, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398870';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-08-03T17:00:00Z', 'Örjans Vall', 'completed', 0, 2, '2398870');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-03T17:00:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw16', 'Matchweek 16', 'MW16', 16, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw16';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398876';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-08-08T13:00:00Z', 'Gamla Ullevi', 'completed', 3, 4, '2398876');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-08T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(4, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398875';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-08-08T15:30:00Z', 'Strandvallen', 'completed', 0, 1, '2398875');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-08T15:30:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477931';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-08-09T12:00:00Z', 'Tele2 Arena', 'completed', 3, 0, '2477931');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-09T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477932';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-08-09T12:00:00Z', 'Eleda Stadion', 'completed', 1, 2, '2477932');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-09T12:00:00Z', venue = 'Eleda Stadion',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398871';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-08-09T14:30:00Z', 'Gamla Ullevi', 'completed', 3, 2, '2398871');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-09T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398872';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-08-09T14:30:00Z', 'Örjans Vall', 'completed', 0, 2, '2398872');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-09T14:30:00Z', venue = 'Örjans Vall',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398877';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-08-10T17:00:00Z', 'Studenternas IP', 'completed', 2, 2, '2398877');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-10T17:00:00Z', venue = 'Studenternas IP',
      status = 'completed', home_score = coalesce(2, home_score), away_score = coalesce(2, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398878';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-08-10T17:00:00Z', 'Hitachi Energy Arena', 'completed', 1, 0, '2398878');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-10T17:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw17', 'Matchweek 17', 'MW17', 17, 'matchweek', 'completed')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw17';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398882';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-08-14T17:00:00Z', 'Borås Arena', 'completed', 3, 0, '2398882');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-14T17:00:00Z', venue = 'Borås Arena',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398886';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-08-15T13:00:00Z', 'Strandvallen', 'completed', 4, 3, '2398886');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-15T13:00:00Z', venue = 'Strandvallen',
      status = 'completed', home_score = coalesce(4, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398879';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-08-16T12:00:00Z', 'Grimsta IP', 'completed', 3, 1, '2398879');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-16T12:00:00Z', venue = 'Grimsta IP',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398880';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-08-16T12:00:00Z', 'Stora Valla', 'completed', 3, 0, '2398880');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-16T12:00:00Z', venue = 'Stora Valla',
      status = 'completed', home_score = coalesce(3, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398881';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-08-16T12:00:00Z', 'Tele2 Arena', 'completed', 1, 3, '2398881');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-16T12:00:00Z', venue = 'Tele2 Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(3, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398885';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-08-16T14:30:00Z', 'Guldfågeln Arena', 'completed', 0, 4, '2398885');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-16T14:30:00Z', venue = 'Guldfågeln Arena',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(4, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477933';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-08-16T14:30:00Z', 'Gamla Ullevi', 'completed', 0, 1, '2477933');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-16T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'completed', home_score = coalesce(0, home_score), away_score = coalesce(1, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477934';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-08-17T17:00:00Z', 'Bravida Arena', 'completed', 1, 0, '2477934');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-17T17:00:00Z', venue = 'Bravida Arena',
      status = 'completed', home_score = coalesce(1, home_score), away_score = coalesce(0, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw18', 'Matchweek 18', 'MW18', 18, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw18';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477936';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-08-21T17:00:00Z', 'Studenternas IP', 'scheduled', null, null, '2477936');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-21T17:00:00Z', venue = 'Studenternas IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398892';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-08-22T13:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398892');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-22T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398889';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-08-23T12:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398889');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-23T12:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398894';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-08-23T12:00:00Z', 'Hitachi Energy Arena', 'scheduled', null, null, '2398894');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-23T12:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398888';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-08-23T14:30:00Z', 'Grimsta IP', 'scheduled', null, null, '2398888');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-23T14:30:00Z', venue = 'Grimsta IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398890';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-08-23T14:30:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398890');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-23T14:30:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477935';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-08-24T17:00:00Z', 'Eleda Stadion', 'scheduled', null, null, '2477935');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-24T17:00:00Z', venue = 'Eleda Stadion',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398887';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-09-16T17:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2398887');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-16T17:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw19', 'Matchweek 19', 'MW19', 19, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw19';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398897';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-08-29T13:00:00Z', 'Borås Arena', 'scheduled', null, null, '2398897');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-29T13:00:00Z', venue = 'Borås Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477937';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-08-29T13:00:00Z', 'Bravida Arena', 'scheduled', null, null, '2477937');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-29T13:00:00Z', venue = 'Bravida Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398901';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-08-29T15:30:00Z', 'Örjans Vall', 'scheduled', null, null, '2398901');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-29T15:30:00Z', venue = 'Örjans Vall',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398895';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-08-30T12:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2398895');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-30T12:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398899';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-08-30T14:30:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398899');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-30T14:30:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398896';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-08-31T17:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398896');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-31T17:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398898';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-08-31T17:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398898');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-31T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477938';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-08-31T17:00:00Z', 'Studenternas IP', 'scheduled', null, null, '2477938');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-08-31T17:00:00Z', venue = 'Studenternas IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw20', 'Matchweek 20', 'MW20', 20, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw20';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398904';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-09-05T13:00:00Z', 'Stora Valla', 'scheduled', null, null, '2398904');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-05T13:00:00Z', venue = 'Stora Valla',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477939';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-09-05T13:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2477939');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-05T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398910';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-09-05T15:30:00Z', 'Hitachi Energy Arena', 'scheduled', null, null, '2398910');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-05T15:30:00Z', venue = 'Hitachi Energy Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398909';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-09-06T12:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398909');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-06T12:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398903';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-09-06T14:30:00Z', 'Grimsta IP', 'scheduled', null, null, '2398903');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-06T14:30:00Z', venue = 'Grimsta IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398906';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-09-07T17:00:00Z', 'Guldfågeln Arena', 'scheduled', null, null, '2398906');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-07T17:00:00Z', venue = 'Guldfågeln Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398908';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-09-07T17:00:00Z', 'Strandvallen', 'scheduled', null, null, '2398908');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-07T17:00:00Z', venue = 'Strandvallen',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477940';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-09-07T17:00:00Z', 'Eleda Stadion', 'scheduled', null, null, '2477940');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-07T17:00:00Z', venue = 'Eleda Stadion',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw21', 'Matchweek 21', 'MW21', 21, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw21';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477941';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-09-11T17:00:00Z', 'Bravida Arena', 'scheduled', null, null, '2477941');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-11T17:00:00Z', venue = 'Bravida Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398911';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-09-12T13:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2398911');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-12T13:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398914';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-09-12T15:30:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398914');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-12T15:30:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398913';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-09-13T12:00:00Z', 'Borås Arena', 'scheduled', null, null, '2398913');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-13T12:00:00Z', venue = 'Borås Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398916';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-09-13T12:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398916');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-13T12:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477942';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-09-13T14:30:00Z', 'Eleda Stadion', 'scheduled', null, null, '2477942');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-13T14:30:00Z', venue = 'Eleda Stadion',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398912';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-09-14T17:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398912');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-14T17:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398918';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-09-14T17:00:00Z', 'Studenternas IP', 'scheduled', null, null, '2398918');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-14T17:00:00Z', venue = 'Studenternas IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw22', 'Matchweek 22', 'MW22', 22, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw22';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398919';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-09-19T13:00:00Z', 'Grimsta IP', 'scheduled', null, null, '2398919');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-19T13:00:00Z', venue = 'Grimsta IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477944';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-09-19T13:00:00Z', 'Hitachi Energy Arena', 'scheduled', null, null, '2477944');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-19T13:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398925';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-09-19T15:30:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398925');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-19T15:30:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398921';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-09-20T12:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398921');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-20T12:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398922';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-09-20T12:00:00Z', 'Örjans Vall', 'scheduled', null, null, '2398922');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-20T12:00:00Z', venue = 'Örjans Vall',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477943';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-09-20T12:00:00Z', 'Guldfågeln Arena', 'scheduled', null, null, '2477943');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-20T12:00:00Z', venue = 'Guldfågeln Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398920';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-09-20T14:30:00Z', 'Stora Valla', 'scheduled', null, null, '2398920');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-20T14:30:00Z', venue = 'Stora Valla',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398924';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-09-20T14:30:00Z', 'Strandvallen', 'scheduled', null, null, '2398924');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-09-20T14:30:00Z', venue = 'Strandvallen',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw23', 'Matchweek 23', 'MW23', 23, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw23';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398930';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-10-09T17:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398930');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-09T17:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398927';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-10-10T13:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2398927');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-10T13:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398929';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-10-10T13:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398929');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-10T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398934';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-10-10T15:30:00Z', 'Strandvallen', 'scheduled', null, null, '2398934');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-10T15:30:00Z', venue = 'Strandvallen',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398932';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-10-11T12:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398932');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-11T12:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477945';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-10-11T14:30:00Z', 'Bravida Arena', 'scheduled', null, null, '2477945');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-11T14:30:00Z', venue = 'Bravida Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398928';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-10-12T17:00:00Z', 'Borås Arena', 'scheduled', null, null, '2398928');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-12T17:00:00Z', venue = 'Borås Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477946';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-10-12T17:00:00Z', 'Eleda Stadion', 'scheduled', null, null, '2477946');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-12T17:00:00Z', venue = 'Eleda Stadion',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw24', 'Matchweek 24', 'MW24', 24, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw24';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398935';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-10-18T13:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2398935');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398936';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-10-18T13:00:00Z', 'Grimsta IP', 'scheduled', null, null, '2398936');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Grimsta IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398937';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-10-18T13:00:00Z', 'Stora Valla', 'scheduled', null, null, '2398937');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Stora Valla',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398938';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-10-18T13:00:00Z', 'Örjans Vall', 'scheduled', null, null, '2398938');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Örjans Vall',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398940';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-10-18T13:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398940');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398941';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-10-18T13:00:00Z', 'Studenternas IP', 'scheduled', null, null, '2398941');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Studenternas IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398942';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-10-18T13:00:00Z', 'Hitachi Energy Arena', 'scheduled', null, null, '2398942');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477947';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-10-18T13:00:00Z', 'Eleda Stadion', 'scheduled', null, null, '2477947');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-18T13:00:00Z', venue = 'Eleda Stadion',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw25', 'Matchweek 25', 'MW25', 25, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw25';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398943';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-10-25T14:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398943');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398945';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-10-25T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398945');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398947';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-10-25T14:00:00Z', 'Guldfågeln Arena', 'scheduled', null, null, '2398947');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Guldfågeln Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398948';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-10-25T14:00:00Z', 'Strandvallen', 'scheduled', null, null, '2398948');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Strandvallen',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398949';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-10-25T14:00:00Z', 'Studenternas IP', 'scheduled', null, null, '2398949');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Studenternas IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398950';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-10-25T14:00:00Z', 'Hitachi Energy Arena', 'scheduled', null, null, '2398950');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477948';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-10-25T14:00:00Z', 'Borås Arena', 'scheduled', null, null, '2477948');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Borås Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477949';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-10-25T14:00:00Z', 'Bravida Arena', 'scheduled', null, null, '2477949');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-25T14:00:00Z', venue = 'Bravida Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw26', 'Matchweek 26', 'MW26', 26, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw26';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398951';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-10-28T14:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2398951');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398953';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-10-28T14:00:00Z', 'Stora Valla', 'scheduled', null, null, '2398953');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Stora Valla',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398954';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-10-28T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398954');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398956';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-10-28T14:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398956');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398957';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-10-28T14:00:00Z', 'Guldfågeln Arena', 'scheduled', null, null, '2398957');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Guldfågeln Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398958';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-10-28T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398958');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477950';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-10-28T14:00:00Z', 'Grimsta IP', 'scheduled', null, null, '2477950');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Grimsta IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477951';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-10-28T14:00:00Z', 'Örjans Vall', 'scheduled', null, null, '2477951');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-10-28T14:00:00Z', venue = 'Örjans Vall',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw27', 'Matchweek 27', 'MW27', 27, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw27';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398959';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-11-01T14:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398959');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398960';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-11-01T14:00:00Z', 'Borås Arena', 'scheduled', null, null, '2398960');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Borås Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398961';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-11-01T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398961');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398964';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-11-01T14:00:00Z', 'Strandvallen', 'scheduled', null, null, '2398964');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Strandvallen',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398965';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-11-01T14:00:00Z', 'Studenternas IP', 'scheduled', null, null, '2398965');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Studenternas IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398966';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-11-01T14:00:00Z', 'Hitachi Energy Arena', 'scheduled', null, null, '2398966');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477952';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-11-01T14:00:00Z', 'Bravida Arena', 'scheduled', null, null, '2477952');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Bravida Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477953';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-11-01T14:00:00Z', 'Eleda Stadion', 'scheduled', null, null, '2477953');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-01T14:00:00Z', venue = 'Eleda Stadion',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw28', 'Matchweek 28', 'MW28', 28, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw28';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398968';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-11-08T14:00:00Z', 'Grimsta IP', 'scheduled', null, null, '2398968');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Grimsta IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398969';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-11-08T14:00:00Z', 'Stora Valla', 'scheduled', null, null, '2398969');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Stora Valla',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398971';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-11-08T14:00:00Z', 'Örjans Vall', 'scheduled', null, null, '2398971');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Örjans Vall',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398972';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-11-08T14:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398972');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398973';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-11-08T14:00:00Z', 'Guldfågeln Arena', 'scheduled', null, null, '2398973');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Guldfågeln Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398974';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-11-08T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398974');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477954';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-11-08T14:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2477954');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477955';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-11-08T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2477955');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-08T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw29', 'Matchweek 29', 'MW29', 29, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw29';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398975';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='AIK'), (select id from public.teams where competition_id=v_comp and code='DEG'), '2026-11-22T14:00:00Z', 'Strawberry Arena', 'scheduled', null, null, '2398975');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Strawberry Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398976';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='BPO'), (select id from public.teams where competition_id=v_comp and code='HBK'), '2026-11-22T14:00:00Z', 'Grimsta IP', 'scheduled', null, null, '2398976');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Grimsta IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398977';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='GAI'), (select id from public.teams where competition_id=v_comp and code='VSK'), '2026-11-22T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398977');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398979';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAM'), (select id from public.teams where competition_id=v_comp and code='IFG'), '2026-11-22T14:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2398979');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398981';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='OIS'), (select id from public.teams where competition_id=v_comp and code='KFF'), '2026-11-22T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398981');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398982';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='SIR'), (select id from public.teams where competition_id=v_comp and code='DJU'), '2026-11-22T14:00:00Z', 'Studenternas IP', 'scheduled', null, null, '2398982');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Studenternas IP',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477956';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HAK'), (select id from public.teams where competition_id=v_comp and code='ELF'), '2026-11-22T14:00:00Z', 'Bravida Arena', 'scheduled', null, null, '2477956');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Bravida Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477957';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MJA'), (select id from public.teams where competition_id=v_comp and code='MFF'), '2026-11-22T14:00:00Z', 'Strandvallen', 'scheduled', null, null, '2477957');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-22T14:00:00Z', venue = 'Strandvallen',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;

  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw30', 'Matchweek 30', 'MW30', 30, 'matchweek', 'upcoming')
  on conflict (season_id, code) do update set status = excluded.status;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw30';
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398983';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DEG'), (select id from public.teams where competition_id=v_comp and code='OIS'), '2026-11-29T14:00:00Z', 'Stora Valla', 'scheduled', null, null, '2398983');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Stora Valla',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398985';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='ELF'), (select id from public.teams where competition_id=v_comp and code='GAI'), '2026-11-29T14:00:00Z', 'Borås Arena', 'scheduled', null, null, '2398985');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Borås Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398986';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='IFG'), (select id from public.teams where competition_id=v_comp and code='SIR'), '2026-11-29T14:00:00Z', 'Gamla Ullevi', 'scheduled', null, null, '2398986');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Gamla Ullevi',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398987';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='HBK'), (select id from public.teams where competition_id=v_comp and code='MJA'), '2026-11-29T14:00:00Z', 'Örjans Vall', 'scheduled', null, null, '2398987');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Örjans Vall',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398988';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='KFF'), (select id from public.teams where competition_id=v_comp and code='AIK'), '2026-11-29T14:00:00Z', 'Guldfågeln Arena', 'scheduled', null, null, '2398988');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Guldfågeln Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2398990';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='VSK'), (select id from public.teams where competition_id=v_comp and code='HAM'), '2026-11-29T14:00:00Z', 'Hitachi Energy Arena', 'scheduled', null, null, '2398990');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Hitachi Energy Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477958';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='DJU'), (select id from public.teams where competition_id=v_comp and code='HAK'), '2026-11-29T14:00:00Z', 'Tele2 Arena', 'scheduled', null, null, '2477958');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Tele2 Arena',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  v_num := v_num + 1;
  select id into v_fix from public.fixtures where season_id = v_season and provider_fixture_id = '2477959';
  if v_fix is null then
    insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, home_score, away_score, provider_fixture_id)
      values (v_comp, v_season, v_round, 'league', v_num, (select id from public.teams where competition_id=v_comp and code='MFF'), (select id from public.teams where competition_id=v_comp and code='BPO'), '2026-11-29T14:00:00Z', 'Eleda Stadion', 'scheduled', null, null, '2477959');
  else
    update public.fixtures set round_id = v_round, kicks_off_at = '2026-11-29T14:00:00Z', venue = 'Eleda Stadion',
      status = 'scheduled', home_score = coalesce(null, home_score), away_score = coalesce(null, away_score)
    where id = v_fix;
  end if;
  raise notice 'Allsvenskan: % fixtures / % matchweeks', v_num, 30;
end $$;
