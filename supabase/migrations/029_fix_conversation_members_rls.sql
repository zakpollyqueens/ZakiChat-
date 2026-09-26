create or replace function public.is_conversation_member(
 p_conversation_id uuid,p_user_id uuid
)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
 select exists(
  select 1 from public.conversation_members
  where conversation_id=p_conversation_id
  and user_id=p_user_id
 );
$$;

revoke all on function public.is_conversation_member(uuid,uuid) from public;
grant execute on function public.is_conversation_member(uuid,uuid) to authenticated;

drop policy if exists "Members can view conversation members"
on public.conversation_members;

create policy "Members can view conversation members"
on public.conversation_members
for select to authenticated
using (
 public.is_conversation_member(
  conversation_id,auth.uid()
 )
);
