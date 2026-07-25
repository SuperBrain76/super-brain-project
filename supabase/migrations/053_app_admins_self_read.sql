-- ============================================================
-- MIGRATION 053 — app_admins self-read policy
--
-- Fix: the client-side admin gate (CompetitionShell, for internal/draft
-- competitions) reads app_admins to check if the current user is an admin.
-- app_admins had RLS enabled but NO select policy, so the authenticated
-- client could never read it — even the real admin was denied, and an
-- internal competition showed a blank/404 for everyone. This is what caused
-- the black screen on the internal Premier League.
--
-- The fix: allow a user to read ONLY THEIR OWN app_admins row. This lets the
-- client answer "am I an admin?" without exposing the admin list to anyone.
-- Server-side checks (assert_admin, admin RPCs) are unaffected — they run as
-- SECURITY DEFINER and never depended on this.
--
-- DEPENDS ON: 005 (app_admins)
-- SAFE TO RE-RUN: yes.
-- ROLLBACK: drop policy "read own admin row" on public.app_admins;
-- ============================================================

alter table public.app_admins enable row level security;

drop policy if exists "read own admin row" on public.app_admins;
create policy "read own admin row"
  on public.app_admins for select
  using (user_id = auth.uid());

insert into public.schema_migrations (version, name, notes)
values ('053', 'app_admins_self_read',
        'Users can read their own app_admins row so the client-side admin gate '
        '(internal/draft competition preview) works.')
on conflict (version) do nothing;

do $$
begin
  raise notice '053: app_admins self-read policy added — internal-preview admin gate now works.';
end;
$$;
