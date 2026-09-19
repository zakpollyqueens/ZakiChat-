-- ZakiChat Status / Updates foundation

create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  text text,

  media_path text,

  media_type text,

  created_at timestamptz not null default now(),

  expires_at timestamptz not null
    default (now() + interval '24 hours'),

  constraint status_updates_content_check
    check (
      text is not null
      or media_path is not null
    ),

  constraint status_updates_media_type_check
    check (
      media_type is null
      or media_type in (
        'image',
        'video'
      )
    )
);

create index if not exists status_updates_user_created_at_idx
on public.status_updates(user_id, created_at desc);

create index if not exists status_updates_expires_at_idx
on public.status_updates(expires_at);

alter table public.status_updates enable row level security;


create table if not exists public.status_views (
  id uuid primary key default gen_random_uuid(),

  status_id uuid not null
    references public.status_updates(id)
    on delete cascade,

  viewer_id uuid not null
    references auth.users(id)
    on delete cascade,

  viewed_at timestamptz not null default now(),

  unique(status_id, viewer_id)
);

create index if not exists status_views_status_id_idx
on public.status_views(status_id);

create index if not exists status_views_viewer_id_idx
on public.status_views(viewer_id);

alter table public.status_views enable row level security;


-- Securely determine whether a user may view another user's status.
-- This function runs with the database owner's privileges so it can
-- inspect the status owner's private contacts without weakening contacts RLS.
drop function if exists public.can_view_status(uuid, uuid);

create or replace function public.can_view_status(
  status_owner_id uuid,
  viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    status_owner_id = viewer_id
    or exists (
      select 1
      from public.contacts c
      where c.user_id = status_owner_id
        and c.contact_user_id = viewer_id
    );
$$;

revoke all on function public.can_view_status(uuid, uuid) from public;
grant execute on function public.can_view_status(uuid, uuid) to authenticated;


-- Users can view their own statuses and statuses shared with them.
drop policy if exists "Users can view their own statuses"
on public.status_updates;

create policy "Users can view statuses they are allowed to see"
on public.status_updates
for select
to authenticated
using (
  expires_at > now()
  and public.can_view_status(user_id, auth.uid())
);


-- Users can create their own statuses.
drop policy if exists "Users can create their own statuses"
on public.status_updates;

create policy "Users can create their own statuses"
on public.status_updates
for insert
to authenticated
with check (
  user_id = auth.uid()
);


-- Users can delete their own statuses.
drop policy if exists "Users can delete their own statuses"
on public.status_updates;

create policy "Users can delete their own statuses"
on public.status_updates
for delete
to authenticated
using (
  user_id = auth.uid()
);


-- Users can view their own status views.
drop policy if exists "Users can view their status views"
on public.status_views;

create policy "Users can view their status views"
on public.status_views
for select
to authenticated
using (
  viewer_id = auth.uid()
  or exists (
    select 1
    from public.status_updates s
    where s.id = status_views.status_id
      and s.user_id = auth.uid()
  )
);


-- Users can record their own status views.
drop policy if exists "Users can create their status views"
on public.status_views;

create policy "Users can create their status views"
on public.status_views
for insert
to authenticated
with check (
  viewer_id = auth.uid()
  and exists (
    select 1
    from public.status_updates s
    where s.id = status_views.status_id
      and s.expires_at > now()
      and public.can_view_status(s.user_id, auth.uid())
  )
);


-- Enable realtime for status updates.
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'status_updates'
    ) then

      alter publication supabase_realtime
      add table public.status_updates;

    end if;

  end if;
end;
$$;


-- ============================================================
-- Status / Updates private media storage
-- Bucket: status-updates
--
-- Storage path:
--   STATUS_OWNER_ID/STATUS_ID/FILENAME
-- ============================================================

-- Users can upload media only to their own status folders.
drop policy if exists "Users can upload status media"
on storage.objects;

create policy "Users can upload status media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'status-updates'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.status_updates s
    where s.id = ((storage.foldername(name))[2])::uuid
      and s.user_id = auth.uid()
  )
);


-- Users can read media belonging to statuses they are allowed to view.
drop policy if exists "Users can read status media"
on storage.objects;

create policy "Users can read status media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'status-updates'
  and exists (
    select 1
    from public.status_updates s
    where s.id = ((storage.foldername(name))[2])::uuid
      and s.expires_at > now()
      and public.can_view_status(s.user_id, auth.uid())
  )
);


-- Status owners can delete their own media.
drop policy if exists "Users can delete status media"
on storage.objects;

create policy "Users can delete status media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'status-updates'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.status_updates s
    where s.id = ((storage.foldername(name))[2])::uuid
      and s.user_id = auth.uid()
  )
);
