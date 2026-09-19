-- ============================================================
-- ZakiChat Channels
-- Channel discovery, subscriptions and channel posts
-- ============================================================

-- ============================================================
-- CHANNELS
-- ============================================================

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references auth.users(id)
    on delete cascade,

  name text not null,
  handle text not null,
  description text,
  avatar_url text,

  is_public boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint channels_name_check
    check (
      length(trim(name)) between 1 and 80
    ),

  constraint channels_handle_check
    check (
      handle ~ '^[a-z0-9_]{3,40}$'
    ),

  constraint channels_handle_unique
    unique(handle)
);

create index if not exists channels_owner_id_idx
on public.channels(owner_id);

create index if not exists channels_public_idx
on public.channels(is_public, created_at desc);

-- ============================================================
-- CHANNEL MEMBERS / SUBSCRIBERS
-- ============================================================

create table if not exists public.channel_members (
  id uuid primary key default gen_random_uuid(),

  channel_id uuid not null
    references public.channels(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role text not null default 'subscriber',

  joined_at timestamptz not null default now(),

  constraint channel_members_role_check
    check (
      role in (
        'owner',
        'admin',
        'subscriber'
      )
    ),

  constraint channel_members_unique
    unique(channel_id, user_id)
);

create index if not exists channel_members_channel_idx
on public.channel_members(channel_id, joined_at desc);

create index if not exists channel_members_user_idx
on public.channel_members(user_id, joined_at desc);

-- ============================================================
-- CHANNEL POSTS
-- ============================================================

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),

  channel_id uuid not null
    references public.channels(id)
    on delete cascade,

  author_id uuid not null
    references auth.users(id)
    on delete cascade,

  content text,
  media_path text,
  media_type text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint channel_posts_content_check
    check (
      content is not null
      or media_path is not null
    ),

  constraint channel_posts_media_type_check
    check (
      media_type is null
      or media_type in (
        'image',
        'video',
        'file'
      )
    )
);

create index if not exists channel_posts_channel_idx
on public.channel_posts(
  channel_id,
  created_at desc
);

create index if not exists channel_posts_author_idx
on public.channel_posts(author_id);

-- ============================================================
-- CHANNEL UPDATED_AT
-- ============================================================

create or replace function public.set_channel_updated_at()
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

drop trigger if exists channels_set_updated_at
on public.channels;

create trigger channels_set_updated_at
before update on public.channels
for each row
execute function public.set_channel_updated_at();

drop trigger if exists channel_posts_set_updated_at
on public.channel_posts;

create trigger channel_posts_set_updated_at
before update on public.channel_posts
for each row
execute function public.set_channel_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.channel_posts enable row level security;

-- ============================================================
-- CHANNEL POLICIES
-- ============================================================

drop policy if exists "Users can discover public channels"
on public.channels;

create policy "Users can discover public channels"
on public.channels
for select
to authenticated
using (
  is_public = true
  or owner_id = auth.uid()
  or exists (
    select 1
    from public.channel_members cm
    where cm.channel_id = channels.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can create channels"
on public.channels;

create policy "Users can create channels"
on public.channels
for insert
to authenticated
with check (
  owner_id = auth.uid()
);

drop policy if exists "Channel owners can update channels"
on public.channels;

create policy "Channel owners can update channels"
on public.channels
for update
to authenticated
using (
  owner_id = auth.uid()
)
with check (
  owner_id = auth.uid()
);

drop policy if exists "Channel owners can delete channels"
on public.channels;

create policy "Channel owners can delete channels"
on public.channels
for delete
to authenticated
using (
  owner_id = auth.uid()
);

-- ============================================================
-- MEMBER POLICIES
-- ============================================================

drop policy if exists "Users can view channel memberships"
on public.channel_members;

create policy "Users can view channel memberships"
on public.channel_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.channels c
    where c.id = channel_members.channel_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "Users can follow channels"
on public.channel_members;

create policy "Users can follow channels"
on public.channel_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.channels c
    where c.id = channel_members.channel_id
      and c.is_public = true
  )
);

drop policy if exists "Users can leave channels"
on public.channel_members;

create policy "Users can leave channels"
on public.channel_members
for delete
to authenticated
using (
  user_id = auth.uid()
  and role = 'subscriber'
);

-- ============================================================
-- CHANNEL POST POLICIES
-- ============================================================

drop policy if exists "Users can view accessible channel posts"
on public.channel_posts;

create policy "Users can view accessible channel posts"
on public.channel_posts
for select
to authenticated
using (
  exists (
    select 1
    from public.channels c
    where c.id = channel_posts.channel_id
      and (
        c.is_public = true
        or c.owner_id = auth.uid()
        or exists (
          select 1
          from public.channel_members cm
          where cm.channel_id = c.id
            and cm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Channel owners and admins can create posts"
on public.channel_posts;

create policy "Channel owners and admins can create posts"
on public.channel_posts
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.channel_members cm
    where cm.channel_id = channel_posts.channel_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  )
);

drop policy if exists "Post authors can update posts"
on public.channel_posts;

create policy "Post authors can update posts"
on public.channel_posts
for update
to authenticated
using (
  author_id = auth.uid()
)
with check (
  author_id = auth.uid()
);

drop policy if exists "Post authors and owners can delete posts"
on public.channel_posts;

create policy "Post authors and owners can delete posts"
on public.channel_posts
for delete
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1
    from public.channels c
    where c.id = channel_posts.channel_id
      and c.owner_id = auth.uid()
  )
);

-- ============================================================
-- AUTOMATIC OWNER MEMBERSHIP
-- ============================================================

create or replace function public.add_channel_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.channel_members (
    channel_id,
    user_id,
    role
  )
  values (
    new.id,
    new.owner_id,
    'owner'
  )
  on conflict (
    channel_id,
    user_id
  )
  do update set role = 'owner';

  return new;
end;
$$;

drop trigger if exists channels_add_owner_membership
on public.channels;

create trigger channels_add_owner_membership
after insert on public.channels
for each row
execute function public.add_channel_owner_membership();

-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin

  begin
    alter publication supabase_realtime
      add table public.channels;
  exception
    when duplicate_object then
      null;
  end;

  begin
    alter publication supabase_realtime
      add table public.channel_members;
  exception
    when duplicate_object then
      null;
  end;

  begin
    alter publication supabase_realtime
      add table public.channel_posts;
  exception
    when duplicate_object then
      null;
  end;

end
$$;

-- ============================================================
-- INITIAL OWNER MEMBERSHIP SAFETY
-- ============================================================

insert into public.channel_members (
  channel_id,
  user_id,
  role
)
select
  c.id,
  c.owner_id,
  'owner'
from public.channels c
where not exists (
  select 1
  from public.channel_members cm
  where cm.channel_id = c.id
    and cm.user_id = c.owner_id
);

-- ============================================================
-- DONE
-- ============================================================
