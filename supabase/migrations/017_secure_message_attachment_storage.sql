-- Secure ZakiChat message attachment storage by conversation membership.

drop policy if exists "Users can upload message attachments"
on storage.objects;

create policy "Users can upload message attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id =
      ((storage.foldername(name))[1])::uuid
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read message attachments"
on storage.objects;

create policy "Conversation members can read message attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id =
      ((storage.foldername(name))[1])::uuid
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their message attachments"
on storage.objects;

create policy "Users can delete their message attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id =
      ((storage.foldername(name))[1])::uuid
      and cm.user_id = auth.uid()
  )
);
