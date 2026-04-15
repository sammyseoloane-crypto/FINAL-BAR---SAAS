-- Guest List Permissions Verification Script
-- Run this script to verify that RLS policies are correctly enforced

-- 1. Check that policies exist
SELECT 
  tablename,
  policyname,
  cmd as operation,
  permissive,
  roles
FROM pg_policies
WHERE tablename IN ('guest_lists', 'guest_list_entries')
ORDER BY tablename, policyname;

-- Expected Output:
-- Should see 8 policies total:
-- - 4 for guest_list_entries (SELECT, INSERT, UPDATE, DELETE)
-- - 4 for guest_lists (SELECT, INSERT, UPDATE, DELETE)

-- 2. Test that a guest entry has the required added_by field
SELECT 
  id,
  guest_name,
  added_by,
  created_at
FROM guest_list_entries
LIMIT 5;

-- Expected: Should see added_by populated with user IDs

-- 3. Verify promoter ownership of guest lists
SELECT 
  id,
  list_name,
  promoter_id,
  tenant_id,
  status
FROM guest_lists
WHERE promoter_id IS NOT NULL
LIMIT 5;

-- Expected: promoter_id should be populated for promoter-created lists

-- 4. Check guest list counts
SELECT 
  gl.id,
  gl.list_name,
  gl.current_guest_count,
  gl.checked_in_count,
  COUNT(gle.id) as actual_count,
  COUNT(gle.id) FILTER (WHERE gle.checked_in = true) as actual_checked_in
FROM guest_lists gl
LEFT JOIN guest_list_entries gle ON gle.guest_list_id = gl.id
GROUP BY gl.id, gl.list_name, gl.current_guest_count, gl.checked_in_count
LIMIT 10;

-- Expected: current_guest_count should match actual_count
--          checked_in_count should match actual_checked_in

-- 5. Verify that RLS is enabled on tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('guest_lists', 'guest_list_entries');

-- Expected: rls_enabled should be TRUE for both tables

-- 6. Test promoter can only see their own lists (simulate with a specific promoter_id)
-- Replace 'your-promoter-user-id-here' with an actual promoter user ID from your system
/*
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'your-promoter-user-id-here';

SELECT 
  id,
  list_name,
  promoter_id
FROM guest_lists;

-- Expected: Should only see lists where promoter_id = 'your-promoter-user-id-here'
-- or lists from the same tenant if viewing allowed

RESET ROLE;
*/

-- 7. Check for any guests without the added_by field (data integrity)
SELECT COUNT(*) as guests_missing_added_by
FROM guest_list_entries
WHERE added_by IS NULL;

-- Expected: Should be 0 for new entries
-- If there are old entries, they may need migration

-- 8. Verify guest status values
SELECT 
  status,
  COUNT(*) as count
FROM guest_list_entries
GROUP BY status;

-- Expected: Values should be 'pending', 'approved', or 'rejected'

-- 9. Check permission-related columns exist
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'guest_list_entries'
AND column_name IN ('added_by', 'checked_in_by', 'checked_in_at', 'checked_in');

-- Expected: All 4 columns should exist

-- 10. Summary Report
SELECT 
  'Total Guest Lists' as metric,
  COUNT(*)::text as value
FROM guest_lists
UNION ALL
SELECT 
  'Total Guests' as metric,
  COUNT(*)::text as value
FROM guest_list_entries
UNION ALL
SELECT 
  'Checked In Guests' as metric,
  COUNT(*)::text as value
FROM guest_list_entries
WHERE checked_in = true
UNION ALL
SELECT 
  'Pending Approval' as metric,
  COUNT(*)::text as value
FROM guest_list_entries
WHERE status = 'pending'
UNION ALL
SELECT 
  'Active Lists' as metric,
  COUNT(*)::text as value
FROM guest_lists
WHERE status = 'active';

-- ====================
-- PERMISSION TEST SCENARIOS
-- ====================

-- Test 1: Owner can view all guest lists in their tenant
-- Expected: Should return all lists for the tenant

-- Test 2: Promoter can only view their own guest lists
-- Expected: Should return only lists where promoter_id = auth.uid()

-- Test 3: VIP Host can add guests
-- Expected: INSERT should succeed with role = 'vip_host'

-- Test 4: Staff cannot add guests
-- Expected: INSERT should fail with role = 'staff'

-- Test 5: Promoter cannot edit guests added by others
-- Expected: UPDATE should fail if added_by != auth.uid()

-- Test 6: Only Owner/Manager can delete guests
-- Expected: DELETE should fail for roles other than owner/manager

-- ====================
-- TROUBLESHOOTING QUERIES
-- ====================

-- If permissions aren't working, check:

-- 1. Is the user authenticated?
SELECT auth.uid();
-- Should return a valid UUID

-- 2. Does the user have a profile with a role?
SELECT id, email, role, tenant_id
FROM profiles
WHERE id = auth.uid();
-- Should return user's profile with role

-- 3. Are there multiple policies that might conflict?
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'guest_list_entries';
-- Check for conflicting USING/WITH CHECK clauses

-- 4. Check specific policy definition
SELECT 
  pg_get_expr(polqual, polrelid) as using_expression,
  pg_get_expr(polwithcheck, polrelid) as with_check_expression
FROM pg_policy
WHERE polname = 'guest_entries_update_policy';
-- Review the actual policy SQL

-- ====================
-- MIGRATION STATUS
-- ====================

-- Check if the guest list permissions migration has been applied
SELECT 
  version,
  description,
  inserted_at
FROM schema_migrations
WHERE version = '20260316000000'
ORDER BY inserted_at DESC
LIMIT 1;

-- Expected: Should return one row with the migration timestamp
