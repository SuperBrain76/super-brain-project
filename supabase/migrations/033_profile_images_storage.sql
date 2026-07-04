-- ============================================================================
-- MIGRATION 033 — PROFILE IMAGE STORAGE (avatars + banners)
-- ============================================================================
-- Idempotent. Creates a public Storage bucket for user-uploaded avatar/banner
-- images and RLS on storage.objects so each user can only write inside their
-- own folder ({user_id}/...). Public read so images render anywhere.
--
-- Replaces the old developer-only "paste an https URL" fields with real uploads.
-- ============================================================================

-- Public bucket, 5 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images', 'profile-images', true, 5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Anyone can read (bucket is public; explicit select policy for clarity).
drop policy if exists "profile-images public read" on storage.objects;
create policy "profile-images public read"
  on storage.objects for select
  using (bucket_id = 'profile-images');

-- A user may write ONLY inside their own uid-named folder.
drop policy if exists "profile-images user insert" on storage.objects;
create policy "profile-images user insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile-images user update" on storage.objects;
create policy "profile-images user update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile-images user delete" on storage.objects;
create policy "profile-images user delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
