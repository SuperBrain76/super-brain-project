-- ============================================================
-- 062 — GROWTH DASHBOARD RPC
--
-- The whole back office in one round trip, exactly the metrics that were
-- asked for. SECURITY DEFINER so it can read the RLS-locked venue tables,
-- gated by the existing assert_admin() so only app_admins can call it.
--
-- Rates are computed over DENOMINATORS THAT MAKE SENSE, not over totals:
--   open rate  = opened / delivered-or-sent   (not / all venues)
--   reply rate = replied / sent
-- A rate over the wrong denominator is worse than no rate — it looks precise
-- and reads low forever.
-- ============================================================

create or replace function public.get_growth_dashboard()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  today  date := (now() at time zone 'utc')::date;
  out    jsonb;
begin
  perform public.assert_admin();

  select jsonb_build_object(

    -- ── Funnel ────────────────────────────────────────────
    'prospects', (
      select count(*) from public.venues where status <> 'disqualified'
    ),
    'prospects_total_scraped', (select count(*) from public.venues),
    'verified_emails', (
      select count(*) from public.venues where contact_email_status = 'valid'
    ),
    'awaiting_enrichment', (
      select count(*) from public.venues
      where status = 'prospect' and enriched_at is null
    ),

    -- ── Outreach ──────────────────────────────────────────
    'emails_sent_today', (
      select count(*) from public.outreach_messages
      where sent_at >= today
    ),
    'emails_sent_total', (
      select count(*) from public.outreach_messages where sent_at is not null
    ),
    'open_rate', (
      select case when count(*) filter (where sent_at is not null) = 0 then 0
             else round(100.0 * count(*) filter (where opened_at is not null)
                        / count(*) filter (where sent_at is not null), 1) end
      from public.outreach_messages
    ),
    'reply_rate', (
      select case when count(*) filter (where sent_at is not null) = 0 then 0
             else round(100.0 * count(*) filter (where replied_at is not null)
                        / count(*) filter (where sent_at is not null), 1) end
      from public.outreach_messages
    ),
    'replies_total', (
      select count(*) from public.outreach_messages where replied_at is not null
    ),
    'bounce_rate', (
      select case when count(*) filter (where sent_at is not null) = 0 then 0
             else round(100.0 * count(*) filter (where bounced_at is not null)
                        / count(*) filter (where sent_at is not null), 1) end
      from public.outreach_messages
    ),
    'suppressed', (select count(*) from public.email_suppressions),

    -- ── Revenue ───────────────────────────────────────────
    'trials', (
      select count(*) from public.venue_subscriptions where status = 'trialing'
    ),
    'active_subscriptions', (
      select count(*) from public.venue_subscriptions where status = 'active'
    ),
    'mrr_cents', (
      select coalesce(sum(mrr_cents), 0) from public.venue_subscriptions
      where status in ('active', 'trialing')
    ),
    'mrr_cents_paying', (
      select coalesce(sum(mrr_cents), 0) from public.venue_subscriptions
      where status = 'active'
    ),
    'failed_payments_30d', (
      select count(*) from public.venue_events
      where kind = 'payment_failed' and created_at > now() - interval '30 days'
    ),
    'past_due', (select count(*) from public.venues where status = 'past_due'),

    -- ── Health ────────────────────────────────────────────
    'provisioning_failures', (
      select count(*) from public.venue_events
      where kind = 'provisioning_failed' and created_at > now() - interval '30 days'
    ),
    'system_errors_24h', (
      select count(*) from public.venue_events
      where severity = 'error' and created_at > now() - interval '24 hours'
    ),
    'churned', (select count(*) from public.venues where status = 'churned'),
    'churn_rate', (
      select case when count(*) filter (where paid_at is not null) = 0 then 0
             else round(100.0 * count(*) filter (where status = 'churned')
                        / count(*) filter (where paid_at is not null), 1) end
      from public.venues
    ),

    -- ── Product ───────────────────────────────────────────
    'venue_leagues', (
      select count(*) from public.prediction_leagues where venue_id is not null
    ),
    'players_in_venue_leagues', (
      select count(distinct m.user_id)
      from public.prediction_league_members m
      join public.prediction_leagues l on l.id = m.league_id
      where l.venue_id is not null
    ),
    'countries_live', (
      select count(distinct country) from public.venues
      where status in ('trialing', 'active')
    ),

    -- ── Top countries (by verified prospects, with conversion) ──
    'top_countries', (
      select coalesce(jsonb_agg(c order by c.verified desc), '[]'::jsonb)
      from (
        select
          country,
          count(*)                                            as prospects,
          count(*) filter (where contact_email_status='valid') as verified,
          count(*) filter (where first_emailed_at is not null) as emailed,
          count(*) filter (where replied_at is not null)       as replied,
          count(*) filter (where paid_at is not null)          as paid
        from public.venues
        where status <> 'disqualified'
        group by country
        order by verified desc
        limit 10
      ) c
    ),

    -- ── Top performing sequence ───────────────────────────
    -- Ranked by reply rate, but only campaigns with enough sends to mean
    -- anything: a 1-send campaign at 100% is noise, not a winner.
    'top_sequences', (
      select coalesce(jsonb_agg(s order by s.reply_rate desc), '[]'::jsonb)
      from (
        select
          coalesce(c.name, 'unattributed')                                  as campaign,
          c.language,
          c.country,
          m.step,
          count(*) filter (where m.sent_at is not null)                     as sent,
          round(100.0 * count(*) filter (where m.opened_at is not null)
                / nullif(count(*) filter (where m.sent_at is not null), 0), 1) as open_rate,
          round(100.0 * count(*) filter (where m.replied_at is not null)
                / nullif(count(*) filter (where m.sent_at is not null), 0), 1) as reply_rate
        from public.outreach_messages m
        left join public.outreach_campaigns c on c.id = m.campaign_id
        group by 1, 2, 3, 4
        having count(*) filter (where m.sent_at is not null) >= 25
        order by reply_rate desc nulls last
        limit 10
      ) s
    ),

    'generated_at', to_jsonb(now())
  ) into out;

  return out;
end;
$function$;

grant execute on function public.get_growth_dashboard() to authenticated;


-- ── Recent event feed for the dashboard ─────────────────────
create or replace function public.get_event_log(
  p_limit    integer default 100,
  p_severity text    default null,
  p_venue    uuid    default null
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare out jsonb;
begin
  perform public.assert_admin();

  select coalesce(jsonb_agg(e order by e.created_at desc), '[]'::jsonb)
  into out
  from (
    select
      v.id, v.created_at, v.kind, v.label, v.category, v.severity,
      v.source, v.detail, v.venue_id, v.venue_name, v.country
    from public.event_log_recent v
    where (p_severity is null or v.severity = p_severity)
      and (p_venue    is null or v.venue_id = p_venue)
    order by v.created_at desc
    limit least(greatest(p_limit, 1), 500)
  ) e;

  return out;
end;
$function$;

grant execute on function public.get_event_log(integer, text, uuid) to authenticated;
