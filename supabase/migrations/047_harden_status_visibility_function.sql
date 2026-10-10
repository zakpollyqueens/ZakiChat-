-- Prevent anonymous or arbitrary-viewer probing of contact relationships through status visibility.
create or replace function public.can_view_status(status_owner_id uuid, viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select
    auth.uid() is not null
    and viewer_id = auth.uid()
    and (
      status_owner_id = auth.uid()
      or exists (
        select 1
        from public.contacts c
        where c.user_id = status_owner_id
          and c.contact_user_id = auth.uid()
      )
    );
$function$;

revoke all on function public.can_view_status(uuid, uuid) from public, anon;
grant execute on function public.can_view_status(uuid, uuid) to authenticated, service_role;
