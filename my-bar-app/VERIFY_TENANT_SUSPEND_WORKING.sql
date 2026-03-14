-- ================================================
-- VERIFY: Tenant Suspend/Activate is Working
-- Check if updates are actually happening in database
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- CHECK 1: View all tenants and their current status
-- ============================================================

SELECT 
  id,
  name,
  subscription_status,
  subscription_tier,
  created_at,
  updated_at
FROM tenants
ORDER BY updated_at DESC NULLS LAST
LIMIT 10;

-- Look for:
-- • subscription_status should be 'inactive' for suspended tenants
-- • subscription_status should be 'active' for active tenants
-- • updated_at should be recent if you just suspended/activated

-- ============================================================
-- CHECK 2: See tenants by status
-- ============================================================

SELECT 
  subscription_status,
  COUNT(*) as count
FROM tenants
GROUP BY subscription_status
ORDER BY count DESC;

-- This shows how many tenants have each status

-- ============================================================
-- CHECK 3: View RLS policies on tenants table
-- ============================================================

SELECT 
  policyname,
  cmd, -- SELECT, INSERT, UPDATE, DELETE
  roles,
  CASE 
    WHEN policyname LIKE '%platform_admin%' THEN '✅ Platform Admin'
    WHEN policyname LIKE '%owner%' THEN '👤 Owner/Admin'
    ELSE '👥 Other'
  END as policy_type
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY 
  CASE 
    WHEN policyname LIKE '%platform_admin%' THEN 1
    ELSE 2
  END,
  cmd;

-- Expected to see:
-- ✅ Platform admins can view all tenants (SELECT)
-- ✅ Platform admins can update all tenants (UPDATE)
-- ✅ Platform admins can create tenants (INSERT)

-- ============================================================
-- CHECK 4: Test if you can see a specific tenant after update
-- ============================================================

-- Replace 'tenant-id-here' with an actual tenant ID
SELECT 
  id,
  name,
  subscription_status,
  updated_at
FROM tenants
WHERE id = 'tenant-id-here';

-- If this returns the tenant with subscription_status = 'inactive',
-- then the update is working! ✅

-- ============================================================
-- ISSUE: Empty Array Response
-- ============================================================

-- If you're seeing Array(0) after suspend, it could mean:

-- 1. UPDATE worked but SELECT is blocked by RLS
--    Solution: Make sure you ran the RLS policies for platform_admin

-- 2. The tenant_id doesn't exist
--    Solution: Check the tenant ID in the database

-- 3. No rows were matched
--    Solution: Verify the tenant ID is correct

-- ============================================================
-- SOLUTION: If RLS is blocking SELECT
-- ============================================================

-- Make sure you ran this policy:
CREATE POLICY IF NOT EXISTS "Platform admins can view all tenants"
  ON tenants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- And this one:
CREATE POLICY IF NOT EXISTS "Platform admins can update all tenants"
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

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- MANUAL TEST: Suspend a tenant via SQL
-- ============================================================

-- Find a tenant to test with:
SELECT id, name, subscription_status FROM tenants LIMIT 1;

-- Update it manually:
-- UPDATE tenants 
-- SET subscription_status = 'inactive', updated_at = NOW()
-- WHERE id = 'your-tenant-id-here';

-- Check if it updated:
-- SELECT id, name, subscription_status, updated_at 
-- FROM tenants 
-- WHERE id = 'your-tenant-id-here';

-- ============================================================
-- WHAT THE EMPTY ARRAY MEANS
-- ============================================================

-- Good News:
-- ✅ No error was thrown, so the UPDATE permission is working
-- ✅ The function completed successfully
-- ✅ The alert showed "Tenant suspended successfully"

-- The Empty Array:
-- ⚠️ .select() after .update() returned no rows
-- ⚠️ This happens when RLS blocks the SELECT on updated rows
-- ⚠️ BUT the update itself probably succeeded!

-- To confirm the update worked:
-- 1. Refresh the page
-- 2. Check if the tenant's status changed in the table
-- 3. The "Suspend" button should now show "Activate" instead

-- ============================================================
-- NEXT STEPS
-- ============================================================

-- If the suspend IS working (status changes when you refresh):
-- ✅ Everything is fine! The empty array is just a SELECT RLS issue
-- ✅ The await fetchTenants() will refresh the data automatically
-- ✅ No further action needed

-- If the suspend is NOT working (status doesn't change):
-- ❌ Run the RLS policies above
-- ❌ Check you're logged in as platform_admin
-- ❌ Verify the tenant ID exists in the database
