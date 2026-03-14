-- Quick Update Stripe Price IDs
-- Replace price_xxx with your actual Stripe Price IDs from https://dashboard.stripe.com/test/products

-- Step 1: View current plans
SELECT 
  id,
  tier, 
  display_name,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly, 
  stripe_price_id_yearly 
FROM subscription_plans 
ORDER BY price_monthly;

-- Step 2: Update with your Stripe Price IDs
-- Get these from: https://dashboard.stripe.com/test/products

-- Starter Plan (R 1,000/month, R 10,000/year)
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_REPLACE_WITH_STARTER_MONTHLY',
  stripe_price_id_yearly = 'price_REPLACE_WITH_STARTER_YEARLY'
WHERE tier = 'starter';

-- Growth/Professional Plan (R 2,750/month, R 27,500/year)
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_REPLACE_WITH_GROWTH_MONTHLY',
  stripe_price_id_yearly = 'price_REPLACE_WITH_GROWTH_YEARLY'
WHERE tier = 'professional' OR tier = 'growth';

-- Pro Plan (R 5,500/month, R 55,000/year)
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_REPLACE_WITH_PRO_MONTHLY',
  stripe_price_id_yearly = 'price_REPLACE_WITH_PRO_YEARLY'
WHERE tier = 'pro';

-- Enterprise Plan (R 10,000/month, R 100,000/year)
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_REPLACE_WITH_ENTERPRISE_MONTHLY',
  stripe_price_id_yearly = 'price_REPLACE_WITH_ENTERPRISE_YEARLY'
WHERE tier = 'enterprise';

-- Step 3: Verify all updates
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
    ELSE '❌ Missing Price IDs' 
  END as status
FROM subscription_plans 
WHERE tier IN ('starter', 'professional', 'growth', 'pro', 'enterprise')
ORDER BY price_monthly;
