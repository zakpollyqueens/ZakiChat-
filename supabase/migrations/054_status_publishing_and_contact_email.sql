-- ZakiChat status publishing and editable secondary contact details.
-- Fix the upload-before-row sequence: users may upload only inside their own
-- status folder. Status visibility still uses the status_updates RLS policies.
alter table public.profiles
  add column if not exists contact_email text;

alter table public.status_updates
  drop constraint if exists status_updates_media_type_check;

alter table public.status_updates
  add constraint status_updates_media_type_check
  check (media_type is null or media_type in ('image','video','audio'));

drop policy if exists "Users can upload status media" on storage.objects;
create policy "Users can upload status media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'status-updates'
  and (storage.foldername(name))[1] = auth.uid()::text
  and coalesce((storage.foldername(name))[2], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

drop policy if exists "Users can create their own statuses" on public.status_updates;
create policy "Users can create their own statuses"
on public.status_updates
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (text is not null or media_path is not null)
  and (media_type is null or media_type in ('image','video','audio'))
);
