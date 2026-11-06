-- Public read-only heartbeat used by the ZakiTech daily Supabase keepalive.
-- It returns only the current database timestamp and never reads or changes application data.
create or replace function public.zakitech_keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select pg_catalog.now();
$function$;

comment on function public.zakitech_keepalive() is
  'Public, read-only infrastructure heartbeat. Returns database time only; does not read or modify application data.';

revoke all on function public.zakitech_keepalive() from public;
grant execute on function public.zakitech_keepalive() to anon, authenticated;
