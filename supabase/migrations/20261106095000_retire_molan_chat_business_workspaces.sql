-- Retire Molan Chat business workspaces without deleting historical records.
-- Business data remains available to trusted service-role administration/audit only.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('business_workspaces','business_members','business_tasks','molan_business_workspaces')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', item.policyname, item.schemaname, item.tablename);
  END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE
  public.business_workspaces,
  public.business_members,
  public.business_tasks,
  public.molan_business_workspaces
FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS business_logo_public_read ON storage.objects;
DROP POLICY IF EXISTS business_logo_owner_insert ON storage.objects;
DROP POLICY IF EXISTS business_logo_owner_update ON storage.objects;
DROP POLICY IF EXISTS business_logo_owner_delete ON storage.objects;
UPDATE storage.buckets SET public = false WHERE id = 'business-logos';

REVOKE EXECUTE ON FUNCTION private.is_business_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.is_business_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.can_manage_business(uuid) FROM PUBLIC, anon, authenticated;
