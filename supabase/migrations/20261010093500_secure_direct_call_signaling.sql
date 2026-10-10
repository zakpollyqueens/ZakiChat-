-- Secure one-to-one audio/video call signaling for ZakiChat.
create table if not exists public.calls (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 caller_id uuid not null references auth.users(id) on delete cascade,
 callee_id uuid not null references auth.users(id) on delete cascade,
 call_type text not null check(call_type in ('audio','video')),
 status text not null default 'ringing' check(status in ('ringing','accepted','rejected','ended','missed','failed')),
 created_at timestamptz not null default now(), accepted_at timestamptz, ended_at timestamptz,
 check(caller_id<>callee_id)
);
create index if not exists calls_callee_created_idx on public.calls(callee_id,created_at desc);
create table if not exists public.call_signals (
 id uuid primary key default gen_random_uuid(),
 call_id uuid not null references public.calls(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 signal_type text not null check(signal_type in ('offer','answer','ice-candidate','hangup','reject')),
 payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 check(sender_id<>recipient_id), check(pg_column_size(payload)<=65536)
);
create index if not exists call_signals_recipient_idx on public.call_signals(recipient_id,created_at);
alter table public.calls enable row level security;
alter table public.call_signals enable row level security;
drop policy if exists calls_select_participant on public.calls;
create policy calls_select_participant on public.calls for select to authenticated using((select auth.uid()) in (caller_id,callee_id));
drop policy if exists calls_update_participant on public.calls;
create policy calls_update_participant on public.calls for update to authenticated using((select auth.uid()) in (caller_id,callee_id)) with check((select auth.uid()) in (caller_id,callee_id));
drop policy if exists call_signals_select_participant on public.call_signals;
create policy call_signals_select_participant on public.call_signals for select to authenticated using((select auth.uid()) in (sender_id,recipient_id));
drop policy if exists call_signals_insert_sender on public.call_signals;
create policy call_signals_insert_sender on public.call_signals for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.calls c where c.id=call_id and c.status in ('ringing','accepted') and ((c.caller_id=sender_id and c.callee_id=recipient_id) or (c.callee_id=sender_id and c.caller_id=recipient_id))));
create or replace function public.create_direct_call(p_conversation_id uuid,p_call_type text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_peer uuid; v_call uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_call_type not in ('audio','video') then raise exception 'Invalid call type'; end if;
 if not exists(select 1 from public.conversations c where c.id=p_conversation_id and c.kind='direct' and public.is_conversation_member(c.id,v_user)) then raise exception 'Calls are only available in direct conversations'; end if;
 select user_id into v_peer from public.conversation_members where conversation_id=p_conversation_id and user_id<>v_user limit 1;
 if v_peer is null then raise exception 'Conversation participant not found'; end if;
 insert into public.calls(conversation_id,caller_id,callee_id,call_type) values(p_conversation_id,v_user,v_peer,p_call_type) returning id into v_call;
 return v_call;
end; $$;
revoke all on function public.create_direct_call(uuid,text) from public,anon;
grant execute on function public.create_direct_call(uuid,text) to authenticated;
grant select on public.calls to authenticated;
grant update(status,accepted_at,ended_at) on public.calls to authenticated;
grant select,insert on public.call_signals to authenticated;
revoke insert,delete on public.calls from authenticated;
revoke update on public.call_signals from authenticated;
do $$ begin alter publication supabase_realtime add table public.calls; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.call_signals; exception when duplicate_object then null; when undefined_object then null; end $$;
