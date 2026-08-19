-- ============================================================
-- 058 — Find an auth user by email (venue provisioning)
--
-- user_profiles has no email column — addresses live in auth.users, which
-- PostgREST cannot reach. Provisioning needs an O(1) "does this bar owner
-- already have an account?" check; the alternative is paging listUsers()
-- on every webhook.
--
-- SECURITY DEFINER and granted to NOBODY: the service role bypasses RLS and
-- calls it directly. anon/authenticated cannot execute it, so this is not an
-- email-enumeration hole.
-- ============================================================

create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable security definer
set search_path to 'public', 'auth'
as $function$
  select id from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;
$function$;

revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
