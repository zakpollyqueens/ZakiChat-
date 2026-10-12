-- Per-user call history deletion.
-- Hide a call only for the requesting user; do not delete the shared call record
-- or remove it from the other participant's history.
create table if not exists public.call_history_hidden (
  user_id uuid not null references auth.users(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, call_id)
);
alter table public.call_history_hidden enable row level security;

drop policy if exists "Users can view their hidden call history" on public.call_history_hidden;
create policy "Users can view their hidden call history"
on public.call_history_hidden for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can hide their own call history" on public.call_history_hidden;
create policy "Users can hide their own call history"
on public.call_history_hidden for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.calls c
    where c.id = call_id
      and ((select auth.uid()) = c.caller_id or (select auth.uid()) = c.callee_id)
  )
);

drop policy if exists "Users can restore their own call history" on public.call_history_hidden;
create policy "Users can restore their own call history"
on public.call_history_hidden for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, delete on public.call_history_hidden to authenticated;
