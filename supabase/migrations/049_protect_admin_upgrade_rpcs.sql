-- Keep custom administrator session and upgrade RPCs behind server-side authorization.
revoke all on function public.admin_session_user(text) from public, anon, authenticated;
grant execute on function public.admin_session_user(text) to service_role;

revoke all on function public.admin_upgrade_overview(text) from public, anon, authenticated;
grant execute on function public.admin_upgrade_overview(text) to service_role;

revoke all on function public.admin_upgrade_records(text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_upgrade_records(text, text, text, text) to service_role;

revoke all on function public.admin_manual_upgrade(text, text, text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_manual_upgrade(text, text, text, numeric, text, text, text) to service_role;
