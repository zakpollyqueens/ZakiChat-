-- =========================================================
-- ZakiChat — Phase 7.4 Group Management
-- =========================================================

create or replace function public.is_group_manager(
  p_group_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

revoke execute
on function public.is_group_manager(uuid)
from public;

grant execute
on function public.is_group_manager(uuid)
to authenticated;


-- =========================================================
-- Update group details
-- =========================================================

create or replace function public.update_group(
  p_group_id uuid,
  p_name text,
  p_description text default null,
  p_avatar_url text default null
)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  if (auth.uid() is null) then
    raise exception 'Authentication required';
  end if;

  if not public.is_group_manager(p_group_id) then
    raise exception 'Only group owners and admins can update the group';
  end if;

  if p_name is null
     or length(trim(p_name)) < 2
     or length(trim(p_name)) > 80 then
    raise exception 'Group name must be between 2 and 80 characters';
  end if;

  if p_description is not null
     and length(p_description) > 180 then
    raise exception 'Group description is too long';
  end if;

  update public.groups
  set
    name = trim(p_name),
    description = nullif(trim(p_description), ''),
    avatar_url = nullif(trim(coalesce(p_avatar_url, '')), ''),
    updated_at = now()
  where id = p_group_id
  returning *
  into v_group;

  if not found then
    raise exception 'Group not found';
  end if;

  update public.conversations
  set
    title = trim(p_name),
    avatar_url = nullif(trim(coalesce(p_avatar_url, '')), ''),
    updated_at = now()
  where id = v_group.conversation_id;

  return v_group;
end;
$$;

revoke execute
on function public.update_group(uuid, text, text, text)
from public;

grant execute
on function public.update_group(uuid, text, text, text)
to authenticated;


-- =========================================================
-- Add member
-- =========================================================

create or replace function public.add_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns public.group_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.group_members;
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_group_manager(p_group_id) then
    raise exception 'Only group owners and admins can add members';
  end if;

  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_user_id
  ) then
    raise exception 'User not found';
  end if;

  if exists (
    select 1
    from public.group_members
    where group_id = p_group_id
      and user_id = p_user_id
  ) then
    raise exception 'User is already a group member';
  end if;

  select conversation_id
  into v_conversation_id
  from public.groups
  where id = p_group_id;

  if v_conversation_id is null then
    raise exception 'Group not found';
  end if;

  insert into public.conversation_members (
    conversation_id,
    user_id
  )
  values (
    v_conversation_id,
    p_user_id
  )
  on conflict (conversation_id, user_id)
  do nothing;

  insert into public.group_members (
    group_id,
    user_id,
    role
  )
  values (
    p_group_id,
    p_user_id,
    'member'
  )
  returning *
  into v_member;

  return v_member;
end;
$$;

revoke execute
on function public.add_group_member(uuid, uuid)
from public;

grant execute
on function public.add_group_member(uuid, uuid)
to authenticated;


-- =========================================================
-- Remove member
-- =========================================================

create or replace function public.remove_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_target_role text;
  v_actor_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select role
  into v_actor_role
  from public.group_members
  where group_id = p_group_id
    and user_id = auth.uid();

  if v_actor_role is null then
    raise exception 'You are not a group member';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Use leave_group to leave the group';
  end if;

  select role
  into v_target_role
  from public.group_members
  where group_id = p_group_id
    and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'User is not a group member';
  end if;

  if v_target_role = 'owner' then
    raise exception 'The group owner cannot be removed';
  end if;

  if v_actor_role = 'member' then
    raise exception 'Only owners and admins can remove members';
  end if;

  if v_actor_role = 'admin'
     and v_target_role = 'admin' then
    raise exception 'Admins cannot remove other admins';
  end if;

  select conversation_id
  into v_conversation_id
  from public.groups
  where id = p_group_id;

  delete from public.group_members
  where group_id = p_group_id
    and user_id = p_user_id;

  delete from public.conversation_members
  where conversation_id = v_conversation_id
    and user_id = p_user_id;

  return true;
end;
$$;

revoke execute
on function public.remove_group_member(uuid, uuid)
from public;

grant execute
on function public.remove_group_member(uuid, uuid)
to authenticated;


-- =========================================================
-- Change member role
-- =========================================================

create or replace function public.set_group_member_role(
  p_group_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.group_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_member public.group_members;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;

  select role
  into v_actor_role
  from public.group_members
  where group_id = p_group_id
    and user_id = auth.uid();

  if v_actor_role <> 'owner' then
    raise exception 'Only the group owner can change admin roles';
  end if;

  select role
  into v_target_role
  from public.group_members
  where group_id = p_group_id
    and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'User is not a group member';
  end if;

  if v_target_role = 'owner' then
    raise exception 'The owner role cannot be changed';
  end if;

  update public.group_members
  set role = p_role
  where group_id = p_group_id
    and user_id = p_user_id
  returning *
  into v_member;

  return v_member;
end;
$$;

revoke execute
on function public.set_group_member_role(uuid, uuid, text)
from public;

grant execute
on function public.set_group_member_role(uuid, uuid, text)
to authenticated;


-- =========================================================
-- Leave group
-- =========================================================

create or replace function public.leave_group(
  p_group_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_conversation_id uuid;
  v_role text;
  v_owner_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select role
  into v_role
  from public.group_members
  where group_id = p_group_id
    and user_id = v_user_id;

  if v_role is null then
    raise exception 'You are not a group member';
  end if;

  if v_role = 'owner' then
    select count(*)
    into v_owner_count
    from public.group_members
    where group_id = p_group_id
      and role = 'owner';

    if v_owner_count = 1 then
      raise exception 'The group owner must transfer ownership before leaving';
    end if;
  end if;

  select conversation_id
  into v_conversation_id
  from public.groups
  where id = p_group_id;

  delete from public.group_members
  where group_id = p_group_id
    and user_id = v_user_id;

  delete from public.conversation_members
  where conversation_id = v_conversation_id
    and user_id = v_user_id;

  return true;
end;
$$;

revoke execute
on function public.leave_group(uuid)
from public;

grant execute
on function public.leave_group(uuid)
to authenticated;
