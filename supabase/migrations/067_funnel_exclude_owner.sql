-- ============================================================================
-- MIGRATION 067 — FUNNEL: exclude the venue OWNER from "players"
-- ============================================================================
-- Provisioning auto-joins the owner to their own league (provisioning.ts step
-- "owner joins their own league"). So the 066 player counts treated the owner
-- as a customer, inflating "active venues" / "first player registered" — the
-- exact metrics meant to show whether a REAL customer scanned and joined.
--
-- This replaces get_venue_funnel(), get_venue_timeline() and the
-- venue_player_joined() trigger so every "player" figure excludes the owner.
-- create-or-replace only — additive, idempotent, safe to re-run.
-- ============================================================================

-- ── Trigger: don't emit player_joined for the owner's own auto-join ─────────
create or replace function public.venue_player_joined()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_venue uuid; v_owner uuid;
begin
  select pl.venue_id, vn.owner_user_id
    into v_venue, v_owner
  from public.prediction_leagues pl
  left join public.venues vn on vn.id = pl.venue_id
  where pl.id = new.league_id;

  if v_venue is not null and new.user_id is distinct from v_owner then
    insert into public.venue_events (venue_id, kind, detail, source)
    values (v_venue, 'player_joined',
            jsonb_build_object('league_id', new.league_id, 'user_id', new.user_id),
            'app');
  end if;
  return new;
end;
$$;


-- ── get_venue_funnel() — owner excluded from players + predictions ──────────
create or replace function public.get_venue_funnel()
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare j jsonb;
begin
  perform public.assert_admin();

  with ev as (
    select venue_id, kind from public.venue_events where venue_id is not null
  ),
  stages as (
    select
      count(*)                                                              as prospects,
      count(*) filter (where v.first_emailed_at is not null)                as emailed,
      count(*) filter (
        where v.first_clicked_at is not null
           or v.id in (select venue_id from ev where kind = 'landing_viewed')
      )                                                                     as clicked,
      count(*) filter (
        where v.status in ('signed_up','trialing','active','past_due','churned')
           or v.id in (select venue_id from ev where kind in ('signup_started','checkout_opened'))
      )                                                                     as signups,
      count(*) filter (
        where v.trial_started_at is not null
           or v.status in ('trialing','active','past_due','churned')
      )                                                                     as trials,
      count(*) filter (where v.onboarded_at is not null)                    as onboarded,
      count(*) filter (where v.status = 'active')                           as paying
    from public.venues v
  ),
  evol as (
    select
      count(*) filter (where kind = 'landing_viewed')        as landing_views,
      count(*) filter (where kind = 'start_clicked')         as start_clicks,
      count(*) filter (where kind = 'signup_started')        as signup_starts,
      count(*) filter (where kind = 'checkout_opened')       as checkouts_opened,
      count(*) filter (where kind = 'launch_pack_generated') as launch_packs,
      count(*) filter (where kind = 'qr_scanned')            as qr_scans
    from public.venue_events
  ),
  players as (
    select count(distinct pl.venue_id) as venues_with_players
    from public.prediction_leagues pl
    join public.prediction_league_members m on m.league_id = pl.id
    join public.venues vn on vn.id = pl.venue_id
    where pl.venue_id is not null
      and m.user_id is distinct from vn.owner_user_id      -- exclude the owner
  ),
  preds as (
    select count(distinct pl.venue_id) as venues_with_predictions
    from public.prediction_leagues pl
    join public.prediction_league_members m on m.league_id = pl.id
    join public.venues vn on vn.id = pl.venue_id
    join public.fixtures f on f.competition_id = pl.competition_id
    join public.predictions p on p.fixture_id = f.id and p.user_id = m.user_id
    where pl.venue_id is not null
      and m.user_id is distinct from vn.owner_user_id      -- exclude the owner
  )
  select jsonb_build_object(
    'prospects',   s.prospects,
    'emailed',     s.emailed,
    'clicked',     s.clicked,
    'signups',     s.signups,
    'trials',      s.trials,
    'onboarded',   s.onboarded,
    'paying',      s.paying,
    'active_venues', pl.venues_with_players,
    'venues_with_predictions', pr.venues_with_predictions,
    'events', jsonb_build_object(
      'landing_views',    ev.landing_views,
      'start_clicks',     ev.start_clicks,
      'signup_starts',    ev.signup_starts,
      'checkouts_opened', ev.checkouts_opened,
      'launch_packs',     ev.launch_packs,
      'qr_scans',         ev.qr_scans
    ),
    'generated_at', now()
  ) into j
  from stages s, evol ev, players pl, preds pr;

  return j;
end;
$$;
grant execute on function public.get_venue_funnel() to authenticated;


-- ── get_venue_timeline() — owner excluded from players + predictions ────────
create or replace function public.get_venue_timeline(p_query text)
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare
  v            public.venues%rowtype;
  vid          uuid;
  j_events     jsonb;
  players_ct   int;
  first_player timestamptz;
  preds_ct     int;
  first_pred   timestamptz;
begin
  perform public.assert_admin();

  begin vid := p_query::uuid; exception when others then vid := null; end;

  select * into v from public.venues
  where (vid is not null and id = vid)
     or (vid is null and (name ilike '%' || p_query || '%'
                          or contact_email ilike '%' || p_query || '%'))
  order by (name ilike coalesce(p_query,'')) desc, created_at desc
  limit 1;

  if not found then return jsonb_build_object('found', false); end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc), '[]'::jsonb)
    into j_events
  from (
    select e.created_at, e.kind,
           coalesce(k.label, e.kind)      as label,
           coalesce(k.category, 'system') as category,
           e.severity, e.source, e.detail
    from public.venue_events e
    left join public.event_kinds k on k.kind = e.kind
    where e.venue_id = v.id
  ) x;

  select count(distinct m.user_id), min(m.joined_at)
    into players_ct, first_player
  from public.prediction_leagues pl
  join public.prediction_league_members m on m.league_id = pl.id
  where pl.venue_id = v.id
    and m.user_id is distinct from v.owner_user_id;         -- exclude the owner

  select count(*), min(p.submitted_at)
    into preds_ct, first_pred
  from public.prediction_leagues pl
  join public.prediction_league_members m on m.league_id = pl.id
  join public.fixtures f on f.competition_id = pl.competition_id
  join public.predictions p on p.fixture_id = f.id and p.user_id = m.user_id
  where pl.venue_id = v.id
    and m.user_id is distinct from v.owner_user_id;         -- exclude the owner

  return jsonb_build_object(
    'found', true,
    'venue', jsonb_build_object(
      'id', v.id, 'name', v.name, 'slug', v.slug, 'status', v.status,
      'city', v.city, 'country', v.country, 'contact_email', v.contact_email,
      'source', v.source, 'created_at', v.created_at
    ),
    'milestones', jsonb_build_object(
      'created_at', v.created_at, 'first_emailed_at', v.first_emailed_at,
      'first_opened_at', v.first_opened_at, 'first_clicked_at', v.first_clicked_at,
      'replied_at', v.replied_at, 'trial_started_at', v.trial_started_at,
      'onboarded_at', v.onboarded_at, 'paid_at', v.paid_at, 'churned_at', v.churned_at
    ),
    'product', jsonb_build_object(
      'players', coalesce(players_ct, 0), 'first_player_at', first_player,
      'predictions', coalesce(preds_ct, 0), 'first_prediction_at', first_pred
    ),
    'events', j_events
  );
end;
$$;
grant execute on function public.get_venue_timeline(text) to authenticated;
