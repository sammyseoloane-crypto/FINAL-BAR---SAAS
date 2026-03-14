-- ============================================================
-- DIAGNOSE & FIX: Why tenant_subscription_details still empty
-- ============================================================

-- STEP 1: Verify your profile was actually updated
SELECT 
  auth.uid() as current_user,
  p.email,
  p.role,
  p.tenant_id as profile_tenant_id,
  t.id as actual_enterprise_tenant_id,
  CASE 
    WHEN p.tenant_id = t.id THEN '✅ MATCH - Should work'
    WHEN p.tenant_id IS NULL THEN '❌ Profile has NULL tenant_id'
    ELSE '❌ MISMATCH - Different tenant'
  END as status
FROM profiles p
CROSS JOIN (SELECT id FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1) t
WHERE p.id = auth.uid();
-- If this shows MISMATCH or NULL, the UPDATE didn't work

-- STEP 2: Check if auth.uid() is working
SELECT 
  auth.uid() as your_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NOT LOGGED IN'
    ELSE '✅ Logged in'
  END as login_status;
-- If NULL, you're not authenticated

-- STEP 3: Manually test the view WHERE clause
SELECT 
  'Platform admin check' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    ) THEN '✅ YES - You ARE platform_admin'
    ELSE '❌ NO - You are NOT platform_admin'
  END as result
UNION ALL
SELECT 
  'Tenant match check',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND t.subscription_tier = 'enterprise'
    ) THEN '✅ YES - Your tenant_id matches enterprise tenant'
    ELSE '❌ NO - No match'
  END;

-- STEP 4: Test the full view query manually (without RLS)
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  t.subscription_status,
  sp.display_name as plan_name,
  'Direct query - bypasses view RLS' as note
FROM tenants t
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier
WHERE t.subscription_tier = 'enterprise';
-- If this shows data, the data exists and JOIN works

-- STEP 5: Test with explicit tenant_id (replace with yours)
SELECT 
  (SELECT tenant_id FROM profiles WHERE id = auth.uid()) as your_tenant_id_from_profile,
  (SELECT id FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1) as enterprise_tenant_id_from_table;
-- These two UUIDs should be IDENTICAL

-- ============================================================
-- FIX OPTIONS
-- ============================================================

-- FIX 1: If profile.tenant_id is still NULL, try this update:
UPDATE profiles
SET tenant_id = (SELECT id FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1)
WHERE id = auth.uid()
RETURNING id, email, tenant_id, 'Updated!' as status;

-- FIX 2: If you should be platform_admin instead:
UPDATE profiles
SET role = 'platform_admin',
    tenant_id = NULL  -- Platform admins see ALL tenants
WHERE id = auth.uid()
RETURNING id, email, role, 'Now platform_admin!' as status;

-- FIX 3: Temporarily disable RLS by recreating view without WHERE clause
-- (ONLY for testing - security risk in production!)
DROP VIEW IF EXISTS tenant_subscription_details_no_rls;

CREATE VIEW tenant_subscription_details_no_rls AS
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
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier;
-- No WHERE clause - shows ALL tenants

GRANT SELECT ON tenant_subscription_details_no_rls TO authenticated;

-- Test this view (shows all data):
SELECT * FROM tenant_subscription_details_no_rls WHERE subscription_tier = 'enterprise';
-- If this works but tenant_subscription_details doesn't, it's 100% the RLS WHERE clause

-- ============================================================
-- PERMANENT FIX: Recreate view with simpler RLS logic
-- ============================================================

DROP VIEW IF EXISTS tenant_subscription_details CASCADE;

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
  -- Platform admins see all
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'platform_admin'
  OR
  -- Regular users see only their tenant
  t.id = (SELECT tenant_id FROM profiles WHERE id = auth.uid());

GRANT SELECT ON tenant_subscription_details TO authenticated;

COMMENT ON VIEW tenant_subscription_details IS 'Tenant subscription details with RLS - platform_admin sees all, users see their tenant';

-- Refresh schema
NOTIFY pgrst, 'reload schema';

-- Test the recreated view
SELECT * FROM tenant_subscription_details;

-- ============================================================
-- NUCLEAR OPTION: Disable RLS entirely (testing only!)
-- ============================================================

-- If nothing else works, test with NO RLS at all:
/*
DROP VIEW IF EXISTS tenant_subscription_details CASCADE;

CREATE VIEW tenant_subscription_details AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  t.subscription_status,
  t.subscription_end,
  sp.display_name as plan_name,
  sp.price_monthly,
  sp.price_yearly,
  t.stripe_customer_id,
  t.stripe_subscription_id
FROM tenants t
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier;

GRANT SELECT ON tenant_subscription_details TO authenticated, anon;

SELECT * FROM tenant_subscription_details;
*/

-- ⚠️ WARNING: This shows ALL tenant data to ALL users
-- Only for debugging - never use in production!
