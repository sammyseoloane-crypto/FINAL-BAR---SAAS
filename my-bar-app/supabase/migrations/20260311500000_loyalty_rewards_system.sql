-- ============================================================
-- LOYALTY & REWARDS SYSTEM
-- Customer loyalty points, rewards, and promotional campaigns
-- Created: 2026-03-11
-- ============================================================

-- Create loyalty_programs table
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  points_per_currency DECIMAL(10, 2) DEFAULT 1.00, -- Points earned per ZAR spent
  currency VARCHAR(3) DEFAULT 'ZAR',
  welcome_bonus_points INTEGER DEFAULT 0,
  birthday_bonus_points INTEGER DEFAULT 0,
  referral_bonus_points INTEGER DEFAULT 0,
  min_purchase_for_points DECIMAL(10, 2) DEFAULT 0,
  points_expiry_days INTEGER, -- NULL = no expiry
  tier_system_enabled BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create loyalty_tiers table
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  min_points INTEGER NOT NULL,
  max_points INTEGER,
  points_multiplier DECIMAL(3, 2) DEFAULT 1.00, -- 1.5x points for platinum tier
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  perks JSONB DEFAULT '[]',
  color VARCHAR(7) DEFAULT '#000000',
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create customer_loyalty table
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  current_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  current_tier_id UUID REFERENCES loyalty_tiers(id),
  tier_expires_at TIMESTAMP WITH TIME ZONE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, tenant_id, program_id)
);

-- Create loyalty_transactions table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id),
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  balance_after INTEGER NOT NULL,
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create rewards_catalog table
CREATE TABLE IF NOT EXISTS rewards_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID REFERENCES loyalty_programs(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  reward_type VARCHAR(50) NOT NULL, -- 'discount', 'free_item', 'voucher', 'upgrade'
  reward_value DECIMAL(10, 2),
  product_id UUID REFERENCES products(id), -- For free_item type
  discount_percentage DECIMAL(5, 2), -- For discount type
  voucher_code VARCHAR(100),
  max_redemptions INTEGER,
  redemptions_count INTEGER DEFAULT 0,
  tier_requirement UUID REFERENCES loyalty_tiers(id),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create reward_redemptions table
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_loyalty_id UUID NOT NULL REFERENCES customer_loyalty(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards_catalog(id),
  points_spent INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'redeemed', 'expired', 'cancelled'
  voucher_code VARCHAR(100),
  redeemed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create promotional_campaigns table
CREATE TABLE IF NOT EXISTS promotional_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL, -- 'happy_hour', 'early_bird', 'event_special', 'seasonal'
  discount_type VARCHAR(50), -- 'percentage', 'fixed_amount', 'buy_x_get_y'
  discount_value DECIMAL(10, 2),
  applicable_products JSONB, -- Array of product IDs
  applicable_events JSONB, -- Array of event IDs
  min_purchase_amount DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  promo_code VARCHAR(50),
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  location_ids JSONB, -- Array of location IDs
  valid_days_of_week JSONB, -- [0,1,2,3,4,5,6] for Sun-Sat
  valid_time_start TIME,
  valid_time_end TIME,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create campaign_usage table
CREATE TABLE IF NOT EXISTS campaign_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  transaction_id UUID REFERENCES transactions(id),
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX idx_loyalty_programs_tenant ON loyalty_programs(tenant_id);
CREATE INDEX idx_loyalty_tiers_program ON loyalty_tiers(program_id);
CREATE INDEX idx_customer_loyalty_user ON customer_loyalty(user_id);
CREATE INDEX idx_customer_loyalty_tenant ON customer_loyalty(tenant_id);
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_loyalty_id);
CREATE INDEX idx_rewards_catalog_tenant ON rewards_catalog(tenant_id);
CREATE INDEX idx_reward_redemptions_customer ON reward_redemptions(customer_loyalty_id);
CREATE INDEX idx_promotional_campaigns_tenant ON promotional_campaigns(tenant_id);
CREATE INDEX idx_promotional_campaigns_dates ON promotional_campaigns(start_date, end_date);
CREATE INDEX idx_campaign_usage_campaign ON campaign_usage(campaign_id);
CREATE INDEX idx_campaign_usage_user ON campaign_usage(user_id);

-- Enable RLS
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active loyalty programs"
  ON loyalty_programs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage loyalty programs"
  ON loyalty_programs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = loyalty_programs.tenant_id
    )
  );

CREATE POLICY "Users can view loyalty tiers"
  ON loyalty_tiers FOR SELECT
  USING (true);

CREATE POLICY "Users can view their loyalty info"
  ON customer_loyalty FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (
    customer_loyalty_id IN (
      SELECT id FROM customer_loyalty WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view active rewards"
  ON rewards_catalog FOR SELECT
  USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

CREATE POLICY "Users can view their redemptions"
  ON reward_redemptions FOR SELECT
  USING (
    customer_loyalty_id IN (
      SELECT id FROM customer_loyalty WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view active campaigns"
  ON promotional_campaigns FOR SELECT
  USING (is_active = true AND NOW() BETWEEN start_date AND end_date);

-- ============================================================
-- LOYALTY & REWARDS HELPER FUNCTIONS
-- ============================================================

-- Function to award loyalty points
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_transaction_id UUID,
  p_user_id UUID,
  p_amount DECIMAL(10, 2)
)
RETURNS INTEGER AS $$
DECLARE
  v_tenant_id UUID;
  v_program loyalty_programs;
  v_customer_loyalty customer_loyalty;
  v_points_earned INTEGER;
  v_multiplier DECIMAL(3, 2) := 1.00;
BEGIN
  -- Get tenant_id from transaction
  SELECT tenant_id INTO v_tenant_id FROM transactions WHERE id = p_transaction_id;

  -- Get active loyalty program
  SELECT * INTO v_program 
  FROM loyalty_programs 
  WHERE tenant_id = v_tenant_id AND is_active = true
  LIMIT 1;

  IF v_program IS NULL THEN
    RETURN 0; -- No active program
  END IF;

  -- Check minimum purchase requirement
  IF p_amount < v_program.min_purchase_for_points THEN
    RETURN 0;
  END IF;

  -- Get or create customer loyalty record
  SELECT * INTO v_customer_loyalty
  FROM customer_loyalty
  WHERE user_id = p_user_id AND program_id = v_program.id;

  IF NOT FOUND THEN
    INSERT INTO customer_loyalty (user_id, tenant_id, program_id, current_points, lifetime_points)
    VALUES (p_user_id, v_tenant_id, v_program.id, v_program.welcome_bonus_points, v_program.welcome_bonus_points)
    RETURNING * INTO v_customer_loyalty;
  END IF;

  -- Get tier multiplier if applicable
  IF v_customer_loyalty.current_tier_id IS NOT NULL THEN
    SELECT points_multiplier INTO v_multiplier
    FROM loyalty_tiers
    WHERE id = v_customer_loyalty.current_tier_id;
  END IF;

  -- Calculate points earned
  v_points_earned := FLOOR((p_amount * v_program.points_per_currency * v_multiplier)::NUMERIC);

  -- Update customer loyalty
  UPDATE customer_loyalty
  SET 
    current_points = current_points + v_points_earned,
    lifetime_points = lifetime_points + v_points_earned,
    last_activity = NOW()
  WHERE id = v_customer_loyalty.id;

  -- Record transaction
  INSERT INTO loyalty_transactions (
    customer_loyalty_id,
    transaction_id,
    points_earned,
    balance_after,
    description
  ) VALUES (
    v_customer_loyalty.id,
    p_transaction_id,
    v_points_earned,
    v_customer_loyalty.current_points + v_points_earned,
    'Points earned from purchase'
  );

  -- Check for tier upgrade
  PERFORM update_loyalty_tier(v_customer_loyalty.id);

  RETURN v_points_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to redeem reward
CREATE OR REPLACE FUNCTION redeem_reward(
  p_reward_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_reward rewards_catalog;
  v_customer_loyalty customer_loyalty;
  v_redemption_id UUID;
BEGIN
  -- Get reward details
  SELECT * INTO v_reward FROM rewards_catalog WHERE id = p_reward_id;

  IF NOT FOUND OR NOT v_reward.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward not available');
  END IF;

  -- Check redemption limits
  IF v_reward.max_redemptions IS NOT NULL AND v_reward.redemptions_count >= v_reward.max_redemptions THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward sold out');
  END IF;

  -- Get customer loyalty
  SELECT * INTO v_customer_loyalty
  FROM customer_loyalty
  WHERE user_id = p_user_id AND tenant_id = v_reward.tenant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enrolled in loyalty program');
  END IF;

  -- Check if user has enough points
  IF v_customer_loyalty.current_points < v_reward.points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  -- Check tier requirement
  IF v_reward.tier_requirement IS NOT NULL AND v_customer_loyalty.current_tier_id != v_reward.tier_requirement THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tier requirement not met');
  END IF;

  -- Deduct points
  UPDATE customer_loyalty
  SET current_points = current_points - v_reward.points_cost
  WHERE id = v_customer_loyalty.id;

  -- Create redemption
  INSERT INTO reward_redemptions (
    customer_loyalty_id,
    reward_id,
    points_spent,
    voucher_code,
    expires_at
  ) VALUES (
    v_customer_loyalty.id,
    p_reward_id,
    v_reward.points_cost,
    v_reward.voucher_code,
    NOW() + INTERVAL '30 days'
  ) RETURNING id INTO v_redemption_id;

  -- Record loyalty transaction
  INSERT INTO loyalty_transactions (
    customer_loyalty_id,
    points_redeemed,
    balance_after,
    description
  ) VALUES (
    v_customer_loyalty.id,
    v_reward.points_cost,
    v_customer_loyalty.current_points - v_reward.points_cost,
    'Points redeemed for: ' || v_reward.name
  );

  -- Update reward redemption count
  UPDATE rewards_catalog
  SET redemptions_count = redemptions_count + 1
  WHERE id = p_reward_id;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'points_spent', v_reward.points_cost,
    'remaining_points', v_customer_loyalty.current_points - v_reward.points_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update loyalty tier
CREATE OR REPLACE FUNCTION update_loyalty_tier(p_customer_loyalty_id UUID)
RETURNS UUID AS $$
DECLARE
  v_customer customer_loyalty;
  v_new_tier loyalty_tiers;
BEGIN
  SELECT * INTO v_customer FROM customer_loyalty WHERE id = p_customer_loyalty_id;

  -- Find appropriate tier based on lifetime points
  SELECT * INTO v_new_tier
  FROM loyalty_tiers
  WHERE program_id = v_customer.program_id
    AND v_customer.lifetime_points >= min_points
    AND (max_points IS NULL OR v_customer.lifetime_points < max_points)
  ORDER BY min_points DESC
  LIMIT 1;

  IF v_new_tier.id IS DISTINCT FROM v_customer.current_tier_id THEN
    UPDATE customer_loyalty
    SET 
      current_tier_id = v_new_tier.id,
      tier_expires_at = NULL -- Or set expiry policy
    WHERE id = p_customer_loyalty_id;
  END IF;

  RETURN v_new_tier.id;
END;
$$ LANGUAGE plpgsql;

-- Function to apply promotional discount
CREATE OR REPLACE FUNCTION apply_promo_code(
  p_promo_code VARCHAR,
  p_user_id UUID,
  p_transaction_amount DECIMAL(10, 2),
  p_product_ids JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_campaign promotional_campaigns;
  v_discount DECIMAL(10, 2);
BEGIN
  -- Find valid campaign
  SELECT * INTO v_campaign
  FROM promotional_campaigns
  WHERE promo_code = p_promo_code
    AND is_active = true
    AND NOW() BETWEEN start_date AND end_date
    AND (usage_limit IS NULL OR usage_count < usage_limit)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- Check minimum purchase
  IF v_campaign.min_purchase_amount IS NOT NULL AND p_transaction_amount < v_campaign.min_purchase_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum purchase amount not met');
  END IF;

  -- Calculate discount
  IF v_campaign.discount_type = 'percentage' THEN
    v_discount := p_transaction_amount * v_campaign.discount_value / 100;
  ELSIF v_campaign.discount_type = 'fixed_amount' THEN
    v_discount := v_campaign.discount_value;
  END IF;

  -- Apply max discount cap
  IF v_campaign.max_discount_amount IS NOT NULL THEN
    v_discount := LEAST(v_discount, v_campaign.max_discount_amount);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', v_campaign.id,
    'discount_amount', v_discount,
    'final_amount', p_transaction_amount - v_discount
  );
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE loyalty_programs IS 'Loyalty programs configuration for tenants';
COMMENT ON TABLE customer_loyalty IS 'Customer enrollment and points balance';
COMMENT ON TABLE rewards_catalog IS 'Redeemable rewards and perks';
COMMENT ON TABLE promotional_campaigns IS 'Time-based promotional campaigns and discounts';
COMMENT ON FUNCTION award_loyalty_points(UUID, UUID, DECIMAL) IS 'Award points to customer based on purchase';
COMMENT ON FUNCTION redeem_reward(UUID, UUID) IS 'Redeem a reward using loyalty points';
