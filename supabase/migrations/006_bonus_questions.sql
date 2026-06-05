-- ============================================================
-- MIGRATION 006 — Bonus Questions (revised)
--
-- Six tournament-wide predictions that award bonus points.
-- Key improvements over initial version:
--   • locks_at column: questions auto-lock at competition start
--   • upsert RPC enforces time-based lock at DB level (no manual
--     admin action required before kickoff)
--   • match_points returned separately from bonus_points in all
--     leaderboard RPCs for full transparency
--   • get_my_predictor_stats returns bonus_answered + bonus_total
--     for completion tracking
--
-- Depends on: predictor-schema.sql, 003, 004, 005
-- Safe to re-run (idempotent guards throughout).
-- ============================================================


-- ── 1. Bonus questions table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bonus_questions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      uuid        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  question_key        text        NOT NULL,
  question_text       text        NOT NULL,
  points_value        integer     NOT NULL CHECK (points_value > 0),
  answer_type         text        NOT NULL
                      CHECK (answer_type IN ('team', 'player')),
  status              text        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'locked', 'answered')),
  -- locks_at: predictions are rejected at DB level once now() >= locks_at,
  -- regardless of status. Defaults to competition start time at seed.
  -- Admin lock button sets status='locked' and may be used as an override
  -- before this deadline, but the time-based check always takes precedence.
  locks_at            timestamptz NOT NULL,
  correct_team_id     uuid        REFERENCES public.teams(id),
  correct_answer_text text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, question_key)
);

CREATE INDEX IF NOT EXISTS bonus_questions_competition_idx
  ON public.bonus_questions (competition_id);

ALTER TABLE public.bonus_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read bonus questions" ON public.bonus_questions;
CREATE POLICY "public read bonus questions"
  ON public.bonus_questions FOR SELECT USING (true);


-- ── 2. Bonus predictions table ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.bonus_predictions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id     uuid        NOT NULL REFERENCES public.bonus_questions(id) ON DELETE CASCADE,
  answer_team_id  uuid        REFERENCES public.teams(id),
  answer_text     text,
  points_awarded  integer,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS bonus_predictions_user_idx     ON public.bonus_predictions (user_id);
CREATE INDEX IF NOT EXISTS bonus_predictions_question_idx ON public.bonus_predictions (question_id);

ALTER TABLE public.bonus_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own bonus predictions"   ON public.bonus_predictions;
DROP POLICY IF EXISTS "users insert own bonus predictions" ON public.bonus_predictions;
DROP POLICY IF EXISTS "users update own bonus predictions" ON public.bonus_predictions;

CREATE POLICY "users read own bonus predictions"
  ON public.bonus_predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own bonus predictions"
  ON public.bonus_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own bonus predictions"
  ON public.bonus_predictions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 3. Seed six questions for FIFA World Cup 2026 ────────────
--
-- Surprise Team definition:
--   "Highest finishing team ranked outside the FIFA Top 20 rankings
--    immediately before the tournament begins."
--
-- locks_at is set to competition.starts_at (tournament kickoff).
-- All predictions are automatically locked at this moment.

DO $$
DECLARE
  v_comp record;
BEGIN
  SELECT id, starts_at INTO v_comp
  FROM public.competitions WHERE slug = 'wc2026';

  IF v_comp.id IS NULL THEN
    RAISE NOTICE 'wc2026 competition not found — skipping bonus question seed.';
    RETURN;
  END IF;

  IF v_comp.starts_at IS NULL THEN
    RAISE EXCEPTION 'competitions.starts_at is NULL for wc2026. Set it before seeding bonus questions.';
  END IF;

  INSERT INTO public.bonus_questions
    (competition_id, question_key, question_text, points_value, answer_type, locks_at)
  VALUES
    (v_comp.id, 'winner',
      'World Cup Winner',
      20, 'team', v_comp.starts_at),
    (v_comp.id, 'runner_up',
      'Runner Up',
      10, 'team', v_comp.starts_at),
    (v_comp.id, 'golden_boot',
      'Golden Boot Winner',
      15, 'player', v_comp.starts_at),
    (v_comp.id, 'most_goals',
      'Team Scoring Most Goals',
      10, 'team', v_comp.starts_at),
    (v_comp.id, 'best_defence',
      'Team Conceding Fewest Goals',
      10, 'team', v_comp.starts_at),
    (v_comp.id, 'surprise_team',
      'Surprise Team',
      10, 'team', v_comp.starts_at)
  ON CONFLICT (competition_id, question_key) DO NOTHING;

  RAISE NOTICE 'Bonus questions seeded for wc2026 (locks at %).',
    v_comp.starts_at;
END;
$$;


-- ── 4. User upsert RPC ────────────────────────────────────────
--
-- Double-gated: rejects if status != 'open' OR now() >= locks_at.
-- If locks_at has passed and status is still 'open', auto-sets
-- status='locked' as a self-healing side effect.
-- No manual admin action is required to lock questions at kickoff.

CREATE OR REPLACE FUNCTION public.upsert_bonus_prediction(
  p_question_id  uuid,
  p_team_id      uuid  DEFAULT NULL,
  p_answer_text  text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to predict.';
  END IF;

  SELECT * INTO v_q
  FROM public.bonus_questions WHERE id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bonus question not found.';
  END IF;

  -- ── Time-based auto-lock (takes precedence over status) ─────
  IF now() >= v_q.locks_at THEN
    -- Auto-set status='locked' if it hasn't been set yet
    IF v_q.status = 'open' THEN
      UPDATE public.bonus_questions SET status = 'locked'
      WHERE id = p_question_id;
    END IF;
    RAISE EXCEPTION 'Predictions are locked — the tournament has started.';
  END IF;

  -- ── Manual status check ──────────────────────────────────────
  IF v_q.status != 'open' THEN
    RAISE EXCEPTION 'Predictions are no longer accepted for this question.';
  END IF;

  INSERT INTO public.bonus_predictions
    (user_id, question_id, answer_team_id, answer_text)
  VALUES
    (auth.uid(), p_question_id, p_team_id, p_answer_text)
  ON CONFLICT (user_id, question_id) DO UPDATE SET
    answer_team_id = EXCLUDED.answer_team_id,
    answer_text    = EXCLUDED.answer_text,
    updated_at     = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_bonus_prediction TO authenticated;


-- ── 5. Admin: lock a question ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_lock_bonus_question(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required.';
  END IF;
  UPDATE public.bonus_questions
  SET status = 'locked'
  WHERE id = p_question_id AND status = 'open';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_lock_bonus_question TO authenticated;


-- ── 6. Admin: set answer + score all predictions ──────────────

CREATE OR REPLACE FUNCTION public.admin_set_bonus_answer(
  p_question_id      uuid,
  p_team_id          uuid  DEFAULT NULL,
  p_answer_text      text  DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q            record;
  v_scored_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required.';
  END IF;

  SELECT * INTO v_q FROM public.bonus_questions WHERE id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bonus question not found.'; END IF;

  IF v_q.answer_type = 'team'   AND p_team_id IS NULL THEN
    RAISE EXCEPTION 'A team answer is required for this question.';
  END IF;
  IF v_q.answer_type = 'player'
  AND (p_answer_text IS NULL OR trim(p_answer_text) = '') THEN
    RAISE EXCEPTION 'A player name is required for this question.';
  END IF;

  UPDATE public.bonus_questions
  SET
    correct_team_id     = p_team_id,
    correct_answer_text = CASE
      WHEN p_answer_text IS NOT NULL THEN lower(trim(p_answer_text))
      ELSE NULL
    END,
    status = 'answered'
  WHERE id = p_question_id;

  UPDATE public.bonus_predictions
  SET
    points_awarded = CASE
      WHEN v_q.answer_type = 'team'
        AND answer_team_id = p_team_id
        THEN v_q.points_value
      WHEN v_q.answer_type = 'player'
        AND lower(trim(answer_text)) = lower(trim(p_answer_text))
        THEN v_q.points_value
      ELSE 0
    END,
    updated_at = now()
  WHERE question_id = p_question_id;

  GET DIAGNOSTICS v_scored_count = ROW_COUNT;
  RETURN v_scored_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_bonus_answer TO authenticated;


-- ── 7. Global leaderboard — with match_points + bonus_points ──
--
-- Returns match_points and bonus_points separately for transparency,
-- plus total_points (sum of both) for ranking.

CREATE OR REPLACE FUNCTION public.get_predictor_leaderboard(
  p_competition_id uuid
)
RETURNS TABLE (
  rank         bigint,
  display_name text,
  country      text,
  total_points bigint,
  match_points bigint,
  bonus_points bigint,
  predictions  bigint,
  exact_scores bigint
)
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  WITH match_pts AS (
    SELECT
      p.user_id,
      coalesce(sum(p.points_awarded), 0)               AS pts,
      count(p.id)                                       AS preds,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)  AS exacts
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
      AND p.points_awarded IS NOT NULL
    GROUP BY p.user_id
  ),
  bonus_pts AS (
    SELECT
      bp.user_id,
      coalesce(sum(bp.points_awarded), 0) AS pts
    FROM public.bonus_predictions bp
    JOIN public.bonus_questions bq ON bq.id = bp.question_id
    WHERE bq.competition_id = p_competition_id
      AND bp.points_awarded IS NOT NULL
    GROUP BY bp.user_id
  )
  SELECT
    row_number() OVER (
      ORDER BY (mp.pts + coalesce(bo.pts, 0)) DESC,
               mp.exacts DESC
    )                                                         AS rank,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous') AS display_name,
    pr.country,
    mp.pts + coalesce(bo.pts, 0)                              AS total_points,
    mp.pts                                                     AS match_points,
    coalesce(bo.pts, 0)                                        AS bonus_points,
    mp.preds                                                   AS predictions,
    mp.exacts                                                  AS exact_scores
  FROM match_pts mp
  JOIN public.user_profiles pr ON pr.id = mp.user_id
  LEFT JOIN bonus_pts bo       ON bo.user_id = mp.user_id
  ORDER BY total_points DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.get_predictor_leaderboard TO anon, authenticated;


-- ── 8. League leaderboard — with match_points + bonus_points ──
-- Preserves the membership check from migration 005.

CREATE OR REPLACE FUNCTION public.get_league_leaderboard(p_league_id uuid)
RETURNS TABLE (
  rank         bigint,
  user_id      uuid,
  display_name text,
  country      text,
  total_points bigint,
  match_points bigint,
  bonus_points bigint,
  predictions  bigint,
  exact_scores bigint
)
LANGUAGE plpgsql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.prediction_league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you must be a member of this league to view its leaderboard.';
  END IF;

  RETURN QUERY
  WITH league_comp AS (
    SELECT competition_id FROM public.prediction_leagues WHERE id = p_league_id
  ),
  member_ids AS (
    SELECT user_id FROM public.prediction_league_members WHERE league_id = p_league_id
  ),
  match_pts AS (
    SELECT
      p.user_id,
      coalesce(sum(p.points_awarded), 0)               AS pts,
      count(p.id)                                       AS preds,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)  AS exacts
    FROM public.predictions p
    JOIN public.fixtures f
      ON f.id = p.fixture_id
     AND f.competition_id = (SELECT competition_id FROM league_comp)
    WHERE p.points_awarded IS NOT NULL
      AND p.user_id IN (SELECT user_id FROM member_ids)
    GROUP BY p.user_id
  ),
  bonus_pts AS (
    SELECT
      bp.user_id,
      coalesce(sum(bp.points_awarded), 0) AS pts
    FROM public.bonus_predictions bp
    JOIN public.bonus_questions bq
      ON bq.id = bp.question_id
     AND bq.competition_id = (SELECT competition_id FROM league_comp)
    WHERE bp.points_awarded IS NOT NULL
      AND bp.user_id IN (SELECT user_id FROM member_ids)
    GROUP BY bp.user_id
  )
  SELECT
    row_number() OVER (
      ORDER BY (coalesce(mp.pts,0) + coalesce(bo.pts,0)) DESC
    )                                                         AS rank,
    m.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous') AS display_name,
    pr.country,
    coalesce(mp.pts,0) + coalesce(bo.pts,0)                  AS total_points,
    coalesce(mp.pts,0)                                        AS match_points,
    coalesce(bo.pts,0)                                        AS bonus_points,
    coalesce(mp.preds,0)                                      AS predictions,
    coalesce(mp.exacts,0)                                     AS exact_scores
  FROM member_ids m
  JOIN public.user_profiles pr ON pr.id = m.user_id
  LEFT JOIN match_pts mp ON mp.user_id = m.user_id
  LEFT JOIN bonus_pts bo ON bo.user_id = m.user_id
  ORDER BY total_points DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_leaderboard TO authenticated;


-- ── 9. My stats — with match_points, bonus_answered, bonus_total
--
-- bonus_answered = how many bonus questions the user has submitted
-- bonus_total    = total bonus questions in this competition
-- Both are used for completion tracking in the UI.

CREATE OR REPLACE FUNCTION public.get_my_predictor_stats(
  p_competition_id uuid
)
RETURNS TABLE (
  total_points   bigint,
  match_points   bigint,
  bonus_points   bigint,
  predictions    bigint,
  exact_scores   bigint,
  global_rank    bigint,
  bonus_answered bigint,
  bonus_total    bigint
)
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  WITH all_totals AS (
    SELECT
      p.user_id,
      coalesce(sum(p.points_awarded), 0)
      + coalesce((
          SELECT sum(bp2.points_awarded)
          FROM public.bonus_predictions bp2
          JOIN public.bonus_questions bq2 ON bq2.id = bp2.question_id
          WHERE bq2.competition_id = p_competition_id
            AND bp2.user_id = p.user_id
            AND bp2.points_awarded IS NOT NULL
        ), 0) AS total
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
      AND p.points_awarded IS NOT NULL
    GROUP BY p.user_id
  ),
  my_match AS (
    SELECT
      coalesce(sum(p.points_awarded), 0)               AS pts,
      -- count ALL submitted predictions (not just scored) for completion tracking
      count(p.id)                                       AS preds,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)  AS exacts
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
      AND p.user_id = auth.uid()
  ),
  my_bonus AS (
    SELECT
      coalesce(sum(bp.points_awarded), 0) AS pts,
      count(bp.id)                         AS answered
    FROM public.bonus_predictions bp
    JOIN public.bonus_questions bq ON bq.id = bp.question_id
    WHERE bq.competition_id = p_competition_id
      AND bp.user_id = auth.uid()
  ),
  bonus_count AS (
    SELECT count(*) AS total
    FROM public.bonus_questions
    WHERE competition_id = p_competition_id
  )
  SELECT
    mm.pts + mb.pts                                                     AS total_points,
    mm.pts                                                              AS match_points,
    mb.pts                                                              AS bonus_points,
    mm.preds                                                            AS predictions,
    mm.exacts                                                           AS exact_scores,
    (SELECT count(*)+1 FROM all_totals WHERE total > mm.pts + mb.pts)   AS global_rank,
    mb.answered                                                         AS bonus_answered,
    bc.total                                                            AS bonus_total
  FROM my_match mm, my_bonus mb, bonus_count bc;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_predictor_stats TO authenticated;


DO $$
BEGIN
  RAISE NOTICE 'Migration 006 applied:';
  RAISE NOTICE '  - bonus_questions table (with locks_at column)';
  RAISE NOTICE '  - bonus_predictions table + RLS';
  RAISE NOTICE '  - 6 questions seeded for wc2026 (locks at tournament start)';
  RAISE NOTICE '  - upsert_bonus_prediction(): double-gated (status + time)';
  RAISE NOTICE '  - admin_lock_bonus_question(): manual override';
  RAISE NOTICE '  - admin_set_bonus_answer(): sets answer + scores predictions';
  RAISE NOTICE '  - get_predictor_leaderboard(): + match_points column';
  RAISE NOTICE '  - get_league_leaderboard(): + match_points column';
  RAISE NOTICE '  - get_my_predictor_stats(): + match_points, bonus_answered, bonus_total';
END;
$$;
