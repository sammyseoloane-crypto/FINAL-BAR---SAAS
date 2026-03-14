-- ============================================================
-- DIAGNOSE VIEW ACCESS ISSUES
-- Run these queries to identify why views show 0 results
-- ============================================================

-- Check 1: Verify you're logged in and have a profile
SELECT 
  auth.uid() as current_user_id,
  p.email,
  p.role,
  p.tenant_id,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.id = auth.uid();
-- Expected: Should return YOUR user profile with role and tenant_id

-- Check 2: Count actual data in underlying tables
SELECT 
  'tenants' as table_name,
  COUNT(*) as row_count
FROM tenants
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'email_logs', COUNT(*) FROM email_logs
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'users (staff)', COUNT(*) FROM users WHERE role = 'staff';
-- Expected: Should show how many rows exist in each table

-- Check 3: Test tenant_subscription_details without RLS filter
-- (This bypasses the security to see if data exists)
SELECT COUNT(*) as total_tenants FROM tenants;
-- Expected: Should show total number of tenants in database

-- Check 4: Test if platform_admin check works
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    ) THEN 'YES - You are platform_admin'
    ELSE 'NO - You are NOT platform_admin'
  END as platform_admin_status;
-- Expected: Should show if current user is platform_admin

-- Check 5: Test if regular tenant filtering works
SELECT 
  (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
  ) as your_tenant_id,
  (
    SELECT name FROM tenants
    WHERE id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ) as your_tenant_name;
-- Expected: Should show YOUR tenant_id and name

-- Check 6: Manually test the view logic for tenant_subscription_details
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  'Should you see this?' as question,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    ) THEN 'YES (platform_admin)'
    WHEN t.id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ) THEN 'YES (your tenant)'
    ELSE 'NO (different tenant)'
  END as access_status
FROM tenants t
ORDER BY access_status DESC;
-- Expected: Shows all tenants with access status

-- ============================================================
-- COMMON ISSUES AND FIXES
-- ============================================================

/*
ISSUE 1: "current_user_id is NULL"
FIX: You're not logged in to Supabase. Log in via the UI or set auth token.

ISSUE 2: "role is NULL" or "tenant_id is NULL"
FIX: Your profile is incomplete. Update it:
  UPDATE profiles 
  SET role = 'platform_admin', tenant_id = NULL 
  WHERE id = auth.uid();

ISSUE 3: "All tables show 0 rows"
FIX: Database is empty. Create test data:
  - Add tenants via Tenants page
  - Add transactions via POS
  - Send test emails
  - Create tasks

ISSUE 4: "You are NOT platform_admin but expect to be"
FIX: Update your role:
  UPDATE profiles SET role = 'platform_admin' WHERE id = auth.uid();

ISSUE 5: "Views show 0 but Check 6 shows data with 'YES' status"
FIX: Views might need schema refresh:
  NOTIFY pgrst, 'reload schema';
  
  Or check grants:
  GRANT SELECT ON tenant_subscription_details TO authenticated;
  GRANT SELECT ON reports TO authenticated;
  GRANT SELECT ON email_statistics TO authenticated;
  GRANT SELECT ON task_stats_by_user TO authenticated;
  GRANT SELECT ON overdue_tasks TO authenticated;
*/

-- ============================================================
-- QUICK FIX: Refresh everything
-- ============================================================

-- Re-grant permissions
GRANT SELECT ON tenant_subscription_details TO authenticated;
GRANT SELECT ON reports TO authenticated;
GRANT SELECT ON email_statistics TO authenticated;
GRANT SELECT ON task_stats_by_user TO authenticated;
GRANT SELECT ON overdue_tasks TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- RETEST: Run the original query again
-- ============================================================

SELECT 
  'tenant_subscription_details' as view_name,
  COUNT(DISTINCT tenant_id) as tenant_count
FROM tenant_subscription_details
UNION ALL
SELECT 
  'reports',
  COUNT(DISTINCT tenant_id)
FROM reports
UNION ALL
SELECT 
  'email_statistics',
  COUNT(DISTINCT tenant_id)
FROM email_statistics
UNION ALL
SELECT 
  'task_stats_by_user',
  COUNT(DISTINCT tenant_id)
FROM task_stats_by_user
UNION ALL
SELECT 
  'overdue_tasks',
  COUNT(DISTINCT tenant_id)
FROM overdue_tasks;
-- Expected: Should show > 0 if you're platform_admin or have tenant data
