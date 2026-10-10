-- Retire the previous ZakiChat chat subsystem so a Telegram-inspired
-- implementation can be built against a clean schema.
-- Shared identity, profile, status, channel, notification, payment, admin,
-- business, upgrade, and support tables are intentionally preserved.

DELETE FROM public.notifications
WHERE conversation_id IS NOT NULL
   OR message_id IS NOT NULL
   OR lower(type) LIKE '%group%'
   OR lower(type) LIKE '%message%'
   OR lower(type) LIKE '%call%'
   OR lower(type) LIKE '%contact%';

DELETE FROM public.community_admin_status WHERE lower(community_type) = 'group';
DELETE FROM public.community_audit_log WHERE lower(community_type) = 'group';
DELETE FROM public.community_moderation_actions WHERE lower(community_type) = 'group';
DELETE FROM public.community_reports WHERE lower(community_type) = 'group';

DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.starred_messages CASCADE;
DROP TABLE IF EXISTS public.call_signals CASCADE;
DROP TABLE IF EXISTS public.calls CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.conversation_user_settings CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;

DROP FUNCTION IF EXISTS public.admin_conversation_details(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_conversations(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_messages(text, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_groups(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_direct_conversation(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_manager(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_group(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_group_with_members(text, text, text, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.add_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.leave_group(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.remove_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_group_member_role(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_group(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_message_notifications() CASCADE;
DROP FUNCTION IF EXISTS public.delete_expired_messages() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_message_content_edit() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_message_soft_delete() CASCADE;
DROP FUNCTION IF EXISTS public.set_call_timestamps() CASCADE;
DROP FUNCTION IF EXISTS public.set_chat_settings_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_conversation_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_group_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_messages_updated_at() CASCADE;
