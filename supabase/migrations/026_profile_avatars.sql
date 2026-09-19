-- ZakiChat profile avatar storage

insert into storage.buckets (
  id,
  name,
  public
)
values (
  'profile-avatars',
  'profile-avatars',
  true
)
on conflict (id) do update
set public = true;

drop policy if exists "Profile avatars are publicly readable"
on storage.objects;

create policy "Profile avatars are publicly readable"
on storage.objects
for select
using (
  bucket_id = 'profile-avatars'
);

drop policy if exists "Users can upload their own profile avatar"
on storage.objects;

create policy "Users can upload their own profile avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own profile avatar"
on storage.objects;

create policy "Users can update their own profile avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own profile avatar"
on storage.objects;

create policy "Users can delete their own profile avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
