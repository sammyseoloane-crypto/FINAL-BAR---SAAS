-- ============================================================
-- NIGHTCLUB SUBSCRIPTION TIERS SYSTEM
-- 4-tier subscription model for nightclub and bar management
-- Created: 2026-03-13
-- ============================================================

-- Update subscription tier constraint to include new tiers
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subscription_tier_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_subscription_tier_check 
  CHECK (subscription_tier IN ('trial', 'starter', 'growth', 'pro', 'enterprise'));

-- Add new columns for event and staff limits
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_events_per_month INTEGER DEFAULT 2;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_events_per_month INTEGER;

-- Clear existing subscription plans (backup first if needed)
DELETE FROM subscription_plans WHERE tier IN ('trial', 'starter', 'professional', 'enterprise', 'premium');

-- Insert new nightclub-focused subscription plans

-- Tier 1: Starter Plan (R799-1,200/month)
INSERT INTO subscription_plans (
  name, display_name, tier, 
  price_monthly, price_yearly, currency,
  max_locations, max_staff, max_products, 
  max_monthly_transactions, max_events_per_month,
  transaction_fee_percentage, 
  features,
  is_active
) VALUES (
  'starter', 
  '💰 Starter Plan', 
  'starter', 
  1000.00, 10000.00, 'ZAR',
  1, 3, 100, 
  5000, 2,
  2.50,
  '{
    "pos_system": true,
    "inventory_management": true,
    "qr_payments": true,
    "event_ticketing": true,
    "digital_menu": true,
    "basic_customer_profiles": true,
    "daily_revenue_reports": true,
    "basic_sales_reports": true,
    "vip_tables": false,
    "bottle_service": false,
    "guest_lists": false,
    "loyalty_program": false,
    "ai_analytics": false,
    "dynamic_pricing": false,
    "multi_venue": false,
    "api_access": false,
    "email_support": true,
    "priority_support": false
  }'::jsonb,
  true
);

-- Tier 2: Growth Plan (R2,000-3,500/month)
INSERT INTO subscription_plans (
  name, display_name, tier, 
  price_monthly, price_yearly, currency,
  max_locations, max_staff, max_products, 
  max_monthly_transactions, max_events_per_month,
  transaction_fee_percentage, 
  features,
  is_active
) VALUES (
  'growth', 
  '🍸 Growth Plan', 
  'growth', 
  2750.00, 27500.00, 'ZAR',
  2, 10, 300, 
  15000, 10,
  2.00,
  '{
    "pos_system": true,
    "inventory_management": true,
    "inventory_alerts": true,
    "qr_payments": true,
    "event_ticketing": true,
    "digital_menu": true,
    "basic_customer_profiles": true,
    "daily_revenue_reports": true,
    "weekly_revenue_reports": true,
    "basic_sales_reports": true,
    "drink_analytics": true,
    "vip_tables": true,
    "bottle_service": true,
    "guest_lists": true,
    "promoter_accounts": true,
    "bar_tabs": true,
    "loyalty_program": true,
    "vip_customer_tracking": true,
    "staff_performance": true,
    "ai_analytics": false,
    "dynamic_pricing": false,
    "multi_venue": true,
    "api_access": false,
    "email_support": true,
    "priority_support": false
  }'::jsonb,
  true
);

-- Tier 3: Pro Nightclub Plan (R4,000-7,000/month)
INSERT INTO subscription_plans (
  name, display_name, tier, 
  price_monthly, price_yearly, currency,
  max_locations, max_staff, max_products, 
  max_monthly_transactions, max_events_per_month,
  transaction_fee_percentage, 
  features,
  is_active
) VALUES (
  'pro', 
  '🏆 Pro Nightclub Plan', 
  'pro', 
  5500.00, 55000.00, 'ZAR',
  3, 999999, 1000, 
  999999, 999999,
  1.50,
  '{
    "pos_system": true,
    "full_pos": true,
    "inventory_management": true,
    "inventory_alerts": true,
    "inventory_predictions": true,
    "qr_payments": true,
    "event_ticketing": true,
    "multi_event_management": true,
    "digital_menu": true,
    "customer_profiles": true,
    "daily_revenue_reports": true,
    "weekly_revenue_reports": true,
    "event_revenue_tracking": true,
    "sales_reports": true,
    "drink_analytics": true,
    "hourly_sales_heatmaps": true,
    "staff_sales_rankings": true,
    "vip_tables": true,
    "table_layout_manager": true,
    "bottle_service": true,
    "bottle_packages": true,
    "guest_lists": true,
    "promoter_accounts": true,
    "bar_tabs": true,
    "loyalty_program": true,
    "vip_tiers": true,
    "vip_customer_tracking": true,
    "customer_spending_analytics": true,
    "staff_performance": true,
    "marketing_automation": true,
    "ai_analytics": true,
    "ai_demand_prediction": true,
    "dynamic_pricing": true,
    "multi_venue": true,
    "api_access": false,
    "email_support": true,
    "priority_support": true
  }'::jsonb,
  true
);

-- Tier 4: Enterprise Venue Plan (R10,000+/month)
INSERT INTO subscription_plans (
  name, display_name, tier, 
  price_monthly, price_yearly, currency,
  max_locations, max_staff, max_products, 
  max_monthly_transactions, max_events_per_month,
  transaction_fee_percentage, 
  features,
  is_active
) VALUES (
  'enterprise', 
  '👑 Enterprise Venue Plan', 
  'enterprise', 
  10000.00, 100000.00, 'ZAR',
  999999, 999999, 999999, 
  999999, 999999,
  1.00,
  '{
    "pos_system": true,
    "full_pos": true,
    "inventory_management": true,
    "inventory_alerts": true,
    "inventory_predictions": true,
    "qr_payments": true,
    "event_ticketing": true,
    "multi_event_management": true,
    "public_event_discovery": true,
    "digital_menu": true,
    "customer_profiles": true,
    "customer_app_access": true,
    "daily_revenue_reports": true,
    "weekly_revenue_reports": true,
    "event_revenue_tracking": true,
    "sales_reports": true,
    "drink_analytics": true,
    "hourly_sales_heatmaps": true,
    "staff_sales_rankings": true,
    "vip_tables": true,
    "table_layout_manager": true,
    "bottle_service": true,
    "bottle_packages": true,
    "guest_lists": true,
    "promoter_accounts": true,
    "bar_tabs": true,
    "loyalty_program": true,
    "vip_tiers": true,
    "vip_customer_tracking": true,
    "customer_spending_analytics": true,
    "vip_spending_trends": true,
    "staff_performance": true,
    "marketing_automation": true,
    "cross_venue_promotions": true,
    "ai_analytics": true,
    "ai_demand_prediction": true,
    "ai_revenue_forecasting": true,
    "crowd_analytics": true,
    "dynamic_pricing": true,
    "multi_venue": true,
    "multi_location_management": true,
    "franchise_dashboard": true,
    "advanced_permissions": true,
    "api_access": true,
    "custom_integrations": true,
    "white_label": true,
    "email_support": true,
    "priority_support": true,
    "dedicated_support": true,
    "onboarding": true
  }'::jsonb,
  true
);

-- Add trial plan for new signups
INSERT INTO subscription_plans (
  name, display_name, tier, 
  price_monthly, price_yearly, currency,
  max_locations, max_staff, max_products, 
  max_monthly_transactions, max_events_per_month,
  transaction_fee_percentage, 
  features,
  is_active
) VALUES (
  'trial', 
  '🎯 Free Trial (14 Days)', 
  'trial', 
  0.00, 0.00, 'ZAR',
  1, 3, 50, 
  500, 2,
  5.00,
  '{
    "pos_system": true,
    "inventory_management": true,
    "qr_payments": true,
    "event_ticketing": true,
    "digital_menu": true,
    "basic_customer_profiles": true,
    "daily_revenue_reports": true,
    "basic_sales_reports": true,
    "vip_tables": false,
    "email_support": true
  }'::jsonb,
  true
);

-- Create function to check feature access
CREATE OR REPLACE FUNCTION check_feature_access(
  p_tenant_id UUID,
  p_feature_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_tier VARCHAR(50);
  v_features JSONB;
  v_has_feature BOOLEAN;
BEGIN
  -- Get tenant's current tier and features
  SELECT 
    t.subscription_tier,
    sp.features
  INTO v_tier, v_features
  FROM tenants t
  LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier
  WHERE t.id = p_tenant_id;
  
  -- If tenant not found or no subscription plan, deny access
  IF v_tier IS NULL OR v_features IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if feature exists and is enabled
  v_has_feature := COALESCE((v_features->p_feature_name)::BOOLEAN, FALSE);
  
  RETURN v_has_feature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_tenant_id UUID,
  p_limit_type TEXT
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_current_count INTEGER;
  v_max_limit INTEGER;
  v_tier VARCHAR(50);
BEGIN
  -- Get tenant tier
  SELECT subscription_tier INTO v_tier
  FROM tenants
  WHERE id = p_tenant_id;
  
  -- Check different limit types
  CASE p_limit_type
    WHEN 'staff' THEN
      SELECT COUNT(*), t.max_staff
      INTO v_current_count, v_max_limit
      FROM profiles p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE p.tenant_id = p_tenant_id 
        AND p.role IN ('staff', 'admin', 'owner')
      GROUP BY t.max_staff;
      
    WHEN 'locations' THEN
      SELECT COUNT(*), t.max_locations
      INTO v_current_count, v_max_limit
      FROM locations l
      JOIN tenants t ON t.id = l.tenant_id
      WHERE l.tenant_id = p_tenant_id
      GROUP BY t.max_locations;
      
    WHEN 'products' THEN
      SELECT COUNT(*), t.max_products
      INTO v_current_count, v_max_limit
      FROM products pr
      JOIN tenants t ON t.id = pr.tenant_id
      WHERE pr.tenant_id = p_tenant_id
      GROUP BY t.max_products;
      
    WHEN 'events' THEN
      SELECT COUNT(*), t.max_events_per_month
      INTO v_current_count, v_max_limit
      FROM events e
      JOIN tenants t ON t.id = e.tenant_id
      WHERE e.tenant_id = p_tenant_id
        AND e.event_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND e.event_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY t.max_events_per_month;
      
    ELSE
      v_current_count := 0;
      v_max_limit := 0;
  END CASE;
  
  -- If no records found, set current count to 0
  v_current_count := COALESCE(v_current_count, 0);
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'limit_type', p_limit_type,
    'current', v_current_count,
    'max', v_max_limit,
    'remaining', GREATEST(0, v_max_limit - v_current_count),
    'is_at_limit', v_current_count >= v_max_limit,
    'tier', v_tier
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for tenant subscription details
CREATE OR REPLACE VIEW tenant_subscription_details AS
SELECT 
  t.id as tenant_id,
  t.name as tenant_name,
  t.subscription_tier,
  t.subscription_status,
  t.subscription_end,
  sp.display_name as plan_name,
  sp.price_monthly,
  sp.price_yearly,
  sp.max_locations,
  sp.max_staff,
  sp.max_products,
  sp.max_monthly_transactions,
  sp.max_events_per_month,
  sp.transaction_fee_percentage,
  sp.features,
  t.stripe_customer_id,
  t.stripe_subscription_id
FROM tenants t
LEFT JOIN subscription_plans sp ON sp.tier = t.subscription_tier;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_feature_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_usage_limit(UUID, TEXT) TO authenticated;
GRANT SELECT ON tenant_subscription_details TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION check_feature_access IS 'Check if a tenant has access to a specific feature based on their subscription tier';
COMMENT ON FUNCTION check_usage_limit IS 'Check current usage vs limits for staff, locations, products, or events';
COMMENT ON VIEW tenant_subscription_details IS 'Complete view of tenant subscription information including plan details';
