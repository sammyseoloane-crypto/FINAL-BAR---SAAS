-- ============================================================
-- VERIFY 14-DAY TRIAL IMPLEMENTATION
-- Check that first users (owners) get proper trial setup
-- Date: 2026-03-25
-- ============================================================

-- ============================================================
-- STEP 1: Check Current Trial Tenants
-- ============================================================

SELECT 
  t.id,
  t.name,
  t.created_at::DATE as signup_date,
  t.subscription_status,
  t.subscription_tier,
  t.subscription_end::DATE as trial_expires,
  EXTRACT(DAY FROM t.subscription_end - t.created_at)::INT as trial_days_granted,
  CASE 
    WHEN t.subscription_end IS NULL THEN '❌ NO TRIAL END DATE'
    WHEN EXTRACT(DAY FROM t.subscription_end - t.created_at) != 14 THEN '⚠️  NOT 14 DAYS'
    WHEN t.subscription_end < NOW() THEN '⏰ TRIAL EXPIRED'
    ELSE '✅ TRIAL ACTIVE (' || EXTRACT(DAY FROM t.subscription_end - NOW())::INT || ' days left)'
  END as trial_status,
  t.max_staff,
  t.max_locations,
  t.max_products,
  t.max_monthly_transactions
FROM tenants t
WHERE t.subscription_status = 'trial' OR t.subscription_tier = 'trial'
ORDER BY t.created_at DESC;

-- ============================================================
-- STEP 2: Verify Trial Plan Exists in subscription_plans
-- ============================================================

SELECT 
  name,
  display_name,
  tier,
  price_monthly,
  max_staff,
  max_locations,
  max_products,
  max_monthly_transactions,
  monthly_revenue_limit,
  transaction_fee_percentage,
  is_active
FROM subscription_plans
WHERE tier = 'trial';

-- ============================================================
-- STEP 3: Check if Trial Trigger Exists
-- ============================================================

-- Check for trigger that auto-sets subscription_end for trial
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%subscription%' 
   OR trigger_name LIKE '%trial%'
   OR action_statement LIKE '%subscription_end%';

-- ============================================================
-- STEP 4: Check Owner Profiles Associated with Trial Tenants
-- ============================================================

SELECT 
  p.id as user_id,
  p.email,
  p.role,
  p.full_name,
  p.created_at::DATE as user_created,
  t.name as business_name,
  t.subscription_status,
  t.subscription_end::DATE as trial_expires
FROM profiles p
JOIN tenants t ON p.tenant_id = t.id
WHERE p.role = 'owner'
  AND t.subscription_status = 'trial'
ORDER BY p.created_at DESC;

-- ============================================================
-- STEP 5: Apply Missing Trigger (If Needed)
-- ============================================================

-- Function to automatically set trial end date
CREATE OR REPLACE FUNCTION set_trial_subscription_end()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription_status is 'trial' and no subscription_end
  IF NEW.subscription_status = 'trial' AND NEW.subscription_end IS NULL THEN
    NEW.subscription_end = TIMEZONE('utc', NOW()) + INTERVAL '14 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists then create
DROP TRIGGER IF EXISTS trigger_set_trial_end ON tenants;
CREATE TRIGGER trigger_set_trial_end
  BEFORE INSERT OR UPDATE ON tenants
  FOR EACH ROW
  WHEN (NEW.subscription_status = 'trial')
  EXECUTE FUNCTION set_trial_subscription_end();

-- ============================================================
-- STEP 6: Fix Any Existing Trial Tenants Without End Date
-- ============================================================

-- Update trial tenants that are missing subscription_end
UPDATE tenants
SET subscription_end = created_at + INTERVAL '14 days'
WHERE subscription_status = 'trial'
  AND subscription_end IS NULL;

-- Report what was fixed
SELECT 
  COUNT(*) as fixed_count,
  '✅ Fixed trial tenants without end date' as status
FROM tenants
WHERE subscription_status = 'trial'
  AND subscription_end IS NOT NULL;

-- ============================================================
-- STEP 7: Verify Trial Limits Are Applied
-- ============================================================

-- Check if trial tenants have correct limits
SELECT 
  t.name,
  t.subscription_tier,
  CASE WHEN t.max_staff = 5 THEN '✅' ELSE '❌ Should be 5' END as staff_limit,
  t.max_staff,
  CASE WHEN t.max_locations = 1 THEN '✅' ELSE '❌ Should be 1' END as locations_limit,
  t.max_locations,
  CASE WHEN t.max_products = 50 THEN '✅' ELSE '❌ Should be 50' END as products_limit,
  t.max_products,
  CASE WHEN t.max_monthly_transactions = 500 THEN '✅' ELSE '❌ Should be 500' END as transactions_limit,
  t.max_monthly_transactions
FROM tenants t
WHERE t.subscription_status = 'trial';

-- ============================================================
-- STEP 8: Test New Owner Registration Flow
-- ============================================================

-- This SQL demonstrates what happens when a new owner registers
-- (The actual registration happens in AuthContext.jsx)

-- Example of what AuthContext.jsx does:
/*
INSERT INTO tenants (name, subscription_status, subscription_end)
VALUES (
  'New Bar Name',
  'trial',
  NOW() + INTERVAL '14 days'
)
RETURNING id;
*/

-- ============================================================
-- VERIFICATION SUMMARY
-- ============================================================

-- Count total trial accounts
SELECT 
  COUNT(*) as total_trial_accounts,
  COUNT(CASE WHEN subscription_end IS NOT NULL THEN 1 END) as with_end_date,
  COUNT(CASE WHEN subscription_end IS NULL THEN 1 END) as missing_end_date,
  COUNT(CASE WHEN subscription_end > NOW() THEN 1 END) as active_trials,
  COUNT(CASE WHEN subscription_end < NOW() THEN 1 END) as expired_trials
FROM tenants
WHERE subscription_status = 'trial';

-- ============================================================
-- EXPECTED RESULTS
-- ============================================================
/*
✅ All trial tenants should have subscription_end set
✅ Trial period should be exactly 14 days
✅ Trial limits: 5 staff, 1 location, 50 products, 500 transactions
✅ Trigger should exist to auto-set trial end date
✅ AuthContext.jsx manually sets trial end date on owner registration
✅ Owner role should be assigned to first user of trial tenant
*/
