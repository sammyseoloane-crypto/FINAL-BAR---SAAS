-- ============================================================
-- EXPLANATION: Why Views Don't Need INSERT
-- tenant_subscription_details is a VIEW, not a TABLE
-- ============================================================

/*
🔍 UNDERSTANDING THE DIFFERENCE:

TABLE (tenants):
- Stores actual data on disk
- You can INSERT, UPDATE, DELETE rows
- Physical storage of subscription info

VIEW (tenant_subscription_details):
- Virtual table - no data storage
- Just a saved SELECT query
- Automatically shows latest data from underlying tables
- You CANNOT INSERT into a view
- When underlying table changes, view reflects it instantly

ANALOGY:
- Table = Photo album (stores actual photos)
- View = Window into the album (you see the photos, but window doesn't store them)
*/

-- ============================================================
-- HOW SUBSCRIPTION UPGRADES WORK
-- ============================================================

/*
STEP 1: User clicks "Upgrade to Enterprise" in UI
   ↓
STEP 2: Stripe Checkout session created
   ↓
STEP 3: User pays via Stripe
   ↓
STEP 4: Stripe webhook fires (stripe-webhook edge function)
   ↓
STEP 5: Webhook UPDATES tenants table:
   UPDATE tenants SET
     subscription_tier = 'enterprise',
     subscription_status = 'active',
     stripe_subscription_id = '...',
     updated_at = NOW()
   WHERE id = tenant_id;
   ↓
STEP 6: tenant_subscription_details VIEW automatically shows new data
   (Because it queries FROM tenants table)
   ↓
STEP 7: User refreshes dashboard and sees "Enterprise" badge
*/

-- ============================================================
-- THE VIEW DEFINITION
-- ============================================================

-- This is what tenant_subscription_details actually is:
/*
CREATE VIEW tenant_subscription_details AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,        ← FROM tenants table
  t.subscription_status,       ← FROM tenants table
  t.subscription_end,          ← FROM tenants table
  sp.display_name as plan_name, ← FROM subscription_plans table
  sp.price_monthly,            ← FROM subscription_plans table
  sp.price_yearly              ← FROM subscription_plans table
FROM tenants t                 ← Queries this table
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier
WHERE ... RLS filters ...;
*/

-- When you UPDATE tenants.subscription_tier, the view INSTANTLY shows the new value
-- No INSERT needed - it's automatic!

-- ============================================================
-- WHAT ACTUALLY HAPPENS DURING UPGRADE
-- ============================================================

-- BEFORE upgrade:
SELECT subscription_tier FROM tenants WHERE id = 'abc-123';
-- Result: 'trial'

-- View shows:
SELECT * FROM tenant_subscription_details WHERE tenant_id = 'abc-123';
-- Result: tier = 'trial', plan_name = 'Trial Plan'

-- ⬇️ USER UPGRADES VIA STRIPE ⬇️

-- Webhook runs:
UPDATE tenants SET subscription_tier = 'enterprise' WHERE id = 'abc-123';

-- NOW tenants table has:
SELECT subscription_tier FROM tenants WHERE id = 'abc-123';
-- Result: 'enterprise'  ← Changed!

-- View AUTOMATICALLY shows new data:
SELECT * FROM tenant_subscription_details WHERE tenant_id = 'abc-123';
-- Result: tier = 'enterprise', plan_name = 'Enterprise Plan'  ← Updated!

-- ============================================================
-- WHY THE VIEW MIGHT APPEAR EMPTY
-- ============================================================

/*
REASON 1: Your profile.tenant_id doesn't match the tenant
SOLUTION: Link your profile to the enterprise tenant
  UPDATE profiles 
  SET tenant_id = (SELECT id FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1)
  WHERE id = auth.uid();

REASON 2: The tenants table wasn't actually updated
SOLUTION: Check if Stripe webhook succeeded
  SELECT subscription_tier, updated_at FROM tenants WHERE id = 'your-tenant-id';
  
  If it still shows old tier, manually update:
  UPDATE tenants SET subscription_tier = 'enterprise', updated_at = NOW() 
  WHERE id = 'your-tenant-id';

REASON 3: RLS policy is blocking the view
SOLUTION: Make sure you're logged in and have correct role
  SELECT auth.uid(), role, tenant_id FROM profiles WHERE id = auth.uid();

REASON 4: View cache not refreshed (rare)
SOLUTION: Refresh PostgREST schema
  NOTIFY pgrst, 'reload schema';
*/

-- ============================================================
-- VERIFY UPGRADE WORKED
-- ============================================================

-- Test 1: Check tenants table directly (source of truth)
SELECT 
  id,
  name,
  subscription_tier,
  subscription_status,
  updated_at,
  'Actual data in tenants table' as note
FROM tenants
WHERE id = (SELECT tenant_id FROM profiles WHERE id = auth.uid());
-- This shows ACTUAL stored data

-- Test 2: Check view (should match Test 1)
SELECT 
  tenant_id,
  tenant_name,
  subscription_tier,
  subscription_status,
  'Data from view' as note
FROM tenant_subscription_details
WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid());
-- This shows what the VIEW returns

-- If Test 1 shows enterprise but Test 2 is empty → RLS issue
-- If both show same tier → view is working correctly!

-- ============================================================
-- SUMMARY
-- ============================================================

/*
✅ DO THIS when upgrading:
  - User pays via Stripe checkout
  - Stripe webhook updates tenants table
  - View automatically reflects changes
  - No INSERT required!

❌ DON'T DO THIS:
  - Try to INSERT into tenant_subscription_details
  - Manually modify the view
  - Expect to "add rows" to the view

💡 KEY TAKEAWAY:
Views are WINDOWS into tables, not storage themselves.
When you update the table, the view shows the new data automatically.
*/
