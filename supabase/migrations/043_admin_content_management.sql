-- Extend system notices so the admin UI can safely manage publication and audience.
alter table public.admin_system_notices
  add column if not exists visibility text not null default 'public',
  add column if not exists priority text not null default 'normal',
  add column if not exists status text not null default 'published';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_system_notices'::regclass
      and conname = 'admin_system_notices_visibility_check'
  ) then
    alter table public.admin_system_notices
      add constraint admin_system_notices_visibility_check
      check (visibility in ('public', 'users', 'hidden'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_system_notices'::regclass
      and conname = 'admin_system_notices_priority_check'
  ) then
    alter table public.admin_system_notices
      add constraint admin_system_notices_priority_check
      check (priority in ('normal', 'important', 'urgent'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_system_notices'::regclass
      and conname = 'admin_system_notices_status_check'
  ) then
    alter table public.admin_system_notices
      add constraint admin_system_notices_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create index if not exists admin_system_notices_status_visibility_idx
  on public.admin_system_notices(status, visibility, created_at desc);

create or replace function public.admin_get_system_notices()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
begin
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'message', message,
          'notice_type', notice_type,
          'visibility', visibility,
          'priority', priority,
          'starts_at', starts_at,
          'ends_at', ends_at,
          'created_at', created_at
        )
        order by
          case priority when 'urgent' then 1 when 'important' then 2 else 3 end,
          created_at desc
      )
      from public.admin_system_notices
      where is_active = true
        and status = 'published'
        and visibility = 'public'
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
    ),
    '[]'::jsonb
  );
end;
$function$;
