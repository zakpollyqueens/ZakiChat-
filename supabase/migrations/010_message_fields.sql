-- ZakiChat message enhancements
-- Adds message type and edit/update tracking.

alter table public.messages
  add column if not exists message_type text not null default 'text';

alter table public.messages
  add column if not exists updated_at timestamptz not null default now();

alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'video', 'audio', 'file', 'system'));

create index if not exists messages_message_type_idx
  on public.messages(message_type);

create or replace function public.set_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists messages_set_updated_at
on public.messages;

create trigger messages_set_updated_at
before update on public.messages
for each row
execute function public.set_messages_updated_at();
