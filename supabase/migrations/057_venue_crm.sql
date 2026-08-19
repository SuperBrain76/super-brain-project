-- ============================================================
-- 057 — VENUE CRM + OUTBOUND + BILLING SPINE
--
-- One spine for the venue business (sports bars / pubs / restaurants
-- running a branded prediction league):
--
--   venues              the single source of truth — a row is created the
--                       moment a venue is *prospected* and carries the same
--                       id all the way through to paying customer.
--   venue_events        append-only activity log (funnel + audit).
--   outreach_campaigns  a named send (country + language + template).
--   outreach_messages   one row per email, with Resend ids + engagement.
--   email_suppressions  hard block list — unsubscribes, bounces, complaints.
--   venue_subscriptions Stripe mirror (customer, subscription, MRR).
--
-- prediction_leagues gains venue_id so a branded league points back at the
-- venue that pays for it.
--
-- All of these are BACK OFFICE: RLS is on with no anon/authenticated
-- policies, so only the service role (server routes, n8n) can touch them.
-- Idempotent — safe to re-run.
-- ============================================================

-- ── VENUES ──────────────────────────────────────────────────
create table if not exists public.venues (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique,                     -- /v/<slug> once live

  -- identity (from prospecting)
  name              text        not null,
  country           text        not null,            -- ISO-3166-1 alpha-2: GB DE ES FR IT
  city              text,
  chain             text,                            -- null = independent
  website           text,
  address           text,
  google_place_id   text unique,                     -- dedupe key from Maps scrape
  language          text        not null default 'en',   -- en de es fr it

  -- primary contact (denormalised on purpose — one contact per venue)
  contact_name      text,
  contact_role      text,
  contact_email     text,
  contact_email_status text     not null default 'unverified',  -- unverified|valid|risky|invalid
  contact_phone     text,
  linkedin_url      text,

  -- product fit
  competition_slug  text,                            -- premier-league | la-liga | ...

  -- branding (filled at onboarding)
  logo_url          text,
  banner_url        text,
  colour_primary    text        not null default '#F5B301',
  colour_ink        text        not null default '#12100E',

  -- ownership inside the app
  owner_user_id     uuid references auth.users(id) on delete set null,

  -- funnel state — the one column the dashboard groups by
  status            text        not null default 'prospect',
  -- prospect | verified | contacted | opened | replied | signed_up
  --          | trialing | active | past_due | suspended | churned | disqualified

  source            text        not null default 'google_maps',
  owner_notes       text,

  -- denormalised funnel timestamps (cheap dashboard, no joins)
  verified_at       timestamptz,
  first_emailed_at  timestamptz,
  last_emailed_at   timestamptz,
  first_opened_at   timestamptz,
  first_clicked_at  timestamptz,
  replied_at        timestamptz,
  signed_up_at      timestamptz,
  trial_started_at  timestamptz,
  paid_at           timestamptz,
  churned_at        timestamptz,

  emails_sent       integer     not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists venues_contact_email_key
  on public.venues (lower(contact_email)) where contact_email is not null;
create index if not exists venues_status_idx      on public.venues (status);
create index if not exists venues_country_idx     on public.venues (country);
create index if not exists venues_language_idx    on public.venues (language);
create index if not exists venues_created_idx     on public.venues (created_at desc);

-- ── VENUE EVENTS (append-only) ──────────────────────────────
create table if not exists public.venue_events (
  id         bigserial   primary key,
  venue_id   uuid        not null references public.venues(id) on delete cascade,
  kind       text        not null,   -- imported|verified|email_sent|email_opened|
                                     -- email_clicked|email_replied|email_bounced|
                                     -- signed_up|trial_started|paid|payment_failed|
                                     -- suspended|churned|note
  detail     jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists venue_events_venue_idx on public.venue_events (venue_id, created_at desc);
create index if not exists venue_events_kind_idx  on public.venue_events (kind, created_at desc);

-- ── OUTREACH CAMPAIGNS ──────────────────────────────────────
create table if not exists public.outreach_campaigns (
  id            uuid        primary key default gen_random_uuid(),
  key           text        unique not null,          -- 'gb-pl-launch-01'
  name          text        not null,
  country       text,                                 -- null = multi-country
  language      text        not null default 'en',
  template_key  text        not null,                 -- code-side template id
  from_email    text        not null,
  reply_to      text,
  daily_cap     integer     not null default 500,     -- deliverability guard rail
  status        text        not null default 'draft', -- draft|running|paused|done
  created_at    timestamptz not null default now()
);

-- ── OUTREACH MESSAGES ───────────────────────────────────────
create table if not exists public.outreach_messages (
  id                uuid        primary key default gen_random_uuid(),
  venue_id          uuid        not null references public.venues(id) on delete cascade,
  campaign_id       uuid        references public.outreach_campaigns(id) on delete set null,
  step              integer     not null default 1,   -- 1 = first touch, 2 = bump, ...
  to_email          text        not null,
  subject           text        not null,
  language          text        not null default 'en',
  provider_id       text,                             -- Resend message id
  status            text        not null default 'queued',
  -- queued|sent|delivered|opened|clicked|replied|bounced|complained|failed|skipped
  error             text,
  sent_at           timestamptz,
  delivered_at      timestamptz,
  opened_at         timestamptz,
  clicked_at        timestamptz,
  replied_at        timestamptz,
  bounced_at        timestamptz,
  created_at        timestamptz not null default now()
);
create unique index if not exists outreach_messages_once
  on public.outreach_messages (venue_id, campaign_id, step);
create index if not exists outreach_messages_provider_idx on public.outreach_messages (provider_id);
create index if not exists outreach_messages_status_idx   on public.outreach_messages (status, sent_at desc);

-- ── EMAIL SUPPRESSIONS (never send again) ───────────────────
create table if not exists public.email_suppressions (
  email      text        primary key,      -- always stored lower-case
  reason     text        not null,         -- unsubscribed|bounced|complained|manual
  detail     text,
  created_at timestamptz not null default now()
);

-- ── VENUE SUBSCRIPTIONS (Stripe mirror) ─────────────────────
create table if not exists public.venue_subscriptions (
  id                      uuid        primary key default gen_random_uuid(),
  venue_id                uuid        not null references public.venues(id) on delete cascade,
  stripe_customer_id      text        not null,
  stripe_subscription_id  text        unique,
  stripe_price_id         text,
  plan                    text        not null default 'monthly',   -- monthly|annual
  status                  text        not null default 'incomplete',
  -- trialing|active|past_due|canceled|unpaid|incomplete
  currency                text        not null default 'eur',
  amount_cents            integer     not null default 0,           -- per period
  mrr_cents               integer     not null default 0,           -- normalised monthly
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean     not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists venue_subs_venue_idx    on public.venue_subscriptions (venue_id);
create index if not exists venue_subs_customer_idx on public.venue_subscriptions (stripe_customer_id);
create index if not exists venue_subs_status_idx   on public.venue_subscriptions (status);

-- ── STRIPE EVENT LEDGER (idempotency for the webhook) ───────
create table if not exists public.stripe_events (
  id           text        primary key,     -- Stripe event id (evt_...)
  type         text        not null,
  processed_at timestamptz not null default now(),
  payload      jsonb
);

-- ── LINK BRANDED LEAGUES BACK TO THE VENUE ──────────────────
alter table public.prediction_leagues
  add column if not exists venue_id uuid references public.venues(id) on delete set null;
create index if not exists prediction_leagues_venue_idx on public.prediction_leagues (venue_id);

-- ── updated_at triggers ─────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists venues_touch on public.venues;
create trigger venues_touch before update on public.venues
  for each row execute function public.touch_updated_at();

drop trigger if exists venue_subs_touch on public.venue_subscriptions;
create trigger venue_subs_touch before update on public.venue_subscriptions
  for each row execute function public.touch_updated_at();

-- ── RLS: back office only (service role bypasses RLS) ───────
alter table public.venues              enable row level security;
alter table public.venue_events        enable row level security;
alter table public.outreach_campaigns  enable row level security;
alter table public.outreach_messages   enable row level security;
alter table public.email_suppressions  enable row level security;
alter table public.venue_subscriptions enable row level security;
alter table public.stripe_events       enable row level security;

-- The one exception: a venue owner may read their own venue row.
drop policy if exists "venue owner reads own venue" on public.venues;
create policy "venue owner reads own venue"
  on public.venues for select to authenticated
  using (owner_user_id = auth.uid());

-- ── FUNNEL VIEW (powers the dashboard in one query) ─────────
create or replace view public.venue_funnel as
select
  count(*)                                                     as venues_found,
  count(*) filter (where contact_email_status = 'valid')        as verified_emails,
  count(*) filter (where first_emailed_at is not null)          as emailed,
  count(*) filter (where first_opened_at  is not null)          as opened,
  count(*) filter (where replied_at       is not null)          as replied,
  count(*) filter (where signed_up_at     is not null)          as signed_up,
  count(*) filter (where trial_started_at is not null)          as trials,
  count(*) filter (where paid_at          is not null)          as paid,
  count(distinct country)                                       as countries
from public.venues
where status <> 'disqualified';

comment on table public.venues is
  'Single source of truth for the venue business: prospect → customer, one row.';
