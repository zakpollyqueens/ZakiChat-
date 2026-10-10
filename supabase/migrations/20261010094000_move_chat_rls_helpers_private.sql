-- Keep membership predicates outside the exposed API schema.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_conversation_member(p_conversation_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_user_id); $$;
create or replace function private.is_conversation_admin(p_conversation_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_user_id and cm.role in ('owner','admin')); $$;
revoke all on function private.is_conversation_member(uuid,uuid) from public,anon;
revoke all on function private.is_conversation_admin(uuid,uuid) from public,anon;
grant execute on function private.is_conversation_member(uuid,uuid) to authenticated;
grant execute on function private.is_conversation_admin(uuid,uuid) to authenticated;

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select to authenticated using(private.is_conversation_member(id,(select auth.uid())));
drop policy if exists conversations_update_admin on public.conversations;
create policy conversations_update_admin on public.conversations for update to authenticated using(private.is_conversation_admin(id,(select auth.uid()))) with check(private.is_conversation_admin(id,(select auth.uid())));
drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members for select to authenticated using(private.is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists conversation_members_insert_admin on public.conversation_members;
create policy conversation_members_insert_admin on public.conversation_members for insert to authenticated with check(private.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists conversation_members_update_self_or_admin on public.conversation_members;
create policy conversation_members_update_self_or_admin on public.conversation_members for update to authenticated using(user_id=(select auth.uid()) or private.is_conversation_admin(conversation_id,(select auth.uid()))) with check(user_id=(select auth.uid()) or private.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists conversation_members_delete_self_or_admin on public.conversation_members;
create policy conversation_members_delete_self_or_admin on public.conversation_members for delete to authenticated using((user_id=(select auth.uid()) and role<>'owner') or private.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select to authenticated using(private.is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists messages_insert_member_sender on public.messages;
create policy messages_insert_member_sender on public.messages for insert to authenticated with check(sender_id=(select auth.uid()) and private.is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists messages_update_sender_or_admin on public.messages;
create policy messages_update_sender_or_admin on public.messages for update to authenticated using(sender_id=(select auth.uid()) or private.is_conversation_admin(conversation_id,(select auth.uid()))) with check(sender_id=(select auth.uid()) or private.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists messages_delete_sender_or_admin on public.messages;
create policy messages_delete_sender_or_admin on public.messages for delete to authenticated using(sender_id=(select auth.uid()) or private.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists reactions_select_member on public.message_reactions;
create policy reactions_select_member on public.message_reactions for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id and private.is_conversation_member(m.conversation_id,(select auth.uid()))));
drop policy if exists reactions_insert_self_member on public.message_reactions;
create policy reactions_insert_self_member on public.message_reactions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and private.is_conversation_member(m.conversation_id,(select auth.uid()))));
drop policy if exists starred_insert_self_member on public.starred_messages;
create policy starred_insert_self_member on public.starred_messages for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and private.is_conversation_member(m.conversation_id,(select auth.uid()))));
drop policy if exists chat_attachment_read_member on storage.objects;
create policy chat_attachment_read_member on storage.objects for select to authenticated using(bucket_id='chat-attachments' and private.is_conversation_member(((storage.foldername(name))[1])::uuid,(select auth.uid())));
drop policy if exists chat_attachment_upload_member on storage.objects;
create policy chat_attachment_upload_member on storage.objects for insert to authenticated with check(bucket_id='chat-attachments' and (storage.foldername(name))[2]=(select auth.uid())::text and private.is_conversation_member(((storage.foldername(name))[1])::uuid,(select auth.uid())));
drop policy if exists chat_attachment_delete_owner on storage.objects;
create policy chat_attachment_delete_owner on storage.objects for delete to authenticated using(bucket_id='chat-attachments' and (storage.foldername(name))[2]=(select auth.uid())::text and private.is_conversation_member(((storage.foldername(name))[1])::uuid,(select auth.uid())));
create or replace function public.create_direct_call(p_conversation_id uuid,p_call_type text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_peer uuid; v_call uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_call_type not in ('audio','video') then raise exception 'Invalid call type'; end if;
 if not exists(select 1 from public.conversations c where c.id=p_conversation_id and c.kind='direct' and private.is_conversation_member(c.id,v_user)) then raise exception 'Calls are only available in direct conversations'; end if;
 select user_id into v_peer from public.conversation_members where conversation_id=p_conversation_id and user_id<>v_user limit 1;
 if v_peer is null then raise exception 'Conversation participant not found'; end if;
 insert into public.calls(conversation_id,caller_id,callee_id,call_type) values(p_conversation_id,v_user,v_peer,p_call_type) returning id into v_call;
 return v_call;
end; $$;
revoke all on function public.is_conversation_member(uuid,uuid) from public,anon,authenticated;
revoke all on function public.is_conversation_admin(uuid,uuid) from public,anon,authenticated;
