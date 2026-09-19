create table if not exists public.privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,

  last_seen_visibility text not null default 'contacts'
    check (last_seen_visibility in ('everyone', 'contacts', 'nobody')),

  online_visibility text not null default 'everyone'
    check (online_visibility in ('everyone', 'same_as_last_seen')),

  profile_photo_visibility text not null default 'everyone'
    check (profile_photo_visibility in ('everyone', 'contacts', 'nobody')),

  about_visibility text not null default 'contacts'
    check (about_visibility in ('everyone', 'contacts', 'nobody')),

  status_visibility text not null default 'contacts'
    check (status_visibility in ('everyone', 'contacts', 'nobody')),

  read_receipts boolean not null default true,

  groups_visibility text not null default 'everyone'
    check (groups_visibility in ('everyone', 'contacts')),

  calls_visibility text not null default 'everyone'
    check (calls_visibility in ('everyone', 'contacts')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_settings enable row level security;

drop policy if exists "Users can view their own privacy settings"
on public.privacy_settings;

create policy "Users can view their own privacy settings"
on public.privacy_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own privacy settings"
on public.privacy_settings;

create policy "Users can insert their own privacy settings"
on public.privacy_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own privacy settings"
on public.privacy_settings;

create policy "Users can update their own privacy settings"
on public.privacy_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user_privacy_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.privacy_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_privacy_settings
on auth.users;

create trigger on_auth_user_created_privacy_settings
after insert on auth.users
for each row
execute function public.handle_new_user_privacy_settings();

insert into public.privacy_settings (user_id)
select id
from auth.users
on conflict (user_id) do nothing;
