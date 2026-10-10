-- 047: Business workspace access follows the owner's active monthly plan.
-- Keep memberships and business data intact while expired; RLS hides the workspace
-- from owner/staff until the owner renews, then access resumes automatically.

create or replace function private.is_business_member(p_business_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.business_workspaces w
    where w.id = p_business_id
      and (
        w.owner_user_id = (select auth.uid())
        or exists (
          select 1
          from public.business_members m
          join public.user_upgrades u on u.user_id = w.owner_user_id
          where m.business_id = w.id
            and m.user_id = (select auth.uid())
            and m.status = 'active'
            and u.plan = 'business_monthly'
            and u.status = 'active'
            and u.expires_at > now()
        )
      )
      and (
        exists (
          select 1 from public.user_upgrades u
          where u.user_id = w.owner_user_id
            and u.plan = 'business_monthly'
            and u.status = 'active'
            and u.expires_at > now()
        )
      )
  );
$$;

create or replace function private.can_manage_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.business_workspaces w
    join public.user_upgrades u on u.user_id = w.owner_user_id
    where w.id = p_business_id
      and u.plan = 'business_monthly'
      and u.status = 'active'
      and u.expires_at > now()
      and (
        w.owner_user_id = (select auth.uid())
        or exists (
          select 1 from public.business_members m
          where m.business_id = w.id
            and m.user_id = (select auth.uid())
            and m.status = 'active'
            and m.role = 'manager'
        )
      )
  );
$$;

drop policy if exists business_workspaces_select_members on public.business_workspaces;
create policy business_workspaces_select_members
on public.business_workspaces for select to authenticated
using (private.is_business_member(id));

drop policy if exists business_members_select_owner_or_self_or_invitee on public.business_members;
create policy business_members_select_owner_or_self_or_invitee
on public.business_members for select to authenticated
using (
  (private.is_business_owner(business_id) and private.can_manage_business(business_id))
  or (user_id = (select auth.uid()) and status = 'active' and private.is_business_member(business_id))
  or (status = 'invited' and lower(email) = lower(coalesce((select auth.jwt())->>'email','')))
);

drop policy if exists business_tasks_select_members on public.business_tasks;
create policy business_tasks_select_members
on public.business_tasks for select to authenticated
using (private.is_business_member(business_id));

drop policy if exists business_tasks_update_managers_or_assignee on public.business_tasks;
create policy business_tasks_update_managers_or_assignee
on public.business_tasks for update to authenticated
using (
  private.can_manage_business(business_id)
  or (assigned_to = (select auth.uid()) and private.is_business_member(business_id))
)
with check (
  private.can_manage_business(business_id)
  or (assigned_to = (select auth.uid()) and private.is_business_member(business_id))
);

revoke all on function private.is_business_member(uuid) from public, anon;
revoke all on function private.can_manage_business(uuid) from public, anon;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.can_manage_business(uuid) to authenticated;
