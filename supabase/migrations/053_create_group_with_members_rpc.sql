-- Atomic group creation for the Groups page.
-- Validate selected users against the caller's own contacts before creating anything.
create or replace function public.create_group_with_members(
  p_name text,
  p_description text default null,
  p_avatar_url text default null,
  p_member_ids uuid[] default '{}'::uuid[]
)
returns public.groups
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_group public.groups;
  v_member_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 80 then
    raise exception 'Group name must be between 2 and 80 characters';
  end if;

  if p_description is not null and length(p_description) > 180 then
    raise exception 'Group description must be 180 characters or less';
  end if;

  select coalesce(array_agg(distinct requested.member_id), '{}'::uuid[])
    into v_member_ids
  from unnest(coalesce(p_member_ids, '{}'::uuid[])) as requested(member_id)
  where requested.member_id is not null
    and requested.member_id <> v_user_id;

  if cardinality(v_member_ids) < 1 then
    raise exception 'Select at least one contact for the group';
  end if;

  if cardinality(v_member_ids) > 256 then
    raise exception 'A group can include at most 256 invited contacts';
  end if;

  if exists (
    select 1
    from unnest(v_member_ids) as requested(member_id)
    where not exists (
      select 1
      from public.contacts c
      where c.user_id = v_user_id
        and c.contact_user_id = requested.member_id
    )
  ) then
    raise exception 'Every selected group member must be one of your ZakiChat contacts';
  end if;

  insert into public.conversations (type, title, avatar_url)
  values ('group', trim(p_name), nullif(trim(coalesce(p_avatar_url, '')), ''))
  returning id into v_conversation_id;

  insert into public.groups (conversation_id, name, description, avatar_url, created_by)
  values (
    v_conversation_id,
    trim(p_name),
    nullif(trim(p_description), ''),
    nullif(trim(coalesce(p_avatar_url, '')), ''),
    v_user_id
  )
  returning * into v_group;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, v_user_id);

  insert into public.conversation_members (conversation_id, user_id)
  select v_conversation_id, requested.member_id
  from unnest(v_member_ids) as requested(member_id);

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_user_id, 'owner');

  insert into public.group_members (group_id, user_id, role)
  select v_group.id, requested.member_id, 'member'
  from unnest(v_member_ids) as requested(member_id);

  return v_group;
end;
$function$;

revoke all on function public.create_group_with_members(text, text, text, uuid[]) from public, anon;
grant execute on function public.create_group_with_members(text, text, text, uuid[]) to authenticated;
