-- ============================================================
-- SEED — Premier League 2026/27 (real clubs, real fixtures)
--
-- Real 2025/26 match-ups and kickoff times-of-day on the 2026/27 calendar.
-- Idempotent (safe to re-run). Creates the competition, season, 3 rounds,
-- 20 clubs and 30 fixtures, then leaves it HIDDEN — launch it from
-- /admin/competitions when you're ready.
--
-- DEPENDS ON: engine migrations 037-050 applied.
-- ============================================================

do $$
declare
  v_comp   uuid;
  v_season uuid;
  v_round  uuid;
  v_home   uuid;
  v_away   uuid;
  v_num    integer := 0;
begin
  -- ── Competition ──
  insert into public.competitions (name, slug, sport_code, status, starts_at, ends_at)
  values ('Premier League', 'premier-league', 'football', 'upcoming',
          '2026-08-14T00:00:00Z', '2027-05-24T00:00:00Z')
  on conflict (slug) do update set name = excluded.name
  returning id into v_comp;

  if v_comp is null then
    select id into v_comp from public.competitions where slug = 'premier-league';
  end if;

  -- ── Stage (single league table) ──
  insert into public.competition_stages (competition_id, code, label, sort_order, has_table, is_knockout)
  values (v_comp, 'league', 'Matchweek', 1, true, false)
  on conflict (competition_id, code) do nothing;

  -- ── Season ──
  insert into public.seasons (competition_id, slug, label, status, is_current, starts_at, ends_at)
  values (v_comp, 'pl-2026-27', '2026/27', 'upcoming', true,
          '2026-08-14T00:00:00Z', '2027-05-24T00:00:00Z')
  on conflict (slug) do nothing;
  select id into v_season from public.seasons where slug = 'pl-2026-27';

  -- ── Scoring (5/3/2/0) ──
  insert into public.scoring_rules (competition_id, rule_code, points, sort_order) values
    (v_comp,'exact',5,1),(v_comp,'gd',3,2),(v_comp,'result',2,3),(v_comp,'wrong',0,4)
  on conflict (competition_id, rule_code) do nothing;

  -- ── Settings (matchweek home, hidden until launch) ──
  insert into public.competition_settings (competition_id, key, value) values
    (v_comp,'home_style','"matchweek"'::jsonb),
    (v_comp,'has_knockout','false'::jsonb),
    (v_comp,'has_standings_table','true'::jsonb),
    (v_comp,'has_challenges','true'::jsonb),
    (v_comp,'round_label','"Matchweek"'::jsonb),
    (v_comp,'round_label_plural','"Matchweeks"'::jsonb),
    (v_comp,'provider','"api-football"'::jsonb),
    (v_comp,'provider_league_id','39'::jsonb),
    (v_comp,'provider_season','2026'::jsonb),
    (v_comp,'ingest_enabled','false'::jsonb),
    (v_comp,'lifecycle','"draft"'::jsonb),
    (v_comp,'visible','false'::jsonb),
    (v_comp,'timezone','"Europe/London"'::jsonb),
    (v_comp,'display_order','20'::jsonb)
  on conflict (competition_id, key) do nothing;

  -- ── Clubs ──
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Arsenal', 'ARS', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Aston Villa', 'AVL', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Bournemouth', 'BOU', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Brentford', 'BRE', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Brighton', 'BHA', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Burnley', 'BUR', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Chelsea', 'CHE', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Crystal Palace', 'CRY', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Everton', 'EVE', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Fulham', 'FUL', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Leeds United', 'LEE', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Liverpool', 'LIV', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Man City', 'MCI', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Man United', 'MUN', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Newcastle', 'NEW', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Nott''m Forest', 'NFO', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Sunderland', 'SUN', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Tottenham', 'TOT', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'West Ham', 'WHU', null) on conflict (competition_id, code) do nothing;
  insert into public.teams (competition_id, season_id, name, code, group_name) values (v_comp, v_season, 'Wolves', 'WOL', null) on conflict (competition_id, code) do nothing;

  insert into public.season_teams (season_id, team_id)
    select v_season, id from public.teams where competition_id = v_comp
  on conflict do nothing;

  -- ── Matchweek 1 ──
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw1', 'Matchweek 1', 'MW1', 1, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw1';
  select id into v_home from public.teams where competition_id = v_comp and code = 'LIV';
  select id into v_away from public.teams where competition_id = v_comp and code = 'BOU';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-14T19:00:00Z', 'Anfield', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'AVL';
  select id into v_away from public.teams where competition_id = v_comp and code = 'NEW';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-15T11:30:00Z', 'Villa Park', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'BHA';
  select id into v_away from public.teams where competition_id = v_comp and code = 'FUL';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-15T14:00:00Z', 'Amex Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'SUN';
  select id into v_away from public.teams where competition_id = v_comp and code = 'WHU';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-15T14:00:00Z', 'Stadium of Light', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'TOT';
  select id into v_away from public.teams where competition_id = v_comp and code = 'BUR';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-15T14:00:00Z', 'Tottenham Hotspur Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'WOL';
  select id into v_away from public.teams where competition_id = v_comp and code = 'MCI';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-15T16:30:00Z', 'Molineux', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'CHE';
  select id into v_away from public.teams where competition_id = v_comp and code = 'CRY';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-16T13:00:00Z', 'Stamford Bridge', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'NFO';
  select id into v_away from public.teams where competition_id = v_comp and code = 'BRE';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-16T13:00:00Z', 'The City Ground', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'MUN';
  select id into v_away from public.teams where competition_id = v_comp and code = 'ARS';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-16T15:30:00Z', 'Old Trafford', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'LEE';
  select id into v_away from public.teams where competition_id = v_comp and code = 'EVE';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-17T19:00:00Z', 'Elland Road', 'scheduled')
  on conflict do nothing;

  -- ── Matchweek 2 ──
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw2', 'Matchweek 2', 'MW2', 2, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw2';
  select id into v_home from public.teams where competition_id = v_comp and code = 'WHU';
  select id into v_away from public.teams where competition_id = v_comp and code = 'CHE';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-22T19:00:00Z', 'London Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'MCI';
  select id into v_away from public.teams where competition_id = v_comp and code = 'TOT';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-23T11:30:00Z', 'Etihad Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'BOU';
  select id into v_away from public.teams where competition_id = v_comp and code = 'WOL';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-23T14:00:00Z', 'Vitality Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'BRE';
  select id into v_away from public.teams where competition_id = v_comp and code = 'AVL';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-23T14:00:00Z', 'Gtech Community Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'BUR';
  select id into v_away from public.teams where competition_id = v_comp and code = 'SUN';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-23T14:00:00Z', 'Turf Moor', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'ARS';
  select id into v_away from public.teams where competition_id = v_comp and code = 'LEE';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-23T16:30:00Z', 'Emirates Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'CRY';
  select id into v_away from public.teams where competition_id = v_comp and code = 'NFO';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-24T13:00:00Z', 'Selhurst Park', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'EVE';
  select id into v_away from public.teams where competition_id = v_comp and code = 'BHA';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-24T13:00:00Z', 'Hill Dickinson Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'FUL';
  select id into v_away from public.teams where competition_id = v_comp and code = 'MUN';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-24T15:30:00Z', 'Craven Cottage', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'NEW';
  select id into v_away from public.teams where competition_id = v_comp and code = 'LIV';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-25T19:00:00Z', 'St James'' Park', 'scheduled')
  on conflict do nothing;

  -- ── Matchweek 3 ──
  insert into public.rounds (season_id, code, label, short_label, sort_order, kind, status)
    values (v_season, 'mw3', 'Matchweek 3', 'MW3', 3, 'matchweek', 'upcoming')
  on conflict (season_id, code) do nothing;
  select id into v_round from public.rounds where season_id = v_season and code = 'mw3';
  select id into v_home from public.teams where competition_id = v_comp and code = 'CHE';
  select id into v_away from public.teams where competition_id = v_comp and code = 'FUL';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-30T11:30:00Z', 'Stamford Bridge', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'MUN';
  select id into v_away from public.teams where competition_id = v_comp and code = 'BUR';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-30T14:00:00Z', 'Old Trafford', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'SUN';
  select id into v_away from public.teams where competition_id = v_comp and code = 'BRE';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-30T14:00:00Z', 'Stadium of Light', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'TOT';
  select id into v_away from public.teams where competition_id = v_comp and code = 'BOU';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-30T14:00:00Z', 'Tottenham Hotspur Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'WOL';
  select id into v_away from public.teams where competition_id = v_comp and code = 'EVE';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-30T14:00:00Z', 'Molineux', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'LEE';
  select id into v_away from public.teams where competition_id = v_comp and code = 'NEW';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-30T16:30:00Z', 'Elland Road', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'BHA';
  select id into v_away from public.teams where competition_id = v_comp and code = 'MCI';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-31T13:00:00Z', 'Amex Stadium', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'NFO';
  select id into v_away from public.teams where competition_id = v_comp and code = 'WHU';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-31T13:00:00Z', 'The City Ground', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'LIV';
  select id into v_away from public.teams where competition_id = v_comp and code = 'ARS';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-31T15:30:00Z', 'Anfield', 'scheduled')
  on conflict do nothing;
  select id into v_home from public.teams where competition_id = v_comp and code = 'AVL';
  select id into v_away from public.teams where competition_id = v_comp and code = 'CRY';
  v_num := v_num + 1;
  insert into public.fixtures (competition_id, season_id, round_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
    values (v_comp, v_season, v_round, 'league', v_num, v_home, v_away, '2026-08-31T15:30:00Z', 'Villa Park', 'scheduled')
  on conflict do nothing;

  perform public.recompute_round_window(id) from public.rounds where season_id = v_season;

  raise notice 'Premier League seeded: % fixtures across % rounds. HIDDEN — launch from /admin/competitions.', v_num, 3;
end;
$$;
