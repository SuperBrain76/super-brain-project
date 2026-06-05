-- ============================================================
-- MIGRATION 008 — League member RPC + leaderboard fix
--
-- Depends on: predictor-schema.sql, 005_security_performance.sql
-- Safe to re-run (idempotent — CREATE OR REPLACE throughout).
--
-- Problems fixed:
--   1. get_league_leaderboard() was missing match_points and
--      bonus_points columns that the app expects. It also used
--      INNER JOIN on user_profiles which excluded members whose
--      profile row hadn't been created yet.
--
--   2. No RPC existed to fetch league member list with display
--      names. user_profiles RLS (auth.uid() = id) prevents
--      client-side queries from reading other users' profiles,
--      so a SECURITY DEFINER function is required.
-- ============================================================


-- ── 1. Fix get_league_leaderboard ────────────────────────────
-- Changes vs migration 005:
--   - JOIN user_profiles → LEFT JOIN (members without profile still appear)
--   - match_points and bonus_points added to RETURNS TABLE and SELECT

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
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- ── Auth check ──────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- ── Membership / admin check ────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.prediction_league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you must be a member of this league.';
  END IF;

  -- ── Return leaderboard — all members, including 0-point ────
  RETURN QUERY
  SELECT
    row_number() OVER (
      ORDER BY coalesce(sum(CASE WHEN p.points_awarded IS NOT NULL AND b.id IS NULL
                               THEN p.points_awarded ELSE 0 END), 0) +
               coalesce((
                 SELECT sum(bp.points_awarded)
                 FROM public.bonus_predictions bp
                 WHERE bp.user_id = lm.user_id
                   AND bp.points_awarded IS NOT NULL
               ), 0) DESC
    )::bigint                                                             AS rank,
    lm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous')             AS display_name,
    pr.country,
    -- total = match + bonus
    (
      coalesce(sum(CASE WHEN p.points_awarded IS NOT NULL AND b.id IS NULL
                        THEN p.points_awarded ELSE 0 END), 0) +
      coalesce((
        SELECT sum(bp.points_awarded)
        FROM public.bonus_predictions bp
        WHERE bp.user_id = lm.user_id
          AND bp.points_awarded IS NOT NULL
      ), 0)
    )::bigint                                                             AS total_points,
    coalesce(sum(CASE WHEN p.points_awarded IS NOT NULL AND b.id IS NULL
                      THEN p.points_awarded ELSE 0 END), 0)::bigint      AS match_points,
    coalesce((
      SELECT sum(bp.points_awarded)
      FROM public.bonus_predictions bp
      WHERE bp.user_id = lm.user_id
        AND bp.points_awarded IS NOT NULL
    ), 0)::bigint                                                         AS bonus_points,
    count(p.id)::bigint                                                   AS predictions,
    count(CASE WHEN p.points_awarded = 5 THEN 1 END)::bigint             AS exact_scores
  FROM public.prediction_league_members lm
  JOIN public.prediction_leagues l        ON l.id = lm.league_id
  LEFT JOIN public.user_profiles pr       ON pr.id = lm.user_id
  LEFT JOIN public.predictions p          ON p.user_id = lm.user_id
  LEFT JOIN public.fixtures f             ON f.id = p.fixture_id
                                         AND f.competition_id = l.competition_id
  -- Exclude bonus fixture rows if any exist (guard)
  LEFT JOIN public.bonus_questions b      ON b.id = p.fixture_id
  WHERE lm.league_id = p_league_id
  GROUP BY lm.user_id, pr.display_name, pr.country
  ORDER BY total_points DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_leaderboard TO authenticated;


-- ── 2. New: get_league_members ────────────────────────────────
-- Returns all members of a league with display name, country,
-- and join date. SECURITY DEFINER bypasses the user_profiles
-- RLS policy (which restricts reads to auth.uid() = id) so
-- all members' names are visible to any league member.

CREATE OR REPLACE FUNCTION public.get_league_members(p_league_id uuid)
RETURNS TABLE (
  user_id      uuid,
  display_name text,
  country      text,
  joined_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- ── Auth check ──────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- ── Membership / admin check ────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.prediction_league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you must be a member of this league.';
  END IF;

  RETURN QUERY
  SELECT
    lm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous') AS display_name,
    pr.country,
    lm.joined_at
  FROM public.prediction_league_members lm
  LEFT JOIN public.user_profiles pr ON pr.id = lm.user_id
  WHERE lm.league_id = p_league_id
  ORDER BY lm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_members TO authenticated;


-- ── Summary ───────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Migration 008 applied:';
  RAISE NOTICE '  - get_league_leaderboard() updated: LEFT JOIN user_profiles,';
  RAISE NOTICE '    match_points + bonus_points columns added';
  RAISE NOTICE '  - get_league_members() new RPC: member list bypassing profile RLS';
END;
$$;
