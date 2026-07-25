-- ============================================================
-- VERIFY 047 + 048 — hierarchy integrity and configurable economy
--
-- READ-ONLY. Safe to run at any time.
--
-- Run blocks A–C BEFORE migration 047 (they tell you whether the trigger
-- will reject anything that already exists), and blocks D–F before and
-- after migration 048 (they must be identical).
-- ============================================================


\echo '=== BLOCK A — hierarchy completeness (before 047) ==='
-- Migration 047 exempts LEGACY fixtures — those with neither a season nor a
-- round. Anything with one but not the other would be rejected on its next
-- update, so find those now.

select
  c.slug,
  count(*)                                                    as fixtures,
  count(f.season_id)                                          as with_season,
  count(f.round_id)                                           as with_round,
  count(*) filter (where f.season_id is null and f.round_id is null)  as legacy_exempt,
  count(*) filter (where (f.season_id is null) <> (f.round_id is null)) as ⚠_half_assigned
from public.fixtures f
join public.competitions c on c.id = f.competition_id
group by c.slug
order by c.slug;
-- EXPECTED after 041+042: wc2026 → fixtures = with_season = with_round = 104,
-- legacy_exempt = 0, half_assigned = 0.
-- Any half_assigned row must be fixed BEFORE 047 is applied.


\echo '=== BLOCK B — cross-level violations (MUST be zero rows) ==='
-- The invariants a foreign key cannot express. If any row appears here,
-- migration 047 is correct to reject it and the data is genuinely wrong.

-- B1: fixture's season belongs to a different competition
select 'season_competition_mismatch' as violation,
       f.id as fixture_id, f.competition_id, s.competition_id as season_competition
from public.fixtures f
join public.seasons s on s.id = f.season_id
where s.competition_id <> f.competition_id;

-- B2: fixture's round belongs to a different season
select 'round_season_mismatch' as violation,
       f.id as fixture_id, f.season_id, r.season_id as round_season
from public.fixtures f
join public.rounds r on r.id = f.round_id
where r.season_id <> f.season_id;

-- B3: season_teams linking a team to another competition's season
select 'season_team_mismatch' as violation,
       st.season_id, st.team_id, t.competition_id as team_competition, s.competition_id as season_competition
from public.season_teams st
join public.teams   t on t.id = st.team_id
join public.seasons s on s.id = st.season_id
where t.competition_id <> s.competition_id;

-- B4: a completed season still flagged current
select 'completed_season_is_current' as violation, slug, status
from public.seasons
where is_current and status in ('completed', 'archived');


\echo '=== BLOCK C — the hierarchy, top to bottom ==='
-- Sport → Competition → Season → Round → Fixture, counted at each level.
-- A zero anywhere below a non-zero is a half-built competition.

select
  sport_code,
  competition_slug,
  count(distinct season_id) as seasons,
  count(distinct round_id)  as rounds,
  count(fixture_id)         as fixtures
from public.v_competition_hierarchy
group by sport_code, competition_slug
order by sport_code, competition_slug;


\echo '=== BLOCK D — IQ minted per competition (before AND after 048) ==='
-- The zero-delta check for migration 048. competition_economy_rules ships
-- EMPTY, so every competition must resolve to the same global amounts and
-- these totals must not move.

select
  c.slug,
  count(*)                as ledger_rows,
  sum(l.delta)            as net_iq,
  count(distinct l.user_id) as users
from public.economy_ledger l
join public.predictions p  on p.id::text = l.source_ref
join public.fixtures f     on f.id = p.fixture_id
join public.competitions c on c.id = f.competition_id
where l.event_code = 'prediction_score'
group by c.slug
order by c.slug;


\echo '=== BLOCK E — resolved amounts match the global map (after 048) ==='
-- economy_resolve_amount must return exactly economy_event_types.amount_map
-- for every competition while no rules exist.

select
  c.slug,
  b.bucket,
  (et.amount_map ->> b.bucket)::bigint                                   as global_amount,
  public.economy_resolve_amount(c.id, 'prediction_score', b.bucket)      as resolved,
  case
    when (et.amount_map ->> b.bucket)::bigint
       = public.economy_resolve_amount(c.id, 'prediction_score', b.bucket)
    then 'OK' else '🔴 DIFFERS'
  end as verdict
from public.competitions c
cross join (values ('5'), ('3'), ('2'), ('0')) as b(bucket)
cross join public.economy_event_types et
where et.code = 'prediction_score'
order by c.slug, b.bucket desc;
-- EXPECTED: every row OK, unless a competition_economy_rules row exists
-- for that competition — in which case DIFFERS is intended and the rule
-- should explain it.


\echo '=== BLOCK F — any economy rules configured? ==='
-- Empty is the zero-delta state. Every row here is a deliberate tuning
-- decision and should be traceable to one.

select
  c.slug, r.event_code, r.multiplier, r.enabled, r.amount_map, r.notes, r.updated_at
from public.competition_economy_rules r
join public.competitions c on c.id = r.competition_id
order by c.slug, r.event_code;
-- EXPECTED immediately after migration 048: zero rows.


\echo '=== BLOCK G — reserved-slug collisions ==='
-- A competition whose slug shadows an application route is permanently
-- unreachable: Next.js resolves static segments first.

select slug, name,
       '🔴 UNREACHABLE — collides with an app route' as problem
from public.competitions
where slug in (
  'admin','api','auth','login','logout','signup','settings','profile','u',
  'tests','test','battle','economy','iq','network','achievements','leaderboard',
  'results','share','challenge','welcome','predict','privacy','terms','contact',
  'disclaimer','forgot-password','reset-password','_next','static','favicon.ico'
);
-- EXPECTED: zero rows. admin_create_competition rejects these, but a
-- competition inserted by hand in SQL bypasses that check.


\echo '=== BLOCK H — exactly one default competition ==='

select count(*) as default_competitions
from public.competition_settings
where key = 'is_default' and value = 'true'::jsonb;
-- EXPECTED: exactly 1. Zero means /predict has nowhere to redirect;
-- more than one is prevented by a unique index but check anyway.
