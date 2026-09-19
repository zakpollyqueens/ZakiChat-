-- ============================================================
-- ZakiChat Communication Features
-- Location messages + WebRTC voice/video calls
-- ============================================================

-- ============================================================
-- LOCATION MESSAGE SUPPORT
-- ============================================================

alter table public.messages
  add column if not exists location_latitude double precision;

alter table public.messages
  add column if not exists location_longitude double precision;

alter table public.messages
  add column if not exists location_label text;

alter table public.messages
  drop constraint if exists messages_location_coordinates_check;

alter table public.messages
  add constraint messages_location_coordinates_check
  check (
    (
      location_latitude is null
      and location_longitude is null
    )
    or
    (
      location_latitude between -90 and 90
      and location_longitude between -180 and 180
    )
  );

alter table public.messages
  drop constraint if exists messages_location_fields_check;

alter table public.messages
  add constraint messages_location_fields_check
  check (
    message_type <> 'location'
    or (
      location_latitude is not null
      and location_longitude is not null
    )
  );

-- Extend the existing message-type system.
alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check
  check (
    message_type in (
      'text',
      'image',
      'video',
      'audio',
      'file',
      'location',
      'system'
    )
  );

create index if not exists messages_location_idx
on public.messages(location_latitude, location_longitude)
where location_latitude is not null
  and location_longitude is not null;


-- ============================================================
-- CALL RECORDS
-- ============================================================

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,

  caller_id uuid not null
    references auth.users(id)
    on delete cascade,

  callee_id uuid not null
    references auth.users(id)
    on delete cascade,

  call_type text not null default 'voice',

  status text not null default 'ringing',

  started_at timestamptz,

  answered_at timestamptz,

  ended_at timestamptz,

  created_at timestamptz not null default now(),

  constraint calls_type_check
    check (call_type in ('voice', 'video')),

  constraint calls_status_check
    check (
      status in (
        'ringing',
        'connecting',
        'active',
        'ended',
        'declined',
        'missed',
        'failed',
        'cancelled'
      )
    ),

  constraint calls_participants_check
    check (caller_id <> callee_id)
);

create index if not exists calls_conversation_id_idx
on public.calls(conversation_id, created_at desc);

create index if not exists calls_caller_id_idx
on public.calls(caller_id, created_at desc);

create index if not exists calls_callee_id_idx
on public.calls(callee_id, created_at desc);

create index if not exists calls_status_idx
on public.calls(status);


-- ============================================================
-- CALL SIGNALING
--
-- This table carries WebRTC offer/answer/ICE information.
-- It is deliberately separate from messages because signaling
-- data is temporary call infrastructure, not chat history.
-- ============================================================

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),

  call_id uuid not null
    references public.calls(id)
    on delete cascade,

  sender_id uuid not null
    references auth.users(id)
    on delete cascade,

  signal_type text not null,

  payload jsonb not null,

  created_at timestamptz not null default now(),

  constraint call_signals_type_check
    check (
      signal_type in (
        'offer',
        'answer',
        'ice-candidate',
        'hangup',
        'busy',
        'decline'
      )
    )
);

create index if not exists call_signals_call_id_idx
on public.call_signals(call_id, created_at);

create index if not exists call_signals_sender_id_idx
on public.call_signals(sender_id);


-- ============================================================
-- CALL RLS
-- ============================================================

alter table public.calls enable row level security;

alter table public.call_signals enable row level security;


drop policy if exists "Call participants can view calls"
on public.calls;

create policy "Call participants can view calls"
on public.calls
for select
to authenticated
using (
  caller_id = auth.uid()
  or callee_id = auth.uid()
);


drop policy if exists "Conversation members can create calls"
on public.calls;

create policy "Conversation members can create calls"
on public.calls
for insert
to authenticated
with check (
  caller_id = auth.uid()
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = calls.conversation_id
      and cm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = calls.conversation_id
      and cm.user_id = calls.callee_id
  )
);


drop policy if exists "Call participants can update calls"
on public.calls;

create policy "Call participants can update calls"
on public.calls
for update
to authenticated
using (
  caller_id = auth.uid()
  or callee_id = auth.uid()
)
with check (
  caller_id = auth.uid()
  or callee_id = auth.uid()
);


drop policy if exists "Call participants can view signals"
on public.call_signals;

create policy "Call participants can view signals"
on public.call_signals
for select
to authenticated
using (
  exists (
    select 1
    from public.calls c
    where c.id = call_signals.call_id
      and (
        c.caller_id = auth.uid()
        or c.callee_id = auth.uid()
      )
  )
);


drop policy if exists "Call participants can create signals"
on public.call_signals;

create policy "Call participants can create signals"
on public.call_signals
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.calls c
    where c.id = call_signals.call_id
      and (
        c.caller_id = auth.uid()
        or c.callee_id = auth.uid()
      )
  )
);


drop policy if exists "Signal senders can delete signals"
on public.call_signals;

create policy "Signal senders can delete signals"
on public.call_signals
for delete
to authenticated
using (
  sender_id = auth.uid()
);


-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin
  begin
    alter publication supabase_realtime
      add table public.calls;
  exception
    when duplicate_object then
      null;
  end;

  begin
    alter publication supabase_realtime
      add table public.call_signals;
  exception
    when duplicate_object then
      null;
  end;
end
$$;


-- ============================================================
-- CALL UPDATE TIMESTAMP
-- ============================================================

create or replace function public.set_call_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'active'
     and old.status <> 'active'
     and new.answered_at is null then
    new.answered_at = now();
  end if;

  if new.status in (
    'ended',
    'declined',
    'missed',
    'failed',
    'cancelled'
  )
  and old.status not in (
    'ended',
    'declined',
    'missed',
    'failed',
    'cancelled'
  )
  and new.ended_at is null then
    new.ended_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists calls_set_timestamps
on public.calls;

create trigger calls_set_timestamps
before update on public.calls
for each row
execute function public.set_call_timestamps();
