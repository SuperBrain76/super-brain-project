-- ============================================================
-- 059 — EVENT LOG (complete)
--
-- 057 gave us venue_events, but it could only record things that happened
-- TO A VENUE. Two of the events we most need to see have no venue attached:
--
--   • a provisioning failure — the venue row may not exist yet, which is
--     exactly the case worth alerting on (they paid, nothing was built);
--   • an n8n workflow failure — that is a system fault, not a venue fact.
--
-- So venue_id becomes nullable and the table gains severity + source. It is
-- now THE event log for the venue business, not just a per-venue timeline.
--
-- severity: info | warn | error   — the dashboard's alert strip reads `error`
-- source:   which system emitted it (app, stripe, instantly, n8n, scraper)
-- ============================================================

alter table public.venue_events
  alter column venue_id drop not null;

alter table public.venue_events
  add column if not exists severity text not null default 'info',
  add column if not exists source   text not null default 'app';

-- Non-venue events still need to be findable by subject (a campaign, a
-- workflow name, a place id) — keep it in detail, but index the common path.
create index if not exists venue_events_severity_idx
  on public.venue_events (severity, created_at desc)
  where severity <> 'info';

create index if not exists venue_events_source_idx
  on public.venue_events (source, created_at desc);

-- ── Canonical event kinds ───────────────────────────────────
-- Deliberately a lookup table, not a CHECK constraint: adding an event kind
-- must never require a migration + deploy. The table documents the taxonomy
-- and lets the dashboard render friendly labels without a code deploy.
create table if not exists public.event_kinds (
  kind        text primary key,
  label       text not null,
  category    text not null,          -- prospecting | outreach | billing | provisioning | system
  severity    text not null default 'info',
  sort_order  integer not null default 100
);

insert into public.event_kinds (kind, label, category, severity, sort_order) values
  -- prospecting
  ('prospect_imported',  'Prospect imported',   'prospecting',  'info',  10),
  ('prospect_enriched',  'Prospect enriched',   'prospecting',  'info',  11),
  ('email_verified',     'Email verified',      'prospecting',  'info',  12),
  ('prospect_rejected',  'Prospect rejected',   'prospecting',  'info',  13),
  -- outreach
  ('email_sent',         'Email sent',          'outreach',     'info',  20),
  ('email_opened',       'Email opened',        'outreach',     'info',  21),
  ('link_clicked',       'Link clicked',        'outreach',     'info',  22),
  ('reply_received',     'Reply received',      'outreach',     'info',  23),
  ('email_bounced',      'Email bounced',       'outreach',     'warn',  24),
  ('unsubscribed',       'Unsubscribed',        'outreach',     'info',  25),
  -- billing
  ('trial_started',      'Trial started',       'billing',      'info',  30),
  ('trial_will_end',     'Trial ending',        'billing',      'info',  31),
  ('subscription_started','Subscription started','billing',     'info',  32),
  ('payment_succeeded',  'Payment succeeded',   'billing',      'info',  33),
  ('payment_failed',     'Payment failed',      'billing',      'warn',  34),
  ('subscription_cancelled','Subscription cancelled','billing',  'warn',  35),
  -- provisioning
  ('venue_provisioned',  'Venue provisioned',   'provisioning', 'info',  40),
  ('league_created',     'League created',      'provisioning', 'info',  41),
  ('qr_generated',       'QR generated',        'provisioning', 'info',  42),
  ('welcome_email_sent', 'Welcome email sent',  'provisioning', 'info',  43),
  ('league_suspended',   'League suspended',    'provisioning', 'warn',  44),
  ('provisioning_failed','Provisioning failed', 'provisioning', 'error', 45),
  -- system
  ('n8n_failed',         'n8n workflow failed', 'system',       'error', 50),
  ('scraper_run',        'Scraper run',         'system',       'info',  51),
  ('sync_failed',        'Sync failed',         'system',       'error', 52)
on conflict (kind) do update
  set label = excluded.label,
      category = excluded.category,
      severity = excluded.severity,
      sort_order = excluded.sort_order;

alter table public.event_kinds enable row level security;

-- ── Dashboard helper: recent errors, newest first ───────────
create or replace view public.event_log_recent as
select
  e.id, e.created_at, e.kind, e.severity, e.source, e.detail,
  e.venue_id, v.name as venue_name, v.country,
  coalesce(k.label, e.kind) as label,
  coalesce(k.category, 'system') as category
from public.venue_events e
left join public.venues v      on v.id = e.venue_id
left join public.event_kinds k on k.kind = e.kind
order by e.created_at desc;
