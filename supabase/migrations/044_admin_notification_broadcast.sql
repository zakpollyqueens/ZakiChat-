-- Atomic, session-verified administrator notification broadcast.
create or replace function public.admin_broadcast_notification(
  p_token text,
  p_title text,
  p_body text,
  p_type text,
  p_audience text,
  p_user_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
declare
  v_admin_id uuid;
  v_role text;
  v_active boolean;
  v_count integer := 0;
  v_campaign_id uuid := gen_random_uuid();
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_type text := lower(trim(coalesce(p_type, 'general')));
  v_audience text := lower(trim(coalesce(p_audience, 'all')));
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Administrator session is required' using errcode = '42501';
  end if;

  v_admin_id := public.admin_session_user(p_token);
  if v_admin_id is null then
    raise exception 'Administrator session is invalid or expired' using errcode = '42501';
  end if;

  select role, active into v_role, v_active
  from public.admin_users where user_id = v_admin_id;

  if coalesce(v_active, false) is not true or v_role <> 'super_admin' then
    raise exception 'Super-administrator permission is required' using errcode = '42501';
  end if;

  if v_title is null or length(v_title) > 160 then
    raise exception 'Notification title is required and must be at most 160 characters';
  end if;
  if v_body is null or length(v_body) > 5000 then
    raise exception 'Notification message is required and must be at most 5000 characters';
  end if;
  if v_type not in ('general', 'update', 'maintenance', 'security', 'payment', 'announcement') then
    raise exception 'Unsupported notification type';
  end if;
  if v_audience not in ('all', 'active', 'selected') then
    raise exception 'Unsupported notification audience';
  end if;
  if v_audience = 'selected' and coalesce(cardinality(p_user_ids), 0) = 0 then
    raise exception 'Select at least one recipient for a targeted notification';
  end if;

  insert into public.notifications (user_id, actor_id, type, title, body)
  select p.id, v_admin_id, v_type, v_title, v_body
  from public.profiles p
  where p.id <> v_admin_id
    and (
      v_audience = 'all'
      or (v_audience = 'active' and (p.is_online = true or p.last_seen >= now() - interval '15 minutes'))
      or (v_audience = 'selected' and p.id = any(coalesce(p_user_ids, '{}'::uuid[])))
    );

  get diagnostics v_count = row_count;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_id, details
  ) values (
    v_admin_id,
    'notification_broadcast',
    'notification_campaign',
    v_campaign_id::text,
    jsonb_build_object(
      'title', v_title,
      'message', v_body,
      'type', v_type,
      'audience', v_audience,
      'recipients_count', v_count,
      'campaign_id', v_campaign_id,
      'created_at', now()
    )
  );

  return jsonb_build_object(
    'success', true,
    'campaign_id', v_campaign_id,
    'recipients_count', v_count,
    'title', v_title,
    'type', v_type,
    'audience', v_audience,
    'created_at', now()
  );
end;
$function$;

revoke all on function public.admin_broadcast_notification(text, text, text, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_broadcast_notification(text, text, text, text, text, uuid[]) to service_role;
