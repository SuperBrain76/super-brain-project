-- ============================================================
-- MIGRATION 005b — Add get_my_leagues_with_counts RPC
--
-- ROOT CAUSE OF "My Leagues shows no leagues" BUG:
-- Migration 005 was never run. The get_my_leagues_with_counts
-- function didn't exist. getMyLeaguesBySlug() called it, got a
-- Supabase error, silently returned [], and the UI showed
-- "no leagues" even though 5 leagues and 6 members existed.
--
-- This file creates ONLY the missing function.
-- It does NOT touch get_predictor_leaderboard, get_league_leaderboard,
-- or get_my_predictor_stats (those were correctly updated by 006).
--
-- SAFE to run after migration 006 — no function conflicts.
-- Depends on: predictor-schema.sql, 003 (normalized_name), 004 (max_members)
-- ============================================================

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
  RAISE NOTICE 'Migration 005b applied: get_my_leagues_with_counts() created.';
  RAISE NOTICE 'My Leagues will now load with member counts in a single query.';
END;
$$;
