-- Pin SECURITY DEFINER and trigger helper search paths to trusted schemas.
alter function public.set_messages_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.set_push_subscription_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.set_registration_payment_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.get_registration_fee(text, boolean) set search_path = pg_catalog, public, extensions;
alter function public.set_chat_settings_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.set_community_admin_status_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.set_community_report_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.get_upgrade_price(text) set search_path = pg_catalog, public, extensions;
alter function public.set_upgrade_updated_at() set search_path = pg_catalog, public, extensions;
alter function public.handle_new_user() set search_path = pg_catalog, public, extensions;
alter function public.handle_new_user_privacy_settings() set search_path = pg_catalog, public, extensions;
alter function public.create_message_notifications() set search_path = pg_catalog, public, extensions;
alter function public.cleanup_expired_security_challenges() set search_path = pg_catalog, public, extensions;
alter function public.cleanup_security_challenges() set search_path = pg_catalog, public, extensions;
alter function public.delete_expired_messages() set search_path = pg_catalog, public, extensions;
alter function public.add_channel_owner_membership() set search_path = pg_catalog, public, extensions;

-- These functions are invoked by triggers or trusted scheduled jobs, not directly by browsers.
revoke all on function public.set_messages_updated_at() from public, anon, authenticated;
revoke all on function public.set_push_subscription_updated_at() from public, anon, authenticated;
revoke all on function public.set_registration_payment_updated_at() from public, anon, authenticated;
revoke all on function public.set_chat_settings_updated_at() from public, anon, authenticated;
revoke all on function public.set_community_admin_status_updated_at() from public, anon, authenticated;
revoke all on function public.set_community_report_updated_at() from public, anon, authenticated;
revoke all on function public.set_upgrade_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_user_privacy_settings() from public, anon, authenticated;
revoke all on function public.create_message_notifications() from public, anon, authenticated;
revoke all on function public.cleanup_expired_security_challenges() from public, anon, authenticated;
revoke all on function public.cleanup_security_challenges() from public, anon, authenticated;
revoke all on function public.delete_expired_messages() from public, anon, authenticated;
revoke all on function public.add_channel_owner_membership() from public, anon, authenticated;
