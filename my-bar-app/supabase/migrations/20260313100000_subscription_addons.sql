-- =====================================================
-- SUBSCRIPTION ADD-ONS SYSTEM
-- =====================================================
-- This migration creates tables and functions for managing
-- subscription add-ons like SMS marketing, booking fees, etc.

-- =====================================================
-- 1. ADD-ONS CATALOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  addon_type TEXT NOT NULL CHECK (addon_type IN ('sms_marketing', 'booking_fees', 'transaction_fees', 'custom')),
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Usage-based pricing
  is_usage_based BOOLEAN DEFAULT FALSE,
  usage_unit TEXT, -- e.g., 'sms', 'reservation', 'transaction'
  price_per_unit DECIMAL(10, 4), -- e.g., R0.50 per SMS, R5 per reservation
  included_units INTEGER DEFAULT 0, -- Free units included
  
  -- Features and limits
  features JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  available_for_tiers TEXT[] DEFAULT ARRAY['starter', 'growth', 'pro', 'enterprise'],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. TENANT ADD-ONS (ACTIVE SUBSCRIPTIONS)
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES subscription_addons(id) ON DELETE CASCADE,
  
  -- Subscription details
  is_active BOOLEAN DEFAULT TRUE,
  billing_frequency TEXT CHECK (billing_frequency IN ('monthly', 'yearly')) DEFAULT 'monthly',
  
  -- Usage tracking for usage-based add-ons
  current_usage INTEGER DEFAULT 0,
  usage_limit INTEGER,
  last_usage_reset_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Billing
  amount_to_bill DECIMAL(10, 2) DEFAULT 0,
  last_billed_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  
  -- Stripe integration
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, addon_id)
);

-- =====================================================
-- 3. ADD-ON USAGE TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS addon_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_addon_id UUID NOT NULL REFERENCES tenant_addons(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES subscription_addons(id) ON DELETE CASCADE,
  
  -- Usage details
  usage_type TEXT NOT NULL, -- 'sms_sent', 'reservation_created', 'transaction_processed'
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 4),
  total_cost DECIMAL(10, 2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tenant_addons_tenant_id ON tenant_addons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_addons_addon_id ON tenant_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_tenant_addons_active ON tenant_addons(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_addon_usage_logs_tenant_addon_id ON addon_usage_logs(tenant_addon_id);
CREATE INDEX IF NOT EXISTS idx_addon_usage_logs_tenant_id ON addon_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_addon_usage_logs_created_at ON addon_usage_logs(created_at DESC);

-- =====================================================
-- 5. FUNCTIONS - CHECK IF TENANT HAS ADD-ON
-- =====================================================
CREATE OR REPLACE FUNCTION check_tenant_has_addon(
  p_tenant_id UUID,
  p_addon_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_addon BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM tenant_addons ta
    JOIN subscription_addons sa ON ta.addon_id = sa.id
    WHERE ta.tenant_id = p_tenant_id
      AND sa.addon_type = p_addon_type
      AND ta.is_active = TRUE
  ) INTO v_has_addon;
  
  RETURN v_has_addon;
END;
$$;

-- =====================================================
-- 6. FUNCTIONS - CHECK USAGE LIMIT FOR ADD-ON
-- =====================================================
CREATE OR REPLACE FUNCTION check_addon_usage_limit(
  p_tenant_id UUID,
  p_addon_type TEXT
)
RETURNS TABLE(
  has_addon BOOLEAN,
  current_usage INTEGER,
  usage_limit INTEGER,
  is_at_limit BOOLEAN,
  remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as has_addon,
    ta.current_usage,
    COALESCE(ta.usage_limit, 999999) as usage_limit,
    (ta.current_usage >= COALESCE(ta.usage_limit, 999999)) as is_at_limit,
    GREATEST(0, COALESCE(ta.usage_limit, 999999) - ta.current_usage) as remaining
  FROM tenant_addons ta
  JOIN subscription_addons sa ON ta.addon_id = sa.id
  WHERE ta.tenant_id = p_tenant_id
    AND sa.addon_type = p_addon_type
    AND ta.is_active = TRUE
  LIMIT 1;
END;
$$;

-- =====================================================
-- 7. FUNCTIONS - RECORD ADD-ON USAGE
-- =====================================================
CREATE OR REPLACE FUNCTION record_addon_usage(
  p_tenant_id UUID,
  p_addon_type TEXT,
  p_usage_type TEXT,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_addon_id UUID;
  v_addon_id UUID;
  v_unit_price DECIMAL(10, 4);
  v_total_cost DECIMAL(10, 2);
BEGIN
  -- Get tenant addon details
  SELECT ta.id, ta.addon_id, sa.price_per_unit
  INTO v_tenant_addon_id, v_addon_id, v_unit_price
  FROM tenant_addons ta
  JOIN subscription_addons sa ON ta.addon_id = sa.id
  WHERE ta.tenant_id = p_tenant_id
    AND sa.addon_type = p_addon_type
    AND ta.is_active = TRUE
  LIMIT 1;
  
  IF v_tenant_addon_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate cost
  v_total_cost := v_unit_price * p_quantity;
  
  -- Insert usage log
  INSERT INTO addon_usage_logs (
    tenant_addon_id,
    tenant_id,
    addon_id,
    usage_type,
    quantity,
    unit_price,
    total_cost,
    metadata
  ) VALUES (
    v_tenant_addon_id,
    p_tenant_id,
    v_addon_id,
    p_usage_type,
    p_quantity,
    v_unit_price,
    v_total_cost,
    p_metadata
  );
  
  -- Update current usage
  UPDATE tenant_addons
  SET current_usage = current_usage + p_quantity,
      amount_to_bill = amount_to_bill + v_total_cost,
      updated_at = NOW()
  WHERE id = v_tenant_addon_id;
  
  RETURN TRUE;
END;
$$;

-- =====================================================
-- 8. FUNCTIONS - RESET MONTHLY USAGE
-- =====================================================
CREATE OR REPLACE FUNCTION reset_addon_monthly_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reset_count INTEGER := 0;
BEGIN
  -- Reset usage for add-ons that need monthly reset
  UPDATE tenant_addons
  SET 
    current_usage = 0,
    last_usage_reset_at = NOW(),
    updated_at = NOW()
  WHERE is_active = TRUE
    AND last_usage_reset_at < DATE_TRUNC('month', NOW());
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  RETURN v_reset_count;
END;
$$;

-- =====================================================
-- 9. INSERT DEFAULT ADD-ONS
-- =====================================================
INSERT INTO subscription_addons (name, description, addon_type, price_monthly, price_yearly, is_usage_based, usage_unit, price_per_unit, included_units, features, available_for_tiers) VALUES

-- SMS Marketing Add-on
('SMS Marketing', 'Send SMS campaigns for events, specials, and VIP invitations', 'sms_marketing', 300.00, 3000.00, TRUE, 'sms', 0.50, 100, 
'["Bulk SMS campaigns", "Event reminders", "Drink specials alerts", "VIP invitations", "Automated notifications", "SMS templates", "Delivery reports"]'::jsonb,
ARRAY['starter', 'growth', 'pro', 'enterprise']),

-- Table Booking Fees
('Table Booking Fees', 'Charge R5 per VIP table reservation', 'booking_fees', 0.00, 0.00, TRUE, 'reservation', 5.00, 0,
'["Automated fee collection", "Per-reservation charging", "Revenue reports", "Integration with VIP Tables"]'::jsonb,
ARRAY['growth', 'pro', 'enterprise']),

-- Transaction Fee (0.5%)
('Transaction Fees (0.5%)', 'Earn 0.5% on all payment transactions', 'transaction_fees', 0.00, 0.00, TRUE, 'transaction', 0.005, 0,
'["Passive revenue stream", "Automated fee calculation", "Transaction analytics", "Monthly reports"]'::jsonb,
ARRAY['starter', 'growth', 'pro', 'enterprise']),

-- Transaction Fee (1%)
('Transaction Fees (1%)', 'Earn 1% on all payment transactions (Premium tier)', 'transaction_fees', 0.00, 0.00, TRUE, 'transaction', 0.01, 0,
'["Higher revenue share", "Automated fee calculation", "Advanced analytics", "Priority support"]'::jsonb,
ARRAY['pro', 'enterprise'])

ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 10. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_usage_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can view available add-ons
CREATE POLICY "Anyone can view active add-ons"
  ON subscription_addons FOR SELECT
  USING (is_active = TRUE);

-- Tenants can view their own add-ons
CREATE POLICY "Tenants can view their add-ons"
  ON tenant_addons FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Tenants can view their usage logs
CREATE POLICY "Tenants can view their usage logs"
  ON addon_usage_logs FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Owners can manage their tenant add-ons
CREATE POLICY "Owners can manage tenant add-ons"
  ON tenant_addons FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  ));

COMMENT ON TABLE subscription_addons IS 'Catalog of available subscription add-ons';
COMMENT ON TABLE tenant_addons IS 'Active add-on subscriptions for tenants';
COMMENT ON TABLE addon_usage_logs IS 'Usage tracking for usage-based add-ons';
