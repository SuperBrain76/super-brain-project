-- ════════════════════════════════════════════════════════════
-- FIFA World Cup 2026 — Fixture Seed
-- 48 teams · 12 groups · 104 matches
--
-- ⚠ IMPORTANT: Verify team names and kickoff times against
--   https://www.fifa.com/worldcup before launch.
--   Kickoff times are APPROXIMATE — update via admin panel.
--   All times stored in UTC. Convert to local:
--     UTC-4 (EDT): subtract 4h   (USA East)
--     UTC-5 (CDT): subtract 5h   (USA Central, Mexico City)
--     UTC-6 (MDT): subtract 6h   (USA Mountain)
--     UTC-7 (PDT): subtract 7h   (USA West, Vancouver)
--
-- Run AFTER predictor-schema.sql
-- Safe to re-run (uses ON CONFLICT DO NOTHING)
-- ════════════════════════════════════════════════════════════


-- ── COMPETITION ───────────────────────────────────────────────

insert into public.competitions (name, slug, status, starts_at, ends_at)
values (
  'FIFA World Cup 2026',
  'wc2026',
  'upcoming',
  '2026-06-11 20:00:00+00',
  '2026-07-19 22:00:00+00'
)
on conflict (slug) do nothing;


-- ── TEAMS (48) ────────────────────────────────────────────────
-- Groups A–L · 4 teams each · host nations in Groups A (MEX), B (USA), C (CAN)

insert into public.teams (competition_id, name, code, flag_emoji, group_name)
select c.id, t.name, t.code, t.flag, t.grp
from public.competitions c,
(values
  -- GROUP A — Mexico host
  ('Mexico',        'MEX', '🇲🇽', 'A'),
  ('Ecuador',       'ECU', '🇪🇨', 'A'),
  ('Venezuela',     'VEN', '🇻🇪', 'A'),
  ('Jamaica',       'JAM', '🇯🇲', 'A'),

  -- GROUP B — USA host
  ('USA',           'USA', '🇺🇸', 'B'),
  ('Colombia',      'COL', '🇨🇴', 'B'),
  ('Morocco',       'MAR', '🇲🇦', 'B'),
  ('Panama',        'PAN', '🇵🇦', 'B'),

  -- GROUP C — Canada host
  ('Canada',        'CAN', '🇨🇦', 'C'),
  ('Argentina',     'ARG', '🇦🇷', 'C'),
  ('Chile',         'CHI', '🇨🇱', 'C'),
  ('Peru',          'PER', '🇵🇪', 'C'),

  -- GROUP D
  ('Spain',         'ESP', '🇪🇸', 'D'),
  ('Uruguay',       'URU', '🇺🇾', 'D'),
  ('Poland',        'POL', '🇵🇱', 'D'),
  ('South Africa',  'RSA', '🇿🇦', 'D'),

  -- GROUP E
  ('France',        'FRA', '🇫🇷', 'E'),
  ('Netherlands',   'NED', '🇳🇱', 'E'),
  ('Australia',     'AUS', '🇦🇺', 'E'),
  ('South Korea',   'KOR', '🇰🇷', 'E'),

  -- GROUP F
  ('England',       'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'F'),
  ('Brazil',        'BRA', '🇧🇷', 'F'),
  ('Senegal',       'SEN', '🇸🇳', 'F'),
  ('Serbia',        'SRB', '🇷🇸', 'F'),

  -- GROUP G
  ('Germany',       'GER', '🇩🇪', 'G'),
  ('Portugal',      'POR', '🇵🇹', 'G'),
  ('Japan',         'JPN', '🇯🇵', 'G'),
  ('Ivory Coast',   'CIV', '🇨🇮', 'G'),

  -- GROUP H
  ('Croatia',       'CRO', '🇭🇷', 'H'),
  ('Nigeria',       'NGA', '🇳🇬', 'H'),
  ('Saudi Arabia',  'KSA', '🇸🇦', 'H'),
  ('Switzerland',   'SUI', '🇨🇭', 'H'),

  -- GROUP I
  ('Belgium',       'BEL', '🇧🇪', 'I'),
  ('Algeria',       'ALG', '🇩🇿', 'I'),
  ('Iran',          'IRN', '🇮🇷', 'I'),
  ('New Zealand',   'NZL', '🇳🇿', 'I'),

  -- GROUP J
  ('Italy',         'ITA', '🇮🇹', 'J'),
  ('Turkey',        'TUR', '🇹🇷', 'J'),
  ('Egypt',         'EGY', '🇪🇬', 'J'),
  ('Jordan',        'JOR', '🇯🇴', 'J'),

  -- GROUP K
  ('Denmark',       'DEN', '🇩🇰', 'K'),
  ('Cameroon',      'CMR', '🇨🇲', 'K'),
  ('Iraq',          'IRQ', '🇮🇶', 'K'),
  ('Paraguay',      'PAR', '🇵🇾', 'K'),

  -- GROUP L
  ('Austria',       'AUT', '🇦🇹', 'L'),
  ('Tunisia',       'TUN', '🇹🇳', 'L'),
  ('Uzbekistan',    'UZB', '🇺🇿', 'L'),
  ('Scotland',      'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'L')
) as t(name, code, flag, grp)
where c.slug = 'wc2026'
on conflict (competition_id, code) do nothing;


-- ════════════════════════════════════════════════════════════
-- FIXTURES — GROUP STAGE (72 matches)
-- Each group plays round-robin: 6 matches across 3 matchdays.
-- Matchday 3 within each group must be simultaneous (FIFA rule).
-- Format: T1 vs T2 / T3 vs T4 (MD1), T1 vs T3 / T2 vs T4 (MD2),
--         T1 vs T4 || T2 vs T3 (MD3 simultaneous)
-- ════════════════════════════════════════════════════════════

-- Helper: resolves team ID by code within this competition
-- Used inline as subquery to keep the INSERT readable.
-- Pattern: (select t.id from teams t join competitions c on t.competition_id = c.id
--            where t.code = 'MEX' and c.slug = 'wc2026')

-- ── GROUP A (Mexico, Ecuador, Venezuela, Jamaica) ─────────────

-- MD1
insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'A', 1,
  (select id from teams where code='MEX' and competition_id=c.id),
  (select id from teams where code='ECU' and competition_id=c.id),
  '2026-06-11 20:00:00+00', 'Estadio Azteca, Mexico City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'A', 2,
  (select id from teams where code='VEN' and competition_id=c.id),
  (select id from teams where code='JAM' and competition_id=c.id),
  '2026-06-11 23:00:00+00', 'Estadio Akron, Guadalajara', 'scheduled'
from competitions c where c.slug='wc2026';

-- MD2
insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'A', 3,
  (select id from teams where code='MEX' and competition_id=c.id),
  (select id from teams where code='VEN' and competition_id=c.id),
  '2026-06-16 20:00:00+00', 'Estadio Azteca, Mexico City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'A', 4,
  (select id from teams where code='ECU' and competition_id=c.id),
  (select id from teams where code='JAM' and competition_id=c.id),
  '2026-06-16 23:00:00+00', 'Estadio BBVA, Monterrey', 'scheduled'
from competitions c where c.slug='wc2026';

-- MD3 (simultaneous within group)
insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'A', 5,
  (select id from teams where code='MEX' and competition_id=c.id),
  (select id from teams where code='JAM' and competition_id=c.id),
  '2026-06-22 22:00:00+00', 'Estadio Azteca, Mexico City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'A', 6,
  (select id from teams where code='ECU' and competition_id=c.id),
  (select id from teams where code='VEN' and competition_id=c.id),
  '2026-06-22 22:00:00+00', 'Estadio BBVA, Monterrey', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP B (USA, Colombia, Morocco, Panama) ──────────────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'B', 7,
  (select id from teams where code='USA' and competition_id=c.id),
  (select id from teams where code='COL' and competition_id=c.id),
  '2026-06-12 17:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'B', 8,
  (select id from teams where code='MAR' and competition_id=c.id),
  (select id from teams where code='PAN' and competition_id=c.id),
  '2026-06-12 20:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'B', 9,
  (select id from teams where code='USA' and competition_id=c.id),
  (select id from teams where code='MAR' and competition_id=c.id),
  '2026-06-17 23:00:00+00', 'AT&T Stadium, Dallas', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'B', 10,
  (select id from teams where code='COL' and competition_id=c.id),
  (select id from teams where code='PAN' and competition_id=c.id),
  '2026-06-17 20:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'B', 11,
  (select id from teams where code='USA' and competition_id=c.id),
  (select id from teams where code='PAN' and competition_id=c.id),
  '2026-06-23 22:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'B', 12,
  (select id from teams where code='COL' and competition_id=c.id),
  (select id from teams where code='MAR' and competition_id=c.id),
  '2026-06-23 22:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP C (Canada, Argentina, Chile, Peru) ──────────────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'C', 13,
  (select id from teams where code='CAN' and competition_id=c.id),
  (select id from teams where code='ARG' and competition_id=c.id),
  '2026-06-12 23:00:00+00', 'BC Place, Vancouver', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'C', 14,
  (select id from teams where code='CHI' and competition_id=c.id),
  (select id from teams where code='PER' and competition_id=c.id),
  '2026-06-13 17:00:00+00', 'BMO Field, Toronto', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'C', 15,
  (select id from teams where code='CAN' and competition_id=c.id),
  (select id from teams where code='CHI' and competition_id=c.id),
  '2026-06-18 17:00:00+00', 'BMO Field, Toronto', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'C', 16,
  (select id from teams where code='ARG' and competition_id=c.id),
  (select id from teams where code='PER' and competition_id=c.id),
  '2026-06-18 20:00:00+00', 'BC Place, Vancouver', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'C', 17,
  (select id from teams where code='CAN' and competition_id=c.id),
  (select id from teams where code='PER' and competition_id=c.id),
  '2026-06-24 22:00:00+00', 'BMO Field, Toronto', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'C', 18,
  (select id from teams where code='ARG' and competition_id=c.id),
  (select id from teams where code='CHI' and competition_id=c.id),
  '2026-06-24 22:00:00+00', 'BC Place, Vancouver', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP D (Spain, Uruguay, Poland, South Africa) ────────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'D', 19,
  (select id from teams where code='ESP' and competition_id=c.id),
  (select id from teams where code='URU' and competition_id=c.id),
  '2026-06-13 20:00:00+00', 'AT&T Stadium, Dallas', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'D', 20,
  (select id from teams where code='POL' and competition_id=c.id),
  (select id from teams where code='RSA' and competition_id=c.id),
  '2026-06-13 23:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'D', 21,
  (select id from teams where code='ESP' and competition_id=c.id),
  (select id from teams where code='POL' and competition_id=c.id),
  '2026-06-18 23:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'D', 22,
  (select id from teams where code='URU' and competition_id=c.id),
  (select id from teams where code='RSA' and competition_id=c.id),
  '2026-06-19 17:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'D', 23,
  (select id from teams where code='ESP' and competition_id=c.id),
  (select id from teams where code='RSA' and competition_id=c.id),
  '2026-06-25 22:00:00+00', 'AT&T Stadium, Dallas', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'D', 24,
  (select id from teams where code='URU' and competition_id=c.id),
  (select id from teams where code='POL' and competition_id=c.id),
  '2026-06-25 22:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP E (France, Netherlands, Australia, South Korea) ─────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'E', 25,
  (select id from teams where code='FRA' and competition_id=c.id),
  (select id from teams where code='NED' and competition_id=c.id),
  '2026-06-14 17:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'E', 26,
  (select id from teams where code='AUS' and competition_id=c.id),
  (select id from teams where code='KOR' and competition_id=c.id),
  '2026-06-14 20:00:00+00', 'Lumen Field, Seattle', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'E', 27,
  (select id from teams where code='FRA' and competition_id=c.id),
  (select id from teams where code='AUS' and competition_id=c.id),
  '2026-06-19 20:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'E', 28,
  (select id from teams where code='NED' and competition_id=c.id),
  (select id from teams where code='KOR' and competition_id=c.id),
  '2026-06-19 23:00:00+00', 'Lumen Field, Seattle', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'E', 29,
  (select id from teams where code='FRA' and competition_id=c.id),
  (select id from teams where code='KOR' and competition_id=c.id),
  '2026-06-25 02:00:00+00', 'AT&T Stadium, Dallas', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'E', 30,
  (select id from teams where code='NED' and competition_id=c.id),
  (select id from teams where code='AUS' and competition_id=c.id),
  '2026-06-25 02:00:00+00', 'Lumen Field, Seattle', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP F (England, Brazil, Senegal, Serbia) ────────────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'F', 31,
  (select id from teams where code='ENG' and competition_id=c.id),
  (select id from teams where code='BRA' and competition_id=c.id),
  '2026-06-14 23:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'F', 32,
  (select id from teams where code='SEN' and competition_id=c.id),
  (select id from teams where code='SRB' and competition_id=c.id),
  '2026-06-15 17:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'F', 33,
  (select id from teams where code='ENG' and competition_id=c.id),
  (select id from teams where code='SEN' and competition_id=c.id),
  '2026-06-20 17:00:00+00', 'Gillette Stadium, Boston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'F', 34,
  (select id from teams where code='BRA' and competition_id=c.id),
  (select id from teams where code='SRB' and competition_id=c.id),
  '2026-06-20 20:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'F', 35,
  (select id from teams where code='ENG' and competition_id=c.id),
  (select id from teams where code='SRB' and competition_id=c.id),
  '2026-06-26 02:00:00+00', 'Gillette Stadium, Boston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'F', 36,
  (select id from teams where code='BRA' and competition_id=c.id),
  (select id from teams where code='SEN' and competition_id=c.id),
  '2026-06-26 02:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP G (Germany, Portugal, Japan, Ivory Coast) ───────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'G', 37,
  (select id from teams where code='GER' and competition_id=c.id),
  (select id from teams where code='POR' and competition_id=c.id),
  '2026-06-15 20:00:00+00', 'Lincoln Financial Field, Philadelphia', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'G', 38,
  (select id from teams where code='JPN' and competition_id=c.id),
  (select id from teams where code='CIV' and competition_id=c.id),
  '2026-06-15 23:00:00+00', 'AT&T Stadium, Dallas', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'G', 39,
  (select id from teams where code='GER' and competition_id=c.id),
  (select id from teams where code='JPN' and competition_id=c.id),
  '2026-06-20 23:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'G', 40,
  (select id from teams where code='POR' and competition_id=c.id),
  (select id from teams where code='CIV' and competition_id=c.id),
  '2026-06-21 17:00:00+00', 'Lincoln Financial Field, Philadelphia', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'G', 41,
  (select id from teams where code='GER' and competition_id=c.id),
  (select id from teams where code='CIV' and competition_id=c.id),
  '2026-06-26 22:00:00+00', 'Lincoln Financial Field, Philadelphia', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'G', 42,
  (select id from teams where code='POR' and competition_id=c.id),
  (select id from teams where code='JPN' and competition_id=c.id),
  '2026-06-26 22:00:00+00', 'AT&T Stadium, Dallas', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP H (Croatia, Nigeria, Saudi Arabia, Switzerland) ─────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'H', 43,
  (select id from teams where code='CRO' and competition_id=c.id),
  (select id from teams where code='NGA' and competition_id=c.id),
  '2026-06-16 17:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'H', 44,
  (select id from teams where code='KSA' and competition_id=c.id),
  (select id from teams where code='SUI' and competition_id=c.id),
  '2026-06-16 20:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'H', 45,
  (select id from teams where code='CRO' and competition_id=c.id),
  (select id from teams where code='KSA' and competition_id=c.id),
  '2026-06-21 20:00:00+00', 'Lumen Field, Seattle', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'H', 46,
  (select id from teams where code='NGA' and competition_id=c.id),
  (select id from teams where code='SUI' and competition_id=c.id),
  '2026-06-21 23:00:00+00', 'NRG Stadium, Houston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'H', 47,
  (select id from teams where code='CRO' and competition_id=c.id),
  (select id from teams where code='SUI' and competition_id=c.id),
  '2026-06-27 02:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'H', 48,
  (select id from teams where code='NGA' and competition_id=c.id),
  (select id from teams where code='KSA' and competition_id=c.id),
  '2026-06-27 02:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP I (Belgium, Algeria, Iran, New Zealand) ─────────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'I', 49,
  (select id from teams where code='BEL' and competition_id=c.id),
  (select id from teams where code='ALG' and competition_id=c.id),
  '2026-06-16 23:00:00+00', 'NRG Stadium, Houston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'I', 50,
  (select id from teams where code='IRN' and competition_id=c.id),
  (select id from teams where code='NZL' and competition_id=c.id),
  '2026-06-17 17:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'I', 51,
  (select id from teams where code='BEL' and competition_id=c.id),
  (select id from teams where code='IRN' and competition_id=c.id),
  '2026-06-22 17:00:00+00', 'NRG Stadium, Houston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'I', 52,
  (select id from teams where code='ALG' and competition_id=c.id),
  (select id from teams where code='NZL' and competition_id=c.id),
  '2026-06-22 20:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'I', 53,
  (select id from teams where code='BEL' and competition_id=c.id),
  (select id from teams where code='NZL' and competition_id=c.id),
  '2026-06-27 22:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'I', 54,
  (select id from teams where code='ALG' and competition_id=c.id),
  (select id from teams where code='IRN' and competition_id=c.id),
  '2026-06-27 22:00:00+00', 'NRG Stadium, Houston', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP J (Italy, Turkey, Egypt, Jordan) ────────────────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'J', 55,
  (select id from teams where code='ITA' and competition_id=c.id),
  (select id from teams where code='TUR' and competition_id=c.id),
  '2026-06-17 23:00:00+00', 'Lincoln Financial Field, Philadelphia', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'J', 56,
  (select id from teams where code='EGY' and competition_id=c.id),
  (select id from teams where code='JOR' and competition_id=c.id),
  '2026-06-17 17:00:00+00', 'Gillette Stadium, Boston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'J', 57,
  (select id from teams where code='ITA' and competition_id=c.id),
  (select id from teams where code='EGY' and competition_id=c.id),
  '2026-06-22 23:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'J', 58,
  (select id from teams where code='TUR' and competition_id=c.id),
  (select id from teams where code='JOR' and competition_id=c.id),
  '2026-06-23 17:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'J', 59,
  (select id from teams where code='ITA' and competition_id=c.id),
  (select id from teams where code='JOR' and competition_id=c.id),
  '2026-06-28 02:00:00+00', 'Lincoln Financial Field, Philadelphia', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'J', 60,
  (select id from teams where code='TUR' and competition_id=c.id),
  (select id from teams where code='EGY' and competition_id=c.id),
  '2026-06-28 02:00:00+00', 'Gillette Stadium, Boston', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP K (Denmark, Cameroon, Iraq, Paraguay) ───────────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'K', 61,
  (select id from teams where code='DEN' and competition_id=c.id),
  (select id from teams where code='CMR' and competition_id=c.id),
  '2026-06-18 17:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'K', 62,
  (select id from teams where code='IRQ' and competition_id=c.id),
  (select id from teams where code='PAR' and competition_id=c.id),
  '2026-06-18 23:00:00+00', 'Lumen Field, Seattle', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'K', 63,
  (select id from teams where code='DEN' and competition_id=c.id),
  (select id from teams where code='IRQ' and competition_id=c.id),
  '2026-06-23 20:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'K', 64,
  (select id from teams where code='CMR' and competition_id=c.id),
  (select id from teams where code='PAR' and competition_id=c.id),
  '2026-06-23 23:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'K', 65,
  (select id from teams where code='DEN' and competition_id=c.id),
  (select id from teams where code='PAR' and competition_id=c.id),
  '2026-06-28 22:00:00+00', 'Lumen Field, Seattle', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'K', 66,
  (select id from teams where code='CMR' and competition_id=c.id),
  (select id from teams where code='IRQ' and competition_id=c.id),
  '2026-06-28 22:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled'
from competitions c where c.slug='wc2026';


-- ── GROUP L (Austria, Tunisia, Uzbekistan, Scotland) ──────────

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'L', 67,
  (select id from teams where code='AUT' and competition_id=c.id),
  (select id from teams where code='TUN' and competition_id=c.id),
  '2026-06-19 17:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'L', 68,
  (select id from teams where code='UZB' and competition_id=c.id),
  (select id from teams where code='SCO' and competition_id=c.id),
  '2026-06-19 23:00:00+00', 'NRG Stadium, Houston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'L', 69,
  (select id from teams where code='AUT' and competition_id=c.id),
  (select id from teams where code='UZB' and competition_id=c.id),
  '2026-06-24 17:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'L', 70,
  (select id from teams where code='TUN' and competition_id=c.id),
  (select id from teams where code='SCO' and competition_id=c.id),
  '2026-06-24 20:00:00+00', 'NRG Stadium, Houston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'L', 71,
  (select id from teams where code='AUT' and competition_id=c.id),
  (select id from teams where code='SCO' and competition_id=c.id),
  '2026-06-29 02:00:00+00', 'NRG Stadium, Houston', 'scheduled'
from competitions c where c.slug='wc2026';

insert into public.fixtures (competition_id, stage, group_name, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'group', 'L', 72,
  (select id from teams where code='TUN' and competition_id=c.id),
  (select id from teams where code='UZB' and competition_id=c.id),
  '2026-06-29 02:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled'
from competitions c where c.slug='wc2026';


-- ════════════════════════════════════════════════════════════
-- KNOCKOUT STAGE — 32 fixtures (teams TBD until groups resolve)
-- home_team_id and away_team_id are NULL — admin updates via panel
-- as teams advance. Dates and venues are confirmed by FIFA.
-- ════════════════════════════════════════════════════════════

-- Round of 32 (16 matches, June 29 – July 3)
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 73, null, null, '2026-06-29 17:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 74, null, null, '2026-06-29 23:00:00+00', 'AT&T Stadium, Dallas', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 75, null, null, '2026-06-30 17:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 76, null, null, '2026-06-30 23:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 77, null, null, '2026-07-01 17:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 78, null, null, '2026-07-01 23:00:00+00', 'Lumen Field, Seattle', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 79, null, null, '2026-07-02 17:00:00+00', 'Gillette Stadium, Boston', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 80, null, null, '2026-07-02 23:00:00+00', 'Lincoln Financial Field, Philadelphia', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 81, null, null, '2026-07-03 17:00:00+00', 'Estadio Azteca, Mexico City', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 82, null, null, '2026-07-03 23:00:00+00', 'Estadio Akron, Guadalajara', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 83, null, null, '2026-07-04 17:00:00+00', 'BC Place, Vancouver', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 84, null, null, '2026-07-04 23:00:00+00', 'BMO Field, Toronto', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 85, null, null, '2026-07-05 17:00:00+00', 'NRG Stadium, Houston', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 86, null, null, '2026-07-05 23:00:00+00', 'Arrowhead Stadium, Kansas City', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 87, null, null, '2026-07-06 17:00:00+00', 'Estadio BBVA, Monterrey', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r32', 88, null, null, '2026-07-06 23:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled' from competitions c where c.slug='wc2026';

-- Round of 16 (8 matches, July 8–11)
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 89, null, null, '2026-07-08 20:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 90, null, null, '2026-07-09 20:00:00+00', 'AT&T Stadium, Dallas', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 91, null, null, '2026-07-10 20:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 92, null, null, '2026-07-11 20:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 93, null, null, '2026-07-12 17:00:00+00', 'Levi''s Stadium, Santa Clara', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 94, null, null, '2026-07-12 23:00:00+00', 'Lumen Field, Seattle', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 95, null, null, '2026-07-13 17:00:00+00', 'NRG Stadium, Houston', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'r16', 96, null, null, '2026-07-13 23:00:00+00', 'Estadio Azteca, Mexico City', 'scheduled' from competitions c where c.slug='wc2026';

-- Quarter-finals (4 matches, July 14–15)
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'qf', 97, null, null, '2026-07-14 20:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'qf', 98, null, null, '2026-07-15 17:00:00+00', 'AT&T Stadium, Dallas', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'qf', 99, null, null, '2026-07-15 23:00:00+00', 'SoFi Stadium, Los Angeles', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'qf', 100, null, null, '2026-07-16 20:00:00+00', 'Hard Rock Stadium, Miami', 'scheduled' from competitions c where c.slug='wc2026';

-- Semi-finals (2 matches, July 17–18)
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'sf', 101, null, null, '2026-07-17 20:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled' from competitions c where c.slug='wc2026';
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'sf', 102, null, null, '2026-07-18 20:00:00+00', 'AT&T Stadium, Dallas', 'scheduled' from competitions c where c.slug='wc2026';

-- Third place play-off
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, '3rd', 103, null, null, '2026-07-18 19:00:00+00', 'Estadio Azteca, Mexico City', 'scheduled' from competitions c where c.slug='wc2026';

-- FINAL
insert into public.fixtures (competition_id, stage, fixture_number, home_team_id, away_team_id, kicks_off_at, venue, status)
select c.id, 'final', 104, null, null, '2026-07-19 20:00:00+00', 'MetLife Stadium, East Rutherford NJ', 'scheduled' from competitions c where c.slug='wc2026';


-- ── Verify ────────────────────────────────────────────────────
do $$
declare
  team_count    integer;
  fixture_count integer;
begin
  select count(*) into team_count    from public.teams    t join public.competitions c on t.competition_id = c.id where c.slug = 'wc2026';
  select count(*) into fixture_count from public.fixtures f join public.competitions c on f.competition_id = c.id where c.slug = 'wc2026';
  raise notice 'WC2026 seed: % teams loaded, % fixtures loaded', team_count, fixture_count;
  if fixture_count != 104 then
    raise warning 'Expected 104 fixtures, got %. Check for missing inserts.', fixture_count;
  end if;
end;
$$;
