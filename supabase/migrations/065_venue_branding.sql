-- ============================================================================
-- MIGRATION 065 — VENUE BRANDING + LOGO STORAGE
-- ============================================================================
-- Additive only. Extends the venue onboarding so that, straight after payment,
-- a venue captures its full brand (logo, two colours, socials) and we can
-- auto-generate its Launch Pack — printable posters, table tents, a TV
-- leaderboard and social graphics — all in its own colours.
--
-- `colour_primary` / `colour_ink` / `logo_url` / `banner_url` already exist
-- (migration 057). This adds the missing pieces and a public bucket for the
-- logo, written server-side by the service role during onboarding.
-- ============================================================================

alter table public.venues
  add column if not exists colour_secondary text,          -- optional accent
  add column if not exists instagram        text,          -- @handle or url
  add column if not exists facebook         text,          -- page url
  add column if not exists staff_emails     text[] not null default '{}',
  add column if not exists onboarding_step  text,          -- last wizard step reached
  add column if not exists onboarded_at     timestamptz;   -- wizard finished

comment on column public.venues.colour_secondary is 'Optional secondary brand colour for asset accents.';
comment on column public.venues.onboarding_step  is 'Last step the owner reached in the post-payment setup wizard.';

-- ── Logo bucket ─────────────────────────────────────────────────────────────
-- Public read (logos render on posters, TVs, social). Writes are server-side
-- only, via the service role during provisioning/onboarding, so there is no
-- authenticated-user insert policy — the venue owner never uploads directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-logos', 'venue-logos', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/svg+xml'];

drop policy if exists "venue-logos public read" on storage.objects;
create policy "venue-logos public read"
  on storage.objects for select
  using (bucket_id = 'venue-logos');
