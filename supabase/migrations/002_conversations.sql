create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct',
  created_at timestamptz not null default now(),

  constraint conversations_type_check
    check (type in ('direct', 'group'))
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  joined_at timestamptz not null default now(),

  unique(conversation_id, user_id)
);

create index if not exists conversations_created_at_idx
on public.conversations(created_at desc);

create index if not exists conversation_members_conversation_id_idx
on public.conversation_members(conversation_id);

create index if not exists conversation_members_user_id_idx
on public.conversation_members(user_id);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;

drop policy if exists "Members can view conversations"
on public.conversations;

create policy "Members can view conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can create conversations"
on public.conversations;

create policy "Authenticated users can create conversations"
on public.conversations
for insert
to authenticated
with check (true);

drop policy if exists "Members can view conversation members"
on public.conversation_members;

create policy "Members can view conversation members"
on public.conversation_members
for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "Users can add themselves to conversations"
on public.conversation_members;

create policy "Users can add themselves to conversations"
on public.conversation_members
for insert
to authenticated
with check (user_id = auth.uid());
