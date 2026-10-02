-- ============================================================
-- ZakiChat Chat V2 foundation
-- Persistent per-user conversation preferences, starred messages,
-- blocked users, and message expiration support.
-- ============================================================

create table if not exists public.conversation_user_settings (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  notifications_enabled boolean not null default true,

  disappearing_seconds integer,

  wallpaper text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(conversation_id, user_id),

  constraint conversation_user_settings_disappearing_check
    check (
      disappearing_seconds is null
      or disappearing_seconds in (
        86400,
        604800,
        7776000
      )
    )
);

create index if not exists conversation_user_settings_user_idx
on public.conversation_user_settings(user_id);

create index if not exists conversation_user_settings_conversation_idx
on public.conversation_user_settings(conversation_id);

alter table public.conversation_user_settings enable row level security;

drop policy if exists "Users can view their conversation settings"
on public.conversation_user_settings;

create policy "Users can view their conversation settings"
on public.conversation_user_settings
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists "Users can create their conversation settings"
on public.conversation_user_settings;

create policy "Users can create their conversation settings"
on public.conversation_user_settings
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversation_user_settings.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their conversation settings"
on public.conversation_user_settings;

create policy "Users can update their conversation settings"
on public.conversation_user_settings
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

-- ============================================================
-- STARRED MESSAGES
-- ============================================================

create table if not exists public.starred_messages (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  message_id uuid not null
    references public.messages(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique(user_id, message_id)
);

create index if not exists starred_messages_user_idx
on public.starred_messages(user_id, created_at desc);

create index if not exists starred_messages_message_idx
on public.starred_messages(message_id);

alter table public.starred_messages enable row level security;

drop policy if exists "Users can view their starred messages"
on public.starred_messages;

create policy "Users can view their starred messages"
on public.starred_messages
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists "Users can star messages"
on public.starred_messages;

create policy "Users can star messages"
on public.starred_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
    where m.id = starred_messages.message_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can unstar messages"
on public.starred_messages;

create policy "Users can unstar messages"
on public.starred_messages
for delete
to authenticated
using (
  user_id = auth.uid()
);

-- ============================================================
-- BLOCKED USERS
-- ============================================================

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),

  blocker_id uuid not null
    references auth.users(id)
    on delete cascade,

  blocked_id uuid not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  unique(blocker_id, blocked_id),

  constraint blocked_users_not_self
    check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocker_idx
on public.blocked_users(blocker_id, created_at desc);

create index if not exists blocked_users_blocked_idx
on public.blocked_users(blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can view people they blocked"
on public.blocked_users;

create policy "Users can view people they blocked"
on public.blocked_users
for select
to authenticated
using (
  blocker_id = auth.uid()
);

drop policy if exists "Users can block people"
on public.blocked_users;

create policy "Users can block people"
on public.blocked_users
for insert
to authenticated
with check (
  blocker_id = auth.uid()
);

drop policy if exists "Users can unblock people"
on public.blocked_users;

create policy "Users can unblock people"
on public.blocked_users
for delete
to authenticated
using (
  blocker_id = auth.uid()
);

-- ============================================================
-- MESSAGE EXPIRATION
-- ============================================================

alter table public.messages
  add column if not exists expires_at timestamptz;

create index if not exists messages_expires_at_idx
on public.messages(expires_at)
where expires_at is not null;

-- ============================================================
-- UPDATED-AT SUPPORT
-- ============================================================

create or replace function public.touch_conversation_user_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversation_user_settings_updated_at
on public.conversation_user_settings;

create trigger conversation_user_settings_updated_at
before update on public.conversation_user_settings
for each row
execute function public.touch_conversation_user_settings();
