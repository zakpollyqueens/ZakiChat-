-- Remove the legacy admin RPC that inspected the retired group-chat tables.
DROP FUNCTION IF EXISTS public.admin_list_groups(text, text, text) CASCADE;
