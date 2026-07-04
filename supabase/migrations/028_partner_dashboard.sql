-- ============================================================================
-- MIGRATION 028 — PARTNER DASHBOARD (data-driven aggregation)
-- ============================================================================
-- Idempotent. Requires 021–027.
--
-- Adds:
--   • partner_levels        — DATA-DRIVEN partner tiers (name/threshold/perks).
--   • get_partner_dashboard() — a single SECURITY DEFINER RPC that returns the
--     WHOLE dashboard as one JSONB payload (one round trip, mobile-first):
--     currency, balance, partner level + progress, streak, daily-reward preview,
--     referral code + network stats, recent transactions, achievements,
--     contribution leaderboard position, and a ranked "Next Actions" list.
--
-- Nothing is hardcoded: currency, level thresholds, reward amounts, and the IQ
-- value of each "next action" are all read from existing economy config tables.
-- ============================================================================

-- ── PARTNER LEVELS (data) ───────────────────────────────────────────────────
create table if not exists public.partner_levels (
  level      integer     primary key,
  name       text        not null,
  min_earned bigint      not null,          -- lifetime IQ earned to reach tier
  icon       text        not null default '⭐',
  perks      jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.partner_levels enable row level security;
drop policy if exists "partner levels public read" on public.partner_levels;
create policy "partner levels public read"
  on public.partner_levels for select to anon, authenticated using (true);

insert into public.partner_levels (level, name, min_earned, icon) values
  (1, 'Rookie',    0,     '🌱'),
  (2, 'Bronze',    100,   '🥉'),
  (3, 'Silver',    500,   '🥈'),
  (4, 'Gold',      2000,  '🥇'),
  (5, 'Platinum',  5000,  '💎'),
  (6, 'Diamond',   15000, '🔷'),
  (7, 'Elite',     50000, '👑')
on conflict (level) do nothing;


-- ── RPC: get_partner_dashboard ──────────────────────────────────────────────
create or replace function public.get_partner_dashboard(p_currency text default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  uid              uuid := auth.uid();
  cur              record;
  bal              bigint := 0;
  lifetime         bigint := 0;
  lvl              record;
  nxt              record;
  progress         numeric := 0;
  st               record;
  today            date := (now() at time zone 'utc')::date;
  checked_in_today boolean := false;
  next_streak_day  integer := 1;
  login_preview    bigint := 0;
  streak_preview   bigint := 0;
  ref              record;
  ref_code         text;
  lb_rank          bigint;
  lb_total         bigint := 0;
  ach_total        integer := 0;
  ach_unlocked     integer := 0;
  recent           jsonb := '[]'::jsonb;
  recent_ach       jsonb := '[]'::jsonb;
  next_actions     jsonb := '[]'::jsonb;
  profile_done     boolean := false;
  upcoming_open    integer := 0;
begin
  if uid is null then
    return jsonb_build_object('authenticated', false);
  end if;

  -- Configurable currency: explicit arg, else IQ, else first active.
  select * into cur
  from public.economy_currencies
  where active and code = coalesce(p_currency, code)
  order by (code = 'IQ') desc, code
  limit 1;
  if cur.code is null then
    return jsonb_build_object('authenticated', true, 'error', 'no active currency');
  end if;

  -- Balance + lifetime earned (positive deltas only).
  select coalesce(sum(delta),0) into bal
    from public.economy_ledger where user_id = uid and currency_code = cur.code;
  select coalesce(sum(delta),0) into lifetime
    from public.economy_ledger where user_id = uid and currency_code = cur.code and delta > 0;

  -- Partner level from lifetime earned + progress to next.
  select * into lvl from public.partner_levels where min_earned <= lifetime order by min_earned desc limit 1;
  select * into nxt from public.partner_levels where min_earned >  lifetime order by min_earned asc  limit 1;
  if lvl.level is null then
    progress := 0;
  elsif nxt.level is null then
    progress := 100;
  else
    progress := round(((lifetime - lvl.min_earned)::numeric / nullif(nxt.min_earned - lvl.min_earned, 0)) * 100, 1);
  end if;

  -- Streak + today's reward preview (without minting).
  select * into st from public.user_streaks where user_id = uid;
  checked_in_today := coalesce(st.last_checkin = today, false);
  if st.user_id is null then
    next_streak_day := 1;
  elsif checked_in_today then
    next_streak_day := st.current_streak;
  elsif st.last_checkin = today - 1 then
    next_streak_day := st.current_streak + 1;
  else
    next_streak_day := 1;
  end if;
  select coalesce(base_amount,0) into login_preview from public.economy_event_types where code = 'daily_login';
  select coalesce((amount_map ->> next_streak_day::text)::bigint, base_amount, 0)
    into streak_preview from public.economy_event_types where code = 'daily_streak';

  -- Referral code + network stats.
  select code into ref_code from public.referral_codes where user_id = uid;
  select
    count(*)::integer                                        as total,
    count(*) filter (where status = 'qualified')::integer   as active,
    count(*) filter (where status = 'pending')::integer     as pending,
    coalesce((select sum(delta) from public.economy_ledger
              where user_id = uid and event_code = 'referral_qualified'), 0)::bigint as earned
  into ref
  from public.referrals where referrer_id = uid;

  -- Contribution leaderboard position.
  with bals as (
    select user_id, sum(delta) as b
    from public.economy_ledger where currency_code = cur.code
    group by user_id having sum(delta) > 0
  )
  select
    (select count(*) from bals),
    case when exists (select 1 from bals where user_id = uid)
         then (select count(*) + 1 from bals x where x.b > (select b from bals where user_id = uid))
         else null end
  into lb_total, lb_rank;

  -- Achievements.
  select count(*) into ach_total    from public.achievements where active;
  select count(*) into ach_unlocked from public.user_achievements where user_id = uid;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.unlocked_at desc), '[]'::jsonb) into recent_ach
  from (
    select a.code, a.name, a.icon, ua.unlocked_at
    from public.user_achievements ua
    join public.achievements a on a.code = ua.achievement_code
    where ua.user_id = uid
    order by ua.unlocked_at desc limit 5
  ) t;

  -- Recent transactions (human-labelled from event descriptions).
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into recent
  from (
    select
      l.created_at,
      l.delta,
      l.event_code,
      coalesce(et.description, l.reason, l.event_code, 'Adjustment') as label
    from public.economy_ledger l
    left join public.economy_event_types et on et.code = l.event_code
    where l.user_id = uid and l.currency_code = cur.code
    order by l.created_at desc limit 8
  ) t;

  -- Inputs for Next Actions.
  select coalesce(profile_complete, false) into profile_done
    from public.user_profiles where id = uid;
  select count(*) into upcoming_open
  from public.fixtures f
  join public.competitions c on c.id = f.competition_id and c.status in ('upcoming','active')
  where f.kicks_off_at > now()
    and f.home_team_id is not null and f.away_team_id is not null
    and not exists (select 1 from public.predictions p where p.fixture_id = f.id and p.user_id = uid);

  -- Next Actions: highest-value things to do today (value read from config).
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into next_actions
  from (
    select code, title, subtitle, href, icon, iq
    from (
      values
        ('daily_checkin', 'Claim your daily reward', 'Keep your streak alive', '/iq', '🎁',
          (case when checked_in_today then 0 else (login_preview + streak_preview) end)::bigint,
          (not checked_in_today)),
        ('complete_profile', 'Complete your profile', 'One-time partner bonus', '/profile/complete', '📝',
          coalesce((select base_amount from public.economy_event_types where code = 'profile_complete'), 0)::bigint,
          (not profile_done)),
        ('make_predictions', 'Predict upcoming matches', 'Points for every correct call', '/predict', '⚽',
          (coalesce((select (amount_map ->> '5')::bigint from public.economy_event_types where code = 'prediction_score'), 0)
            * least(upcoming_open, 5))::bigint,
          (upcoming_open > 0)),
        ('beat_test', 'Set a new personal best', 'Beat your top cognitive score', '/tests', '🧠',
          coalesce((select (amount_map ->> 'elite')::bigint from public.economy_event_types where code = 'test_personal_best'), 0)::bigint,
          true),
        ('invite_friend', 'Invite a partner', 'Earn when they get active', '/iq', '🤝',
          coalesce((select base_amount from public.economy_event_types where code = 'referral_qualified'), 0)::bigint,
          true)
    ) as v(code, title, subtitle, href, icon, iq, available)
    where available and iq > 0
    order by iq desc
    limit 4
  ) t;

  -- Assemble the payload.
  return jsonb_build_object(
    'authenticated', true,
    'currency', jsonb_build_object('code', cur.code, 'name', cur.name, 'symbol', cur.symbol, 'decimals', cur.decimals),
    'balance', bal,
    'lifetime_earned', lifetime,
    'level', jsonb_build_object(
      'level', lvl.level, 'name', lvl.name, 'icon', lvl.icon, 'min_earned', lvl.min_earned,
      'next_name', nxt.name, 'next_at', nxt.min_earned, 'progress_pct', progress
    ),
    'streak', jsonb_build_object(
      'current', coalesce(st.current_streak, 0), 'longest', coalesce(st.longest_streak, 0),
      'total_checkins', coalesce(st.total_checkins, 0), 'checked_in_today', checked_in_today
    ),
    'daily_reward', jsonb_build_object(
      'available', not checked_in_today, 'login', login_preview, 'streak', streak_preview,
      'streak_day', next_streak_day, 'total', (login_preview + streak_preview)
    ),
    'referral', jsonb_build_object(
      'code', ref_code, 'total', ref.total, 'active', ref.active, 'pending', ref.pending, 'earned', ref.earned
    ),
    'leaderboard', jsonb_build_object('rank', lb_rank, 'total', lb_total),
    'achievements', jsonb_build_object('unlocked', ach_unlocked, 'total', ach_total, 'recent', recent_ach),
    'recent_transactions', recent,
    'next_actions', next_actions
  );
end;
$$;

grant execute on function public.get_partner_dashboard(text) to anon, authenticated;
