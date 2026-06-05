-- ============================================================
-- MIGRATION 006 — Bonus Questions
--
-- Adds the bonus prediction system: six tournament-wide questions
-- (Winner, Runner Up, Golden Boot, Most Goals, Best Defence,
-- Surprise Team) that award bonus points on top of match scores.
--
-- Depends on: predictor-schema.sql, 003, 004, 005
-- Safe to re-run (idempotent guards throughout).
-- ============================================================


-- ── 1. Bonus questions ───────────────────────────────────────
-- One row per question per competition. Admin sets the correct
-- answer here once the tournament ends; the scoring RPC reads it.

CREATE TABLE IF NOT EXISTS public.bonus_questions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id      uuid        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  question_key        text        NOT NULL,   -- 'winner' | 'runner_up' | 'golden_boot' | ...
  question_text       text        NOT NULL,
  points_value        integer     NOT NULL CHECK (points_value > 0),
  answer_type         text        NOT NULL    -- 'team' | 'player'
                      CHECK (answer_type IN ('team', 'player')),
  status              text        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'locked', 'answered')),
  correct_team_id     uuid        REFERENCES public.teams(id),   -- set by admin
  correct_answer_text text,                   -- for player-type answers (stored lowercase)
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, question_key)
);

CREATE INDEX IF NOT EXISTS bonus_questions_competition_idx
  ON public.bonus_questions (competition_id);

ALTER TABLE public.bonus_questions ENABLE ROW LEVEL SECURITY;

-- Anyone can read questions and status (shows lock state, not answers until status='answered')
DROP POLICY IF EXISTS "public read bonus questions" ON public.bonus_questions;
CREATE POLICY "public read bonus questions"
  ON public.bonus_questions FOR SELECT USING (true);


-- ── 2. Bonus predictions ─────────────────────────────────────
-- One row per (user, question). Locks when question.status != 'open'.

CREATE TABLE IF NOT EXISTS public.bonus_predictions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id     uuid        NOT NULL REFERENCES public.bonus_questions(id) ON DELETE CASCADE,
  answer_team_id  uuid        REFERENCES public.teams(id),   -- for 'team' questions
  answer_text     text,                                       -- for 'player' questions
  points_awarded  integer,                                    -- null until question answered
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS bonus_predictions_user_idx
  ON public.bonus_predictions (user_id);
CREATE INDEX IF NOT EXISTS bonus_predictions_question_idx
  ON public.bonus_predictions (question_id);

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

DO $$
DECLARE
  v_comp_id uuid;
BEGIN
  SELECT id INTO v_comp_id FROM public.competitions WHERE slug = 'wc2026';
  IF v_comp_id IS NULL THEN
    RAISE NOTICE 'wc2026 competition not found — skipping bonus question seed.';
    RETURN;
  END IF;

  INSERT INTO public.bonus_questions
    (competition_id, question_key, question_text, points_value, answer_type)
  VALUES
    (v_comp_id, 'winner',        'World Cup Winner',                     20, 'team'),
    (v_comp_id, 'runner_up',     'Runner Up',                            10, 'team'),
    (v_comp_id, 'golden_boot',   'Golden Boot Winner',                   15, 'player'),
    (v_comp_id, 'most_goals',    'Team Scoring Most Goals',              10, 'team'),
    (v_comp_id, 'best_defence',  'Team Conceding Fewest Goals',          10, 'team'),
    (v_comp_id, 'surprise_team', 'Surprise Team of the Tournament',      10, 'team')
  ON CONFLICT (competition_id, question_key) DO NOTHING;

  RAISE NOTICE 'Bonus questions seeded for wc2026.';
END;
$$;


-- ── 4. User upsert RPC ────────────────────────────────────────
-- Validates status = 'open' before allowing a prediction.

CREATE OR REPLACE FUNCTION public.upsert_bonus_prediction(
  p_question_id  uuid,
  p_team_id      uuid    DEFAULT NULL,
  p_answer_text  text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to predict.';
  END IF;

  SELECT status INTO v_status
  FROM public.bonus_questions WHERE id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bonus question not found.';
  END IF;

  IF v_status <> 'open' THEN
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
-- Returns the number of predictions scored.
-- Can be called again with corrected values — idempotent rescore.

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

  IF v_q.answer_type = 'team' AND p_team_id IS NULL THEN
    RAISE EXCEPTION 'A team answer is required for this question.';
  END IF;
  IF v_q.answer_type = 'player'
  AND (p_answer_text IS NULL OR trim(p_answer_text) = '') THEN
    RAISE EXCEPTION 'A player name is required for this question.';
  END IF;

  -- Write correct answer
  UPDATE public.bonus_questions
  SET
    correct_team_id     = p_team_id,
    correct_answer_text = CASE
      WHEN p_answer_text IS NOT NULL THEN lower(trim(p_answer_text))
      ELSE NULL
    END,
    status = 'answered'
  WHERE id = p_question_id;

  -- Score all predictions for this question
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


-- ── 7. Updated get_predictor_leaderboard (includes bonus) ─────

CREATE OR REPLACE FUNCTION public.get_predictor_leaderboard(
  p_competition_id uuid
)
RETURNS TABLE (
  rank         bigint,
  display_name text,
  country      text,
  total_points bigint,
  predictions  bigint,
  exact_scores bigint,
  bonus_points bigint
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
    )                                                              AS rank,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous')      AS display_name,
    pr.country,
    mp.pts + coalesce(bo.pts, 0)                                   AS total_points,
    mp.preds                                                        AS predictions,
    mp.exacts                                                       AS exact_scores,
    coalesce(bo.pts, 0)                                             AS bonus_points
  FROM match_pts mp
  JOIN public.user_profiles pr ON pr.id = mp.user_id
  LEFT JOIN bonus_pts bo       ON bo.user_id = mp.user_id
  ORDER BY total_points DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.get_predictor_leaderboard TO anon, authenticated;


-- ── 8. Updated get_league_leaderboard (includes bonus) ────────
-- Preserves the membership check from migration 005.

CREATE OR REPLACE FUNCTION public.get_league_leaderboard(p_league_id uuid)
RETURNS TABLE (
  rank         bigint,
  user_id      uuid,
  display_name text,
  country      text,
  total_points bigint,
  predictions  bigint,
  exact_scores bigint,
  bonus_points bigint
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
    JOIN public.fixtures f ON f.id = p.fixture_id AND f.competition_id = (SELECT competition_id FROM league_comp)
    WHERE p.points_awarded IS NOT NULL
      AND p.user_id IN (SELECT user_id FROM member_ids)
    GROUP BY p.user_id
  ),
  bonus_pts AS (
    SELECT
      bp.user_id,
      coalesce(sum(bp.points_awarded), 0) AS pts
    FROM public.bonus_predictions bp
    JOIN public.bonus_questions bq ON bq.id = bp.question_id
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
    coalesce(mp.preds,0)                                      AS predictions,
    coalesce(mp.exacts,0)                                     AS exact_scores,
    coalesce(bo.pts,0)                                        AS bonus_points
  FROM member_ids m
  JOIN public.user_profiles pr ON pr.id = m.user_id
  LEFT JOIN match_pts mp ON mp.user_id = m.user_id
  LEFT JOIN bonus_pts bo ON bo.user_id = m.user_id
  ORDER BY total_points DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_leaderboard TO authenticated;


-- ── 9. Updated get_my_predictor_stats (includes bonus) ────────

CREATE OR REPLACE FUNCTION public.get_my_predictor_stats(
  p_competition_id uuid
)
RETURNS TABLE (
  total_points bigint,
  predictions  bigint,
  exact_scores bigint,
  global_rank  bigint,
  bonus_points bigint
)
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public
AS $$
  WITH all_totals AS (
    -- All users' combined scores for ranking
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
      count(p.id)                                       AS preds,
      count(CASE WHEN p.points_awarded = 5 THEN 1 END)  AS exacts
    FROM public.predictions p
    JOIN public.fixtures f ON f.id = p.fixture_id
    WHERE f.competition_id = p_competition_id
      AND p.user_id = auth.uid()
  ),
  my_bonus AS (
    SELECT coalesce(sum(bp.points_awarded), 0) AS pts
    FROM public.bonus_predictions bp
    JOIN public.bonus_questions bq ON bq.id = bp.question_id
    WHERE bq.competition_id = p_competition_id
      AND bp.user_id = auth.uid()
      AND bp.points_awarded IS NOT NULL
  )
  SELECT
    mm.pts + mb.pts                                                   AS total_points,
    mm.preds                                                           AS predictions,
    mm.exacts                                                          AS exact_scores,
    (SELECT count(*) + 1 FROM all_totals WHERE total > mm.pts + mb.pts) AS global_rank,
    mb.pts                                                             AS bonus_points
  FROM my_match mm, my_bonus mb;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_predictor_stats TO authenticated;


DO $$
BEGIN
  RAISE NOTICE 'Migration 006 applied:';
  RAISE NOTICE '  - bonus_questions table (6 wc2026 questions seeded)';
  RAISE NOTICE '  - bonus_predictions table + RLS';
  RAISE NOTICE '  - upsert_bonus_prediction() RPC';
  RAISE NOTICE '  - admin_lock_bonus_question() RPC';
  RAISE NOTICE '  - admin_set_bonus_answer() RPC';
  RAISE NOTICE '  - get_predictor_leaderboard() updated: + bonus_points column';
  RAISE NOTICE '  - get_league_leaderboard() updated: + bonus_points column';
  RAISE NOTICE '  - get_my_predictor_stats() updated: + bonus_points column';
END;
$$;
