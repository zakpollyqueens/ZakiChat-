-- ZakiChat Phase 3 messaging architecture
-- Conversation metadata + replies + soft deletion.

-- =========================================================
-- CONVERSATION METADATA
-- =========================================================

alter table public.conversations
  add column if not exists title text;

alter table public.conversations
  add column if not exists avatar_url text;

create index if not exists conversations_type_idx
on public.conversations(type);


-- =========================================================
-- MESSAGE REPLIES
-- =========================================================

alter table public.messages
  add column if not exists reply_to_message_id uuid;

alter table public.messages
  drop constraint if exists messages_reply_to_message_id_fkey;

alter table public.messages
  add constraint messages_reply_to_message_id_fkey
  foreign key (reply_to_message_id)
  references public.messages(id)
  on delete set null;

create index if not exists messages_reply_to_message_id_idx
on public.messages(reply_to_message_id);


-- =========================================================
-- MESSAGE SOFT DELETION
-- =========================================================

alter table public.messages
  add column if not exists deleted_at timestamptz;

create index if not exists messages_deleted_at_idx
on public.messages(deleted_at);


-- =========================================================
-- MESSAGE UPDATED-AT TRIGGER
-- =========================================================

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


-- =========================================================
-- SENDER-ONLY SOFT DELETE
-- =========================================================

create or replace function public.enforce_message_soft_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.deleted_at is null
     and new.deleted_at is not null then

    if old.sender_id <> auth.uid() then
      raise exception 'Only the message sender can delete the message';
    end if;

  end if;

  return new;
end;
$$;

drop trigger if exists messages_enforce_soft_delete
on public.messages;

create trigger messages_enforce_soft_delete
before update on public.messages
for each row
execute function public.enforce_message_soft_delete();


-- =========================================================
-- CONVERSATION UPDATED-AT TRIGGER
-- =========================================================

create or replace function public.set_conversation_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at
on public.conversations;

create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_conversation_updated_at();
