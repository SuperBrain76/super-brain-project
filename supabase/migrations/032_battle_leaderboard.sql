-- ============================================================================
-- MIGRATION 032 — BATTLE LEADERBOARD RPC
-- ============================================================================
-- Idempotent. Adds a public, anon-safe battle ranking so the unified Rankings
-- page can show a "Battles" board alongside Predictions / IQ / Network / Global.
-- SECURITY DEFINER: never exposes user_id — only display_name, country, elo, wins.
-- ============================================================================

create or replace function public.get_battle_leaderboard()
returns table (
  rank         bigint,
  display_name text,
  country      text,
  elo          integer,
  wins         integer,
  losses       integer
)
language sql
stable
security definer set search_path = public
as $$
  select
    row_number() over (order by bp.elo desc, bp.wins desc) as rank,
    coalesce(nullif(trim(bp.display_name), ''), 'Anonymous') as display_name,
    bp.country,
    bp.elo,
    bp.wins,
    bp.losses
  from public.battle_profiles bp
  where (bp.wins + bp.losses) > 0
  order by bp.elo desc, bp.wins desc
  limit 100;
$$;

grant execute on function public.get_battle_leaderboard() to anon, authenticated;
