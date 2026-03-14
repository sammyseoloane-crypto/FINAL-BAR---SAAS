-- ============================================================
-- SMART PRICING ENGINE FOR VIP TABLES
-- Dynamic pricing based on demand
-- Created: 2026-03-14
-- ============================================================

-- Add columns to tables for dynamic pricing
ALTER TABLE tables 
  ADD COLUMN IF NOT EXISTS base_min_spend DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_min_spend DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(50) DEFAULT 'standard'; -- 'standard', 'high_demand', 'peak'

-- Add expected_capacity to events table
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS expected_capacity INTEGER;

-- Update current_min_spend to match minimum_spend initially
UPDATE tables 
SET base_min_spend = COALESCE(minimum_spend, 0),
    current_min_spend = COALESCE(minimum_spend, 0)
WHERE base_min_spend IS NULL OR current_min_spend IS NULL;

-- ============================================================
-- SMART PRICING FUNCTION
-- Automatically adjusts minimum spend based on reservation demand
-- ============================================================

DROP FUNCTION IF EXISTS calculate_dynamic_minimum_spend(UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION calculate_dynamic_minimum_spend(
  p_tenant_id UUID,
  p_event_id UUID DEFAULT NULL,
  p_reservation_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  table_id UUID,
  table_name VARCHAR,
  base_min_spend DECIMAL,
  current_min_spend DECIMAL,
  pricing_tier VARCHAR,
  adjustment_percentage INTEGER,
  reserved_count BIGINT,
  total_count BIGINT,
  occupancy_rate DECIMAL
) AS $$
DECLARE
  v_total_tables BIGINT;
  v_reserved_tables BIGINT;
  v_occupancy_rate DECIMAL;
  v_price_multiplier DECIMAL := 1.0;
  v_pricing_tier VARCHAR := 'standard';
  v_adjustment_pct INTEGER := 0;
BEGIN
  -- Count total active tables for tenant
  SELECT COUNT(*)
  INTO v_total_tables
  FROM tables t
  WHERE t.tenant_id = p_tenant_id
    AND t.is_active = TRUE;

  -- Count reserved tables for the date (or event)
  IF p_event_id IS NOT NULL THEN
    -- Event-specific reservations
    SELECT COUNT(DISTINCT tr.table_id)
    INTO v_reserved_tables
    FROM table_reservations tr
    WHERE tr.tenant_id = p_tenant_id
      AND tr.event_id = p_event_id
      AND tr.status IN ('confirmed', 'checked_in');
  ELSE
    -- Date-based reservations
    SELECT COUNT(DISTINCT tr.table_id)
    INTO v_reserved_tables
    FROM table_reservations tr
    WHERE tr.tenant_id = p_tenant_id
      AND tr.reservation_date = p_reservation_date
      AND tr.status IN ('confirmed', 'checked_in');
  END IF;

  -- Calculate occupancy rate
  IF v_total_tables > 0 THEN
    v_occupancy_rate := (v_reserved_tables::DECIMAL / v_total_tables) * 100;
  ELSE
    v_occupancy_rate := 0;
  END IF;

  -- Apply smart pricing rules
  IF v_occupancy_rate > 80 THEN
    -- PEAK DEMAND: 50% increase
    v_price_multiplier := 1.5;
    v_pricing_tier := 'peak';
    v_adjustment_pct := 50;
  ELSIF v_occupancy_rate > 60 THEN
    -- HIGH DEMAND: 20% increase
    v_price_multiplier := 1.2;
    v_pricing_tier := 'high_demand';
    v_adjustment_pct := 20;
  ELSE
    -- STANDARD PRICING
    v_price_multiplier := 1.0;
    v_pricing_tier := 'standard';
    v_adjustment_pct := 0;
  END IF;

  -- Return pricing for all tables with dynamic adjustment
  RETURN QUERY
  SELECT 
    t.id AS table_id,
    t.name AS table_name,
    COALESCE(t.base_min_spend, t.minimum_spend, 0) AS base_min_spend,
    ROUND(COALESCE(t.base_min_spend, t.minimum_spend, 0) * v_price_multiplier, 2) AS current_min_spend,
    v_pricing_tier AS pricing_tier,
    v_adjustment_pct AS adjustment_percentage,
    v_reserved_tables AS reserved_count,
    v_total_tables AS total_count,
    ROUND(v_occupancy_rate, 2) AS occupancy_rate
  FROM tables t
  WHERE t.tenant_id = p_tenant_id
    AND t.is_active = TRUE
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATE TABLE PRICING FUNCTION
-- Apply dynamic pricing to tables
-- ============================================================

DROP FUNCTION IF EXISTS update_table_pricing(UUID, UUID, DATE);

CREATE OR REPLACE FUNCTION update_table_pricing(
  p_tenant_id UUID,
  p_event_id UUID DEFAULT NULL,
  p_reservation_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
DECLARE
  v_pricing_data RECORD;
BEGIN
  -- Get dynamic pricing data
  FOR v_pricing_data IN 
    SELECT * FROM calculate_dynamic_minimum_spend(p_tenant_id, p_event_id, p_reservation_date)
  LOOP
    -- Update each table with new pricing
    UPDATE tables
    SET 
      current_min_spend = v_pricing_data.current_min_spend,
      pricing_tier = v_pricing_data.pricing_tier,
      updated_at = TIMEZONE('utc', NOW())
    WHERE id = v_pricing_data.table_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: Auto-update pricing on reservation changes
-- ============================================================

DROP FUNCTION IF EXISTS trigger_update_pricing() CASCADE;

CREATE OR REPLACE FUNCTION trigger_update_pricing()
RETURNS TRIGGER AS $$
BEGIN
  -- Update pricing when reservation is confirmed or cancelled
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR
     (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('confirmed', 'cancelled')) THEN
    
    PERFORM update_table_pricing(
      NEW.tenant_id,
      NEW.event_id,
      NEW.reservation_date
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reservation_pricing_update ON table_reservations;

CREATE TRIGGER trigger_reservation_pricing_update
  AFTER INSERT OR UPDATE ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_pricing();

-- ============================================================
-- REVENUE ANALYTICS FUNCTION
-- Calculate table revenue for heatmap
-- ============================================================

DROP FUNCTION IF EXISTS get_table_revenue_stats(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_table_revenue_stats(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  table_id UUID,
  table_name VARCHAR,
  total_revenue DECIMAL,
  reservation_count BIGINT,
  avg_spend DECIMAL,
  total_guests BIGINT,
  avg_party_size DECIMAL,
  revenue_rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH revenue_data AS (
    SELECT 
      t.id AS table_id,
      t.name AS table_name,
      COALESCE(SUM(tr.actual_spend), 0) AS total_revenue,
      COUNT(tr.id) AS reservation_count,
      COALESCE(AVG(tr.actual_spend), 0) AS avg_spend,
      COALESCE(SUM(tr.guest_count), 0) AS total_guests,
      COALESCE(AVG(tr.guest_count), 0) AS avg_party_size
    FROM tables t
    LEFT JOIN table_reservations tr ON tr.table_id = t.id
      AND tr.tenant_id = p_tenant_id
      AND tr.reservation_date BETWEEN p_start_date AND p_end_date
      AND tr.status = 'completed'
    WHERE t.tenant_id = p_tenant_id
      AND t.is_active = TRUE
    GROUP BY t.id, t.name
  )
  SELECT 
    rd.*,
    RANK() OVER (ORDER BY rd.total_revenue DESC)::INTEGER AS revenue_rank
  FROM revenue_data rd
  ORDER BY rd.total_revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PRICING HISTORY TABLE
-- Track pricing changes over time
-- ============================================================

CREATE TABLE IF NOT EXISTS table_pricing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  
  -- Pricing snapshot
  base_min_spend DECIMAL(10, 2),
  current_min_spend DECIMAL(10, 2),
  pricing_tier VARCHAR(50),
  adjustment_percentage INTEGER,
  
  -- Demand metrics
  occupancy_rate DECIMAL(5, 2),
  reserved_tables INTEGER,
  total_tables INTEGER,
  
  -- Context
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  reservation_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_pricing_history_tenant ON table_pricing_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_table ON table_pricing_history(table_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_date ON table_pricing_history(reservation_date);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Tables: Owners can view and update their tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view their tables" ON tables;

CREATE POLICY "Owners can view their tables" ON tables
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update table pricing" ON tables;

CREATE POLICY "Owners can update table pricing" ON tables
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Table Reservations: Users can view their own, staff can view all for their tenant
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reservations" ON table_reservations;

CREATE POLICY "Users can view their own reservations" ON table_reservations
  FOR SELECT USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager', 'staff')
    )
  );

DROP POLICY IF EXISTS "Staff can create reservations" ON table_reservations;

CREATE POLICY "Staff can create reservations" ON table_reservations
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager', 'staff')
    )
  );

DROP POLICY IF EXISTS "Staff can update reservations" ON table_reservations;

CREATE POLICY "Staff can update reservations" ON table_reservations
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'manager', 'staff')
    )
  );

-- Pricing History: Read-only for analytics
ALTER TABLE table_pricing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view pricing history" ON table_pricing_history;

CREATE POLICY "Owners can view pricing history" ON table_pricing_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- INITIAL DATA SETUP
-- ============================================================

-- Set base_min_spend for existing tables
UPDATE tables 
SET base_min_spend = COALESCE(minimum_spend, 0),
    current_min_spend = COALESCE(minimum_spend, 0)
WHERE base_min_spend IS NULL;

COMMENT ON FUNCTION calculate_dynamic_minimum_spend IS 'Smart pricing engine that adjusts minimum spend based on demand: >80% → +50%, >60% → +20%';
COMMENT ON FUNCTION update_table_pricing IS 'Applies dynamic pricing to all tables based on current reservation demand';
COMMENT ON FUNCTION get_table_revenue_stats IS 'Revenue analytics for table heatmap visualization';
