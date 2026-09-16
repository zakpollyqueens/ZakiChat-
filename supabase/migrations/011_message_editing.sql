alter table public.messages
  add column if not exists edited_at timestamptz;

create index if not exists messages_edited_at_idx
  on public.messages(edited_at);

create or replace function public.enforce_message_content_edit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.content is distinct from old.content then
    if old.sender_id <> auth.uid() then
      raise exception 'Only the message sender can edit message content';
    end if;

    new.edited_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists messages_enforce_content_edit
on public.messages;

create trigger messages_enforce_content_edit
before update on public.messages
for each row
execute function public.enforce_message_content_edit();
