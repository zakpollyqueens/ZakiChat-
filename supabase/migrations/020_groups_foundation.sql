-- =========================================================
-- ZakiChat Phase 7.1
-- Groups foundation
--
-- Groups reuse the existing conversation + message system.
-- A group owns one conversation whose type is "group".
-- Messages continue to live in public.messages.
-- =========================================================


-- =========================================================
-- GROUPS
-- =========================================================

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,

  name text not null,
  description text,
  avatar_url text,

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint groups_name_check
    check (length(trim(name)) between 2 and 80),

  constraint groups_description_check
    check (
      description is null
      or length(description) <= 180
    ),

  constraint groups_conversation_unique
    unique (conversation_id)
);


create index if not exists groups_created_by_idx
on public.groups(created_by);

create index if not exists groups_created_at_idx
on public.groups(created_at desc);


-- =========================================================
-- GROUP MEMBERS
-- =========================================================

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),

  group_id uuid not null
    references public.groups(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'member',

  joined_at timestamptz not null default now(),
  last_read_at timestamptz,

  constraint group_members_role_check
    check (
      role in ('owner', 'admin', 'member')
    ),

  constraint group_members_unique
    unique (group_id, user_id)
);


create index if not exists group_members_group_id_idx
on public.group_members(group_id);

create index if not exists group_members_user_id_idx
on public.group_members(user_id);

create index if not exists group_members_group_role_idx
on public.group_members(group_id, role);


-- =========================================================
-- UPDATED-AT TRIGGER
-- =========================================================

create or replace function public.set_group_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists groups_set_updated_at
on public.groups;

create trigger groups_set_updated_at
before update on public.groups
for each row
execute function public.set_group_updated_at();


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.groups
enable row level security;

alter table public.group_members
enable row level security;


-- =========================================================
-- GROUP SELECT
-- =========================================================

drop policy if exists "Group members can view groups"
on public.groups;

create policy "Group members can view groups"
on public.groups
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
  )
);


-- =========================================================
-- GROUP MEMBER SELECT
-- =========================================================

drop policy if exists "Group members can view group members"
on public.group_members;

create policy "Group members can view group members"
on public.group_members
for select
to authenticated
using (
  exists (
    select 1
    from public.group_members viewer
    where viewer.group_id = group_members.group_id
      and viewer.user_id = auth.uid()
  )
);


-- =========================================================
-- SECURE GROUP CREATION
--
-- Creates:
--   1. group conversation
--   2. group record
--   3. conversation membership
--   4. group ownership membership
--
-- The creator becomes the owner automatically.
-- =========================================================

create or replace function public.create_group(
  p_name text,
  p_description text default null,
  p_avatar_url text default null
)
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_conversation_id uuid;
  v_group public.groups;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
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


  -- Create the group conversation.
  insert into public.conversations (
    type,
    title,
    avatar_url
  )
  values (
    'group',
    trim(p_name),
    nullif(trim(coalesce(p_avatar_url, '')), '')
  )
  returning id
  into v_conversation_id;


  -- Create the group record.
  insert into public.groups (
    conversation_id,
    name,
    description,
    avatar_url,
    created_by
  )
  values (
    v_conversation_id,
    trim(p_name),
    nullif(trim(p_description), ''),
    nullif(trim(coalesce(p_avatar_url, '')), ''),
    v_user_id
  )
  returning *
  into v_group;


  -- Add creator to the existing conversation system.
  insert into public.conversation_members (
    conversation_id,
    user_id
  )
  values (
    v_conversation_id,
    v_user_id
  );


  -- Add creator as group owner.
  insert into public.group_members (
    group_id,
    user_id,
    role
  )
  values (
    v_group.id,
    v_user_id,
    'owner'
  );


  return v_group;
end;
$$;


-- =========================================================
-- FUNCTION ACCESS
-- =========================================================

revoke all
on function public.create_group(text, text, text)
from public;

grant execute
on function public.create_group(text, text, text)
to authenticated;


-- =========================================================
-- GROUP REALTIME
-- =========================================================

alter publication supabase_realtime
add table public.groups;

alter publication supabase_realtime
add table public.group_members;
