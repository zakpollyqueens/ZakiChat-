-- Keep standard uploads at 50 MB and premium uploads in a separate protected bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('message-attachments-premium','message-attachments-premium',false,524288000,null)
on conflict (id) do update set public=false,file_size_limit=524288000,allowed_mime_types=null;
update storage.buckets set file_size_limit=52428800 where id='message-attachments';

drop policy if exists premium_members_can_read_attachments on storage.objects;
create policy premium_members_can_read_attachments on storage.objects
for select to authenticated using (
  bucket_id='message-attachments-premium'
  and exists (select 1 from public.conversation_members cm where cm.conversation_id=((storage.foldername(objects.name))[1])::uuid and cm.user_id=(select auth.uid()))
);
drop policy if exists premium_users_can_upload_attachments on storage.objects;
create policy premium_users_can_upload_attachments on storage.objects
for insert to authenticated with check (
  bucket_id='message-attachments-premium'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and exists (select 1 from public.conversation_members cm where cm.conversation_id=((storage.foldername(objects.name))[1])::uuid and cm.user_id=(select auth.uid()))
  and exists (select 1 from public.user_upgrades u where u.user_id=(select auth.uid()) and u.plan in ('personal_monthly','business_monthly') and u.status='active' and u.expires_at>now())
);
drop policy if exists premium_users_can_delete_attachments on storage.objects;
create policy premium_users_can_delete_attachments on storage.objects
for delete to authenticated using (
  bucket_id='message-attachments-premium'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and exists (select 1 from public.conversation_members cm where cm.conversation_id=((storage.foldername(objects.name))[1])::uuid and cm.user_id=(select auth.uid()))
);
