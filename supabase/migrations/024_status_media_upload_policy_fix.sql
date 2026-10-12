-- Permit authenticated users to upload status media to their own user/status UUID path.
-- The client uploads the object before inserting status_updates, so requiring an existing
-- status row here rejects valid first-time uploads.
drop policy if exists "Users can upload status media" on storage.objects;
create policy "Users can upload status media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'status-updates'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Voice statuses are supported by the composer and uploader.
alter table public.status_updates
  drop constraint if exists status_updates_media_type_check;
alter table public.status_updates
  add constraint status_updates_media_type_check
  check (media_type is null or media_type in ('image','video','audio'));
