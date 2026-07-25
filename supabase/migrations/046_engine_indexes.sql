-- ============================================================
-- MIGRATION 046 — Indexes for multi-competition scale
--
-- Competition Engine V2, Phase 2 close-out.
--
-- ────────────────────────────────────────────────────────────
-- WHY
-- ────────────────────────────────────────────────────────────
-- Every query in the predictor was written against ONE competition of 104
-- fixtures. The shape it now has to serve:
--
--   World Cup           104 fixtures   (historical, still queried)
--   Premier League      380 fixtures   (per season)
--   + Champions League, La Liga, …     (simultaneously)
--
-- and leaderboards gain THREE windows (round / month / season) where there
-- was one. The leaderboard RPCs aggregate over every prediction joined to
-- every fixture on each call, with no pagination — so the join keys are
-- what decide whether this stays viable.
--
-- ────────────────────────────────────────────────────────────
-- HONEST CAVEAT
-- ────────────────────────────────────────────────────────────
-- These indexes are reasoned from row counts and query shapes, NOT from
-- measurement — there is no load-test harness and no production access
-- from which to read a plan. They are cheap, additive and individually
-- droppable. Before adding anything further (and certainly before
-- materialising leaderboard totals), MEASURE: run EXPLAIN ANALYZE on
-- get_predictor_leaderboard with realistic data. Do not build a cache for
-- a problem that has not appeared.
--
-- `concurrently` is deliberately NOT used: these run during a maintenance
-- window on tables that are not being written to, and `concurrently`
-- cannot run inside the transaction the SQL editor wraps around a script.
-- If applying to a busy database, split each statement out and add it.
--
-- DEPENDS ON: 042, 045
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: drop the indexes. Nothing depends on them for correctness.
-- ============================================================


-- ── Predictions ──────────────────────────────────────────────

-- The leaderboard join: predictions → fixtures, aggregating points.
-- Covering, so the aggregate can be answered without touching the heap.
create index if not exists predictions_fixture_user_points_idx
  on public.predictions (fixture_id, user_id)
  include (points_awarded);

-- "My predictions in this competition", and the per-user stat card.
create index if not exists predictions_user_fixture_idx
  on public.predictions (user_id, fixture_id)
  include (points_awarded);

-- Scored predictions only — the leaderboard's actual working set. Partial,
-- so it stays small: unscored future fixtures are excluded entirely.
create index if not exists predictions_scored_idx
  on public.predictions (fixture_id, points_awarded)
  where points_awarded is not null;


-- ── Fixtures ─────────────────────────────────────────────────

-- Season + round + kickoff: round leaderboards, matchweek fixture lists,
-- and the monthly window (a range scan on kicks_off_at within a season).
-- Also created in 042; repeated here so this file stands alone.
create index if not exists fixtures_season_round_kickoff_idx
  on public.fixtures (season_id, round_id, kicks_off_at);

-- The ingestion window query: fixtures for a competition within ±3h.
create index if not exists fixtures_comp_kickoff_status_idx
  on public.fixtures (competition_id, kicks_off_at, status);

-- Stuck-fixture sweep: live/postponed rows outside the window. Partial —
-- matches a handful of rows out of thousands.
create index if not exists fixtures_unresolved_idx
  on public.fixtures (competition_id, status)
  where status in ('live', 'postponed');


-- ── Bonus predictions ────────────────────────────────────────
-- Migration 038 resolves bonus points through a correlated subquery on
-- (user_id, question_id). This is that subquery's index.

create index if not exists bonus_predictions_user_question_idx
  on public.bonus_predictions (user_id, question_id)
  include (points_awarded);

create index if not exists bonus_questions_comp_id_idx
  on public.bonus_questions (competition_id, id);


-- ── League membership ────────────────────────────────────────
-- get_league_leaderboard walks members → predictions per member.

create index if not exists league_members_league_user_idx
  on public.prediction_league_members (league_id, user_id);

-- "Which leagues am I in?" — currently filtered client-side in
-- lib/predictor.ts getMyLeagues(), which becomes a real cost once a user
-- belongs to leagues across several competitions.
create index if not exists league_members_user_league_idx
  on public.prediction_league_members (user_id, league_id);


-- ── Statistics ───────────────────────────────────────────────
-- The planner will keep choosing sequential scans on stale statistics,
-- which is exactly the wrong choice once these tables have grown.

analyze public.predictions;
analyze public.fixtures;
analyze public.bonus_predictions;
analyze public.prediction_league_members;


insert into public.schema_migrations (version, name, notes)
values ('046', 'engine_indexes',
        'Covering + partial indexes for multi-competition leaderboards, round '
        'windows and ingestion. Reasoned from query shape, NOT measured — '
        'run EXPLAIN ANALYZE before adding more.')
on conflict (version) do nothing;
