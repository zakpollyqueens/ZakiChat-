-- ============================================================
-- ZAKICHAT COMMUNITY ADMIN OVERSIGHT
-- Migration 041
-- Platform-level oversight for Groups & Channels.
-- ============================================================

create table if not exists public.community_admin_status (
  id uuid primary key default gen_random_uuid(),

  community_type text not null
    check (community_type in ('group','channel')),

  community_id uuid not null,

  status text not null default 'normal'
    check (
      status in (
        'normal',
        'under_review',
        'action_required',
        'restricted',
        'suspended'
      )
    ),

  reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (community_type, community_id)
);

create index if not exists community_admin_status_type_id_idx
on public.community_admin_status (community_type, community_id);

create index if not exists community_admin_status_status_idx
on public.community_admin_status (status);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),

  reporter_id uuid not null
    references auth.users(id) on delete cascade,

  community_type text not null
    check (community_type in ('group','channel')),

  community_id uuid not null,

  category text not null default 'other'
    check (
      category in (
        'terms',
        'harassment',
        'spam',
        'fraud',
        'sexual_content',
        'violence',
        'hate',
        'impersonation',
        'copyright',
        'privacy',
        'other'
      )
    ),

  subject text not null
    check (char_length(trim(subject)) between 2 and 160),

  details text
    check (details is null or char_length(details) <= 5000),

  status text not null default 'open'
    check (
      status in (
        'open',
        'reviewing',
        'resolved',
        'dismissed'
      )
    ),

  evidence jsonb not null default '{}'::jsonb,

  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolution text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_reports_community_idx
on public.community_reports (community_type, community_id);

create index if not exists community_reports_status_idx
on public.community_reports (status);

create index if not exists community_reports_created_at_idx
on public.community_reports (created_at desc);

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),

  community_type text not null
    check (community_type in ('group','channel')),

  community_id uuid not null,

  report_id uuid references public.community_reports(id) on delete set null,

  action text not null
    check (
      action in (
        'warn',
        'mark_under_review',
        'require_changes',
        'restrict',
        'suspend',
        'restore',
        'dismiss_report'
      )
    ),

  reason text not null
    check (char_length(trim(reason)) between 2 and 2000),

  actor_user_id uuid not null
    references auth.users(id) on delete restrict,

  created_at timestamptz not null default now()
);

create index if not exists community_moderation_actions_community_idx
on public.community_moderation_actions (community_type, community_id);

create index if not exists community_moderation_actions_created_at_idx
on public.community_moderation_actions (created_at desc);

create table if not exists public.community_audit_log (
  id uuid primary key default gen_random_uuid(),

  community_type text not null
    check (community_type in ('group','channel')),

  community_id uuid not null,

  actor_user_id uuid
    references auth.users(id) on delete set null,

  event_type text not null
    check (
      event_type in (
        'view',
        'report_created',
        'review_started',
        'review_completed',
        'status_changed',
        'moderation_action',
        'ownership_review',
        'membership_review'
      )
    ),

  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists community_audit_log_community_idx
on public.community_audit_log (community_type, community_id);

create index if not exists community_audit_log_created_at_idx
on public.community_audit_log (created_at desc);

alter table public.community_admin_status enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_moderation_actions enable row level security;
alter table public.community_audit_log enable row level security;

drop policy if exists "Users can create community reports"
on public.community_reports;

create policy "Users can create community reports"
on public.community_reports
for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "Users can view their own community reports"
on public.community_reports;

create policy "Users can view their own community reports"
on public.community_reports
for select
to authenticated
using (reporter_id = auth.uid());

-- Administrative reads/writes are intentionally excluded from
-- browser-side authenticated policies. The protected administrator
-- Edge Function will perform privileged operations using the service key.

create or replace function public.set_community_admin_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_admin_status_updated_at
on public.community_admin_status;

create trigger community_admin_status_updated_at
before update on public.community_admin_status
for each row execute function public.set_community_admin_status_updated_at();

create or replace function public.set_community_report_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_reports_updated_at
on public.community_reports;

create trigger community_reports_updated_at
before update on public.community_reports
for each row execute function public.set_community_report_updated_at();
