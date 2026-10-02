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

  constraint chat_settings_disappearing_check
    check (
      disappearing_seconds is null
      or disappearing_seconds in (
        86400,
        604800,
        7776000
      )
    )
);

create index if not exists chat_settings_user_idx
on public.conversation_user_settings(user_id);

create index if not exists chat_settings_conversation_idx
on public.conversation_user_settings(conversation_id);

alter table public.conversation_user_settings
enable row level security;

drop policy if exists "Users can view their chat settings"
on public.conversation_user_settings;

create policy "Users can view their chat settings"
on public.conversation_user_settings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create their chat settings"
on public.conversation_user_settings;

create policy "Users can create their chat settings"
on public.conversation_user_settings
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id =
      conversation_user_settings.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their chat settings"
on public.conversation_user_settings;

create policy "Users can update their chat settings"
on public.conversation_user_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
