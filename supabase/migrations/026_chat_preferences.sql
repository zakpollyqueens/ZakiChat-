alter table public.conversation_members
add column if not exists is_pinned boolean not null default false,
add column if not exists is_archived boolean not null default false,
add column if not exists is_favorite boolean not null default false,
add column if not exists is_muted boolean not null default false,
add column if not exists marked_unread boolean not null default false;

create index if not exists conversation_members_user_pinned_idx
on public.conversation_members(user_id, is_pinned);

create index if not exists conversation_members_user_archived_idx
on public.conversation_members(user_id, is_archived);

create index if not exists conversation_members_user_favorite_idx
on public.conversation_members(user_id, is_favorite);

drop policy if exists "Users can update their conversation preferences"
on public.conversation_members;

create policy "Users can update their conversation preferences"
on public.conversation_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
