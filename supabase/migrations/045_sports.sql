-- ============================================================
-- MIGRATION 045 — Sports, and reserving the multi-sport shape
--
-- Competition Engine V2, Phase 2.4.
--
-- ────────────────────────────────────────────────────────────
-- SCOPE — read this before extending it
-- ────────────────────────────────────────────────────────────
-- This migration does NOT implement Formula 1, cricket or rugby. It adds
-- the discriminator and RESERVES the columns those sports will need, so
-- that adding one later is additive rather than a rewrite of `predictions`.
--
-- Why not build it now: `fixtures` is home_team vs away_team and
-- `predictions` is two integers. That model is exactly right for football,
-- and the realistic next five competitions — Premier League, Champions
-- League, La Liga, Serie A, Bundesliga, Ligue 1, MLS — are all football.
-- Building a generic prediction payload before a single non-football
-- competition is scheduled would add a second, untested code path through
-- the scoring engine to serve zero users.
--
-- Why reserve it now: `prediction_type` on the fixture and a nullable
-- `payload` on the prediction cost nothing today, and their absence would
-- later force a change to the one table holding every user's entries.
-- Reserving is cheap; retrofitting is not.
--
-- NOTHING READS EITHER COLUMN. Both are inert.
--
-- DEPENDS ON: 037
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: at the foot of this file.
-- ============================================================


-- ── 1. sports ────────────────────────────────────────────────

create table if not exists public.sports (
  code                    text primary key,          -- 'football', 'cricket', 'motorsport'
  name                    text not null,
  has_draw                boolean not null default true,
  default_prediction_type text not null default 'score',
  icon                    text,
  created_at              timestamptz not null default now()
);

alter table public.sports enable row level security;

drop policy if exists "public read sports" on public.sports;
create policy "public read sports"
  on public.sports for select using (true);

insert into public.sports (code, name, has_draw, default_prediction_type, icon) values
  ('football',   'Football',   true,  'score',    '⚽'),
  ('cricket',    'Cricket',    false, 'custom',   '🏏'),
  ('motorsport', 'Motorsport', false, 'ordering', '🏎'),
  ('rugby',      'Rugby',      true,  'score',    '🏉'),
  ('basketball', 'Basketball', false, 'score',    '🏀')
on conflict (code) do nothing;

comment on table public.sports is
  'Sport discriminator. Only ''football'' is implemented end-to-end; the others '
  'are declared so a competition can be created against them without a migration.';


-- ── 2. competitions.sport_code ───────────────────────────────
-- Defaults to football so every existing row is correct without a backfill.

alter table public.competitions
  add column if not exists sport_code text not null default 'football'
  references public.sports(code) on update cascade;

create index if not exists competitions_sport_idx on public.competitions (sport_code);


-- ── 3. RESERVED — not read by any code ───────────────────────

-- How predictions for this fixture are expressed.
--   'score'    — home/away integers. The only implemented type.
--   'ordering' — finishing order (F1). Reserved.
--   'outcome'  — win/lose/draw only. Reserved.
--   'custom'   — sport-specific payload. Reserved.
alter table public.fixtures
  add column if not exists prediction_type text not null default 'score'
  check (prediction_type in ('score', 'ordering', 'outcome', 'custom'));

-- The escape hatch for non-score sports. Null for every football
-- prediction, forever. home_score/away_score remain THE columns for
-- football and are not deprecated.
alter table public.predictions
  add column if not exists payload jsonb;

comment on column public.fixtures.prediction_type is
  'RESERVED. Only ''score'' is implemented. Nothing branches on this yet.';
comment on column public.predictions.payload is
  'RESERVED for non-score sports. Null for all football predictions. '
  'home_score/away_score remain the canonical columns for football.';


insert into public.schema_migrations (version, name, notes)
values ('045', 'sports',
        'Adds sports + competitions.sport_code (default football). Reserves '
        'fixtures.prediction_type and predictions.payload — both inert.')
on conflict (version) do nothing;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table public.predictions  drop column if exists payload;
-- alter table public.fixtures     drop column if exists prediction_type;
-- alter table public.competitions drop column if exists sport_code;
-- drop table if exists public.sports;
-- ============================================================
