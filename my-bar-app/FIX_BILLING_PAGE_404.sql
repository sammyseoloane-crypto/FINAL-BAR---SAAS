-- ================================================
-- FIX: Platform Admin Billing Page 404 Error
-- Issue: subscriptions table doesn't exist
-- Solution: Query tenants table instead
-- ================================================

-- ============================================================
-- DIAGNOSIS
-- ============================================================

-- The billing page was querying a non-existent 'subscriptions' table
-- Subscription data is actually stored in the 'tenants' table with:
--   - subscription_tier (links to subscription_plans.tier)
--   - subscription_status
--   - stripe_subscription_id
--   - stripe_customer_id

-- Check current tenants with subscription data
SELECT 
  id,
  name,
  subscription_tier,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- VERIFICATION: Check subscription_plans table exists
-- ============================================================

SELECT 
  tier,
  display_name,
  price_monthly,
  price_yearly,
  is_active
FROM subscription_plans
WHERE is_active = true
ORDER BY price_monthly ASC;

-- ============================================================
-- FIX: Ensure foreign key relationship (optional but recommended)
-- ============================================================

-- Note: PostgreSQL doesn't support foreign keys to non-unique columns
-- The join is done via tier value matching, not a formal FK constraint
-- This is intentional since subscription_tier is an enum-like VARCHAR

-- Ensure index exists for better join performance
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_tier ON tenants(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription_plans(tier);

-- ============================================================
-- SAMPLE DATA: Create a test tenant if none exist
-- ============================================================

-- Check if any tenants exist
DO $$
DECLARE
  tenant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tenant_count FROM tenants;
  
  IF tenant_count = 0 THEN
    -- Create a sample tenant for testing
    INSERT INTO tenants (
      name,
      subscription_tier,
      subscription_status,
      max_locations,
      max_staff,
      max_products
    ) VALUES (
      'Demo Venue',
      'trial',
      'trial',
      1,
      5,
      50
    );
    
    RAISE NOTICE 'Created demo tenant for testing';
  ELSE
    RAISE NOTICE 'Tenants already exist: %', tenant_count;
  END IF;
END $$;

-- ============================================================
-- TEST QUERY: What the billing page now queries
-- ============================================================

SELECT 
  t.id,
  t.name,
  t.subscription_tier,
  t.subscription_status,
  t.stripe_subscription_id,
  t.stripe_customer_id,
  t.subscription_start,
  t.subscription_end,
  t.created_at,
  sp.display_name as plan_display_name,
  sp.price_monthly,
  sp.price_yearly
FROM tenants t
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier
ORDER BY t.created_at DESC;

-- This should return results without errors ✅

-- ============================================================
-- NOTES
-- ============================================================

-- Frontend Fix Applied:
-- ✅ Updated BillingOverviewPage.jsx to query 'tenants' table
-- ✅ Added join with subscription_plans for plan details
-- ✅ Added summary statistics (Total Venues, Active, Trial, MRR)
-- ✅ Added empty state message when no venues exist
-- ✅ Data transformation to match expected component format

-- Database Schema:
-- • tenants table stores subscription info per venue
-- • subscription_plans table stores plan tiers and pricing
-- • Join via subscription_tier = tier (not a formal FK)

-- Common Statuses:
-- • 'trial' - Free trial period
-- • 'active' - Paying customer
-- • 'past_due' - Payment failed
-- • 'cancelled' - Subscription ended
-- • 'inactive' - Never activated
