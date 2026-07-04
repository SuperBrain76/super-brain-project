-- ============================================================================
-- MIGRATION 029 — PUBLIC PROFILE SYSTEM
-- ============================================================================
-- Idempotent. Builds on 021–028.
--
-- Gives every user a shareable public profile at a configurable URL
-- (/u/<username>), assembled from the EXISTING economy/partner infrastructure:
-- partner level, currency balance, achievements, prediction stats, cognitive
-- test stats, leaderboard positions, network stats, referral link, and recent
-- public activity — with per-section PRIVACY controls the user owns.
--
-- Security model (unchanged pattern): anon has NO direct read on user_profiles
-- or the private economy tables. The ONLY public surface is
-- get_public_profile() — a SECURITY DEFINER RPC that returns solely safe,
-- privacy-filtered fields (never birth_year / gender / industry / email / raw
-- user_id). Everything is data-driven; nothing about the sections is hardcoded.
-- ============================================================================

-- ── PROFILE COLUMNS ─────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists username   text,
  add column if not exists bio        text,
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists is_public  boolean not null default true,
  add column if not exists privacy    jsonb   not null default
    '{"level":true,"balance":true,"achievements":true,"predictions":true,"tests":true,"network":true,"activity":true,"country":true,"referral":true}'::jsonb;

-- Case-insensitive unique handle. Partial: many NULLs (unset) are allowed.
create unique index if not exists user_profiles_username_key
  on public.user_profiles (lower(username)) where username is not null;


-- ── RESERVED HANDLES (data-driven) ──────────────────────────────────────────
create table if not exists public.reserved_usernames (name text primary key);
alter table public.reserved_usernames enable row level security;
drop policy if exists "reserved usernames public read" on public.reserved_usernames;
create policy "reserved usernames public read"
  on public.reserved_usernames for select to anon, authenticated using (true);

insert into public.reserved_usernames (name) values
  ('admin'),('administrator'),('api'),('auth'),('login'),('signup'),('logout'),
  ('settings'),('profile'),('u'),('user'),('users'),('me'),('predict'),('tests'),
  ('test'),('battle'),('iq'),('leaderboard'),('leaderboards'),('challenge'),('share'),
  ('www'),('help'),('support'),('about'),('terms'),('privacy'),('contact'),('disclaimer'),
  ('superbrain'),('root'),('system'),('null'),('undefined'),('static'),('_next')
on conflict (name) do nothing;


-- ── RPC: set_username ───────────────────────────────────────────────────────
-- Validates format + reserved + uniqueness, then claims the handle for the
-- signed-in user. Returns the normalized username.
create or replace function public.set_username(p_username text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  norm text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  norm := lower(trim(coalesce(p_username, '')));

  if norm !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3–20 characters: letters, numbers, or underscore.';
  end if;
  if exists (select 1 from public.reserved_usernames where name = norm) then
    raise exception 'That username is reserved.';
  end if;
  if exists (select 1 from public.user_profiles where lower(username) = norm and id <> uid) then
    raise exception 'That username is already taken.';
  end if;

  begin
    update public.user_profiles set username = norm, updated_at = now() where id = uid;
    if not found then
      insert into public.user_profiles (id, username) values (uid, norm)
      on conflict (id) do update set username = norm, updated_at = now();
    end if;
  exception when unique_violation then
    raise exception 'That username is already taken.';
  end;

  return norm;
end;
$$;
grant execute on function public.set_username(text) to authenticated;


-- ── RPC: update_public_profile ──────────────────────────────────────────────
-- Updates the caller's own customization + privacy. NULL args leave a field
-- unchanged; pass '' to clear text fields. Validates lengths and URL scheme.
create or replace function public.update_public_profile(
  p_bio        text    default null,
  p_avatar_url text    default null,
  p_banner_url text    default null,
  p_is_public  boolean default null,
  p_privacy    jsonb   default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;

  if p_bio is not null and length(p_bio) > 300 then
    raise exception 'Bio must be 300 characters or fewer.';
  end if;
  if p_avatar_url is not null and p_avatar_url <> '' and p_avatar_url !~ '^https://' then
    raise exception 'Avatar URL must start with https://';
  end if;
  if p_banner_url is not null and p_banner_url <> '' and p_banner_url !~ '^https://' then
    raise exception 'Banner URL must start with https://';
  end if;

  update public.user_profiles set
    bio        = coalesce(p_bio, bio),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    banner_url = coalesce(p_banner_url, banner_url),
    is_public  = coalesce(p_is_public, is_public),
    -- merge privacy so partial updates keep untouched keys
    privacy    = case when p_privacy is null then privacy else privacy || p_privacy end,
    updated_at = now()
  where id = uid;
end;
$$;
grant execute on function public.update_public_profile(text, text, text, boolean, jsonb) to authenticated;


-- ── RPC: get_my_profile_settings (editor prefill) ───────────────────────────
create or replace function public.get_my_profile_settings()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'username',     p.username,
    'display_name', p.display_name,
    'bio',          p.bio,
    'avatar_url',   p.avatar_url,
    'banner_url',   p.banner_url,
    'avatar_color', p.avatar_color,
    'country',      p.country,
    'is_public',    p.is_public,
    'privacy',      p.privacy
  )
  from public.user_profiles p where p.id = auth.uid();
$$;
grant execute on function public.get_my_profile_settings() to authenticated;


-- ── RPC: get_public_profile (the sole public surface) ───────────────────────
create or replace function public.get_public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  prof         record;
  pv           jsonb;
  cur          record;
  bal          bigint := 0;
  lifetime     bigint := 0;
  lvl          record;
  nxt          record;
  progress     numeric := 0;
  ach          jsonb := '[]'::jsonb;
  ach_unlocked integer := 0;
  ach_total    integer := 0;
  pred_points  bigint := 0;
  pred_count   bigint := 0;
  pred_exact   bigint := 0;
  pred_rank    bigint;
  tests_json   jsonb := '[]'::jsonb;
  tests_done   integer := 0;
  avg_pct      numeric;
  contrib_rank bigint;
  net_total    integer := 0;
  net_active   integer := 0;
  ref_code     text;
  activity     jsonb := '[]'::jsonb;
begin
  select * into prof from public.user_profiles where lower(username) = lower(trim(coalesce(p_username, '')));
  if prof.id is null then
    return jsonb_build_object('found', false);
  end if;

  -- Master toggle: private profiles expose only a minimal identity card.
  if prof.is_public is false then
    return jsonb_build_object(
      'found', true, 'is_public', false,
      'username', prof.username, 'display_name', prof.display_name,
      'avatar_url', prof.avatar_url, 'avatar_color', prof.avatar_color,
      'banner_url', prof.banner_url
    );
  end if;

  pv := coalesce(prof.privacy, '{}'::jsonb);

  -- Currency (configurable — default platform currency).
  select * into cur from public.economy_currencies where active order by (code = 'IQ') desc, code limit 1;

  if cur.code is not null then
    select coalesce(sum(delta),0) into bal
      from public.economy_ledger where user_id = prof.id and currency_code = cur.code;
    select coalesce(sum(delta),0) into lifetime
      from public.economy_ledger where user_id = prof.id and currency_code = cur.code and delta > 0;
  end if;

  -- Partner level.
  select * into lvl from public.partner_levels where min_earned <= lifetime order by min_earned desc limit 1;
  select * into nxt from public.partner_levels where min_earned >  lifetime order by min_earned asc  limit 1;
  if lvl.level is null then progress := 0;
  elsif nxt.level is null then progress := 100;
  else progress := round(((lifetime - lvl.min_earned)::numeric / nullif(nxt.min_earned - lvl.min_earned, 0)) * 100, 1);
  end if;

  -- Achievements (badges).
  select count(*) into ach_total    from public.achievements where active;
  select count(*) into ach_unlocked from public.user_achievements where user_id = prof.id;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.unlocked_at desc), '[]'::jsonb) into ach
  from (
    select a.code, a.name, a.icon, a.description, ua.unlocked_at
    from public.user_achievements ua
    join public.achievements a on a.code = ua.achievement_code
    where ua.user_id = prof.id
    order by ua.unlocked_at desc limit 24
  ) t;

  -- Prediction stats (global across competitions) + rank.
  select coalesce(sum(p.points_awarded),0), count(p.id), count(*) filter (where p.points_awarded = 5)
    into pred_points, pred_count, pred_exact
  from public.predictions p
  join public.fixtures f on f.id = p.fixture_id
  where p.user_id = prof.id and p.points_awarded is not null;

  with scores as (
    select p.user_id, coalesce(sum(p.points_awarded),0) as pts
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where p.points_awarded is not null
    group by p.user_id
  )
  select case when exists (select 1 from scores where user_id = prof.id)
              then (select count(*) + 1 from scores x where x.pts > (select pts from scores where user_id = prof.id))
              else null end
    into pred_rank;

  -- Cognitive test stats: best score per test + averages.
  select count(distinct test_name) into tests_done from public.test_results where user_id = prof.id;
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into tests_json
  from (
    select distinct on (test_name) test_name, score, percentile
    from public.test_results where user_id = prof.id
    order by test_name, score desc
  ) t;
  select round(avg(best_pct), 0) into avg_pct
  from (select max(percentile) as best_pct from public.test_results where user_id = prof.id group by test_name) q;

  -- Contribution leaderboard rank.
  if cur.code is not null then
    with bals as (
      select user_id, sum(delta) as b from public.economy_ledger
      where currency_code = cur.code group by user_id having sum(delta) > 0
    )
    select case when exists (select 1 from bals where user_id = prof.id)
                then (select count(*) + 1 from bals x where x.b > (select b from bals where user_id = prof.id))
                else null end
      into contrib_rank;
  end if;

  -- Network stats.
  select count(*), count(*) filter (where status = 'qualified')
    into net_total, net_active
  from public.referrals where referrer_id = prof.id;

  -- Referral code (for the "join via me" link).
  select code into ref_code from public.referral_codes where user_id = prof.id;

  -- Recent public activity: positive (earning) events only, human-labelled.
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into activity
  from (
    select l.created_at, l.delta,
           coalesce(et.description, l.reason, l.event_code, 'Activity') as label
    from public.economy_ledger l
    left join public.economy_event_types et on et.code = l.event_code
    where l.user_id = prof.id and l.delta > 0
    order by l.created_at desc limit 10
  ) t;

  -- Assemble, applying per-section privacy (default visible when key absent).
  return jsonb_build_object(
    'found', true,
    'is_public', true,
    'username', prof.username,
    'display_name', prof.display_name,
    'bio', prof.bio,
    'avatar_url', prof.avatar_url,
    'avatar_color', prof.avatar_color,
    'banner_url', prof.banner_url,
    'join_date', prof.created_at,
    'country', case when coalesce((pv->>'country')::boolean, true) then prof.country else null end,
    'currency', case when cur.code is not null
                     then jsonb_build_object('code', cur.code, 'name', cur.name, 'symbol', cur.symbol)
                     else null end,
    'level', case when coalesce((pv->>'level')::boolean, true)
                  then jsonb_build_object('level', lvl.level, 'name', lvl.name, 'icon', lvl.icon,
                                          'progress_pct', progress, 'next_name', nxt.name,
                                          'next_at', nxt.min_earned, 'lifetime_earned', lifetime)
                  else null end,
    'balance', case when coalesce((pv->>'balance')::boolean, true) then bal else null end,
    'achievements', case when coalesce((pv->>'achievements')::boolean, true)
                         then jsonb_build_object('unlocked', ach_unlocked, 'total', ach_total, 'list', ach)
                         else null end,
    'predictions', case when coalesce((pv->>'predictions')::boolean, true)
                        then jsonb_build_object('total_points', pred_points, 'predictions', pred_count,
                                                'exact_scores', pred_exact, 'rank', pred_rank)
                        else null end,
    'tests', case when coalesce((pv->>'tests')::boolean, true)
                  then jsonb_build_object('completed', tests_done, 'avg_percentile', avg_pct, 'best', tests_json)
                  else null end,
    'leaderboard', jsonb_build_object(
      'contribution_rank', case when coalesce((pv->>'balance')::boolean, true) then contrib_rank else null end,
      'predictor_rank',    case when coalesce((pv->>'predictions')::boolean, true) then pred_rank else null end
    ),
    'network', case when coalesce((pv->>'network')::boolean, true)
                    then jsonb_build_object('total', net_total, 'active', net_active)
                    else null end,
    'referral', case when coalesce((pv->>'referral')::boolean, true)
                     then jsonb_build_object('code', ref_code)
                     else null end,
    'activity', case when coalesce((pv->>'activity')::boolean, true) then activity else null end
  );
end;
$$;
grant execute on function public.get_public_profile(text) to anon, authenticated;
