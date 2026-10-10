-- Prevent arbitrary-user membership probes and remove anonymous execution from authenticated app RPCs.
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
  select
    auth.uid() is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = p_conversation_id
        and cm.user_id = auth.uid()
    );
$function$;

alter function public.is_group_manager(uuid) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.is_active_admin() set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.create_group(text, text, text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.get_or_create_direct_conversation(uuid) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.add_group_member(uuid, uuid) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.remove_group_member(uuid, uuid) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.set_group_member_role(uuid, uuid, text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.update_group(uuid, text, text, text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.leave_group(uuid) set search_path = pg_catalog, public, extensions, pg_temp;

revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated, service_role;

revoke all on function public.is_group_manager(uuid) from public, anon;
grant execute on function public.is_group_manager(uuid) to authenticated, service_role;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated, service_role;

revoke all on function public.create_group(text, text, text) from public, anon;
grant execute on function public.create_group(text, text, text) to authenticated, service_role;

revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated, service_role;

revoke all on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated, service_role;

revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated, service_role;

revoke all on function public.set_group_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated, service_role;

revoke all on function public.update_group(uuid, text, text, text) from public, anon;
grant execute on function public.update_group(uuid, text, text, text) to authenticated, service_role;

revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated, service_role;
