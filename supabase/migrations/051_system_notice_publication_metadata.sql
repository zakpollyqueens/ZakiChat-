-- Add the publication metadata expected by the admin updates UI and public notices API.
alter table public.admin_system_notices
  add column if not exists visibility text not null default 'public',
  add column if not exists priority text not null default 'normal',
  add column if not exists status text not null default 'published';

update public.admin_system_notices
set
  visibility = coalesce(nullif(visibility, ''), 'public'),
  priority = coalesce(nullif(priority, ''), 'normal'),
  status = case
    when is_active = true then coalesce(nullif(status, ''), 'published')
    else coalesce(nullif(status, ''), 'draft')
  end;

alter table public.admin_system_notices
  drop constraint if exists admin_system_notices_visibility_check,
  drop constraint if exists admin_system_notices_priority_check,
  drop constraint if exists admin_system_notices_status_check;

alter table public.admin_system_notices
  add constraint admin_system_notices_visibility_check
    check (visibility in ('public', 'users', 'hidden')),
  add constraint admin_system_notices_priority_check
    check (priority in ('normal', 'important', 'urgent')),
  add constraint admin_system_notices_status_check
    check (status in ('draft', 'published', 'archived'));

create index if not exists admin_system_notices_public_feed_idx
  on public.admin_system_notices (created_at desc)
  where is_active = true and status = 'published' and visibility = 'public';
