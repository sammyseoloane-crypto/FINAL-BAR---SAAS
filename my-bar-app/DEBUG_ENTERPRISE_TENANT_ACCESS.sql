-- ============================================================
-- DEBUG: Enterprise Tenant Access Issue
-- User is in enterprise plan but tenant_subscription_details shows no data
-- ============================================================

-- STEP 1: Check your current login and profile
SELECT 
  auth.uid() as your_user_id,
  p.email as your_email,
  p.role as your_role,
  p.tenant_id as your_tenant_id_in_profile,
  p.full_name
FROM profiles p
WHERE p.id = auth.uid();
-- EXPECTED: Should show YOUR user info with tenant_id

-- STEP 2: Check if your tenant exists and is enterprise
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  t.subscription_status,
  t.subscription_end,
  t.created_at
FROM tenants t
WHERE t.subscription_tier = 'enterprise';
-- EXPECTED: Should show your enterprise tenant

-- STEP 3: Check if your profile.tenant_id matches the enterprise tenant
SELECT 
  'Profile tenant_id' as source,
  (SELECT tenant_id FROM profiles WHERE id = auth.uid()) as tenant_id
UNION ALL
SELECT 
  'Enterprise tenant id' as source,
  id as tenant_id
FROM tenants 
WHERE subscription_tier = 'enterprise'
LIMIT 1;
-- EXPECTED: Both should have the SAME UUID

-- STEP 4: Test the view WHERE clause logic manually
SELECT 
  'auth.uid()' as check_name,
  auth.uid()::text as value
UNION ALL
SELECT 
  'Is platform_admin?',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    ) THEN 'YES'
    ELSE 'NO'
  END
UNION ALL
SELECT 
  'Your tenant_id from profile',
  (SELECT tenant_id::text FROM profiles WHERE id = auth.uid())
UNION ALL
SELECT 
  'Enterprise tenant_id',
  (SELECT id::text FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1);

-- STEP 5: Manually run the view query to see what happens
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  'Manual query result' as note
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
-- EXPECTED: Should show at least your enterprise tenant

-- ============================================================
-- COMMON FIXES
-- ============================================================

-- FIX 1: If your profile has no tenant_id, set it
-- Get the enterprise tenant ID first:
SELECT id, name FROM tenants WHERE subscription_tier = 'enterprise';

-- Then update your profile (replace YOUR_TENANT_ID):
-- UPDATE profiles 
-- SET tenant_id = 'YOUR_TENANT_ID'  -- Copy the UUID from above
-- WHERE id = auth.uid();

-- FIX 2: If you should be platform_admin, set the role
-- UPDATE profiles 
-- SET role = 'platform_admin', tenant_id = NULL
-- WHERE id = auth.uid();

-- FIX 3: If multiple users need access, check all profiles for your tenant
SELECT 
  p.id as user_id,
  p.email,
  p.role,
  p.tenant_id,
  CASE 
    WHEN p.tenant_id = t.id THEN '✓ Correctly linked'
    WHEN p.tenant_id IS NULL THEN '✗ No tenant_id'
    ELSE '⚠ Different tenant'
  END as status
FROM profiles p
CROSS JOIN (SELECT id FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1) t
WHERE p.email LIKE '%@%'  -- All real users
ORDER BY status;

-- FIX 4: Verify subscription_plans table has enterprise tier
SELECT 
  tier,
  display_name,
  price_monthly,
  price_yearly,
  max_staff,
  max_locations
FROM subscription_plans
WHERE tier = 'enterprise';
-- EXPECTED: Should show enterprise plan details

-- ============================================================
-- RETEST: After applying a fix, test the view again
-- ============================================================
SELECT * FROM tenant_subscription_details;
-- EXPECTED: Should now show your enterprise tenant details
