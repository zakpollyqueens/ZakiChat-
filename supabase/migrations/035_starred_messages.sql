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
on public.starred_messages(user_id);

create index if not exists starred_messages_message_idx
on public.starred_messages(message_id);

alter table public.starred_messages
enable row level security;

drop policy if exists "Users can view their starred messages"
on public.starred_messages;

create policy "Users can view their starred messages"
on public.starred_messages
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can star messages"
on public.starred_messages;

create policy "Users can star messages"
on public.starred_messages
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can unstar messages"
on public.starred_messages;

create policy "Users can unstar messages"
on public.starred_messages
for delete
to authenticated
using (user_id = auth.uid());
