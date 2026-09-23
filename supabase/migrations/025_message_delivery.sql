alter table public.messages
add column if not exists delivered_at timestamptz;

create index if not exists messages_delivered_at_idx
on public.messages(conversation_id, delivered_at);

