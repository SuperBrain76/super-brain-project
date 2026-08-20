-- ============================================================================
-- MIGRATION 068 — MATCHDAY CHALLENGE (additive, cross-competition venue game)
-- ============================================================================
-- A venue owner hand-picks fixtures across MULTIPLE competitions on a date and
-- creates ONE temporary prediction challenge. Customers scan one QR, predict
-- only those fixtures, and see a live leaderboard.
--
-- STRICTLY ADDITIVE — nothing here touches competitions, fixtures, predictions,
-- prediction_leagues, the scoring trigger, or the migration-047 hierarchy. A
-- challenge is a NEW grouping that REFERENCES existing fixtures; predictions
-- stay global per (user, fixture) so a pick is consistent across a challenge
-- and any normal league.
--
-- SCORING IS UNIFORM AND CHALLENGE-LOCAL: exact 3, correct result 1, else 0 —
-- computed live from the raw prediction vs. the final score inside
-- get_challenge(). It does NOT read predictions.points_awarded (which carries
-- each competition's own rules).
--
-- Locking: none added — predictions already lock per-fixture at kickoff via the
-- existing enforce_prediction_deadline trigger, so a late arrival can still
-- predict matches that haven't started.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.venue_challenges (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  code       text not null unique
             default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  name       text not null,
  prize      text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists venue_challenges_venue_idx on public.venue_challenges (venue_id);

create table if not exists public.challenge_fixtures (
  challenge_id uuid not null references public.venue_challenges(id) on delete cascade,
  fixture_id   uuid not null references public.fixtures(id) on delete cascade,
  primary key (challenge_id, fixture_id)
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.venue_challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- RLS on, no anon/authenticated policies — reached only via the SECURITY
-- DEFINER RPCs below (same pattern as the venue CRM). Predictions themselves
-- are written through the existing predictions path + RLS.
alter table public.venue_challenges     enable row level security;
alter table public.challenge_fixtures   enable row level security;
alter table public.challenge_participants enable row level security;


-- ── get_fixtures_on_date(date) — the owner's fixture picker ──────────────────
create or replace function public.get_fixtures_on_date(p_date date)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare j jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.kicks_off_at, x.competition), '[]'::jsonb)
    into j
  from (
    select f.id, f.kicks_off_at, f.status,
           c.name as competition, c.slug as competition_slug,
           ht.name as home, ht.code as home_code, ht.flag_emoji as home_flag,
           at.name as away, at.code as away_code, at.flag_emoji as away_flag
    from public.fixtures f
    join public.competitions c on c.id = f.competition_id
    join public.teams ht on ht.id = f.home_team_id
    join public.teams at on at.id = f.away_team_id
    where c.status = 'active'
      and f.kicks_off_at >= p_date::timestamptz
      and f.kicks_off_at <  (p_date + 1)::timestamptz
  ) x;

  return j;
end;
$$;
grant execute on function public.get_fixtures_on_date(date) to authenticated;


-- ── create_venue_challenge — owner creates a challenge ──────────────────────
create or replace function public.create_venue_challenge(
  p_name text, p_prize text, p_fixture_ids uuid[]
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_venue uuid; v_id uuid; v_code text; n int;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;

  -- Caller must own a venue (the challenge belongs to it).
  select id into v_venue from public.venues
   where owner_user_id = auth.uid() order by created_at limit 1;
  if v_venue is null then raise exception 'no venue for this account' using errcode = '42501'; end if;

  if p_name is null or length(trim(p_name)) = 0 then raise exception 'name required'; end if;
  if p_fixture_ids is null or array_length(p_fixture_ids, 1) is null then
    raise exception 'pick at least one fixture';
  end if;

  insert into public.venue_challenges (venue_id, name, prize, created_by)
  values (v_venue, trim(p_name), nullif(trim(coalesce(p_prize, '')), ''), auth.uid())
  returning id, code into v_id, v_code;

  -- Only accept fixtures that exist in an ACTIVE competition.
  insert into public.challenge_fixtures (challenge_id, fixture_id)
  select v_id, fid
  from unnest(p_fixture_ids) as fid
  where exists (
    select 1 from public.fixtures f
    join public.competitions c on c.id = f.competition_id
    where f.id = fid and c.status = 'active'
  )
  on conflict do nothing;

  select count(*) into n from public.challenge_fixtures where challenge_id = v_id;
  if n = 0 then
    delete from public.venue_challenges where id = v_id;
    raise exception 'none of the selected fixtures are valid';
  end if;

  insert into public.challenge_participants (challenge_id, user_id)
  values (v_id, auth.uid()) on conflict do nothing;

  return jsonb_build_object('id', v_id, 'code', v_code, 'fixtures', n);
end;
$$;
grant execute on function public.create_venue_challenge(text, text, uuid[]) to authenticated;


-- ── join_challenge — a customer joins (so they appear on the leaderboard) ────
create or replace function public.join_challenge(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select id into v_id from public.venue_challenges where code = upper(trim(p_code));
  if v_id is null then return jsonb_build_object('ok', false); end if;
  insert into public.challenge_participants (challenge_id, user_id)
  values (v_id, auth.uid()) on conflict do nothing;
  return jsonb_build_object('ok', true, 'challenge_id', v_id);
end;
$$;
grant execute on function public.join_challenge(text) to authenticated;


-- ── get_my_challenges — the owner's challenge list ──────────────────────────
create or replace function public.get_my_challenges()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare j jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) into j
  from (
    select ch.code, ch.name, ch.prize, ch.created_at,
           (select count(*) from public.challenge_fixtures cf where cf.challenge_id = ch.id)  as fixtures,
           (select count(*) from public.challenge_participants cp where cp.challenge_id = ch.id) as participants
    from public.venue_challenges ch
    join public.venues v on v.id = ch.venue_id
    where v.owner_user_id = auth.uid()
  ) x;
  return j;
end;
$$;
grant execute on function public.get_my_challenges() to authenticated;


-- ── get_challenge(code) — the customer view + live leaderboard ──────────────
-- Uniform scoring computed live: exact 3, correct result 1, else 0.
create or replace function public.get_challenge(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  ch record; v record;
  j_fixtures jsonb; j_board jsonb;
  v_ends timestamptz; v_all_done boolean;
  v_uid uuid := auth.uid(); v_participants int; v_is_owner boolean; v_is_member boolean;
begin
  select * into ch from public.venue_challenges where code = upper(trim(p_code));
  if not found then return jsonb_build_object('found', false); end if;

  select id, name, slug, city, country, logo_url, colour_primary, colour_ink, owner_user_id
    into v from public.venues where id = ch.venue_id;

  v_is_owner  := v_uid is not null and v_uid = v.owner_user_id;
  v_is_member := v_uid is not null and exists (
    select 1 from public.challenge_participants cp where cp.challenge_id = ch.id and cp.user_id = v_uid);
  select count(*) into v_participants from public.challenge_participants where challenge_id = ch.id;

  -- Fixtures + the caller's own prediction (if any).
  select coalesce(jsonb_agg(to_jsonb(x) order by x.kicks_off_at), '[]'::jsonb),
         max(x.kicks_off_at), bool_and(x.completed)
    into j_fixtures, v_ends, v_all_done
  from (
    select f.id, f.kicks_off_at, f.status,
           (f.home_score is not null and f.away_score is not null) as completed,
           f.home_score as actual_home, f.away_score as actual_away,
           (now() >= f.kicks_off_at) as locked,
           c.name as competition, c.slug as competition_slug,
           ht.name as home, ht.code as home_code, ht.flag_emoji as home_flag,
           at.name as away, at.code as away_code, at.flag_emoji as away_flag,
           mp.home_score as my_home, mp.away_score as my_away
    from public.challenge_fixtures cx
    join public.fixtures f on f.id = cx.fixture_id
    join public.competitions c on c.id = f.competition_id
    join public.teams ht on ht.id = f.home_team_id
    join public.teams at on at.id = f.away_team_id
    left join public.predictions mp on mp.fixture_id = f.id and mp.user_id = v_uid
    where cx.challenge_id = ch.id
  ) x;

  -- Live leaderboard: uniform 3/1/0 over participants.
  select coalesce(jsonb_agg(to_jsonb(b) order by b.points desc, b.picks desc, b.display_name), '[]'::jsonb)
    into j_board
  from (
    select cp.user_id,
      coalesce(nullif(trim(pr.display_name), ''), 'Anonymous') as display_name,
      pr.avatar_url,
      coalesce(sum(case
        when f.home_score is null or f.away_score is null or p.id is null then 0
        when p.home_score = f.home_score and p.away_score = f.away_score then 3
        when (case when p.home_score > p.away_score then 1 when p.home_score < p.away_score then -1 else 0 end)
           = (case when f.home_score > f.away_score then 1 when f.home_score < f.away_score then -1 else 0 end)
             then 1
        else 0 end), 0) as points,
      count(p.id) as picks
    from public.challenge_participants cp
    join public.user_profiles pr on pr.id = cp.user_id
    left join public.challenge_fixtures cx on cx.challenge_id = cp.challenge_id
    left join public.fixtures f on f.id = cx.fixture_id
    left join public.predictions p on p.fixture_id = f.id and p.user_id = cp.user_id
    where cp.challenge_id = ch.id
    group by cp.user_id, pr.display_name, pr.avatar_url
  ) b;

  return jsonb_build_object(
    'found', true,
    'code', ch.code, 'name', ch.name, 'prize', ch.prize, 'created_at', ch.created_at,
    'ends_at', v_ends,
    'status', case when coalesce(v_all_done, false) then 'ended' else 'live' end,
    'is_owner', v_is_owner, 'is_member', v_is_member, 'participants', v_participants,
    'venue', jsonb_build_object('name', v.name, 'slug', v.slug, 'city', v.city,
             'logo_url', v.logo_url, 'primary', v.colour_primary, 'ink', v.colour_ink),
    'fixtures', j_fixtures,
    'leaderboard', j_board
  );
end;
$$;
grant execute on function public.get_challenge(text) to anon, authenticated;
