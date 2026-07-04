-- ============================================================================
-- MIGRATION 030 — NETWORK DASHBOARD
-- ============================================================================
-- Idempotent. Builds on 021–029 (referral engine + economy + partner levels).
--
-- Turns the existing referral graph into a growth analytics surface that
-- rewards ACTIVE, HIGH-QUALITY networks — not raw referral counts. Every metric
-- is sourced from referrals + economy_ledger + user_profiles + partner_levels,
-- and thresholds/windows are data-driven via economy_config.
--
-- The referral engine is single-level (referrals.referred_user_id is globally
-- unique → one referrer per user), so a "network" is a user's direct referrals.
-- The headline numbers deliberately foreground QUALITY: active members, recent
-- engagement, conversion rate, and the IQ the network has actually earned.
-- ============================================================================

-- ── CONFIG (tunable, no deploy) ─────────────────────────────────────────────
insert into public.economy_config (key, value, description) values
  ('network_active_window_days', '30'::jsonb,  'Days window to count a network member as recently engaged'),
  ('network_growth_weeks',       '12'::jsonb,  'Weeks shown in the network growth chart'),
  ('network_top_contributors',   '10'::jsonb,  'Number of top network contributors returned'),
  ('network_leaderboard_limit',  '100'::jsonb, 'Rows in the global network leaderboard')
on conflict (key) do nothing;


-- ── RPC: get_network_dashboard ──────────────────────────────────────────────
create or replace function public.get_network_dashboard(p_currency text default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  cur        record;
  win        integer;
  weeks      integer;
  topn       integer;
  total      integer := 0;
  active     integer := 0;
  pending    integer := 0;
  engaged    integer := 0;
  net_earned bigint  := 0;
  conversion numeric := 0;
  countries  jsonb := '[]'::jsonb;
  growth     jsonb := '[]'::jsonb;
  top        jsonb := '[]'::jsonb;
  size_total bigint := 0;
  size_rank  bigint;
  iq_rank    bigint;
begin
  if uid is null then return jsonb_build_object('authenticated', false); end if;

  win   := public.economy_config_num('network_active_window_days', 30)::int;
  weeks := public.economy_config_num('network_growth_weeks', 12)::int;
  topn  := public.economy_config_num('network_top_contributors', 10)::int;

  select * into cur from public.economy_currencies
  where active and code = coalesce(p_currency, code)
  order by (code = 'IQ') desc, code limit 1;
  if cur.code is null then
    return jsonb_build_object('authenticated', true, 'error', 'no active currency');
  end if;

  -- Headline counts.
  select count(*),
         count(*) filter (where status = 'qualified'),
         count(*) filter (where status = 'pending')
    into total, active, pending
  from public.referrals where referrer_id = uid;

  -- Recently engaged: members who earned currency within the window.
  select count(distinct r.referred_user_id) into engaged
  from public.referrals r
  where r.referrer_id = uid
    and exists (
      select 1 from public.economy_ledger l
      where l.user_id = r.referred_user_id and l.delta > 0
        and l.currency_code = cur.code
        and l.created_at > now() - make_interval(days => win)
    );

  -- Currency the network has earned (its total contribution).
  select coalesce(sum(l.delta), 0) into net_earned
  from public.referrals r
  join public.economy_ledger l on l.user_id = r.referred_user_id
  where r.referrer_id = uid and l.delta > 0 and l.currency_code = cur.code;

  conversion := case when total > 0 then round(active::numeric / total * 100, 1) else 0 end;

  -- Countries represented.
  select coalesce(jsonb_agg(to_jsonb(t) order by t.count desc), '[]'::jsonb) into countries
  from (
    select coalesce(nullif(trim(p.country), ''), 'Unknown') as country, count(*)::int as count
    from public.referrals r
    left join public.user_profiles p on p.id = r.referred_user_id
    where r.referrer_id = uid
    group by coalesce(nullif(trim(p.country), ''), 'Unknown')
    order by count(*) desc
    limit 12
  ) t;

  -- Weekly growth: new members + cumulative, over the last :weeks weeks.
  with wk as (
    select date_trunc('week', r.created_at)::date as week, count(*)::int as new
    from public.referrals r where r.referrer_id = uid
    group by 1
  ),
  series as (
    select generate_series(
      date_trunc('week', now()) - make_interval(weeks => weeks - 1),
      date_trunc('week', now()),
      interval '1 week'
    )::date as week
  )
  select coalesce(jsonb_agg(to_jsonb(g) order by g.week), '[]'::jsonb) into growth
  from (
    select s.week,
           coalesce(w.new, 0) as new,
           (select count(*) from public.referrals r
            where r.referrer_id = uid and date_trunc('week', r.created_at)::date <= s.week)::int as cumulative
    from series s
    left join wk w on w.week = s.week
  ) g;

  -- Top contributors in the network (by IQ earned).
  select coalesce(jsonb_agg(to_jsonb(t) order by t.earned desc), '[]'::jsonb) into top
  from (
    select
      coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
      p.country,
      (r.status = 'qualified') as active,
      coalesce((select sum(l.delta) from public.economy_ledger l
                where l.user_id = r.referred_user_id and l.delta > 0 and l.currency_code = cur.code), 0)::bigint as earned,
      (select pl.name from public.partner_levels pl
       where pl.min_earned <= coalesce((select sum(l.delta) from public.economy_ledger l
                where l.user_id = r.referred_user_id and l.delta > 0 and l.currency_code = cur.code), 0)
       order by pl.min_earned desc limit 1) as level_name
    from public.referrals r
    left join public.user_profiles p on p.id = r.referred_user_id
    where r.referrer_id = uid
    order by earned desc
    limit topn
  ) t;

  -- Global rankings among all referrers (by active members and by network IQ).
  -- referred_user_id is unique, so the ledger join never inflates counts.
  with ref_agg as (
    select r.referrer_id,
           count(distinct r.referred_user_id) filter (where r.status = 'qualified') as active,
           coalesce(sum(l.delta), 0) as net_iq
    from public.referrals r
    left join public.economy_ledger l
      on l.user_id = r.referred_user_id and l.currency_code = cur.code and l.delta > 0
    group by r.referrer_id
  )
  select
    (select count(*) from ref_agg),
    case when exists (select 1 from ref_agg where referrer_id = uid)
         then (select count(*) + 1 from ref_agg a where a.active > (select active from ref_agg where referrer_id = uid))
         else null end,
    case when exists (select 1 from ref_agg where referrer_id = uid)
         then (select count(*) + 1 from ref_agg a where a.net_iq > (select net_iq from ref_agg where referrer_id = uid))
         else null end
  into size_total, size_rank, iq_rank;

  return jsonb_build_object(
    'authenticated', true,
    'currency', jsonb_build_object('code', cur.code, 'name', cur.name, 'symbol', cur.symbol),
    'total_size', total,
    'active_members', active,
    'pending', pending,
    'engaged_recent', engaged,
    'active_window_days', win,
    'conversion_rate', conversion,
    'network_earned', net_earned,
    'quality_score', conversion,     -- active / total, as a %
    'countries', countries,
    'growth', growth,
    'top_contributors', top,
    'rankings', jsonb_build_object(
      'size_rank', size_rank,        -- by active members
      'iq_rank', iq_rank,            -- by network IQ earned
      'referrer_pool', size_total
    )
  );
end;
$$;
grant execute on function public.get_network_dashboard(text) to authenticated;


-- ── RPC: get_network_leaderboard (global network rankings) ──────────────────
-- Ranks partners by ACTIVE network members then network IQ — quality first.
create or replace function public.get_network_leaderboard(p_currency text default null)
returns table (
  rank           bigint,
  display_name   text,
  country        text,
  active_members bigint,
  total_members  bigint,
  network_iq     bigint
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  cur_code text;
  lim      integer;
begin
  select code into cur_code from public.economy_currencies
  where active and code = coalesce(p_currency, code)
  order by (code = 'IQ') desc, code limit 1;
  lim := public.economy_config_num('network_leaderboard_limit', 100)::int;

  return query
  with ref_agg as (
    select r.referrer_id,
           count(distinct r.referred_user_id) filter (where r.status = 'qualified') as active,
           count(distinct r.referred_user_id) as total,
           coalesce(sum(l.delta), 0) as net_iq
    from public.referrals r
    left join public.economy_ledger l
      on l.user_id = r.referred_user_id and l.currency_code = cur_code and l.delta > 0
    group by r.referrer_id
  )
  select
    row_number() over (order by a.active desc, a.net_iq desc) as rank,
    coalesce(nullif(trim(p.display_name), ''), 'Anonymous') as display_name,
    p.country,
    a.active::bigint,
    a.total::bigint,
    a.net_iq::bigint
  from ref_agg a
  left join public.user_profiles p on p.id = a.referrer_id
  where a.total > 0
  order by a.active desc, a.net_iq desc
  limit lim;
end;
$$;
grant execute on function public.get_network_leaderboard(text) to anon, authenticated;
