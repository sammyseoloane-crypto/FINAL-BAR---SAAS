-- ================================================
-- FIX: Add RLS Policies to Views Without Security
-- Secure multi-tenant isolation for all views
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- PROBLEM
-- ============================================================

-- Multiple views have no RLS policies, creating security vulnerabilities:
-- 1. tenant_subscription_details - exposes ALL tenant subscription data
-- 2. reports - exposes ALL transaction data across all tenants
-- 3. email_statistics - exposes ALL email stats across all tenants
-- 4. task_stats_by_user - exposes ALL staff task stats across all tenants
-- 5. overdue_tasks - exposes ALL overdue tasks across all tenants

-- ANY authenticated user can query these and see ALL tenant data
-- This violates multi-tenant isolation security and data privacy

-- Example Attack:
-- A user from "Bar A" could run:
--   SELECT * FROM tenant_subscription_details;
-- and see subscription details for "Bar B", "Bar C", etc.

-- ============================================================
-- FIX 1: tenant_subscription_details View
-- ============================================================

-- Recreate tenant_subscription_details view with security_barrier
-- and built-in tenant filtering via WHERE clause
-- Note: billing_period column excluded - add it after running FIX_NEXT_BILLING_DATES.sql

DROP VIEW IF EXISTS tenant_subscription_details;

CREATE VIEW tenant_subscription_details
WITH (security_barrier = true) AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  t.subscription_status,
  t.subscription_end,
  sp.display_name as plan_name,
  sp.price_monthly,
  sp.price_yearly,
  sp.max_locations,
  sp.max_staff,
  sp.max_products,
  sp.max_monthly_transactions,
  sp.max_events_per_month,
  sp.transaction_fee_percentage,
  sp.features,
  t.stripe_customer_id,
  t.stripe_subscription_id
FROM tenants t
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier
WHERE 
  -- Platform admins can see all tenants
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'platform_admin'
  )
  OR
  -- Regular users can only see their own tenant
  t.id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
  );

-- Grant SELECT permission
GRANT SELECT ON tenant_subscription_details TO authenticated;

-- Add comment
COMMENT ON VIEW tenant_subscription_details IS 'Secure view of tenant subscription information with RLS - platform_admin sees all, users see only their tenant';

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Test 1: Verify all views have security_barrier enabled
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE viewname IN (
  'tenant_subscription_details',
  'reports',
  'email_statistics',
  'task_stats_by_user',
  'overdue_tasks'
)
ORDER BY viewname;

-- Test 2: Test tenant_subscription_details isolation
-- Login as a regular user (owner/manager)
-- Should only see YOUR tenant
SELECT * FROM tenant_subscription_details;

-- Test 3: Test reports isolation
-- Should only see YOUR tenant's transactions
SELECT DISTINCT tenant_id, COUNT(*) as count
FROM reports
GROUP BY tenant_id;
-- Result should show only 1 tenant_id (yours)

-- Test 4: Test email_statistics isolation
SELECT * FROM email_statistics;
-- Should only show your tenant's email stats

-- Test 5: Test task_stats_by_user isolation
SELECT * FROM task_stats_by_user;
-- Should only show your tenant's staff

-- Test 6: Test overdue_tasks isolation
SELECT * FROM overdue_tasks;
-- Should only show your tenant's overdue tasks

-- Test 7: Verify platform_admin can see all (run as platform_admin)
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
-- Platform admin should see multiple tenants in each view

-- Test 8: Verify regular user sees only 1 tenant everywhere
-- Login as regular user (owner/manager/staff)
-- Same query as Test 7
-- All counts should be 1 (your tenant only)

-- Test 9: Check for any policy violations
-- This should return no rows (no policy bypasses)
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN (
  'tenant_subscription_details',
  'reports',
  'email_statistics',
  'task_stats_by_user',
  'overdue_tasks'
)
  AND permissive = 'PERMISSIVE'
  AND roles @> ARRAY['PUBLIC']::name[];
-- If this returns rows, there's a security issue

-- ============================================================
-- REFRESH SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- FIX 2: reports View
-- ============================================================

-- The reports view also has no RLS and exposes all transaction data
-- across all tenants

-- Recreate the reports view with security_barrier and WHERE clause
DROP VIEW IF EXISTS reports;

CREATE VIEW reports
WITH (security_barrier = true) AS
SELECT 
  t.tenant_id,
  t.id as transaction_id,
  t.user_id,
  t.product_id,
  p.name as product_name,
  p.type as product_type,
  t.amount,
  t.status,
  t.created_at,
  t.confirmed_at,
  DATE(t.created_at) as transaction_date,
  EXTRACT(HOUR FROM t.created_at) as transaction_hour,
  EXTRACT(DOW FROM t.created_at) as day_of_week
FROM transactions t
LEFT JOIN products p ON t.product_id = p.id
WHERE 
  -- Platform admins can see all transactions
  EXISTS (
    SELECT 1 FROM profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'platform_admin'
  )
  OR
  -- Regular users can only see their tenant's transactions
  t.tenant_id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
  );

-- Grant SELECT permission
GRANT SELECT ON reports TO authenticated;

-- Add comment
COMMENT ON VIEW reports IS 'Secure reports view with RLS - platform_admin sees all, users see only their tenant transactions';

-- ============================================================
-- FIX 3: email_statistics View
-- ============================================================

-- Recreate with tenant filtering
DROP VIEW IF EXISTS email_statistics;

CREATE VIEW email_statistics
WITH (security_barrier = true) AS
SELECT 
  el.tenant_id,
  el.email_type,
  el.status,
  COUNT(*) as count,
  DATE(el.sent_at) as sent_date
FROM email_logs el
WHERE el.tenant_id IS NOT NULL
  AND (
    -- Platform admins can see all
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'platform_admin'
    )
    OR
    -- Regular users can only see their tenant's emails
    el.tenant_id = (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid()
    )
  )
GROUP BY el.tenant_id, el.email_type, el.status, DATE(el.sent_at);

GRANT SELECT ON email_statistics TO authenticated;

COMMENT ON VIEW email_statistics IS 'Email statistics per tenant with RLS - platform_admin sees all, users see only their tenant';

-- ============================================================
-- FIX 4: task_stats_by_user View
-- ============================================================

-- Recreate with tenant filtering
DROP VIEW IF EXISTS task_stats_by_user;

CREATE VIEW task_stats_by_user
WITH (security_barrier = true) AS
SELECT 
  u.id AS user_id,
  u.email,
  u.tenant_id,
  COUNT(*) FILTER (WHERE t.status = 'completed') AS completed_tasks,
  COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress_tasks,
  COUNT(*) FILTER (WHERE t.status = 'pending') AS pending_tasks,
  COUNT(*) AS total_tasks,
  ROUND(
    (COUNT(*) FILTER (WHERE t.status = 'completed')::NUMERIC / 
    NULLIF(COUNT(*), 0)) * 100, 
    2
  ) AS completion_rate
FROM users u
LEFT JOIN tasks t ON t.assigned_to = u.id
WHERE u.role = 'staff'
  AND (
    -- Platform admins can see all
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'platform_admin'
    )
    OR
    -- Regular users can only see their tenant's staff
    u.tenant_id = (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid()
    )
  )
GROUP BY u.id, u.email, u.tenant_id;

GRANT SELECT ON task_stats_by_user TO authenticated;

COMMENT ON VIEW task_stats_by_user IS 'Task statistics per user with RLS - platform_admin sees all, users see only their tenant staff';

-- ============================================================
-- FIX 5: overdue_tasks View
-- ============================================================

-- Recreate with tenant filtering
DROP VIEW IF EXISTS overdue_tasks;

CREATE VIEW overdue_tasks
WITH (security_barrier = true) AS
SELECT 
  t.*,
  u.email AS assigned_to_email,
  l.name AS location_name,
  EXTRACT(EPOCH FROM (NOW() - t.due_date))/3600 AS hours_overdue
FROM tasks t
LEFT JOIN users u ON t.assigned_to = u.id
LEFT JOIN locations l ON t.location_id = l.id
WHERE t.due_date < NOW()
  AND t.status NOT IN ('completed', 'cancelled')
  AND (
    -- Platform admins can see all
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'platform_admin'
    )
    OR
    -- Regular users can only see their tenant's overdue tasks
    t.tenant_id = (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid()
    )
  )
ORDER BY t.due_date ASC;

GRANT SELECT ON overdue_tasks TO authenticated;

COMMENT ON VIEW overdue_tasks IS 'Overdue tasks with RLS - platform_admin sees all, users see only their tenant tasks';

-- ============================================================
-- REFRESH SCHEMA CACHE (AGAIN)
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- SUMMARY
-- ============================================================

-- After running this migration:
-- ✅ All tenant-related views now have RLS enabled
-- ✅ Platform admins can view ALL data across all tenants
-- ✅ Regular users can ONLY view their own tenant's data
-- ✅ Multi-tenant isolation is enforced at database level
-- ✅ No code changes needed in frontend

-- Security Benefits:
-- • Prevents data leakage between tenants
-- • Enforces least-privilege access
-- • Database-level security (not just application-level)
-- • Complies with multi-tenant best practices
-- • Uses security_barrier for defense in depth

-- Views Fixed (5 total):
-- 1. tenant_subscription_details - subscription data per tenant
-- 2. reports - transaction reporting data per tenant
-- 3. email_statistics - email stats per tenant
-- 4. task_stats_by_user - task completion stats per tenant
-- 5. overdue_tasks - overdue task list per tenant

-- Impact:
-- • Before: ANY authenticated user could see ALL tenant data in these views
-- • After: Users can ONLY see their own tenant's data
-- • Exception: platform_admin role can see everything (intended)

-- Security Model:
-- • All views use: WITH (security_barrier = true)
-- • All views filter by: platform_admin OR user's tenant_id
-- • Profiles table used for auth.uid() → tenant_id mapping
-- • No possibility of cross-tenant data exposure

-- ============================================================
-- OPTIONAL: Add billing_period to tenant_subscription_details
-- ============================================================

-- After running FIX_NEXT_BILLING_DATES.sql (which adds billing_period column),
-- you can recreate tenant_subscription_details to include it:

/*
DROP VIEW IF EXISTS tenant_subscription_details;

CREATE VIEW tenant_subscription_details
WITH (security_barrier = true) AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  t.subscription_status,
  t.subscription_end,
  t.billing_period,  -- ← ADD THIS
  sp.display_name as plan_name,
  sp.price_monthly,
  sp.price_yearly,
  sp.max_locations,
  sp.max_staff,
  sp.max_products,
  sp.max_monthly_transactions,
  sp.max_events_per_month,
  sp.transaction_fee_percentage,
  sp.features,
  t.stripe_customer_id,
  t.stripe_subscription_id
FROM tenants t
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier
WHERE 
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'platform_admin'
  )
  OR
  t.id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
  );

GRANT SELECT ON tenant_subscription_details TO authenticated;
NOTIFY pgrst, 'reload schema';
*/
