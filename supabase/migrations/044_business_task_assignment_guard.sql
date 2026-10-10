-- Prevent business managers from assigning tasks to users outside their workspace.
drop policy if exists business_tasks_insert_managers on public.business_tasks;
create policy business_tasks_insert_managers on public.business_tasks
for insert to authenticated with check (
  private.can_manage_business(business_id)
  and created_by = (select auth.uid())
  and (assigned_to is null or assigned_to = (select auth.uid()) or exists (
    select 1 from public.business_members m
    where m.business_id = business_tasks.business_id
      and m.user_id = business_tasks.assigned_to
      and m.status = 'active'
  ))
);
drop policy if exists business_tasks_update_managers_or_assignee on public.business_tasks;
create policy business_tasks_update_managers_or_assignee on public.business_tasks
for update to authenticated using (
  private.can_manage_business(business_id)
  or (assigned_to = (select auth.uid()) and private.is_business_member(business_id))
) with check (
  (private.can_manage_business(business_id)
    and (assigned_to is null or assigned_to = (select auth.uid()) or exists (
      select 1 from public.business_members m
      where m.business_id = business_tasks.business_id
        and m.user_id = business_tasks.assigned_to
        and m.status = 'active'
    )))
  or (assigned_to = (select auth.uid()) and private.is_business_member(business_id))
);
