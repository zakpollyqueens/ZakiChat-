create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique(user_id, contact_user_id),

  check (user_id <> contact_user_id)
);

create index if not exists contacts_user_id_idx
on public.contacts(user_id);

create index if not exists contacts_contact_user_id_idx
on public.contacts(contact_user_id);

alter table public.contacts enable row level security;

drop policy if exists "Users can view their own contacts"
on public.contacts;

create policy "Users can view their own contacts"
on public.contacts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can add their own contacts"
on public.contacts;

create policy "Users can add their own contacts"
on public.contacts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own contacts"
on public.contacts;

create policy "Users can remove their own contacts"
on public.contacts
for delete
to authenticated
using (auth.uid() = user_id);
