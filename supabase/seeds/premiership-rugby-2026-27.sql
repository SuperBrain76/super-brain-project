-- AUTO-GENERATED seed — Premiership Rugby 2026-2027 (90 fixtures / 18 rounds) from TheSportsDB
-- Rugby union: draws are rare (~1-2%) but real, so has_draw stays true (045).
-- Lands as lifecycle "draft" / visible false — verify, then flip to public.
update public.sports set max_score = 100 where code = 'rugby' and max_score < 100;

do $$
declare v_comp uuid; v_season uuid; v_round uuid; v_num integer := 0;
begin
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('Premiership Rugby', 'premiership-rugby', 'rugby', 'active', '2026-09-25T18:45:00Z', '2027-06-05T14:00:00Z')
  on conflict (slug) do update set name = excluded.name, sport_code = excluded.sport_code, status = excluded.status returning id into v_comp;
  if v_comp is null then select id into v_comp from public.competitions where slug='premiership-rugby'; end if;

  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'regular', 'Round', 1, true, false) on conflict (competition_id, code) do nothing;

  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, 'premiership-rugby-2026-27', '2026/27', 'upcoming', true, '2026-09-25T18:45:00Z', '2027-06-05T14:00:00Z')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug='premiership-rugby-2026-27';

  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_group_stage','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','false'::jsonb),
    (v_comp,'round_label','"Round"'::jsonb),
    (v_comp,'round_label_plural','"Rounds"'::jsonb),
    (v_comp,'provider','"thesportsdb"'::jsonb),
    (v_comp,'provider_league_id','4414'::jsonb),
    (v_comp,'provider_season','"2026-2027"'::jsonb),
    (v_comp,'ingest_enabled','true'::jsonb),
    (v_comp,'lifecycle','"draft"'::jsonb),
    (v_comp,'visible','false'::jsonb),
    (v_comp,'timezone','"Europe/London"'::jsonb),
    (v_comp,'display_order','12'::jsonb)
  on conflict (competition_id, key) do nothing;

  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Bath Rugby', 'BTH', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Bristol Bears', 'BRI', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Exeter Chiefs', 'EXE', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Gloucester', 'GLO', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Harlequins', 'HAR', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Leicester Tigers', 'TIG', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Newcastle Red Bulls', 'NRB', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Northampton Saints', 'NTH', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Sale Sharks', 'SAL', null) on conflict (competition_id, code) do update set name = excluded.name;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Saracens', 'SAR', null) on conflict (competition_id, code) do update set name = excluded.name;

  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp on conflict do nothing;

  delete from public.fixtures where season_id = v_season;
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r1', 'Round 1', 'R1', 1, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r1';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2026-09-25T18:45:00Z', 'Twickenham Stoop', 'scheduled', '2553382');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2026-09-25T18:45:00Z', 'Franklin''s Gardens', 'scheduled', '2553383');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2026-09-26T14:05:00Z', 'Sandy Park', 'scheduled', '2553384');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2026-09-26T16:30:00Z', 'CorpAcq Stadium', 'scheduled', '2553385');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2026-09-27T14:00:00Z', 'Welford Road', 'scheduled', '2553386');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r2', 'Round 2', 'R2', 2, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r2';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2026-10-02T18:45:00Z', 'The Recreation Ground Bath', 'scheduled', '2553387');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2026-10-03T14:05:00Z', 'Ashton Gate', 'scheduled', '2553388');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2026-10-03T16:30:00Z', 'Kingsholm Stadium', 'scheduled', '2553389');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2026-10-03T18:45:00Z', 'Kingston Park', 'scheduled', '2553390');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2026-10-04T14:00:00Z', 'StoneX Stadium', 'scheduled', '2553391');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r3', 'Round 3', 'R3', 3, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r3';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2026-10-09T18:45:00Z', 'Welford Road', 'scheduled', '2553392');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2026-10-10T14:05:00Z', 'Franklin''s Gardens', 'scheduled', '2553393');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2026-10-10T16:30:00Z', 'StoneX Stadium', 'scheduled', '2553394');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2026-10-11T14:00:00Z', 'Sandy Park', 'scheduled', '2553395');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2026-10-11T14:00:00Z', 'CorpAcq Stadium', 'scheduled', '2553396');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r4', 'Round 4', 'R4', 4, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r4';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2026-10-23T18:45:00Z', 'Kingsholm Stadium', 'scheduled', '2553397');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2026-10-23T18:45:00Z', 'Kingston Park', 'scheduled', '2553398');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2026-10-24T14:05:00Z', 'Welford Road', 'scheduled', '2553399');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2026-10-24T16:30:00Z', 'Ashton Gate', 'scheduled', '2553400');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2026-10-25T15:00:00Z', 'Twickenham Stoop', 'scheduled', '2553401');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r5', 'Round 5', 'R5', 5, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r5';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2026-10-30T19:45:00Z', 'Ashton Gate', 'scheduled', '2553402');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2026-10-31T15:00:00Z', 'Sandy Park', 'scheduled', '2553403');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2026-10-31T15:00:00Z', 'StoneX Stadium', 'scheduled', '2553404');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2026-10-31T15:05:00Z', 'The Recreation Ground Bath', 'scheduled', '2553405');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2026-10-31T17:30:00Z', 'Franklin''s Gardens', 'scheduled', '2553406');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r6', 'Round 6', 'R6', 6, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r6';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2026-12-04T19:45:00Z', 'The Recreation Ground Bath', 'scheduled', '2553407');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2026-12-05T15:00:00Z', 'Kingsholm Stadium', 'scheduled', '2553408');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2026-12-05T15:05:00Z', 'Twickenham Stoop', 'scheduled', '2553409');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2026-12-05T17:30:00Z', 'StoneX Stadium', 'scheduled', '2553410');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2026-12-06T15:00:00Z', 'CorpAcq Stadium', 'scheduled', '2553411');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r7', 'Round 7', 'R7', 7, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r7';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2026-12-18T19:45:00Z', 'Kingston Park', 'scheduled', '2553412');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2026-12-19T15:00:00Z', 'Kingsholm Stadium', 'scheduled', '2553413');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2026-12-19T15:05:00Z', 'Welford Road', 'scheduled', '2553414');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2026-12-19T17:30:00Z', 'Franklin''s Gardens', 'scheduled', '2553415');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2026-12-20T15:00:00Z', 'Ashton Gate', 'scheduled', '2553416');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r8', 'Round 8', 'R8', 8, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r8';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2026-12-26T15:00:00Z', 'Ashton Gate', 'scheduled', '2553417');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2026-12-26T15:05:00Z', 'The Recreation Ground Bath', 'scheduled', '2553418');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2026-12-26T17:30:00Z', 'CorpAcq Stadium', 'scheduled', '2553419');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2026-12-27T15:05:00Z', 'Sandy Park', 'scheduled', '2553420');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2026-12-28T17:00:00Z', 'Twickenham Stoop', 'scheduled', '2553421');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r9', 'Round 9', 'R9', 9, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r9';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2027-01-01T19:45:00Z', 'Kingsholm Stadium', 'scheduled', '2553422');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2027-01-02T15:05:00Z', 'StoneX Stadium', 'scheduled', '2553423');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2027-01-02T17:30:00Z', 'Welford Road', 'scheduled', '2553424');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2027-01-02T17:30:00Z', 'Kingston Park', 'scheduled', '2553425');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2027-01-03T15:00:00Z', 'Franklin''s Gardens', 'scheduled', '2553426');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r10', 'Round 10', 'R10', 10, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r10';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2027-01-23T15:00:00Z', 'Kingston Park', 'scheduled', '2553427');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2027-01-23T15:00:00Z', 'CorpAcq Stadium', 'scheduled', '2553428');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2027-01-23T15:00:00Z', 'The Recreation Ground Bath', 'scheduled', '2553429');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2027-01-23T15:00:00Z', 'Twickenham Stoop', 'scheduled', '2553430');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2027-01-23T15:00:00Z', 'Sandy Park', 'scheduled', '2553431');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r11', 'Round 11', 'R11', 11, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r11';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2027-03-20T15:00:00Z', 'The Recreation Ground Bath', 'scheduled', '2553432');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2027-03-20T15:00:00Z', 'Ashton Gate', 'scheduled', '2553433');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2027-03-20T15:00:00Z', 'Sandy Park', 'scheduled', '2553434');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2027-03-20T15:00:00Z', 'Welford Road', 'scheduled', '2553435');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2027-03-20T15:00:00Z', 'StoneX Stadium', 'scheduled', '2553436');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r12', 'Round 12', 'R12', 12, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r12';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2027-03-27T15:00:00Z', 'Kingsholm Stadium', 'scheduled', '2553437');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2027-03-27T15:00:00Z', 'Twickenham Stoop', 'scheduled', '2553438');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2027-03-27T15:00:00Z', 'Franklin''s Gardens', 'scheduled', '2553439');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2027-03-27T15:00:00Z', 'CorpAcq Stadium', 'scheduled', '2553440');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2027-03-27T15:00:00Z', 'Kingston Park', 'scheduled', '2553441');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r13', 'Round 13', 'R13', 13, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r13';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2027-04-17T14:00:00Z', 'The Recreation Ground Bath', 'scheduled', '2553442');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2027-04-17T14:00:00Z', 'Ashton Gate', 'scheduled', '2553443');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2027-04-17T14:00:00Z', 'Sandy Park', 'scheduled', '2553444');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2027-04-17T14:00:00Z', 'Franklin''s Gardens', 'scheduled', '2553445');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2027-04-17T14:00:00Z', 'StoneX Stadium', 'scheduled', '2553446');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r14', 'Round 14', 'R14', 14, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r14';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2027-04-24T14:00:00Z', 'Kingston Park', 'scheduled', '2553447');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2027-04-24T14:00:00Z', 'CorpAcq Stadium', 'scheduled', '2553448');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2027-04-24T14:00:00Z', 'Welford Road', 'scheduled', '2553449');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2027-04-24T14:00:00Z', 'Twickenham Stoop', 'scheduled', '2553450');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2027-04-24T14:00:00Z', 'Kingsholm Stadium', 'scheduled', '2553451');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r15', 'Round 15', 'R15', 15, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r15';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2027-05-08T14:00:00Z', 'Ashton Gate', 'scheduled', '2553452');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2027-05-08T14:00:00Z', 'Sandy Park', 'scheduled', '2553453');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2027-05-08T14:00:00Z', 'Kingsholm Stadium', 'scheduled', '2553454');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2027-05-08T14:00:00Z', 'Twickenham Stoop', 'scheduled', '2553455');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2027-05-08T14:00:00Z', 'Franklin''s Gardens', 'scheduled', '2553456');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r16', 'Round 16', 'R16', 16, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r16';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2027-05-15T14:00:00Z', 'StoneX Stadium', 'scheduled', '2553457');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2027-05-15T14:00:00Z', 'CorpAcq Stadium', 'scheduled', '2553458');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2027-05-15T14:00:00Z', 'Kingston Park', 'scheduled', '2553459');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2027-05-15T14:00:00Z', 'Welford Road', 'scheduled', '2553460');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2027-05-15T14:00:00Z', 'The Recreation Ground Bath', 'scheduled', '2553461');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r17', 'Round 17', 'R17', 17, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r17';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BRI'), (select id from public.teams where competition_id=v_comp and code='BTH'), '2027-05-29T14:00:00Z', 'Ashton Gate', 'scheduled', '2553462');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='EXE'), (select id from public.teams where competition_id=v_comp and code='TIG'), '2027-05-29T14:00:00Z', 'Sandy Park', 'scheduled', '2553463');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='HAR'), (select id from public.teams where competition_id=v_comp and code='SAL'), '2027-05-29T14:00:00Z', 'Twickenham Stoop', 'scheduled', '2553464');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NRB'), (select id from public.teams where competition_id=v_comp and code='NTH'), '2027-05-29T14:00:00Z', 'Kingston Park', 'scheduled', '2553465');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAR'), (select id from public.teams where competition_id=v_comp and code='GLO'), '2027-05-29T14:00:00Z', 'StoneX Stadium', 'scheduled', '2553466');
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'r18', 'Round 18', 'R18', 18, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'r18';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='BTH'), (select id from public.teams where competition_id=v_comp and code='SAR'), '2027-06-05T14:00:00Z', 'The Recreation Ground Bath', 'scheduled', '2553467');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='GLO'), (select id from public.teams where competition_id=v_comp and code='EXE'), '2027-06-05T14:00:00Z', 'Kingsholm Stadium', 'scheduled', '2553468');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='TIG'), (select id from public.teams where competition_id=v_comp and code='HAR'), '2027-06-05T14:00:00Z', 'Welford Road', 'scheduled', '2553469');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='NTH'), (select id from public.teams where competition_id=v_comp and code='BRI'), '2027-06-05T14:00:00Z', 'Franklin''s Gardens', 'scheduled', '2553470');
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status, provider_fixture_id)
    values (v_comp, v_season, v_round, 'regular', v_num, (select id from public.teams where competition_id=v_comp and code='SAL'), (select id from public.teams where competition_id=v_comp and code='NRB'), '2027-06-05T14:00:00Z', 'CorpAcq Stadium', 'scheduled', '2553471');
  raise notice 'Premiership Rugby: % fixtures / % rounds', v_num, 18;
end $$;
