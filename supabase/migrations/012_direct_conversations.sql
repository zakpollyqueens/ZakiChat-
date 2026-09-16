alter table public.conversations
  add column if not exists updated_at timestamptz not null default now();

create index if not exists conversations_updated_at_idx
  on public.conversations(updated_at desc);

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


create or replace function public.get_or_create_direct_conversation(
  p_other_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_user_id uuid;
  v_conversation_id uuid;
begin
  v_current_user_id := auth.uid();

  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_other_user_id is null then
    raise exception 'Other user is required';
  end if;

  if p_other_user_id = v_current_user_id then
    raise exception 'You cannot create a conversation with yourself';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_other_user_id
  ) then
    raise exception 'User not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(
        v_current_user_id::text,
        p_other_user_id::text
      )
      || ':' ||
      greatest(
        v_current_user_id::text,
        p_other_user_id::text
      ),
      0
    )
  );

  select c.id
  into v_conversation_id
  from public.conversations c
  where c.type = 'direct'
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = c.id
        and cm.user_id = v_current_user_id
    )
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = c.id
        and cm.user_id = p_other_user_id
    )
    and (
      select count(*)
      from public.conversation_members cm
      where cm.conversation_id = c.id
    ) = 2
  order by c.created_at
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (
    type
  )
  values (
    'direct'
  )
  returning id into v_conversation_id;

  insert into public.conversation_members (
    conversation_id,
    user_id
  )
  values
    (
      v_conversation_id,
      v_current_user_id
    ),
    (
      v_conversation_id,
      p_other_user_id
    );

  return v_conversation_id;
end;
$$;

revoke all
on function public.get_or_create_direct_conversation(uuid)
from public;

grant execute
on function public.get_or_create_direct_conversation(uuid)
to authenticated;
