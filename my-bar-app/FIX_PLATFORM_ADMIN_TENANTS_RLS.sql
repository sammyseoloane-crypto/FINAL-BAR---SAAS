-- ================================================
-- FIX: Platform Admin Cannot Update Tenants
-- Issue: No RLS policy allows platform_admin to update tenants
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- PROBLEM
-- ============================================================

-- Platform admins cannot suspend/activate tenants because:
-- 1. Tenants table has RLS enabled
-- 2. Existing UPDATE policy only allows tenant owners/admins to update their own tenant
-- 3. No policy exists for platform_admin to update ANY tenant

-- ============================================================
-- SOLUTION: Add Platform Admin Policies
-- ============================================================

-- Allow platform admins to view all tenants
CREATE POLICY "Platform admins can view all tenants"
  ON tenants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Allow platform admins to update all tenants
CREATE POLICY "Platform admins can update all tenants"
  ON tenants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Allow platform admins to insert new tenants (for creating test venues)
CREATE POLICY "Platform admins can create tenants"
  ON tenants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Allow platform admins to delete tenants (optional - be careful with this!)
CREATE POLICY "Platform admins can delete tenants"
  ON tenants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check all policies on tenants table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY policyname;

-- You should now see 4 new platform_admin policies:
-- • Platform admins can view all tenants (SELECT)
-- • Platform admins can update all tenants (UPDATE)
-- • Platform admins can create tenants (INSERT)
-- • Platform admins can delete tenants (DELETE)

-- ============================================================
-- TEST THE FIX
-- ============================================================

-- After running this migration:
-- 1. Log in as a platform_admin user
-- 2. Go to /platform-admin/tenants
-- 3. Click "Suspend" button on any tenant
-- 4. It should now work! ✅

-- The update should succeed:
-- UPDATE tenants 
-- SET subscription_status = 'inactive'
-- WHERE id = 'tenant-id-here';

-- ============================================================
-- IMPORTANT NOTES
-- ============================================================

-- Security Considerations:
-- ✅ Only platform_admin role can perform these operations
-- ✅ tenant_id can be NULL for platform_admin users
-- ✅ RLS policies check the user's role in profiles table
-- ✅ Uses auth.uid() to verify the current authenticated user

-- If you don't want platform admins to DELETE tenants:
-- Just skip the DELETE policy above or run:
-- DROP POLICY IF EXISTS "Platform admins can delete tenants" ON tenants;

-- ============================================================
-- REFRESH PostgREST SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- SUMMARY
-- ============================================================

-- What this fixes:
-- ✅ Platform admins can now view all tenants
-- ✅ Platform admins can now update any tenant (suspend/activate)
-- ✅ Platform admins can create new tenants
-- ✅ Platform admins can delete tenants (optional)

-- After applying this:
-- ✅ Suspend button will work
-- ✅ Activate button will work
-- ✅ No more "permission denied" errors
