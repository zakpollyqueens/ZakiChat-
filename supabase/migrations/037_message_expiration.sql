alter table public.messages
add column if not exists expires_at timestamptz;

create index if not exists messages_expires_at_idx
on public.messages(expires_at)
where expires_at is not null;
