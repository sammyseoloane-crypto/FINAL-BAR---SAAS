-- Temporary Placeholder Stripe Price IDs for Testing
-- This allows the Select Plan button to work while you set up real Stripe products
-- Replace these with actual Stripe price IDs from your Stripe Dashboard later

-- Method 1: Add placeholder IDs (for testing the flow)
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_test_starter_monthly',
  stripe_price_id_yearly = 'price_test_starter_yearly'
WHERE tier = 'starter' OR name = 'starter';

UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_test_growth_monthly',
  stripe_price_id_yearly = 'price_test_growth_yearly'
WHERE tier IN ('professional', 'growth') OR name IN ('professional', 'growth');

UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_test_pro_monthly',
  stripe_price_id_yearly = 'price_test_pro_yearly'
WHERE tier = 'pro' OR name = 'pro';

UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_test_enterprise_monthly',
  stripe_price_id_yearly = 'price_test_enterprise_yearly'
WHERE tier = 'enterprise' OR name = 'enterprise';

-- Verify the updates
SELECT 
  tier, 
  display_name,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly, 
  stripe_price_id_yearly,
  CASE 
    WHEN stripe_price_id_monthly IS NOT NULL AND stripe_price_id_yearly IS NOT NULL 
    THEN '✅ Configured' 
    ELSE '❌ Missing' 
  END as status
FROM subscription_plans 
WHERE tier IN ('starter', 'professional', 'growth', 'pro', 'enterprise')
ORDER BY price_monthly;
