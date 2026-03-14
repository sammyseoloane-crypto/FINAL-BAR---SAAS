-- Update subscription_plans with YOUR Stripe Price IDs from .env
-- Run this in Supabase SQL Editor: https://app.supabase.com

-- Starter Venue Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1TAbjC45ttokNjrV8dLIYcoc',
  stripe_price_id_yearly = 'price_1TAboj45ttokNjrVXTivqPix'
WHERE tier = 'starter' OR name = 'starter';

-- Growth Venue Plan (also checks for 'professional' tier name)
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1TAbmK45ttokNjrVtT0u2Gns',
  stripe_price_id_yearly = 'price_1TAbpL45ttokNjrVFhSVccur'
WHERE tier IN ('growth', 'professional') OR name IN ('growth', 'professional');

-- Pro Venue Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1TAbnB45ttokNjrVrPnISvZo',
  stripe_price_id_yearly = 'price_1TAbq045ttokNjrVVfS81Ja9'
WHERE tier = 'pro' OR name = 'pro';

-- Enterprise Venue Plan
UPDATE subscription_plans 
SET 
  stripe_price_id_monthly = 'price_1TAbnb45ttokNjrVXDIQHWHG',
  stripe_price_id_yearly = 'price_1TAbqS45ttokNjrVvEZJk6a8'
WHERE tier = 'enterprise' OR name = 'enterprise';

-- Verify all updates were successful
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
