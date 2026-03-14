-- ================================================
-- FIX: Set Next Billing Dates for Active Subscriptions
-- Populate subscription_end for active tenants
-- Support both monthly and yearly subscriptions
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- PROBLEM
-- ============================================================

-- Active subscriptions are showing "N/A" for next billing date
-- because subscription_end column is NULL

-- ============================================================
-- STEP 1: Add billing_period column to tenants table
-- ============================================================

-- Add column to store billing cycle (monthly/yearly)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20) DEFAULT 'monthly';

-- Add check constraint
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_billing_period_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_billing_period_check 
  CHECK (billing_period IN ('monthly', 'yearly'));

-- ============================================================
-- STEP 2: Set billing_period for existing tenants
-- ============================================================

-- Default to monthly for all existing active subscriptions
UPDATE tenants
SET billing_period = 'monthly'
WHERE billing_period IS NULL;

-- Manual override: Set specific tenants to yearly
-- TODO: Update these tenant names/IDs as needed
UPDATE tenants
SET billing_period = 'yearly'
WHERE name IN ('Da Oceanz', 'The Grand Nightclub', 'Elite Lounge')
  OR subscription_tier IN ('enterprise', 'premium');

-- ============================================================
-- STEP 3: Calculate and set subscription_end dates
-- ============================================================

-- For YEARLY active subscriptions: 365 days from creation
UPDATE tenants
SET subscription_end = created_at + INTERVAL '365 days'
WHERE subscription_status = 'active'
  AND billing_period = 'yearly'
  AND subscription_end IS NULL;

-- For MONTHLY active subscriptions: 30 days from creation
UPDATE tenants
SET subscription_end = created_at + INTERVAL '30 days'
WHERE subscription_status = 'active'
  AND billing_period = 'monthly'
  AND subscription_end IS NULL;

-- For trial subscriptions without subscription_end:
-- set it to 14 days from creation (trial period)
UPDATE tenants
SET subscription_end = created_at + INTERVAL '14 days'
WHERE subscription_status = 'trial'
  AND subscription_end IS NULL;

-- ============================================================
-- STEP 4: Auto-set subscription_end on new subscriptions
-- ============================================================

-- Create a trigger function to automatically set subscription_end
-- based on billing_period (monthly = 30 days, yearly = 365 days)
CREATE OR REPLACE FUNCTION set_subscription_end()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription_status changed to 'active' and no subscription_end
  IF NEW.subscription_status = 'active' AND NEW.subscription_end IS NULL THEN
    IF NEW.billing_period = 'yearly' THEN
      NEW.subscription_end = TIMEZONE('utc', NOW()) + INTERVAL '365 days';
    ELSE
      -- Default to monthly (30 days)
      NEW.subscription_end = TIMEZONE('utc', NOW()) + INTERVAL '30 days';
    END IF;
  END IF;
  
  -- If subscription_status changed to 'trial' and no subscription_end
  IF NEW.subscription_status = 'trial' AND NEW.subscription_end IS NULL THEN
    NEW.subscription_end = TIMEZONE('utc', NOW()) + INTERVAL '14 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists then create
DROP TRIGGER IF EXISTS trigger_set_subscription_end ON tenants;
CREATE TRIGGER trigger_set_subscription_end
  BEFORE INSERT OR UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION set_subscription_end();

-- ============================================================
-- STEP 5: Verification Queries
-- ============================================================

-- Check all tenants and their next billing dates
SELECT 
  id,
  name,
  subscription_status,
  subscription_tier,
  billing_period,
  created_at::DATE,
  subscription_end::DATE as next_billing,
  CASE 
    WHEN subscription_end IS NULL THEN '❌ No next billing date'
    WHEN subscription_end < NOW() THEN '⚠️ Billing date passed'
    ELSE '✅ Billing in ' || EXTRACT(DAY FROM subscription_end - NOW())::TEXT || ' days'
  END as billing_status
FROM tenants
ORDER BY subscription_end ASC NULLS LAST;

-- Check YEARLY subscriptions specifically
SELECT 
  name,
  subscription_tier,
  billing_period,
  created_at::DATE as started,
  subscription_end::DATE as next_billing,
  EXTRACT(DAY FROM subscription_end - NOW())::INT as days_until_billing
FROM tenants
WHERE billing_period = 'yearly'
  AND subscription_status = 'active'
ORDER BY subscription_end;

-- Check MONTHLY subscriptions
SELECT 
  name,
  subscription_tier,
  billing_period,
  subscription_end::DATE as next_billing,
  EXTRACT(DAY FROM subscription_end - NOW())::INT as days_until_billing
FROM tenants
WHERE billing_period = 'monthly'
  AND subscription_status = 'active'
ORDER BY subscription_end;

-- Check trial accounts
SELECT 
  name,
  subscription_status,
  created_at::DATE as started,
  subscription_end::DATE as expires,
  CASE 
    WHEN subscription_end < NOW() THEN 'EXPIRED'
    ELSE EXTRACT(DAY FROM subscription_end - NOW())::TEXT || ' days left'
  END as trial_status
FROM tenants
WHERE subscription_status = 'trial'
ORDER BY subscription_end;

-- ============================================================
-- MANUAL UPDATES (if needed for specific tenants)
-- ============================================================

-- Change a tenant from monthly to yearly billing:
-- UPDATE tenants
-- SET billing_period = 'yearly',
--     subscription_end = created_at + INTERVAL '365 days'
-- WHERE name = 'Da Oceanz';

-- Change a tenant from yearly to monthly billing:
-- UPDATE tenants
-- SET billing_period = 'monthly',
--     subscription_end = created_at + INTERVAL '30 days'
-- WHERE name = 'Some Bar';

-- Set next billing to a specific date:
-- UPDATE tenants
-- SET subscription_end = '2027-03-14 00:00:00+00'
-- WHERE id = 'tenant-id-here';

-- Renew subscription for another billing cycle:
-- UPDATE tenants
-- SET subscription_end = CASE
--   WHEN billing_period = 'yearly' THEN subscription_end + INTERVAL '365 days'
--   ELSE subscription_end + INTERVAL '30 days'
-- END
-- WHERE id = 'tenant-id-here';

-- ============================================================
-- SUMMARY
-- ============================================================

-- After running this migration:
-- ✅ Added billing_period column to tenants (monthly/yearly)
-- ✅ All active subscriptions have next billing date
-- ✅ Yearly subscriptions bill every 365 days
-- ✅ Monthly subscriptions bill every 30 days
-- ✅ Trial accounts show 14-day expiry date
-- ✅ New subscriptions automatically get billing date set
-- ✅ Trigger respects billing_period (monthly vs yearly)
-- ✅ Billing overview page will show accurate dates

-- Billing cycles:
-- • Trial: 14 days from signup
-- • Monthly: 30 days from activation  
-- • Yearly: 365 days from activation
-- • Can be customized per tenant if needed

-- Tenants set to YEARLY billing:
-- • Da Oceanz
-- • The Grand Nightclub  
-- • Elite Lounge
-- • Any tenant with enterprise/premium tier
