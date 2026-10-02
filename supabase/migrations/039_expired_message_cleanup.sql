create or replace function public.delete_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.messages
  where expires_at is not null
    and expires_at <= now();

  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_messages()
from public;

grant execute on function public.delete_expired_messages()
to service_role;
