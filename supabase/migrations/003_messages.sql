create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,
  sender_id uuid not null
    references auth.users(id)
    on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,

  constraint messages_content_check
    check (length(trim(content)) > 0)
);

create index if not exists messages_conversation_id_idx
on public.messages(conversation_id, created_at);

create index if not exists messages_sender_id_idx
on public.messages(sender_id);

alter table public.messages enable row level security;

drop policy if exists "Conversation members can view messages"
on public.messages;

create policy "Conversation members can view messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Conversation members can send messages"
on public.messages;

create policy "Conversation members can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can mark received messages as read"
on public.messages;

create policy "Users can mark received messages as read"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);
