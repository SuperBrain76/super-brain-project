-- ============================================================
-- VERIFY 039 — provider fixture id backfill
--
-- READ-ONLY.
--
-- 🔴 GATE: every block below must pass BEFORE you apply PART 2 of
--    migration 039 (the unique index). Applying it against a partial or
--    duplicated mapping either fails outright or locks in a bad mapping.
--
-- Replace 'wc2026' with the competition you are verifying.
-- ============================================================

\set comp_slug 'wc2026'


\echo '=== BLOCK A — coverage: mapped vs total (must be equal) ==='

select
  c.slug,
  count(*)                                              as total_fixtures,
  count(f.provider_fixture_id)                          as mapped,
  count(*) - count(f.provider_fixture_id)               as unmapped,
  round(100.0 * count(f.provider_fixture_id) / nullif(count(*), 0), 1) as pct_mapped
from public.fixtures f
join public.competitions c on c.id = f.competition_id
where c.slug = :'comp_slug'
group by c.slug;
-- EXPECTED for wc2026: total_fixtures = 104, mapped = 104, unmapped = 0.
-- Anything less is investigated BY HAND. Never force it.


\echo '=== BLOCK B — duplicates (MUST be zero rows) ==='
-- Two fixtures sharing a provider id means two of our fixtures were mapped
-- to the same real match. The unique index would reject this; find it here
-- first, where the error message is readable.

select
  f.provider,
  f.provider_fixture_id,
  count(*)                     as fixture_count,
  string_agg(f.id::text, ', ') as fixture_ids
from public.fixtures f
join public.competitions c on c.id = f.competition_id
where c.slug = :'comp_slug'
  and f.provider_fixture_id is not null
group by f.provider, f.provider_fixture_id
having count(*) > 1;


\echo '=== BLOCK C — the unmapped fixtures, named ==='
-- The work list. Each row needs a provider id assigned by hand, or an
-- explanation of why it has none (e.g. a knockout slot never played).

select
  f.fixture_number,
  f.stage,
  coalesce(ht.name, 'TBD') as home_team,
  coalesce(at.name, 'TBD') as away_team,
  f.kicks_off_at,
  f.status
from public.fixtures f
join public.competitions c on c.id = f.competition_id
left join public.teams ht on ht.id = f.home_team_id
left join public.teams at on at.id = f.away_team_id
where c.slug = :'comp_slug'
  and f.provider_fixture_id is null
order by f.fixture_number;


\echo '=== BLOCK D — simultaneous kickoffs (the risk being retired) ==='
-- Groups of fixtures sharing a kickoff slot. For each group with more than
-- one fixture, the OLD ±90-minute matcher could route a result to any
-- member. Every fixture in these groups MUST be mapped.

select
  f.kicks_off_at,
  count(*)                                    as fixtures_at_this_time,
  count(f.provider_fixture_id)                as mapped,
  case when count(*) = count(f.provider_fixture_id)
       then 'OK'
       else '🔴 UNSAFE — unmapped fixture in a shared kickoff slot'
  end                                         as verdict
from public.fixtures f
join public.competitions c on c.id = f.competition_id
where c.slug = :'comp_slug'
group by f.kicks_off_at
having count(*) > 1
order by f.kicks_off_at;


\echo '=== BLOCK E — cross-competition collision check ==='
-- provider_fixture_id is unique across the WHOLE table, not per
-- competition, because a provider id is globally unique at the provider.
-- Two competitions claiming the same id means one is misconfigured
-- (usually a wrong provider_league_id).

select f.provider, f.provider_fixture_id,
       string_agg(distinct c.slug, ', ') as competitions
from public.fixtures f
join public.competitions c on c.id = f.competition_id
where f.provider_fixture_id is not null
group by f.provider, f.provider_fixture_id
having count(distinct c.id) > 1;
-- EXPECTED: zero rows.


\echo '=== BLOCK F — is the unique index already in place? ==='

select indexname, indexdef
from pg_indexes
where tablename = 'fixtures'
  and indexname in ('fixtures_provider_uniq_idx', 'fixtures_provider_lookup_idx');
-- After 039 part 1: only fixtures_provider_lookup_idx.
-- After 039 part 2: both.
