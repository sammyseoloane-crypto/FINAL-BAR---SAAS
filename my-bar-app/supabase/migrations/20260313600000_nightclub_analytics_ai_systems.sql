-- ============================================================
-- NIGHTCLUB ANALYTICS & AI SYSTEMS
-- AI predictions, dynamic pricing, crowd analytics, staff performance
-- Created: 2026-03-13
-- ============================================================

-- ============================================================
-- 1. SALES PREDICTIONS TABLE (AI-driven)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL,
  prediction_type VARCHAR(100) NOT NULL, -- 'daily', 'hourly', 'event', 'product'
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  -- Predictions
  predicted_sales_volume INTEGER,
  predicted_revenue DECIMAL(15, 2),
  confidence_score DECIMAL(5, 4), -- 0.0000 to 1.0000
  peak_hour_start INTEGER, -- 0-23
  peak_hour_end INTEGER, -- 0-23
  
  -- Time-based predictions
  hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  
  -- Factors
  weather_factor VARCHAR(50), -- 'sunny', 'rainy', 'cold'
  event_factor BOOLEAN DEFAULT FALSE,
  holiday_factor BOOLEAN DEFAULT FALSE,
  
  -- Model info
  model_version VARCHAR(50),
  training_data_size INTEGER,
  predicted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  UNIQUE(tenant_id, prediction_date, prediction_type, product_id, hour_of_day)
);

CREATE INDEX idx_sales_predictions_tenant ON sales_predictions(tenant_id);
CREATE INDEX idx_sales_predictions_date ON sales_predictions(prediction_date);
CREATE INDEX idx_sales_predictions_product ON sales_predictions(product_id);
CREATE INDEX idx_sales_predictions_event ON sales_predictions(event_id);
CREATE INDEX idx_sales_predictions_confidence ON sales_predictions(confidence_score DESC);

-- ============================================================
-- 2. DYNAMIC PRICING RULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  
  rule_name VARCHAR(200) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- 'time_based', 'demand_based', 'event_based', 'happy_hour'
  priority INTEGER DEFAULT 0, -- Higher priority rules apply first
  
  -- Base pricing
  base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
  
  -- Multipliers
  peak_multiplier DECIMAL(5, 2) DEFAULT 1.00 CHECK (peak_multiplier >= 0),
  event_multiplier DECIMAL(5, 2) DEFAULT 1.00 CHECK (event_multiplier >= 0),
  time_multiplier DECIMAL(5, 2) DEFAULT 1.00 CHECK (time_multiplier >= 0),
  demand_multiplier DECIMAL(5, 2) DEFAULT 1.00 CHECK (demand_multiplier >= 0),
  
  -- Price limits
  min_price DECIMAL(10, 2) CHECK (min_price >= 0),
  max_price DECIMAL(10, 2) CHECK (max_price >= 0),
  
  -- Time conditions
  valid_days_of_week JSONB, -- [0,1,2,3,4,5,6] for Sun-Sat
  valid_time_start TIME,
  valid_time_end TIME,
  valid_date_start DATE,
  valid_date_end DATE,
  
  -- Demand conditions (number of transactions in last hour)
  demand_threshold INTEGER, -- Apply multiplier when transactions > threshold
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_pricing_rules_tenant ON pricing_rules(tenant_id);
CREATE INDEX idx_pricing_rules_product ON pricing_rules(product_id);
CREATE INDEX idx_pricing_rules_event ON pricing_rules(event_id);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(priority DESC);

-- ============================================================
-- 3. VENUE ACTIVITY TABLE (Crowd Analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS venue_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  
  timestamp_hour TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Crowd metrics
  active_customers INTEGER DEFAULT 0,
  peak_crowd_size INTEGER,
  estimated_occupancy_percentage DECIMAL(5, 2),
  
  -- Transaction metrics
  transactions_count INTEGER DEFAULT 0,
  transactions_last_hour INTEGER DEFAULT 0,
  revenue_last_hour DECIMAL(15, 2) DEFAULT 0,
  
  -- Sales velocity
  avg_transaction_value DECIMAL(10, 2),
  sales_per_minute DECIMAL(10, 2),
  
  -- Customer flow
  new_customers_last_hour INTEGER DEFAULT 0,
  returning_customers_last_hour INTEGER DEFAULT 0,
  
  -- Staff metrics
  active_staff_count INTEGER,
  transactions_per_staff DECIMAL(10, 2),
  
  -- Predictions
  predicted_next_hour_revenue DECIMAL(15, 2),
  predicted_crowd_trend VARCHAR(50), -- 'increasing', 'stable', 'decreasing'
  
  metadata JSONB DEFAULT '{}',
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  UNIQUE(tenant_id, location_id, timestamp_hour)
);

CREATE INDEX idx_venue_activity_tenant ON venue_activity(tenant_id);
CREATE INDEX idx_venue_activity_location ON venue_activity(location_id);
CREATE INDEX idx_venue_activity_timestamp ON venue_activity(timestamp_hour DESC);
CREATE INDEX idx_venue_activity_event ON venue_activity(event_id);

-- ============================================================
-- 4. STAFF PERFORMANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type VARCHAR(50) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
  
  -- Transaction metrics
  transactions_handled INTEGER DEFAULT 0,
  orders_processed INTEGER DEFAULT 0,
  revenue_generated DECIMAL(15, 2) DEFAULT 0,
  avg_transaction_value DECIMAL(10, 2),
  
  -- Service metrics
  avg_service_time_seconds INTEGER,
  customer_satisfaction_score DECIMAL(3, 2), -- 0.00 to 5.00
  complaints_received INTEGER DEFAULT 0,
  
  -- Efficiency
  items_per_hour DECIMAL(10, 2),
  revenue_per_hour DECIMAL(10, 2),
  accuracy_rate DECIMAL(5, 2), -- Percentage
  
  -- Activities
  clock_in_time TIMESTAMP WITH TIME ZONE,
  clock_out_time TIMESTAMP WITH TIME ZONE,
  hours_worked DECIMAL(5, 2),
  breaks_taken INTEGER DEFAULT 0,
  
  -- Inventory interaction
  stock_movements_logged INTEGER DEFAULT 0,
  
  -- Rankings (calculated)
  performance_rank INTEGER, -- Rank among all staff for this period
  efficiency_score DECIMAL(5, 2), -- 0-100 composite score
  
  metadata JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  UNIQUE(tenant_id, staff_id, period_start, period_type)
);

CREATE INDEX idx_staff_performance_tenant ON staff_performance(tenant_id);
CREATE INDEX idx_staff_performance_staff ON staff_performance(staff_id);
CREATE INDEX idx_staff_performance_period ON staff_performance(period_start DESC, period_end DESC);
CREATE INDEX idx_staff_performance_revenue ON staff_performance(revenue_generated DESC);
CREATE INDEX idx_staff_performance_efficiency ON staff_performance(efficiency_score DESC);

-- ============================================================
-- 5. INVENTORY PREDICTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  -- Current state
  current_stock DECIMAL(10, 2) NOT NULL,
  minimum_stock DECIMAL(10, 2),
  
  -- Predictions
  predicted_daily_usage DECIMAL(10, 2),
  predicted_weekly_usage DECIMAL(10, 2),
  predicted_stockout_date DATE,
  days_until_stockout INTEGER,
  
  -- Recommendations
  suggested_reorder_quantity DECIMAL(10, 2),
  suggested_reorder_date DATE,
  optimal_stock_level DECIMAL(10, 2),
  
  -- Risk assessment
  low_stock_risk VARCHAR(50), -- 'low', 'medium', 'high', 'critical'
  stockout_probability DECIMAL(5, 4), -- 0.0000 to 1.0000
  
  -- Factors
  seasonal_factor DECIMAL(5, 2) DEFAULT 1.00,
  trend_factor DECIMAL(5, 2) DEFAULT 1.00,
  upcoming_events_factor DECIMAL(5, 2) DEFAULT 1.00,
  
  -- Model info
  model_version VARCHAR(50),
  confidence_score DECIMAL(5, 4),
  based_on_days_data INTEGER, -- How many days of historical data used
  
  metadata JSONB DEFAULT '{}',
  predicted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  is_current BOOLEAN DEFAULT TRUE, -- Only one prediction per product should be current
  
  UNIQUE(tenant_id, product_id, location_id, predicted_at)
);

CREATE INDEX idx_inventory_predictions_tenant ON inventory_predictions(tenant_id);
CREATE INDEX idx_inventory_predictions_product ON inventory_predictions(product_id);
CREATE INDEX idx_inventory_predictions_risk ON inventory_predictions(low_stock_risk);
CREATE INDEX idx_inventory_predictions_current ON inventory_predictions(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_inventory_predictions_stockout ON inventory_predictions(days_until_stockout) WHERE days_until_stockout IS NOT NULL AND days_until_stockout <= 7;

-- ============================================================
-- 6. PRICE HISTORY TABLE (for dynamic pricing tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pricing_rule_id UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
  
  old_price DECIMAL(10, 2) NOT NULL,
  new_price DECIMAL(10, 2) NOT NULL,
  price_change_percentage DECIMAL(5, 2),
  
  change_reason VARCHAR(200), -- 'demand_surge', 'happy_hour', 'event_pricing', 'manual'
  applied_multipliers JSONB, -- {"peak": 1.3, "event": 1.5, "demand": 1.2}
  
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  metadata JSONB DEFAULT '{}' 
);

CREATE INDEX idx_price_history_tenant ON price_history(tenant_id);
CREATE INDEX idx_price_history_product ON price_history(product_id);
CREATE INDEX idx_price_history_timestamp ON price_history(changed_at DESC);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE sales_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Sales Predictions: Owner and Admin can read
CREATE POLICY sales_predictions_tenant_isolation ON sales_predictions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Pricing Rules: Owner and Admin can manage
CREATE POLICY pricing_rules_tenant_isolation ON pricing_rules
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Venue Activity: Owner and Admin can read
CREATE POLICY venue_activity_tenant_isolation ON venue_activity
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Staff Performance: Staff can see own, Owner/Admin see all
CREATE POLICY staff_performance_tenant_isolation ON staff_performance
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      staff_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Inventory Predictions: Owner, Admin, Staff can read
CREATE POLICY inventory_predictions_tenant_isolation ON inventory_predictions
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Price History: Owner and Admin can read
CREATE POLICY price_history_tenant_isolation ON price_history
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS FOR DYNAMIC PRICING
-- ============================================================

-- Calculate dynamic price for a product
CREATE OR REPLACE FUNCTION calculate_dynamic_price(
  p_product_id UUID,
  p_tenant_id UUID,
  p_location_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  final_price DECIMAL(10, 2),
  base_price DECIMAL(10, 2),
  applied_rules JSONB,
  total_multiplier DECIMAL(5, 2)
) AS $$
DECLARE
  v_base_price DECIMAL(10, 2);
  v_multiplier DECIMAL(5, 2) := 1.00;
  v_rules JSONB := '[]'::JSONB;
  v_rule RECORD;
  v_hour INTEGER;
  v_dow INTEGER;
  v_demand INTEGER;
BEGIN
  -- Get base price
  SELECT price INTO v_base_price
  FROM products
  WHERE id = p_product_id AND tenant_id = p_tenant_id;
  
  IF v_base_price IS NULL THEN
    RETURN;
  END IF;
  
  -- Extract time components
  v_hour := EXTRACT(HOUR FROM p_timestamp);
  v_dow := EXTRACT(DOW FROM p_timestamp);
  
  -- Get recent demand (transactions in last hour)
  SELECT COUNT(*) INTO v_demand
  FROM transactions t
  JOIN orders o ON o.metadata->>'transaction_id' = t.id::TEXT
  WHERE o.product_id = p_product_id
    AND t.tenant_id = p_tenant_id
    AND t.created_at >= p_timestamp - INTERVAL '1 hour';
  
  -- Apply pricing rules in priority order
  FOR v_rule IN
    SELECT *
    FROM pricing_rules
    WHERE tenant_id = p_tenant_id
      AND is_active = TRUE
      AND (product_id = p_product_id OR product_id IS NULL)
      AND (event_id = p_event_id OR event_id IS NULL)
      AND (location_id = p_location_id OR location_id IS NULL)
      AND (valid_date_start IS NULL OR valid_date_start <= p_timestamp::DATE)
      AND (valid_date_end IS NULL OR valid_date_end >= p_timestamp::DATE)
      AND (valid_time_start IS NULL OR valid_time_start <= p_timestamp::TIME)
      AND (valid_time_end IS NULL OR valid_time_end >= p_timestamp::TIME)
      AND (valid_days_of_week IS NULL OR valid_days_of_week @> v_dow::TEXT::JSONB)
      AND (demand_threshold IS NULL OR v_demand >= demand_threshold)
    ORDER BY priority DESC
    LIMIT 1
  LOOP
    -- Apply multipliers
    v_multiplier := v_multiplier 
      * COALESCE(v_rule.peak_multiplier, 1.00)
      * COALESCE(v_rule.event_multiplier, 1.00)
      * COALESCE(v_rule.time_multiplier, 1.00)
      * COALESCE(v_rule.demand_multiplier, 1.00);
    
    -- Record applied rule
    v_rules := v_rules || jsonb_build_object(
      'rule_id', v_rule.id,
      'rule_name', v_rule.rule_name,
      'multiplier', v_multiplier
    );
  END LOOP;
  
  -- Calculate final price
  final_price := v_base_price * v_multiplier;
  base_price := v_base_price;
  applied_rules := v_rules;
  total_multiplier := v_multiplier;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_rules_updated_at BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
