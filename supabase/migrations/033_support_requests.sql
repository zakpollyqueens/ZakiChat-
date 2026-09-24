-- ============================================================
-- ZAKICHAT SUPPORT REQUESTS
-- Migration 033
-- ============================================================

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  category text not null default 'general'
    check (
      category in (
        'general',
        'account',
        'payments',
        'security',
        'bug',
        'report',
        'other'
      )
    ),

  subject text not null
    check (char_length(trim(subject)) between 2 and 120),

  message text not null
    check (char_length(trim(message)) between 5 and 5000),

  status text not null default 'open'
    check (
      status in (
        'open',
        'read',
        'resolved'
      )
    ),

  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);

create index if not exists support_requests_user_id_idx
on public.support_requests (user_id);

create index if not exists support_requests_status_idx
on public.support_requests (status);

create index if not exists support_requests_created_at_idx
on public.support_requests (created_at desc);

alter table public.support_requests enable row level security;

drop policy if exists "Users can create their own support requests"
on public.support_requests;

create policy "Users can create their own support requests"
on public.support_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
);

drop policy if exists "Users can view their own support requests"
on public.support_requests;

create policy "Users can view their own support requests"
on public.support_requests
for select
to authenticated
using (
  auth.uid() = user_id
);

drop policy if exists "Users can update their own support requests"
on public.support_requests;

create policy "Users can update their own support requests"
on public.support_requests
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

