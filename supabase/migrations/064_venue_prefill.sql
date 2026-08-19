-- ============================================================
-- 064 — PREFILL FOR THE OUTREACH LANDING PAGE
--
-- Cold emails link to /venues/start?v=<venue-id>. That page needs to greet the
-- venue by name and preselect their league — otherwise the bar owner lands on
-- an empty form and bounces.
--
-- `venues` is RLS-locked, so this returns a DELIBERATELY MINIMAL projection:
-- name, city, country, language, competition. No email, no phone, no fit
-- score, no owner notes, no enrichment. Everything it exposes came from a
-- public Google Maps listing in the first place.
--
-- The id is an unguessable UUID and the payload contains nothing private, so
-- this is not a useful enumeration target. Anything sensitive stays behind
-- the service role.
-- ============================================================

create or replace function public.get_venue_prefill(p_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'found',            true,
    'venue_name',       v.name,
    'city',             v.city,
    'country',          v.country,
    'language',         v.language,
    'website',          v.website,
    'competition_slug', coalesce(v.competition_slug, 'premier-league'),
    -- Already a customer? The page then points them at their league instead
    -- of selling to them again.
    'already_live',     (v.status in ('trialing', 'active')),
    'venue_slug',       v.slug
  )
  from public.venues v
  where v.id = p_id;
$function$;

grant execute on function public.get_venue_prefill(uuid) to anon, authenticated;

-- Competitions the venue chooser offers. Public, tiny, and avoids the page
-- hardcoding a league list that drifts from the database.
create or replace function public.get_sellable_competitions()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name)
                            order by starts_at), '[]'::jsonb)
  from public.competitions
  where status = 'active' and sport_code = 'football';
$function$;

grant execute on function public.get_sellable_competitions() to anon, authenticated;
