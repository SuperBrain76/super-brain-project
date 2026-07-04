-- ============================================================================
-- MIGRATION 036 — MULTI-LEVEL NETWORK FOUNDATION (tree traversal only)
-- ============================================================================
-- Idempotent. Lays the groundwork for future Level-2 / Level-3 network bonuses
-- WITHOUT any schema change later, and WITHOUT paying anything beyond direct
-- (Level-1) referrals today.
--
-- The parent→child tree already exists as an adjacency list in `referrals`:
--   referred_user_id  = the child (unique → exactly one parent per user)
--   referrer_id       = the parent
-- An adjacency list is a generic N-level tree — any depth is reachable by
-- recursion, so enabling L2/L3 later is a FUNCTION + CONFIG change, never a
-- schema migration. These helpers + config keys are that foundation.
-- ============================================================================

-- Future reward rates — data-driven, 0 = disabled (no rewards beyond L1 today).
insert into public.economy_config (key, value, description) values
  ('network_l2_bonus_pct', '0'::jsonb, 'Future: % of an active member''s earnings paid to their level-2 upline (0 = disabled)'),
  ('network_l3_bonus_pct', '0'::jsonb, 'Future: % paid to the level-3 upline (0 = disabled)')
on conflict (key) do nothing;

-- Ancestors of a user (upline), level 1 = direct referrer, up to p_max_depth.
-- This is what a future L2/L3 payout walks: when a member earns, reward their
-- level-2 / level-3 referrers a configured %. Internal (reward-side use).
create or replace function public.economy_referral_upline(p_user uuid, p_max_depth integer default 3)
returns table (ancestor_id uuid, level integer)
language sql
stable
security definer set search_path = public
as $$
  with recursive up as (
    select r.referrer_id as ancestor_id, 1 as level
    from public.referrals r
    where r.referred_user_id = p_user
    union all
    select r.referrer_id, u.level + 1
    from up u
    join public.referrals r on r.referred_user_id = u.ancestor_id
    where u.level < p_max_depth
  )
  select ancestor_id, level from up;
$$;
revoke all on function public.economy_referral_upline(uuid, integer) from public, anon, authenticated;

-- Descendants of a user (downline) with their level — for future multi-level
-- network analytics. Level 1 = direct referrals.
create or replace function public.economy_referral_downline(p_user uuid, p_max_depth integer default 3)
returns table (member_id uuid, level integer)
language sql
stable
security definer set search_path = public
as $$
  with recursive down as (
    select r.referred_user_id as member_id, 1 as level
    from public.referrals r
    where r.referrer_id = p_user
    union all
    select r.referred_user_id, d.level + 1
    from down d
    join public.referrals r on r.referrer_id = d.member_id
    where d.level < p_max_depth
  )
  select member_id, level from down;
$$;
revoke all on function public.economy_referral_downline(uuid, integer) from public, anon, authenticated;
