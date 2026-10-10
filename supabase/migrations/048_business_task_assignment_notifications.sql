-- Notify an assigned staff member when a business task is created or reassigned.
create or replace function private.notify_business_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null
     and new.assigned_to <> new.created_by
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    insert into public.notifications (user_id, actor_id, type, title, body)
    values (
      new.assigned_to,
      coalesce((select auth.uid()), new.created_by),
      'business_task_assigned',
      'New business task assigned',
      left(new.title, 180)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.notify_business_task_assignee() from public, anon, authenticated;
drop trigger if exists business_task_assignee_notification on public.business_tasks;
create trigger business_task_assignee_notification
after insert or update of assigned_to on public.business_tasks
for each row execute function private.notify_business_task_assignee();
