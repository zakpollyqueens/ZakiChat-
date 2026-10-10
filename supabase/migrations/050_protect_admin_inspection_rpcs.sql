-- Keep privileged administrator inspection and moderation RPCs callable only by server-side functions.
revoke all on function public.admin_communication_session_valid(text) from public, anon, authenticated;
grant execute on function public.admin_communication_session_valid(text) to service_role;

revoke all on function public.admin_communication_overview(text) from public, anon, authenticated;
grant execute on function public.admin_communication_overview(text) to service_role;

revoke all on function public.admin_list_conversations(text, text, text) from public, anon, authenticated;
grant execute on function public.admin_list_conversations(text, text, text) to service_role;

revoke all on function public.admin_conversation_details(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_conversation_details(text, uuid) to service_role;

revoke all on function public.admin_list_messages(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_list_messages(text, uuid, integer) to service_role;

revoke all on function public.admin_community_overview(text) from public, anon, authenticated;
grant execute on function public.admin_community_overview(text) to service_role;

revoke all on function public.admin_list_groups(text, text, text) from public, anon, authenticated;
grant execute on function public.admin_list_groups(text, text, text) to service_role;

revoke all on function public.admin_list_channels(text, text, text) from public, anon, authenticated;
grant execute on function public.admin_list_channels(text, text, text) to service_role;

revoke all on function public.admin_community_details(text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_community_details(text, text, uuid) to service_role;

revoke all on function public.admin_community_reports(text, text, text) from public, anon, authenticated;
grant execute on function public.admin_community_reports(text, text, text) to service_role;

revoke all on function public.admin_moderation_action(text, text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_moderation_action(text, text, uuid, text, text, uuid) to service_role;

revoke all on function public.admin_review_community(text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_community(text, text, uuid, text, text) to service_role;

revoke all on function public.admin_find_user(text, text) from public, anon, authenticated;
grant execute on function public.admin_find_user(text, text) to service_role;
