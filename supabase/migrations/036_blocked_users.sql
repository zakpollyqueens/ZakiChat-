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

  constraint blocked_users_self_check
    check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocker_idx
on public.blocked_users(blocker_id);

create index if not exists blocked_users_blocked_idx
on public.blocked_users(blocked_id);

alter table public.blocked_users
enable row level security;

drop policy if exists "Users can view their blocked users"
on public.blocked_users;

create policy "Users can view their blocked users"
on public.blocked_users
for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists "Users can block users"
on public.blocked_users;

create policy "Users can block users"
on public.blocked_users
for insert
to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "Users can unblock users"
on public.blocked_users;

create policy "Users can unblock users"
on public.blocked_users
for delete
to authenticated
using (blocker_id = auth.uid());
