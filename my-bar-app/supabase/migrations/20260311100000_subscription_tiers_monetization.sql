-- ============================================================
-- SUBSCRIPTION TIERS & MONETIZATION SYSTEM
-- Multi-tier subscription with white-labeling and transaction fees
-- Created: 2026-03-11
-- ============================================================

-- Drop old subscription_status constraint
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subscription_status_check;

-- Add subscription tiers and features
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_locations INTEGER DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_staff INTEGER DEFAULT 5;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_products INTEGER DEFAULT 50;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_monthly_transactions INTEGER DEFAULT 500;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS monthly_revenue_limit DECIMAL(10, 2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_branding JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS transaction_fee_percentage DECIMAL(5, 2) DEFAULT 0.00;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Update subscription status constraint
ALTER TABLE tenants ADD CONSTRAINT tenants_subscription_status_check 
  CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'inactive'));

-- Add subscription tier constraint
ALTER TABLE tenants ADD CONSTRAINT tenants_subscription_tier_check 
  CHECK (subscription_tier IN ('trial', 'starter', 'professional', 'enterprise', 'premium'));

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'ZAR',
  max_locations INTEGER,
  max_staff INTEGER,
  max_products INTEGER,
  max_monthly_transactions INTEGER,
  monthly_revenue_limit DECIMAL(10, 2),
  transaction_fee_percentage DECIMAL(5, 2) DEFAULT 0.00,
  features JSONB DEFAULT '{}',
  white_label_enabled BOOLEAN DEFAULT FALSE,
  api_access BOOLEAN DEFAULT FALSE,
  priority_support BOOLEAN DEFAULT FALSE,
  custom_reports BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription_plans(tier);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);

-- Insert default subscription plans
INSERT INTO subscription_plans (
  name, display_name, tier, price_monthly, price_yearly,
  max_locations, max_staff, max_products, max_monthly_transactions,
  monthly_revenue_limit, transaction_fee_percentage, features
) VALUES
-- Trial Plan (14 days free)
('trial', 'Free Trial', 'trial', 0.00, 0.00, 1, 5, 50, 500, 10000.00, 5.00,
 '{"realtime_analytics": true, "basic_reports": true, "email_support": true}'),

-- Starter Plan
('starter', 'Starter Plan', 'starter', 299.00, 2990.00, 1, 10, 100, 2000, 50000.00, 3.50,
 '{"realtime_analytics": true, "basic_reports": true, "qr_payments": true, "email_support": true, "task_management": true}'),

-- Professional Plan
('professional', 'Professional Plan', 'professional', 799.00, 7990.00, 3, 25, 500, 10000, 250000.00, 2.50,
 '{"realtime_analytics": true, "advanced_reports": true, "qr_payments": true, "priority_support": true, "task_management": true, "loyalty_rewards": true, "shift_scheduling": true, "multi_location": true}'),

-- Enterprise Plan
('enterprise', 'Enterprise Plan', 'enterprise', 1999.00, 19990.00, 10, 100, 2000, 50000, NULL, 1.50,
 '{"realtime_analytics": true, "custom_reports": true, "qr_payments": true, "priority_support": true, "task_management": true, "loyalty_rewards": true, "shift_scheduling": true, "multi_location": true, "white_label": true, "api_access": true, "dedicated_support": true}'),

-- Premium Plan (Custom pricing)
('premium', 'Premium Plan', 'premium', 4999.00, 49990.00, NULL, NULL, NULL, NULL, NULL, 1.00,
 '{"realtime_analytics": true, "custom_reports": true, "qr_payments": true, "priority_support": true, "task_management": true, "loyalty_rewards": true, "shift_scheduling": true, "multi_location": true, "white_label": true, "api_access": true, "dedicated_support": true, "custom_integrations": true, "onboarding": true}')
ON CONFLICT (name) DO NOTHING;

-- Create subscription_history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  old_tier VARCHAR(50),
  new_tier VARCHAR(50),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  amount DECIMAL(10, 2),
  billing_period VARCHAR(20), -- 'monthly', 'yearly'
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_tenant_id ON subscription_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at DESC);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "System can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (true);

-- RLS Policies for subscription_history
CREATE POLICY "Tenants can view their subscription history"
  ON subscription_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = subscription_history.tenant_id
    )
  );

CREATE POLICY "System can insert subscription history"
  ON subscription_history FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- SUBSCRIPTION HELPER FUNCTIONS
-- ============================================================

-- Function to check if tenant has feature access
CREATE OR REPLACE FUNCTION tenant_has_feature(
  p_tenant_id UUID,
  p_feature_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_features JSONB;
  v_has_feature BOOLEAN;
BEGIN
  SELECT features INTO v_features
  FROM tenants
  WHERE id = p_tenant_id;

  v_has_feature := (v_features ? p_feature_name) AND (v_features->>p_feature_name)::BOOLEAN;
  
  RETURN COALESCE(v_has_feature, false);
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant is within limits
CREATE OR REPLACE FUNCTION check_tenant_limits(
  p_tenant_id UUID,
  p_limit_type VARCHAR -- 'locations', 'staff', 'products', 'transactions'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_max_allowed INTEGER;
BEGIN
  -- Get current count based on limit type
  CASE p_limit_type
    WHEN 'locations' THEN
      SELECT COUNT(*) INTO v_current_count FROM locations WHERE tenant_id = p_tenant_id;
      SELECT max_locations INTO v_max_allowed FROM tenants WHERE id = p_tenant_id;
    WHEN 'staff' THEN
      SELECT COUNT(*) INTO v_current_count FROM profiles WHERE tenant_id = p_tenant_id AND role IN ('staff', 'admin');
      SELECT max_staff INTO v_max_allowed FROM tenants WHERE id = p_tenant_id;
    WHEN 'products' THEN
      SELECT COUNT(*) INTO v_current_count FROM products WHERE tenant_id = p_tenant_id;
      SELECT max_products INTO v_max_allowed FROM tenants WHERE id = p_tenant_id;
    WHEN 'transactions' THEN
      SELECT COUNT(*) INTO v_current_count 
      FROM transactions 
      WHERE tenant_id = p_tenant_id 
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
      SELECT max_monthly_transactions INTO v_max_allowed FROM tenants WHERE id = p_tenant_id;
  END CASE;

  -- If no limit set, allow unlimited
  IF v_max_allowed IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_current_count < v_max_allowed;
END;
$$ LANGUAGE plpgsql;

-- Function to upgrade/downgrade subscription
CREATE OR REPLACE FUNCTION change_subscription(
  p_tenant_id UUID,
  p_new_plan_id UUID,
  p_billing_period VARCHAR DEFAULT 'monthly'
)
RETURNS JSONB AS $$
DECLARE
  v_old_tier VARCHAR;
  v_new_tier VARCHAR;
  v_plan subscription_plans;
  v_result JSONB;
BEGIN
  -- Get current tier
  SELECT subscription_tier INTO v_old_tier FROM tenants WHERE id = p_tenant_id;
  
  -- Get new plan details
  SELECT * INTO v_plan FROM subscription_plans WHERE id = p_new_plan_id;
  v_new_tier := v_plan.tier;

  -- Update tenant subscription
  UPDATE tenants SET
    subscription_tier = v_new_tier,
    subscription_status = 'active',
    max_locations = v_plan.max_locations,
    max_staff = v_plan.max_staff,
    max_products = v_plan.max_products,
    max_monthly_transactions = v_plan.max_monthly_transactions,
    monthly_revenue_limit = v_plan.monthly_revenue_limit,
    features = v_plan.features,
    white_label_enabled = v_plan.white_label_enabled,
    transaction_fee_percentage = v_plan.transaction_fee_percentage,
    updated_at = NOW()
  WHERE id = p_tenant_id;

  -- Log subscription change
  INSERT INTO subscription_history (
    tenant_id, plan_id, old_tier, new_tier, 
    old_status, new_status, billing_period,
    amount, changed_by
  ) VALUES (
    p_tenant_id, p_new_plan_id, v_old_tier, v_new_tier,
    'active', 'active', p_billing_period,
    CASE 
      WHEN p_billing_period = 'monthly' THEN v_plan.price_monthly
      ELSE v_plan.price_yearly
    END,
    auth.uid()
  );

  -- Log audit
  PERFORM log_audit_action(
    'SUBSCRIPTION_CHANGE',
    'tenant',
    p_tenant_id,
    jsonb_build_object('old_tier', v_old_tier, 'new_tier', v_new_tier)
  );

  v_result := jsonb_build_object(
    'success', true,
    'old_tier', v_old_tier,
    'new_tier', v_new_tier,
    'message', 'Subscription updated successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE subscription_plans IS 'Subscription tier definitions with features and limits';
COMMENT ON TABLE subscription_history IS 'Historical record of subscription changes for billing and compliance';
COMMENT ON FUNCTION tenant_has_feature(UUID, VARCHAR) IS 'Check if tenant has access to a specific feature';
COMMENT ON FUNCTION check_tenant_limits(UUID, VARCHAR) IS 'Verify tenant is within subscription limits';
