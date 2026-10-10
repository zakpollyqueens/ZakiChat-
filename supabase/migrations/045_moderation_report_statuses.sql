-- Align community report statuses with the moderation controls in the admin UI.
alter table public.community_reports
  drop constraint if exists community_reports_status_check;

alter table public.community_reports
  add constraint community_reports_status_check
  check (status in ('open', 'reviewing', 'action_required', 'resolved', 'dismissed'));

create or replace function public.admin_moderation_action(
  p_token text,
  p_community_type text,
  p_community_id uuid,
  p_action text,
  p_reason text,
  p_report_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
declare
  v_admin uuid;
  v_action public.community_moderation_actions;
  v_status text;
begin
  v_admin := public.admin_session_user(p_token);
  if v_admin is null then
    raise exception 'Administrator session is invalid or expired';
  end if;

  if p_community_type not in ('group', 'channel') then
    raise exception 'Invalid community type';
  end if;

  if p_action not in ('warn', 'mark_under_review', 'require_changes', 'restrict', 'suspend', 'restore', 'dismiss_report') then
    raise exception 'Invalid moderation action';
  end if;

  if p_reason is null or length(trim(p_reason)) < 2 then
    raise exception 'A moderation reason is required';
  end if;

  if p_action = 'dismiss_report' and p_report_id is null then
    raise exception 'A report ID is required to dismiss a report';
  end if;

  if p_report_id is not null and not exists (
    select 1 from public.community_reports
    where id = p_report_id
      and community_type = p_community_type
      and community_id = p_community_id
  ) then
    raise exception 'Report does not match the specified community';
  end if;

  insert into public.community_moderation_actions (
    community_type, community_id, report_id, action, reason, actor_user_id
  )
  values (
    p_community_type, p_community_id, p_report_id, p_action, trim(p_reason), v_admin
  )
  returning * into v_action;

  v_status := null;
  if p_action = 'mark_under_review' then
    v_status := 'under_review';
  elsif p_action = 'require_changes' then
    v_status := 'action_required';
  elsif p_action = 'restrict' then
    v_status := 'restricted';
  elsif p_action = 'suspend' then
    v_status := 'suspended';
  elsif p_action = 'restore' then
    v_status := 'normal';
  end if;

  if v_status is not null then
    insert into public.community_admin_status (
      community_type, community_id, status, reason, reviewed_by, reviewed_at
    )
    values (
      p_community_type, p_community_id, v_status, trim(p_reason), v_admin, now()
    )
    on conflict (community_type, community_id)
    do update set
      status = excluded.status,
      reason = excluded.reason,
      reviewed_by = excluded.reviewed_by,
      reviewed_at = excluded.reviewed_at;
  end if;

  if p_report_id is not null then
    update public.community_reports
    set
      status = case
        when p_action = 'mark_under_review' then 'reviewing'
        when p_action = 'require_changes' then 'action_required'
        when p_action = 'dismiss_report' then 'dismissed'
        when p_action in ('restrict', 'suspend', 'restore') then 'resolved'
        else status
      end,
      reviewed_by = v_admin,
      reviewed_at = now(),
      resolution = case
        when p_action in ('require_changes', 'dismiss_report', 'restrict', 'suspend', 'restore') then trim(p_reason)
        else resolution
      end
    where id = p_report_id
      and community_type = p_community_type
      and community_id = p_community_id;
  end if;

  insert into public.community_audit_log (
    community_type, community_id, actor_user_id, event_type, details
  )
  values (
    p_community_type, p_community_id, v_admin, 'moderation_action',
    jsonb_build_object('action', p_action, 'reason', trim(p_reason), 'report_id', p_report_id)
  );

  return to_jsonb(v_action);
end;
$function$;
