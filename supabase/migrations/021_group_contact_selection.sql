create or replace function public.create_group_with_members(
  p_name text,
  p_description text default null,
  p_avatar_url text default null,
  p_member_ids uuid[] default '{}'
)
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_group public.groups;
  v_conversation_id uuid;
  v_member uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null
     or length(trim(p_name)) < 2
     or length(trim(p_name)) > 80 then
    raise exception 'Group name must be between 2 and 80 characters';
  end if;

  insert into public.conversations(type,title,avatar_url)
  values (
    'group',
    trim(p_name),
    nullif(trim(coalesce(p_avatar_url,'')),'')
  )
  returning id into v_conversation_id;

  insert into public.groups(
    conversation_id,name,description,avatar_url,created_by
  )
  values(
    v_conversation_id,
    trim(p_name),
    nullif(trim(p_description),''),
    nullif(trim(coalesce(p_avatar_url,'')),''),
    v_user_id
  )
  returning * into v_group;

  insert into public.conversation_members(conversation_id,user_id)
  values(v_conversation_id,v_user_id);

  insert into public.group_members(group_id,user_id,role)
  values(v_group.id,v_user_id,'owner');

  foreach v_member in array coalesce(p_member_ids,'{}'::uuid[])
  loop
    if v_member is not null and v_member <> v_user_id then

      if exists(
        select 1
        from public.contacts
        where user_id=v_user_id
          and contact_user_id=v_member
      ) then

        insert into public.conversation_members(
          conversation_id,user_id
        )
        values(v_conversation_id,v_member)
        on conflict do nothing;

        insert into public.group_members(
          group_id,user_id,role
        )
        values(v_group.id,v_member,'member')
        on conflict do nothing;

      end if;
    end if;
  end loop;

  return v_group;
end;
$$;

revoke all
on function public.create_group_with_members(text,text,text,uuid[])
from public;

grant execute
on function public.create_group_with_members(text,text,text,uuid[])
to authenticated;
