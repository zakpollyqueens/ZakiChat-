create table if not exists public.user_backups (
 user_id uuid primary key references auth.users(id) on delete cascade,
 backup_payload jsonb not null default '{}'::jsonb,
 backup_version integer not null default 1 check (backup_version = 1),
 backup_size_bytes integer not null default 0 check (backup_size_bytes >= 0 and backup_size_bytes <= 1048576),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.user_backups enable row level security;
revoke all on table public.user_backups from anon;
grant select,insert,update,delete on table public.user_backups to authenticated;
drop policy if exists "Users can read their own backup" on public.user_backups;
create policy "Users can read their own backup" on public.user_backups for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users can create their own backup" on public.user_backups;
create policy "Users can create their own backup" on public.user_backups for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users can update their own backup" on public.user_backups;
create policy "Users can update their own backup" on public.user_backups for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users can delete their own backup" on public.user_backups;
create policy "Users can delete their own backup" on public.user_backups for delete to authenticated using ((select auth.uid())=user_id);