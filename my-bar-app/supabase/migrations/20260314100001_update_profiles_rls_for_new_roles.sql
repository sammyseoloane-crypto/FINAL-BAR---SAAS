-- Migration: Update profiles RLS policies to include new roles
-- Date: 2026-03-14
-- Description: Add platform_admin and manager to RLS policies so they can view/manage profiles

-- Drop existing policies (both old and new names to ensure idempotency)
DROP POLICY IF EXISTS "Owners and admins can view all tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Owners and admins can update tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Owners and admins can delete tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Owners, admins, and managers can view all tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Owners, admins, and managers can update tenant profiles" ON profiles;

-- Recreate policies with new roles included
CREATE POLICY "Owners, admins, and managers can view all tenant profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('platform_admin', 'owner', 'admin', 'manager') 
        AND (u.role = 'platform_admin' OR u.tenant_id = profiles.tenant_id)
    )
  );

CREATE POLICY "Owners, admins, and managers can update tenant profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('platform_admin', 'owner', 'admin', 'manager')
        AND (u.role = 'platform_admin' OR u.tenant_id = profiles.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('platform_admin', 'owner', 'admin', 'manager')
        AND (u.role = 'platform_admin' OR u.tenant_id = profiles.tenant_id)
    )
  );

CREATE POLICY "Owners and admins can delete tenant profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('platform_admin', 'owner', 'admin')
        AND (u.role = 'platform_admin' OR u.tenant_id = profiles.tenant_id)
    )
  );

-- Add helpful comment
COMMENT ON TABLE profiles IS 'User profiles with roles: platform_admin (cross-tenant access), owner/admin/manager (tenant-level access), staff/promoter/vip_host/customer (limited access)';
