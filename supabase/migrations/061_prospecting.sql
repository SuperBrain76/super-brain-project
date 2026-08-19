-- ============================================================
-- 061 — PROSPECTING + ENRICHMENT columns
--
-- What the Google Places sweep and the AI enrichment pass need to store, and
-- the one flag that stops the Instantly sync pushing the same venue twice.
--
-- fit_score is the whole point of the enrichment step: a Places search for
-- "sports bar" in Madrid returns hotel lobbies, shisha cafés and a Hooters.
-- Emailing all of them is how a sending domain dies. Only venues that score
-- above the threshold are ever pushed to a campaign.
-- ============================================================

alter table public.venues
  add column if not exists google_rating      numeric(2,1),
  add column if not exists google_reviews     integer,
  add column if not exists place_types        text[],
  add column if not exists shows_live_sport   boolean,
  add column if not exists fit_score          integer,
  add column if not exists fit_reason         text,
  add column if not exists enrichment         jsonb,
  add column if not exists enriched_at        timestamptz,
  add column if not exists outreach_pushed_at timestamptz;

-- The sync selects on exactly this predicate every run.
create index if not exists venues_ready_for_outreach_idx
  on public.venues (country, fit_score desc)
  where status = 'verified'
    and contact_email_status = 'valid'
    and outreach_pushed_at is null;

create index if not exists venues_needs_enrichment_idx
  on public.venues (created_at)
  where enriched_at is null and status = 'prospect';

comment on column public.venues.fit_score is
  '0-100 from AI enrichment. Below OUTREACH_MIN_FIT_SCORE is never emailed.';
