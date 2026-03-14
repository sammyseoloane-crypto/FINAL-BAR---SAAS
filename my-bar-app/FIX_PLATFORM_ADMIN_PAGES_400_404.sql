-- ================================================
-- FIX: Platform Admin Pages 400/404 Errors
-- Issues: Invalid join syntax, non-existent tables
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- SUMMARY OF ISSUES FIXED
-- ============================================================

-- 1. BILLING PAGE (/platform-admin/billing)
--    Problem: Tried to join tenants with subscription_plans using invalid syntax
--    Error: subscription_plans!subscription_tier(...)
--    Cause: PostgREST can only use ! syntax for actual foreign key relationships
--    Fix: Fetch tables separately and join in JavaScript

-- 2. TENANTS PAGE (/platform-admin/tenants)
--    Problem: Tried to count profiles using invalid syntax
--    Error: profiles(count)
--    Cause: Invalid PostgREST aggregation syntax
--    Fix: Fetch profiles count separately for each tenant

-- ============================================================
-- UNDERSTANDING THE DATABASE STRUCTURE
-- ============================================================

-- TENANTS TABLE (stores venue information)
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'tenants'
  AND column_name IN (
    'id',
    'name', 
    'subscription_tier',
    'subscription_status',
    'status',
    'stripe_subscription_id',
    'stripe_customer_id'
  )
ORDER BY ordinal_position;

-- SUBSCRIPTION_PLANS TABLE (stores pricing tiers)
SELECT 
  tier,
  display_name,
  price_monthly,
  price_yearly,
  is_active
FROM subscription_plans
WHERE is_active = true
ORDER BY price_monthly ASC;

-- PROFILES TABLE (stores user accounts)
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('id', 'email', 'role', 'tenant_id')
ORDER BY ordinal_position;

-- ============================================================
-- WHY THE JOIN SYNTAX DIDN'T WORK
-- ============================================================

-- PostgREST's ! syntax ONLY works with actual foreign keys:
-- ✅ VALID:   profiles!tenant_id(name)    -- profiles.tenant_id → tenants.id (FK exists)
-- ❌ INVALID: subscription_plans!subscription_tier(...) -- No FK relationship

-- To verify foreign keys:
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'tenants'
ORDER BY kcu.column_name;

-- You'll see:
-- - No FK from tenants.subscription_tier to subscription_plans.tier
-- - This is intentional (tier is an enum-like VARCHAR, not a relational FK)

-- ============================================================
-- WHAT WAS CHANGED IN THE CODE
-- ============================================================

-- BILLING PAGE (BillingOverviewPage.jsx)
-- Before: Single query with invalid join
-- After:  Two separate queries, joined in JavaScript
/*
  // Fetch tenants
  const { data: tenantsData } = await supabase
    .from('tenants')
    .select('id, name, subscription_tier, ...');
  
  // Fetch plans separately
  const { data: plansData } = await supabase
    .from('subscription_plans')
    .select('tier, display_name, price_monthly, price_yearly');
  
  // Create lookup map
  const plansMap = plansData.reduce((acc, plan) => {
    acc[plan.tier] = plan;
    return acc;
  }, {});
  
  // Join in JavaScript
  const result = tenantsData.map(tenant => ({
    ...tenant,
    plan: plansMap[tenant.subscription_tier]
  }));
*/

-- TENANTS PAGE (TenantManagementPage.jsx)
-- Before: Invalid profiles(count) syntax
-- After:  Count profiles separately for each tenant
/*
  // Fetch tenants first
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, status, ...');
  
  // Get count for each tenant
  const tenantsWithCounts = await Promise.all(
    tenants.map(async (tenant) => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);
      
      return { ...tenant, userCount: count };
    })
  );
*/

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Test the queries that the pages now use:

-- 1. Billing Page - Tenants
SELECT 
  id,
  name,
  subscription_tier,
  subscription_status,
  stripe_subscription_id,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;

-- 2. Billing Page - Plans
SELECT 
  tier,
  display_name,
  price_monthly,
  price_yearly
FROM subscription_plans
ORDER BY tier;

-- 3. Tenants Page - Tenant List
SELECT 
  id,
  name,
  status,
  subscription_status,
  subscription_tier,
  created_at
FROM tenants
ORDER BY created_at DESC;

-- 4. Tenants Page - User Count for a specific tenant
SELECT COUNT(*) as user_count
FROM profiles
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1);

-- All these queries should work without errors ✅

-- ============================================================
-- SUMMARY
-- ============================================================

-- Frontend Changes:
-- ✅ BillingOverviewPage.jsx - Fixed invalid join syntax
-- ✅ TenantManagementPage.jsx - Fixed profiles count query
-- ✅ Added empty state messages
-- ✅ Added subscription tier display to tenants page
-- ✅ All ESLint errors fixed

-- Database Changes Required:
-- ⚠️ None! The database structure is correct
-- ⚠️ The issue was frontend query syntax, not database schema

-- Expected Behavior After Fix:
-- ✅ /platform-admin/billing loads without 400/404 errors
-- ✅ /platform-admin/tenants loads without 400/404 errors
-- ✅ Shows subscription details correctly
-- ✅ Shows user counts per tenant
-- ✅ Suspend/Activate buttons work
