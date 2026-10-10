update public.admin_system_notices
set status = case when is_active then 'published' else 'draft' end
where created_at < now() + interval '1 second';