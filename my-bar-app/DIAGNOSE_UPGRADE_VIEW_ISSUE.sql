-- ============================================================
-- DIAGNOSE: Why tenant_subscription_details doesn't show upgrades
-- ============================================================

-- ISSUE: tenant_subscription_details is a VIEW, not a table
-- VIEWs don't have INSERT - they query underlying tables (tenants + subscription_plans)
-- When you upgrade, you UPDATE the tenants table, and the view should reflect it automatically

-- ============================================================
-- CHECK 1: Verify the tenants table has latest data
-- ============================================================

SELECT 
  id as tenant_id,
  name as tenant_name,
  subscription_tier,
  subscription_status,
  subscription_end,
  stripe_customer_id,
  stripe_subscription_id,
  updated_at,
  'Direct from tenants table' as source
FROM tenants
WHERE subscription_tier = 'enterprise'
ORDER BY updated_at DESC;
-- This should show your ACTUAL tenant data including recent upgrades

-- ============================================================
-- CHECK 2: Verify subscription_plans table has enterprise tier
-- ============================================================

SELECT 
  id,
  tier,
  display_name,
  price_monthly,
  price_yearly,
  max_staff,
  max_locations
FROM subscription_plans
WHERE tier = 'enterprise';
-- This should show the enterprise plan details

-- ============================================================
-- CHECK 3: Test the view query manually (bypass view)
-- ============================================================

SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  t.subscription_status,
  t.subscription_end,
  sp.display_name as plan_name,
  sp.price_monthly,
  sp.price_yearly,
  'Manual query - should match view' as source
FROM tenants t
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier
WHERE t.subscription_tier = 'enterprise'
  AND (
    -- Platform admins can see all
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    )
    OR
    -- Regular users can only see their tenant
    t.id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
-- This is exactly what the view does - if this works, view should work

-- ============================================================
-- CHECK 4: Compare view vs direct table query
-- ============================================================

-- From VIEW:
SELECT 'From VIEW' as source, COUNT(*) as count
FROM tenant_subscription_details
WHERE subscription_tier = 'enterprise'

UNION ALL

-- From TABLE:
SELECT 'From TABLE' as source, COUNT(*) as count
FROM tenants
WHERE subscription_tier = 'enterprise';

-- Expected: Both should return the SAME count
-- If TABLE shows data but VIEW doesn't → RLS issue
-- If BOTH show 0 → No enterprise tenants exist

-- ============================================================
-- CHECK 5: Verify your profile has correct tenant_id
-- ============================================================

SELECT 
  'Your profile' as check_type,
  p.id as user_id,
  p.email,
  p.role,
  p.tenant_id,
  t.name as tenant_name,
  t.subscription_tier
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.id = auth.uid()

UNION ALL

SELECT 
  'Enterprise tenants' as check_type,
  NULL as user_id,
  NULL as email,
  NULL as role,
  t.id as tenant_id,
  t.name,
  t.subscription_tier
FROM tenants t
WHERE t.subscription_tier = 'enterprise';

-- Your profile.tenant_id should match one of the enterprise tenant IDs

-- ============================================================
-- CHECK 6: Test upgrade history
-- ============================================================

SELECT 
  sh.tenant_id,
  sh.old_tier,
  sh.new_tier,
  sh.new_status,
  sh.changed_at,
  t.name as current_tenant_name,
  t.subscription_tier as current_tier
FROM subscription_history sh
LEFT JOIN tenants t ON sh.tenant_id = t.id
WHERE sh.new_tier = 'enterprise'
ORDER BY sh.changed_at DESC
LIMIT 10;
-- Shows upgrade history - verify upgrades are being recorded

-- ============================================================
-- COMMON ISSUES & FIXES
-- ============================================================

/*
ISSUE 1: "tenant_subscription_details is empty but tenants table has data"
CAUSE: Your profile.tenant_id doesn't match any tenant, OR RLS is blocking
FIX: 
  UPDATE profiles 
  SET tenant_id = (SELECT id FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1)
  WHERE id = auth.uid();

ISSUE 2: "View shows old tier even after upgrade"
CAUSE: Tenants table wasn't actually updated, OR cache issue
FIX: 
  - Check if Stripe webhook ran successfully (check Stripe dashboard logs)
  - Manually update: UPDATE tenants SET subscription_tier = 'enterprise', updated_at = NOW() WHERE id = 'your-tenant-id';
  - Refresh schema: NOTIFY pgrst, 'reload schema';

ISSUE 3: "subscription_end is NULL after upgrade"
CAUSE: Upgrade logic doesn't set subscription_end
FIX: Run FIX_NEXT_BILLING_DATES.sql migration to add billing_period logic, OR manually:
  UPDATE tenants 
  SET subscription_end = subscription_start + INTERVAL '365 days'
  WHERE subscription_tier = 'enterprise';

ISSUE 4: "View exists but returns error when queried"
CAUSE: RLS policy references non-existent columns or has syntax error
FIX: Recreate the view (it's in FIX_TENANT_SUBSCRIPTION_DETAILS_RLS.sql)
*/

-- ============================================================
-- QUICK FIX: Force refresh view data
-- ============================================================

-- Re-grant permissions
GRANT SELECT ON tenant_subscription_details TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Test again
SELECT * FROM tenant_subscription_details;

-- ============================================================
-- MANUAL UPGRADE (if Stripe webhook failed)
-- ============================================================

-- If you need to manually upgrade a tenant to enterprise:
/*
-- Step 1: Find the tenant
SELECT id, name, subscription_tier FROM tenants WHERE name LIKE '%your venue%';

-- Step 2: Find the enterprise plan
SELECT id, tier, display_name FROM subscription_plans WHERE tier = 'enterprise';

-- Step 3: Use the change_subscription function
SELECT change_subscription(
  'paste-tenant-id-here'::uuid,
  (SELECT id FROM subscription_plans WHERE tier = 'enterprise' LIMIT 1),
  'yearly'  -- or 'monthly'
);

-- OR manually update:
UPDATE tenants
SET 
  subscription_tier = 'enterprise',
  subscription_status = 'active',
  subscription_end = CURRENT_DATE + INTERVAL '365 days',  -- 1 year from now
  updated_at = NOW()
WHERE id = 'paste-tenant-id-here';
*/
