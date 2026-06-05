-- ============================================================
-- MIGRATION 005 — Security hardening + performance
--
-- Fixes:
--   HIGH:   adminSetResult() used client-side auth guard only.
--           Replace with SECURITY DEFINER RPC that checks app_admins.
--   MEDIUM: get_league_leaderboard() was callable by any authenticated
--           user. Now verifies the caller is a league member.
--   PERF:   get_my_leagues_with_counts() returns leagues + member counts
--           in a single query (eliminates N+1 member-count round-trips).
--
-- Depends on: predictor-schema.sql, 003, 004
-- Safe to re-run (idempotent guards throughout).
-- ============================================================


-- ── 1. Admin table ────────────────────────────────────────────
-- Stores the UUIDs of users who have admin privileges.
-- No client access. Managed exclusively via the Supabase dashboard
-- or service-role SQL.
--
-- SETUP REQUIRED after running this migration:
--   1. Create your admin account on superbrain.social.
--   2. Find your User UUID in Supabase Dashboard → Authentication → Users.
--   3. Run: INSERT INTO public.app_admins (user_id) VALUES ('<your-uuid>');

CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now()
);

-- No client policies: only service_role / SECURITY DEFINER functions can read
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;


-- ── 2. Secure fixture result entry (HIGH security fix) ────────
-- Replaces the direct table UPDATE in adminSetResult().
-- Checks app_admins before touching fixtures.
-- Triggers the existing auto_score_predictions trigger automatically.

CREATE OR REPLACE FUNCTION public.admin_set_fixture_result(
  p_fixture_id uuid,
  p_home_score integer,
  p_away_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── Auth check ──────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required.';
  END IF;

  -- ── Input validation ────────────────────────────────────────
  IF p_home_score IS NULL OR p_away_score IS NULL THEN
    RAISE EXCEPTION 'Scores cannot be null.';
  END IF;

  IF p_home_score < 0 OR p_home_score > 20
  OR p_away_score < 0 OR p_away_score > 20 THEN
    RAISE EXCEPTION 'Score out of range: must be 0–20.';
  END IF;

  -- ── Fixture exists check ────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.fixtures WHERE id = p_fixture_id) THEN
    RAISE EXCEPTION 'Fixture not found: %', p_fixture_id;
  END IF;

  -- ── Update fixture ──────────────────────────────────────────
  -- Setting home_score + away_score fires the auto_score_predictions
  -- AFTER UPDATE trigger automatically.
  UPDATE public.fixtures
  SET
    home_score = p_home_score,
    away_score = p_away_score,
    status     = 'completed',
    updated_at = now()
  WHERE id = p_fixture_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_fixture_result TO authenticated;


-- ── 3. Secure league leaderboard (MEDIUM security fix) ────────
-- Replaces the previous LANGUAGE sql version.
-- Now verifies the caller is a member of the league before returning
-- any data. Non-members receive an access denied exception rather
-- than an empty result set.

CREATE OR REPLACE FUNCTION public.get_league_leaderboard(p_league_id uuid)
RETURNS TABLE (
  rank         bigint,
  user_id      uuid,
  display_name text,
  country      text,
  total_points bigint,
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

  -- ── Membership check ────────────────────────────────────────
  -- Admins bypass the membership requirement.
  IF NOT EXISTS (
    SELECT 1 FROM public.prediction_league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you must be a member of this league to view its leaderboard.';
  END IF;

  -- ── Return leaderboard ──────────────────────────────────────
  RETURN QUERY
  SELECT
    row_number() OVER (ORDER BY coalesce(sum(p.points_awarded), 0) DESC) AS rank,
    lm.user_id,
    coalesce(nullif(trim(pr.display_name), ''), 'Anonymous')             AS display_name,
    pr.country,
    coalesce(sum(p.points_awarded), 0)                                   AS total_points,
    count(p.id)                                                          AS predictions,
    count(CASE WHEN p.points_awarded = 5 THEN 1 END)                     AS exact_scores
  FROM public.prediction_league_members lm
  JOIN public.prediction_leagues l       ON l.id = lm.league_id
  JOIN public.user_profiles pr           ON pr.id = lm.user_id
  LEFT JOIN public.predictions p         ON p.user_id = lm.user_id
  LEFT JOIN public.fixtures f            ON f.id = p.fixture_id
                                        AND f.competition_id = l.competition_id
                                        AND p.points_awarded IS NOT NULL
  WHERE lm.league_id = p_league_id
  GROUP BY lm.user_id, pr.display_name, pr.country
  ORDER BY total_points DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_league_leaderboard TO authenticated;


-- ── 4. Leagues with member counts in one query (PERF fix) ─────
-- Returns all leagues the current user has joined, for a given
-- competition slug, WITH member counts included.
-- Eliminates the N+1 pattern where each LeagueCard made a separate
-- getLeagueMemberCount() call after initial render.

CREATE OR REPLACE FUNCTION public.get_my_leagues_with_counts(
  p_competition_slug text
)
RETURNS TABLE (
  id              uuid,
  competition_id  uuid,
  name            text,
  normalized_name text,
  invite_code     text,
  created_by      uuid,
  created_at      timestamptz,
  max_members     integer,
  member_count    bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    l.id,
    l.competition_id,
    l.name,
    l.normalized_name,
    l.invite_code,
    l.created_by,
    l.created_at,
    l.max_members,
    count(all_members.user_id)  AS member_count
  FROM public.prediction_league_members my_membership
  JOIN public.prediction_leagues        l
       ON l.id = my_membership.league_id
  JOIN public.competitions              c
       ON c.id = l.competition_id AND c.slug = p_competition_slug
  LEFT JOIN public.prediction_league_members all_members
       ON all_members.league_id = l.id
  WHERE my_membership.user_id = auth.uid()
  GROUP BY
    l.id, l.competition_id, l.name, l.normalized_name,
    l.invite_code, l.created_by, l.created_at, l.max_members
  ORDER BY l.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_leagues_with_counts TO authenticated;


DO $$
BEGIN
  RAISE NOTICE 'Migration 005 applied:';
  RAISE NOTICE '  - app_admins table created';
  RAISE NOTICE '  - admin_set_fixture_result() RPC: server-side admin check';
  RAISE NOTICE '  - get_league_leaderboard() updated: membership verified at DB level';
  RAISE NOTICE '  - get_my_leagues_with_counts() new RPC: leagues + counts in 1 query';
  RAISE NOTICE '';
  RAISE NOTICE '  ACTION REQUIRED: insert your admin user UUID into app_admins:';
  RAISE NOTICE '    INSERT INTO public.app_admins (user_id) VALUES (''<your-uuid>'');';
END;
$$;
