-- ============================================================
-- FIFA World Cup 2026 — Corrected Teams & Fixtures
-- ============================================================
-- Sources:
--   • Official draw: FIFA / Kennedy Center, Washington D.C., 5 Dec 2025
--   • Full schedule:  NBC Sports (primary), Sky Sports (cross-reference)
--   • Wikipedia: 2026 FIFA World Cup Group A–L articles
-- Verified: 2026-06-04
--
-- All kickoff times are UTC (converted from US EDT = UTC−4).
-- Run AFTER predictor-schema.sql.
--
-- SAFE RESET — only deletes WC2026 teams & fixtures.
-- Predictions cascade-delete via FK.
-- User accounts and all other platform data are untouched.
-- ============================================================

BEGIN;

DO $$
DECLARE
  comp_id  uuid := 'e0a9ff8e-1e46-4577-9517-c3cd83ea0e33';
BEGIN

  -- ── 1. Remove existing WC2026 data ───────────────────────────
  DELETE FROM public.fixtures WHERE competition_id = comp_id;
  DELETE FROM public.teams    WHERE competition_id = comp_id;

  -- ── 2. Insert 48 correct teams ────────────────────────────────
  INSERT INTO public.teams (competition_id, name, code, flag_emoji, group_name) VALUES
    -- Group A  (Mexico = co-host)
    (comp_id, 'Mexico',                 'MEX', '🇲🇽', 'A'),
    (comp_id, 'South Africa',           'RSA', '🇿🇦', 'A'),
    (comp_id, 'South Korea',            'KOR', '🇰🇷', 'A'),
    (comp_id, 'Czech Republic',         'CZE', '🇨🇿', 'A'),
    -- Group B  (Canada = co-host)
    (comp_id, 'Canada',                 'CAN', '🇨🇦', 'B'),
    (comp_id, 'Bosnia and Herzegovina', 'BIH', '🇧🇦', 'B'),
    (comp_id, 'Qatar',                  'QAT', '🇶🇦', 'B'),
    (comp_id, 'Switzerland',            'SUI', '🇨🇭', 'B'),
    -- Group C
    (comp_id, 'Brazil',                 'BRA', '🇧🇷', 'C'),
    (comp_id, 'Morocco',                'MAR', '🇲🇦', 'C'),
    (comp_id, 'Haiti',                  'HAI', '🇭🇹', 'C'),
    (comp_id, 'Scotland',               'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),
    -- Group D  (USA = co-host)
    (comp_id, 'United States',          'USA', '🇺🇸', 'D'),
    (comp_id, 'Paraguay',               'PAR', '🇵🇾', 'D'),
    (comp_id, 'Australia',              'AUS', '🇦🇺', 'D'),
    (comp_id, 'Türkiye',                'TUR', '🇹🇷', 'D'),
    -- Group E
    (comp_id, 'Germany',                'GER', '🇩🇪', 'E'),
    (comp_id, 'Curaçao',                'CUW', '🇨🇼', 'E'),
    (comp_id, 'Ivory Coast',            'CIV', '🇨🇮', 'E'),
    (comp_id, 'Ecuador',                'ECU', '🇪🇨', 'E'),
    -- Group F
    (comp_id, 'Netherlands',            'NED', '🇳🇱', 'F'),
    (comp_id, 'Japan',                  'JPN', '🇯🇵', 'F'),
    (comp_id, 'Sweden',                 'SWE', '🇸🇪', 'F'),
    (comp_id, 'Tunisia',                'TUN', '🇹🇳', 'F'),
    -- Group G
    (comp_id, 'Belgium',                'BEL', '🇧🇪', 'G'),
    (comp_id, 'Egypt',                  'EGY', '🇪🇬', 'G'),
    (comp_id, 'Iran',                   'IRN', '🇮🇷', 'G'),
    (comp_id, 'New Zealand',            'NZL', '🇳🇿', 'G'),
    -- Group H
    (comp_id, 'Spain',                  'ESP', '🇪🇸', 'H'),
    (comp_id, 'Cape Verde',             'CPV', '🇨🇻', 'H'),
    (comp_id, 'Saudi Arabia',           'KSA', '🇸🇦', 'H'),
    (comp_id, 'Uruguay',                'URU', '🇺🇾', 'H'),
    -- Group I
    (comp_id, 'France',                 'FRA', '🇫🇷', 'I'),
    (comp_id, 'Senegal',                'SEN', '🇸🇳', 'I'),
    (comp_id, 'Iraq',                   'IRQ', '🇮🇶', 'I'),
    (comp_id, 'Norway',                 'NOR', '🇳🇴', 'I'),
    -- Group J
    (comp_id, 'Argentina',              'ARG', '🇦🇷', 'J'),
    (comp_id, 'Algeria',                'ALG', '🇩🇿', 'J'),
    (comp_id, 'Austria',                'AUT', '🇦🇹', 'J'),
    (comp_id, 'Jordan',                 'JOR', '🇯🇴', 'J'),
    -- Group K
    (comp_id, 'Portugal',               'POR', '🇵🇹', 'K'),
    (comp_id, 'DR Congo',               'COD', '🇨🇩', 'K'),
    (comp_id, 'Uzbekistan',             'UZB', '🇺🇿', 'K'),
    (comp_id, 'Colombia',               'COL', '🇨🇴', 'K'),
    -- Group L
    (comp_id, 'England',                'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'L'),
    (comp_id, 'Croatia',                'CRO', '🇭🇷', 'L'),
    (comp_id, 'Ghana',                  'GHA', '🇬🇭', 'L'),
    (comp_id, 'Panama',                 'PAN', '🇵🇦', 'L');

  -- ── 3. Insert 72 group-stage fixtures ─────────────────────────
  INSERT INTO public.fixtures
    (competition_id, stage, group_name, fixture_number,
     home_team_id, away_team_id, kicks_off_at, venue)
  SELECT
    comp_id, f.stage::text, f.grp, f.num,
    (SELECT id FROM public.teams WHERE competition_id = comp_id AND code = f.home),
    (SELECT id FROM public.teams WHERE competition_id = comp_id AND code = f.away),
    f.ko::timestamptz, f.venue
  FROM (VALUES
    -- ── Group A ──────────────────────────────────────────────────
    ('group','A', 1,'MEX','RSA','2026-06-11T19:00:00Z','Estadio Azteca, Mexico City'),
    ('group','A', 2,'KOR','CZE','2026-06-12T02:00:00Z','Estadio Akron, Guadalajara'),
    ('group','A', 3,'CZE','RSA','2026-06-18T16:00:00Z','Mercedes-Benz Stadium, Atlanta'),
    ('group','A', 4,'MEX','KOR','2026-06-19T01:00:00Z','Estadio Akron, Guadalajara'),
    ('group','A', 5,'CZE','MEX','2026-06-25T01:00:00Z','Estadio Azteca, Mexico City'),
    ('group','A', 6,'RSA','KOR','2026-06-25T01:00:00Z','Estadio BBVA, Monterrey'),
    -- ── Group B ──────────────────────────────────────────────────
    ('group','B', 7,'CAN','BIH','2026-06-12T19:00:00Z','BMO Field, Toronto'),
    ('group','B', 8,'QAT','SUI','2026-06-13T19:00:00Z','Levi''s Stadium, Santa Clara'),
    ('group','B', 9,'SUI','BIH','2026-06-18T19:00:00Z','SoFi Stadium, Los Angeles'),
    ('group','B',10,'CAN','QAT','2026-06-18T22:00:00Z','BC Place, Vancouver'),
    ('group','B',11,'SUI','CAN','2026-06-24T19:00:00Z','BC Place, Vancouver'),
    ('group','B',12,'BIH','QAT','2026-06-24T19:00:00Z','Lumen Field, Seattle'),
    -- ── Group C ──────────────────────────────────────────────────
    ('group','C',13,'BRA','MAR','2026-06-13T22:00:00Z','MetLife Stadium, East Rutherford NJ'),
    ('group','C',14,'HAI','SCO','2026-06-14T01:00:00Z','Gillette Stadium, Foxborough MA'),
    ('group','C',15,'SCO','MAR','2026-06-19T22:00:00Z','Gillette Stadium, Foxborough MA'),
    ('group','C',16,'BRA','HAI','2026-06-20T01:00:00Z','Lincoln Financial Field, Philadelphia'),
    ('group','C',17,'SCO','BRA','2026-06-24T22:00:00Z','Hard Rock Stadium, Miami'),
    ('group','C',18,'MAR','HAI','2026-06-24T22:00:00Z','Mercedes-Benz Stadium, Atlanta'),
    -- ── Group D ──────────────────────────────────────────────────
    ('group','D',19,'USA','PAR','2026-06-13T01:00:00Z','SoFi Stadium, Los Angeles'),
    ('group','D',20,'AUS','TUR','2026-06-14T04:00:00Z','BC Place, Vancouver'),
    ('group','D',21,'USA','AUS','2026-06-19T19:00:00Z','Lumen Field, Seattle'),
    ('group','D',22,'TUR','PAR','2026-06-20T04:00:00Z','Levi''s Stadium, Santa Clara'),
    ('group','D',23,'TUR','USA','2026-06-26T02:00:00Z','SoFi Stadium, Los Angeles'),
    ('group','D',24,'PAR','AUS','2026-06-26T02:00:00Z','Levi''s Stadium, Santa Clara'),
    -- ── Group E ──────────────────────────────────────────────────
    ('group','E',25,'GER','CUW','2026-06-14T17:00:00Z','NRG Stadium, Houston'),
    ('group','E',26,'CIV','ECU','2026-06-14T23:00:00Z','Lincoln Financial Field, Philadelphia'),
    ('group','E',27,'GER','CIV','2026-06-20T20:00:00Z','BMO Field, Toronto'),
    ('group','E',28,'ECU','CUW','2026-06-21T00:00:00Z','Arrowhead Stadium, Kansas City'),
    ('group','E',29,'ECU','GER','2026-06-25T20:00:00Z','MetLife Stadium, East Rutherford NJ'),
    ('group','E',30,'CUW','CIV','2026-06-25T20:00:00Z','Lincoln Financial Field, Philadelphia'),
    -- ── Group F ──────────────────────────────────────────────────
    ('group','F',31,'NED','JPN','2026-06-14T20:00:00Z','AT&T Stadium, Arlington TX'),
    ('group','F',32,'SWE','TUN','2026-06-15T02:00:00Z','Estadio BBVA, Monterrey'),
    ('group','F',33,'NED','SWE','2026-06-20T17:00:00Z','NRG Stadium, Houston'),
    ('group','F',34,'TUN','JPN','2026-06-21T04:00:00Z','Estadio BBVA, Monterrey'),
    ('group','F',35,'JPN','SWE','2026-06-25T23:00:00Z','AT&T Stadium, Arlington TX'),
    ('group','F',36,'TUN','NED','2026-06-25T23:00:00Z','Arrowhead Stadium, Kansas City'),
    -- ── Group G ──────────────────────────────────────────────────
    ('group','G',37,'BEL','EGY','2026-06-15T19:00:00Z','Lumen Field, Seattle'),
    ('group','G',38,'IRN','NZL','2026-06-16T01:00:00Z','SoFi Stadium, Los Angeles'),
    ('group','G',39,'BEL','IRN','2026-06-21T19:00:00Z','SoFi Stadium, Los Angeles'),
    ('group','G',40,'NZL','EGY','2026-06-22T01:00:00Z','BC Place, Vancouver'),
    ('group','G',41,'EGY','IRN','2026-06-27T03:00:00Z','Lumen Field, Seattle'),
    ('group','G',42,'NZL','BEL','2026-06-27T03:00:00Z','BC Place, Vancouver'),
    -- ── Group H ──────────────────────────────────────────────────
    ('group','H',43,'ESP','CPV','2026-06-15T16:00:00Z','Mercedes-Benz Stadium, Atlanta'),
    ('group','H',44,'KSA','URU','2026-06-15T22:00:00Z','Hard Rock Stadium, Miami'),
    ('group','H',45,'ESP','KSA','2026-06-21T16:00:00Z','Mercedes-Benz Stadium, Atlanta'),
    ('group','H',46,'URU','CPV','2026-06-21T22:00:00Z','Hard Rock Stadium, Miami'),
    ('group','H',47,'CPV','KSA','2026-06-27T00:00:00Z','NRG Stadium, Houston'),
    ('group','H',48,'URU','ESP','2026-06-27T00:00:00Z','Estadio Akron, Guadalajara'),
    -- ── Group I ──────────────────────────────────────────────────
    ('group','I',49,'FRA','SEN','2026-06-16T19:00:00Z','MetLife Stadium, East Rutherford NJ'),
    ('group','I',50,'IRQ','NOR','2026-06-16T22:00:00Z','Gillette Stadium, Foxborough MA'),
    ('group','I',51,'FRA','IRQ','2026-06-22T21:00:00Z','Lincoln Financial Field, Philadelphia'),
    ('group','I',52,'NOR','SEN','2026-06-23T00:00:00Z','MetLife Stadium, East Rutherford NJ'),
    ('group','I',53,'NOR','FRA','2026-06-26T19:00:00Z','Gillette Stadium, Foxborough MA'),
    ('group','I',54,'SEN','IRQ','2026-06-26T19:00:00Z','BMO Field, Toronto'),
    -- ── Group J ──────────────────────────────────────────────────
    ('group','J',55,'ARG','ALG','2026-06-17T01:00:00Z','Arrowhead Stadium, Kansas City'),
    ('group','J',56,'AUT','JOR','2026-06-17T04:00:00Z','Levi''s Stadium, Santa Clara'),
    ('group','J',57,'ARG','AUT','2026-06-22T17:00:00Z','AT&T Stadium, Arlington TX'),
    ('group','J',58,'JOR','ALG','2026-06-23T03:00:00Z','Levi''s Stadium, Santa Clara'),
    ('group','J',59,'ALG','AUT','2026-06-28T02:00:00Z','Arrowhead Stadium, Kansas City'),
    ('group','J',60,'JOR','ARG','2026-06-28T02:00:00Z','AT&T Stadium, Arlington TX'),
    -- ── Group K ──────────────────────────────────────────────────
    ('group','K',61,'POR','COD','2026-06-17T17:00:00Z','NRG Stadium, Houston'),
    ('group','K',62,'UZB','COL','2026-06-18T02:00:00Z','Estadio Azteca, Mexico City'),
    ('group','K',63,'POR','UZB','2026-06-23T17:00:00Z','NRG Stadium, Houston'),
    ('group','K',64,'COL','COD','2026-06-24T02:00:00Z','Estadio Akron, Guadalajara'),
    ('group','K',65,'COL','POR','2026-06-27T23:30:00Z','Hard Rock Stadium, Miami'),
    ('group','K',66,'COD','UZB','2026-06-27T23:30:00Z','Mercedes-Benz Stadium, Atlanta'),
    -- ── Group L ──────────────────────────────────────────────────
    ('group','L',67,'ENG','CRO','2026-06-17T20:00:00Z','AT&T Stadium, Arlington TX'),
    ('group','L',68,'GHA','PAN','2026-06-17T23:00:00Z','BMO Field, Toronto'),
    ('group','L',69,'ENG','GHA','2026-06-23T20:00:00Z','Gillette Stadium, Foxborough MA'),
    ('group','L',70,'PAN','CRO','2026-06-23T23:00:00Z','BMO Field, Toronto'),
    ('group','L',71,'PAN','ENG','2026-06-27T21:00:00Z','MetLife Stadium, East Rutherford NJ'),
    ('group','L',72,'CRO','GHA','2026-06-27T21:00:00Z','Lincoln Financial Field, Philadelphia')
  ) AS f(stage, grp, num, home, away, ko, venue);

  -- ── 4. Insert 32 knockout fixtures (teams TBD) ────────────────
  INSERT INTO public.fixtures
    (competition_id, stage, group_name, fixture_number,
     home_team_id, away_team_id, kicks_off_at, venue)
  VALUES
    -- Round of 32 (#73–88)
    (comp_id,'r32',NULL, 73,NULL,NULL,'2026-06-28T19:00:00Z','SoFi Stadium, Los Angeles'),
    (comp_id,'r32',NULL, 74,NULL,NULL,'2026-06-29T20:30:00Z','Gillette Stadium, Foxborough MA'),
    (comp_id,'r32',NULL, 75,NULL,NULL,'2026-06-30T01:00:00Z','Estadio BBVA, Monterrey'),
    (comp_id,'r32',NULL, 76,NULL,NULL,'2026-06-29T17:00:00Z','NRG Stadium, Houston'),
    (comp_id,'r32',NULL, 77,NULL,NULL,'2026-06-30T21:00:00Z','MetLife Stadium, East Rutherford NJ'),
    (comp_id,'r32',NULL, 78,NULL,NULL,'2026-06-30T17:00:00Z','AT&T Stadium, Arlington TX'),
    (comp_id,'r32',NULL, 79,NULL,NULL,'2026-07-01T01:00:00Z','Estadio Azteca, Mexico City'),
    (comp_id,'r32',NULL, 80,NULL,NULL,'2026-07-01T16:00:00Z','Mercedes-Benz Stadium, Atlanta'),
    (comp_id,'r32',NULL, 81,NULL,NULL,'2026-07-02T00:00:00Z','Levi''s Stadium, Santa Clara'),
    (comp_id,'r32',NULL, 82,NULL,NULL,'2026-07-01T20:00:00Z','Lumen Field, Seattle'),
    (comp_id,'r32',NULL, 83,NULL,NULL,'2026-07-02T23:00:00Z','BMO Field, Toronto'),
    (comp_id,'r32',NULL, 84,NULL,NULL,'2026-07-02T19:00:00Z','SoFi Stadium, Los Angeles'),
    (comp_id,'r32',NULL, 85,NULL,NULL,'2026-07-03T03:00:00Z','BC Place, Vancouver'),
    (comp_id,'r32',NULL, 86,NULL,NULL,'2026-07-03T22:00:00Z','Hard Rock Stadium, Miami'),
    (comp_id,'r32',NULL, 87,NULL,NULL,'2026-07-04T01:30:00Z','Arrowhead Stadium, Kansas City'),
    (comp_id,'r32',NULL, 88,NULL,NULL,'2026-07-03T18:00:00Z','AT&T Stadium, Arlington TX'),
    -- Round of 16 (#89–96)
    (comp_id,'r16',NULL, 89,NULL,NULL,'2026-07-04T21:00:00Z','Lincoln Financial Field, Philadelphia'),
    (comp_id,'r16',NULL, 90,NULL,NULL,'2026-07-04T17:00:00Z','NRG Stadium, Houston'),
    (comp_id,'r16',NULL, 91,NULL,NULL,'2026-07-05T20:00:00Z','MetLife Stadium, East Rutherford NJ'),
    (comp_id,'r16',NULL, 92,NULL,NULL,'2026-07-06T00:00:00Z','Estadio Azteca, Mexico City'),
    (comp_id,'r16',NULL, 93,NULL,NULL,'2026-07-06T19:00:00Z','AT&T Stadium, Arlington TX'),
    (comp_id,'r16',NULL, 94,NULL,NULL,'2026-07-07T00:00:00Z','Lumen Field, Seattle'),
    (comp_id,'r16',NULL, 95,NULL,NULL,'2026-07-07T16:00:00Z','Mercedes-Benz Stadium, Atlanta'),
    (comp_id,'r16',NULL, 96,NULL,NULL,'2026-07-07T20:00:00Z','BC Place, Vancouver'),
    -- Quarterfinals (#97–100)
    (comp_id,'qf', NULL, 97,NULL,NULL,'2026-07-09T20:00:00Z','Gillette Stadium, Foxborough MA'),
    (comp_id,'qf', NULL, 98,NULL,NULL,'2026-07-10T19:00:00Z','SoFi Stadium, Los Angeles'),
    (comp_id,'qf', NULL, 99,NULL,NULL,'2026-07-11T21:00:00Z','Hard Rock Stadium, Miami'),
    (comp_id,'qf', NULL,100,NULL,NULL,'2026-07-12T01:00:00Z','Arrowhead Stadium, Kansas City'),
    -- Semifinals (#101–102)
    (comp_id,'sf', NULL,101,NULL,NULL,'2026-07-14T19:00:00Z','AT&T Stadium, Arlington TX'),
    (comp_id,'sf', NULL,102,NULL,NULL,'2026-07-15T19:00:00Z','Mercedes-Benz Stadium, Atlanta'),
    -- Third-place play-off (#103)
    (comp_id,'3rd',NULL,103,NULL,NULL,'2026-07-18T21:00:00Z','Hard Rock Stadium, Miami'),
    -- Final (#104)
    (comp_id,'final',NULL,104,NULL,NULL,'2026-07-19T19:00:00Z','MetLife Stadium, East Rutherford NJ');

  RAISE NOTICE 'WC2026 corrected seed complete: % teams, % fixtures',
    (SELECT count(*) FROM public.teams    WHERE competition_id = comp_id),
    (SELECT count(*) FROM public.fixtures WHERE competition_id = comp_id);

END $$;

COMMIT;
