-- ZakiChat business workspaces, team membership, tasks, and public business logos.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.business_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null check (char_length(trim(business_name)) between 2 and 120),
  business_title text not null default '',
  business_email text not null check (char_length(trim(business_email)) between 3 and 254),
  logo_url text,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  display_name text not null default '',
  role text not null default 'staff' check (role in ('manager','staff','viewer')),
  status text not null default 'invited' check (status in ('invited','active','suspended')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_members_email_not_empty check (char_length(trim(email)) between 3 and 254)
);
create unique index if not exists business_members_business_email_unique on public.business_members (business_id, lower(email));
create unique index if not exists business_members_business_user_unique on public.business_members (business_id, user_id) where user_id is not null;
create index if not exists business_members_user_status_idx on public.business_members (user_id, status) where user_id is not null;

create table if not exists public.business_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_workspaces(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text not null default '',
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists business_tasks_business_status_idx on public.business_tasks (business_id, status, created_at desc);
create index if not exists business_tasks_assignee_status_idx on public.business_tasks (assigned_to, status, due_at);

alter table public.business_workspaces enable row level security;
alter table public.business_members enable row level security;
alter table public.business_tasks enable row level security;

create or replace function private.is_business_owner(p_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.business_workspaces w where w.id=p_business_id and w.owner_user_id=(select auth.uid()));
$$;
create or replace function private.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.business_workspaces w where w.id=p_business_id and w.owner_user_id=(select auth.uid()))
  or exists (select 1 from public.business_members m where m.business_id=p_business_id and m.user_id=(select auth.uid()) and m.status='active');
$$;
create or replace function private.can_manage_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.business_workspaces w
    join public.user_upgrades u on u.user_id=w.owner_user_id
    where w.id=p_business_id and u.plan='business_monthly' and u.status='active' and u.expires_at>now()
      and (w.owner_user_id=(select auth.uid()) or exists (
        select 1 from public.business_members m where m.business_id=w.id and m.user_id=(select auth.uid()) and m.status='active' and m.role='manager'
      ))
  );
$$;
revoke all on function private.is_business_owner(uuid) from public, anon;
revoke all on function private.is_business_member(uuid) from public, anon;
revoke all on function private.can_manage_business(uuid) from public, anon;
grant execute on function private.is_business_owner(uuid) to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.can_manage_business(uuid) to authenticated;

drop policy if exists business_workspaces_select_members on public.business_workspaces;
create policy business_workspaces_select_members on public.business_workspaces for select to authenticated using (private.is_business_member(id));
drop policy if exists business_workspaces_insert_paid_owner on public.business_workspaces;
create policy business_workspaces_insert_paid_owner on public.business_workspaces for insert to authenticated with check (
  owner_user_id=(select auth.uid()) and exists (select 1 from public.user_upgrades u where u.user_id=(select auth.uid()) and u.plan='business_monthly' and u.status='active' and u.expires_at>now())
);
drop policy if exists business_workspaces_update_paid_owner on public.business_workspaces;
create policy business_workspaces_update_paid_owner on public.business_workspaces for update to authenticated using (private.is_business_owner(id) and private.can_manage_business(id)) with check (owner_user_id=(select auth.uid()) and private.can_manage_business(id));
drop policy if exists business_workspaces_delete_paid_owner on public.business_workspaces;
create policy business_workspaces_delete_paid_owner on public.business_workspaces for delete to authenticated using (private.is_business_owner(id) and private.can_manage_business(id));

drop policy if exists business_members_select_owner_or_self_or_invitee on public.business_members;
create policy business_members_select_owner_or_self_or_invitee on public.business_members for select to authenticated using (
  private.is_business_owner(business_id) or user_id=(select auth.uid()) or (status='invited' and lower(email)=lower(coalesce((select auth.jwt())->>'email','')))
);
drop policy if exists business_members_insert_paid_owner on public.business_members;
create policy business_members_insert_paid_owner on public.business_members for insert to authenticated with check (
  private.is_business_owner(business_id) and private.can_manage_business(business_id) and invited_by=(select auth.uid()) and status='invited' and user_id is null
);
drop policy if exists business_members_update_owner_or_accept_invite on public.business_members;
create policy business_members_update_owner_or_accept_invite on public.business_members for update to authenticated using (
  (private.is_business_owner(business_id) and private.can_manage_business(business_id))
  or (user_id is null and status='invited' and lower(email)=lower(coalesce((select auth.jwt())->>'email','')))
) with check (
  (private.is_business_owner(business_id) and private.can_manage_business(business_id))
  or (user_id=(select auth.uid()) and status='active' and lower(email)=lower(coalesce((select auth.jwt())->>'email','')))
);
drop policy if exists business_members_delete_paid_owner on public.business_members;
create policy business_members_delete_paid_owner on public.business_members for delete to authenticated using (private.is_business_owner(business_id) and private.can_manage_business(business_id));

drop policy if exists business_tasks_select_members on public.business_tasks;
create policy business_tasks_select_members on public.business_tasks for select to authenticated using (private.is_business_member(business_id));
drop policy if exists business_tasks_insert_managers on public.business_tasks;
create policy business_tasks_insert_managers on public.business_tasks for insert to authenticated with check (private.can_manage_business(business_id) and created_by=(select auth.uid()));
drop policy if exists business_tasks_update_managers_or_assignee on public.business_tasks;
create policy business_tasks_update_managers_or_assignee on public.business_tasks for update to authenticated using (
  private.can_manage_business(business_id) or (assigned_to=(select auth.uid()) and private.is_business_member(business_id))
) with check (
  private.can_manage_business(business_id) or (assigned_to=(select auth.uid()) and private.is_business_member(business_id))
);
drop policy if exists business_tasks_delete_managers on public.business_tasks;
create policy business_tasks_delete_managers on public.business_tasks for delete to authenticated using (private.can_manage_business(business_id));

grant select, insert, update, delete on public.business_workspaces to authenticated;
grant select, insert, update, delete on public.business_members to authenticated;
grant select, insert, update, delete on public.business_tasks to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('business-logos','business-logos',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'];
drop policy if exists business_logo_public_read on storage.objects;
create policy business_logo_public_read on storage.objects for select to public using (bucket_id='business-logos');
drop policy if exists business_logo_owner_insert on storage.objects;
create policy business_logo_owner_insert on storage.objects for insert to authenticated with check (bucket_id='business-logos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists business_logo_owner_update on storage.objects;
create policy business_logo_owner_update on storage.objects for update to authenticated using (bucket_id='business-logos' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='business-logos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists business_logo_owner_delete on storage.objects;
create policy business_logo_owner_delete on storage.objects for delete to authenticated using (bucket_id='business-logos' and (storage.foldername(name))[1]=(select auth.uid())::text);
