-- Automatic message expiry for ZakiChat.
-- The client sets expires_at only for newly sent messages; expired rows are
-- removed by a database cron job, not by an untrusted client-side timer.

alter table public.messages
  add column if not exists expires_at timestamptz;

create index if not exists messages_expires_at_idx
  on public.messages (expires_at)
  where expires_at is not null;

-- Messages are written through authenticated, membership-checked chat policies.
-- Grant access to the new field only to authenticated chat clients.
revoke all (expires_at) on public.messages from anon;
grant select (expires_at) on public.messages to authenticated;
grant insert (expires_at) on public.messages to authenticated;

create or replace function private.delete_expired_messages()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  deleted_count integer;
begin
  delete from public.messages
  where expires_at is not null
    and expires_at <= now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;

revoke all on function private.delete_expired_messages() from public, anon, authenticated;

-- Supabase supports pg_cron. Schedule cleanup every five minutes so expiry
-- does not depend on any one user's app being open.
create extension if not exists pg_cron;

do $schedule$
begin
  if exists (select 1 from cron.job where jobname = 'zakichat-expired-message-cleanup') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'zakichat-expired-message-cleanup';
  end if;

  perform cron.schedule(
    'zakichat-expired-message-cleanup',
    '*/5 * * * *',
    'select private.delete_expired_messages();'
  );
end;
$schedule$;
