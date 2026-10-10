-- Rebuild ZakiChat's chat core after the intentional chat subsystem reset.
-- Private messages, group membership, archive/preferences, attachments and reactions.
create extension if not exists pgcrypto;

create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(),
 kind text not null default 'direct' check(kind in ('direct','group')),
 title text, description text, avatar_url text,
 created_by uuid not null references auth.users(id) on delete restrict,
 last_message_at timestamptz, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((kind='direct' and title is null) or kind='group')
);
create table if not exists public.conversation_members (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check(role in ('owner','admin','member')),
 joined_at timestamptz not null default now(), last_read_at timestamptz,
 is_archived boolean not null default false, is_pinned boolean not null default false,
 is_muted boolean not null default false, cleared_at timestamptz,
 unique(conversation_id,user_id)
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete restrict,
 body text not null default '',
 message_type text not null default 'text' check(message_type in ('text','image','video','audio','voice','file','system')),
 attachments jsonb not null default '[]'::jsonb check(jsonb_typeof(attachments)='array'),
 reply_to_id uuid references public.messages(id) on delete set null,
 forwarded_from_id uuid references public.messages(id) on delete set null,
 edited_at timestamptz, deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(length(body)<=10000)
);
create table if not exists public.message_reactions (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check(length(emoji) between 1 and 16),
 created_at timestamptz not null default now(), unique(message_id,user_id,emoji)
);
create table if not exists public.starred_messages (
 user_id uuid not null references auth.users(id) on delete cascade,
 message_id uuid not null references public.messages(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,message_id)
);
create table if not exists public.contacts (
 user_id uuid not null references auth.users(id) on delete cascade,
 contact_user_id uuid not null references auth.users(id) on delete cascade,
 display_name text, created_at timestamptz not null default now(),
 primary key(user_id,contact_user_id), check(user_id<>contact_user_id)
);

create index if not exists conversations_last_message_idx on public.conversations(last_message_at desc nulls last);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id,is_archived,is_pinned);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at desc) where deleted_at is null;
create index if not exists messages_sender_idx on public.messages(sender_id,created_at desc);
create index if not exists reactions_message_idx on public.message_reactions(message_id);
create index if not exists contacts_user_idx on public.contacts(user_id);

create or replace function public.is_conversation_member(p_conversation_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_user_id); $$;
create or replace function public.is_conversation_admin(p_conversation_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_user_id and cm.role in ('owner','admin')); $$;

create or replace function public.create_or_get_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid(); v_conversation_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if p_other_user_id is null or p_other_user_id=v_user_id then raise exception 'Choose another user'; end if;
 if not exists(select 1 from auth.users where id=p_other_user_id) then raise exception 'User not found'; end if;
 select c.id into v_conversation_id from public.conversations c
 join public.conversation_members mine on mine.conversation_id=c.id and mine.user_id=v_user_id
 join public.conversation_members theirs on theirs.conversation_id=c.id and theirs.user_id=p_other_user_id
 where c.kind='direct' and (select count(*) from public.conversation_members allm where allm.conversation_id=c.id)=2 limit 1;
 if v_conversation_id is not null then return v_conversation_id; end if;
 insert into public.conversations(kind,created_by) values('direct',v_user_id) returning id into v_conversation_id;
 insert into public.conversation_members(conversation_id,user_id,role) values(v_conversation_id,v_user_id,'owner'),(v_conversation_id,p_other_user_id,'member');
 return v_conversation_id;
end; $$;

create or replace function public.create_group_conversation(p_title text,p_member_ids uuid[] default '{}'::uuid[],p_description text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid(); v_conversation_id uuid; v_member uuid;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_title,'')))<1 or length(trim(p_title))>100 then raise exception 'Group name must be 1 to 100 characters'; end if;
 insert into public.conversations(kind,title,description,created_by) values('group',trim(p_title),nullif(trim(coalesce(p_description,'')),''),v_user_id) returning id into v_conversation_id;
 insert into public.conversation_members(conversation_id,user_id,role) values(v_conversation_id,v_user_id,'owner');
 foreach v_member in array coalesce(p_member_ids,'{}'::uuid[]) loop
  if v_member<>v_user_id and exists(select 1 from auth.users where id=v_member) then
   insert into public.conversation_members(conversation_id,user_id,role) values(v_conversation_id,v_member,'member') on conflict(conversation_id,user_id) do nothing;
  end if;
 end loop;
 return v_conversation_id;
end; $$;

create or replace function public.set_conversation_message_timestamp()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin update public.conversations set last_message_at=new.created_at,updated_at=now() where id=new.conversation_id; return new; end; $$;
drop trigger if exists messages_set_conversation_timestamp on public.messages;
create trigger messages_set_conversation_timestamp after insert on public.messages for each row execute function public.set_conversation_message_timestamp();
create or replace function public.touch_message_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists messages_touch_updated_at on public.messages;
create trigger messages_touch_updated_at before update on public.messages for each row execute function public.touch_message_updated_at();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.starred_messages enable row level security;
alter table public.contacts enable row level security;

drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations for select to authenticated using(public.is_conversation_member(id,(select auth.uid())));
drop policy if exists conversations_insert_self on public.conversations;
create policy conversations_insert_self on public.conversations for insert to authenticated with check(created_by=(select auth.uid()));
drop policy if exists conversations_update_admin on public.conversations;
create policy conversations_update_admin on public.conversations for update to authenticated using(public.is_conversation_admin(id,(select auth.uid()))) with check(public.is_conversation_admin(id,(select auth.uid())));
drop policy if exists conversations_delete_owner on public.conversations;
create policy conversations_delete_owner on public.conversations for delete to authenticated using(created_by=(select auth.uid()));

drop policy if exists conversation_members_select_member on public.conversation_members;
create policy conversation_members_select_member on public.conversation_members for select to authenticated using(public.is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists conversation_members_insert_self_or_admin on public.conversation_members;
drop policy if exists conversation_members_insert_admin on public.conversation_members;
create policy conversation_members_insert_admin on public.conversation_members for insert to authenticated with check(public.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists conversation_members_update_self_or_admin on public.conversation_members;
create policy conversation_members_update_self_or_admin on public.conversation_members for update to authenticated using(user_id=(select auth.uid()) or public.is_conversation_admin(conversation_id,(select auth.uid()))) with check(user_id=(select auth.uid()) or public.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists conversation_members_delete_self_or_admin on public.conversation_members;
create policy conversation_members_delete_self_or_admin on public.conversation_members for delete to authenticated using((user_id=(select auth.uid()) and role<>'owner') or public.is_conversation_admin(conversation_id,(select auth.uid())));

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select to authenticated using(public.is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists messages_insert_member_sender on public.messages;
create policy messages_insert_member_sender on public.messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.is_conversation_member(conversation_id,(select auth.uid())));
drop policy if exists messages_update_sender_or_admin on public.messages;
create policy messages_update_sender_or_admin on public.messages for update to authenticated using(sender_id=(select auth.uid()) or public.is_conversation_admin(conversation_id,(select auth.uid()))) with check(sender_id=(select auth.uid()) or public.is_conversation_admin(conversation_id,(select auth.uid())));
drop policy if exists messages_delete_sender_or_admin on public.messages;
create policy messages_delete_sender_or_admin on public.messages for delete to authenticated using(sender_id=(select auth.uid()) or public.is_conversation_admin(conversation_id,(select auth.uid())));

drop policy if exists reactions_select_member on public.message_reactions;
create policy reactions_select_member on public.message_reactions for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id,(select auth.uid()))));
drop policy if exists reactions_insert_self_member on public.message_reactions;
create policy reactions_insert_self_member on public.message_reactions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id,(select auth.uid()))));
drop policy if exists reactions_delete_self on public.message_reactions;
create policy reactions_delete_self on public.message_reactions for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists starred_select_self on public.starred_messages;
create policy starred_select_self on public.starred_messages for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists starred_insert_self_member on public.starred_messages;
create policy starred_insert_self_member on public.starred_messages for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id,(select auth.uid()))));
drop policy if exists starred_delete_self on public.starred_messages;
create policy starred_delete_self on public.starred_messages for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists contacts_select_self on public.contacts;
create policy contacts_select_self on public.contacts for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists contacts_insert_self on public.contacts;
create policy contacts_insert_self on public.contacts for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists contacts_update_self on public.contacts;
create policy contacts_update_self on public.contacts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists contacts_delete_self on public.contacts;
create policy contacts_delete_self on public.contacts for delete to authenticated using(user_id=(select auth.uid()));

revoke insert on public.conversations from authenticated;
revoke update on public.conversation_members from authenticated;
grant update(last_read_at,is_archived,is_pinned,is_muted,cleared_at) on public.conversation_members to authenticated;
revoke update on public.messages from authenticated;
grant update(body,attachments,edited_at,deleted_at,updated_at) on public.messages to authenticated;
grant select,insert,update,delete on public.conversations to authenticated;
grant select,insert,update,delete on public.conversation_members to authenticated;
grant select,insert,update,delete on public.messages to authenticated;
grant select,insert,delete on public.message_reactions to authenticated;
grant select,insert,delete on public.starred_messages to authenticated;
grant select,insert,update,delete on public.contacts to authenticated;
revoke all on function public.create_group_conversation(text,uuid[],text) from public,anon;
revoke all on function public.create_or_get_direct_conversation(uuid) from public,anon;
revoke all on function public.is_conversation_admin(uuid,uuid) from public,anon;
revoke all on function public.is_conversation_member(uuid,uuid) from public,anon;
revoke all on function public.set_conversation_message_timestamp() from public,anon,authenticated;
grant execute on function public.create_group_conversation(text,uuid[],text) to authenticated;
grant execute on function public.create_or_get_direct_conversation(uuid) to authenticated;
grant execute on function public.is_conversation_admin(uuid,uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-attachments','chat-attachments',false,52428800,null)
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=null;
drop policy if exists chat_attachment_read_member on storage.objects;
create policy chat_attachment_read_member on storage.objects for select to authenticated
using(bucket_id='chat-attachments' and public.is_conversation_member(((storage.foldername(name))[1])::uuid,(select auth.uid())));
drop policy if exists chat_attachment_upload_member on storage.objects;
create policy chat_attachment_upload_member on storage.objects for insert to authenticated
with check(bucket_id='chat-attachments' and (storage.foldername(name))[2]=(select auth.uid())::text and public.is_conversation_member(((storage.foldername(name))[1])::uuid,(select auth.uid())));
drop policy if exists chat_attachment_delete_owner on storage.objects;
create policy chat_attachment_delete_owner on storage.objects for delete to authenticated
using(bucket_id='chat-attachments' and (storage.foldername(name))[2]=(select auth.uid())::text and public.is_conversation_member(((storage.foldername(name))[1])::uuid,(select auth.uid())));

do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when undefined_object then null; end $$;

-- Column-level permissions: prevent changing ownership, sender identity, timestamps or roles.
revoke update on public.conversations from authenticated;
grant update(title,description,avatar_url,updated_at) on public.conversations to authenticated;
revoke insert on public.conversation_members from authenticated;
grant insert(conversation_id,user_id) on public.conversation_members to authenticated;
revoke insert on public.messages from authenticated;
grant insert(conversation_id,sender_id,body,message_type,attachments,reply_to_id,forwarded_from_id) on public.messages to authenticated;
revoke insert on public.message_reactions from authenticated;
grant insert(message_id,user_id,emoji) on public.message_reactions to authenticated;
revoke insert on public.starred_messages from authenticated;
grant insert(user_id,message_id) on public.starred_messages to authenticated;
revoke update on public.contacts from authenticated;
grant update(display_name) on public.contacts to authenticated;
