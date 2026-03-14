-- ============================================================
-- CLUB PERFORMANCE DASHBOARD TABLES
-- ============================================================
-- Migration: 20260314000005_club_performance_tables.sql
-- Description: Tables for real-time club performance tracking
-- Created: 2026-03-14
-- ============================================================

-- ============================================================
-- DRINKS_SOLD TABLE
-- Track individual drink sales for analytics
-- ============================================================
CREATE TABLE IF NOT EXISTS drinks_sold (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Drink details
  drink_name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- 'beer', 'wine', 'spirits', 'cocktails', 'non-alcoholic'
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  
  -- Sales context
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  served_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  
  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  shift_date DATE DEFAULT CURRENT_DATE,
  hour_of_day INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM (timestamp AT TIME ZONE 'UTC'))) STORED,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_drinks_sold_tenant_id ON drinks_sold(tenant_id);
CREATE INDEX idx_drinks_sold_timestamp ON drinks_sold(timestamp);
CREATE INDEX idx_drinks_sold_shift_date ON drinks_sold(shift_date);
CREATE INDEX idx_drinks_sold_drink_name ON drinks_sold(drink_name);
CREATE INDEX idx_drinks_sold_served_by ON drinks_sold(served_by);
CREATE INDEX idx_drinks_sold_hour_of_day ON drinks_sold(hour_of_day);
CREATE INDEX idx_drinks_sold_event_id ON drinks_sold(event_id);

COMMENT ON TABLE drinks_sold IS 'Individual drink sales tracking for real-time analytics';

-- ============================================================
-- STAFF_SALES TABLE
-- Track staff performance and sales
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Sales metrics
  total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
  drinks_sold INTEGER DEFAULT 0,
  tables_served INTEGER DEFAULT 0,
  tips_earned DECIMAL(10, 2) DEFAULT 0,
  
  -- Performance metrics
  avg_service_time_minutes INTEGER,
  customer_rating DECIMAL(3, 2), -- 0.00 to 5.00
  upsell_count INTEGER DEFAULT 0,
  
  -- Shift information
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_start TIMESTAMP WITH TIME ZONE,
  shift_end TIMESTAMP WITH TIME ZONE,
  hours_worked DECIMAL(5, 2),
  
  -- Event context
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Ensure one record per staff per shift per event
  UNIQUE(staff_id, shift_date, event_id)
);

-- Indexes
CREATE INDEX idx_staff_sales_tenant_id ON staff_sales(tenant_id);
CREATE INDEX idx_staff_sales_staff_id ON staff_sales(staff_id);
CREATE INDEX idx_staff_sales_shift_date ON staff_sales(shift_date);
CREATE INDEX idx_staff_sales_total_sales ON staff_sales(total_sales DESC);
CREATE INDEX idx_staff_sales_event_id ON staff_sales(event_id);

COMMENT ON TABLE staff_sales IS 'Staff performance and sales tracking';

-- ============================================================
-- CROWD_TRACKING TABLE
-- Track real-time venue capacity and crowd flow
-- ============================================================
CREATE TABLE IF NOT EXISTS crowd_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Capacity metrics
  current_capacity INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER NOT NULL,
  occupancy_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN max_capacity > 0 THEN (current_capacity::DECIMAL / max_capacity * 100)
      ELSE 0 
    END
  ) STORED,
  
  -- Entry/Exit tracking
  entries_count INTEGER DEFAULT 0,
  exits_count INTEGER DEFAULT 0,
  
  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  recorded_date DATE DEFAULT CURRENT_DATE,
  hour_of_day INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM (timestamp AT TIME ZONE 'UTC'))) STORED,
  
  -- Event context
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX idx_crowd_tracking_tenant_id ON crowd_tracking(tenant_id);
CREATE INDEX idx_crowd_tracking_timestamp ON crowd_tracking(timestamp);
CREATE INDEX idx_crowd_tracking_recorded_date ON crowd_tracking(recorded_date);
CREATE INDEX idx_crowd_tracking_event_id ON crowd_tracking(event_id);

COMMENT ON TABLE crowd_tracking IS 'Real-time crowd size and capacity monitoring';

-- ============================================================
-- FUNCTIONS FOR REAL-TIME METRICS
-- ============================================================

-- Function: Get tonight's revenue stats
DROP FUNCTION IF EXISTS get_tonight_revenue_stats(UUID);

CREATE OR REPLACE FUNCTION get_tonight_revenue_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_revenue DECIMAL,
  transaction_count INTEGER,
  avg_transaction DECIMAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.amount), 0) as total_revenue,
    COUNT(*)::INTEGER as transaction_count,
    COALESCE(AVG(t.amount), 0) as avg_transaction
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'confirmed'
    AND DATE(t.created_at) = CURRENT_DATE;
END;
$$;

-- Function: Get hourly revenue
DROP FUNCTION IF EXISTS get_hourly_revenue(UUID, DATE);

CREATE OR REPLACE FUNCTION get_hourly_revenue(p_tenant_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  hour INTEGER,
  revenue DECIMAL,
  transaction_count INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM t.created_at)::INTEGER as hour,
    COALESCE(SUM(t.amount), 0) as revenue,
    COUNT(*)::INTEGER as transaction_count
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'confirmed'
    AND DATE(t.created_at) = p_date
  GROUP BY EXTRACT(HOUR FROM t.created_at)
  ORDER BY hour;
END;
$$;

-- Function: Get top selling drinks
CREATE OR REPLACE FUNCTION get_top_selling_drinks(
  p_tenant_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  drink_name VARCHAR,
  total_quantity INTEGER,
  total_revenue DECIMAL,
  avg_price DECIMAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.drink_name,
    SUM(ds.quantity)::INTEGER as total_quantity,
    COALESCE(SUM(ds.total_price), 0) as total_revenue,
    COALESCE(AVG(ds.unit_price), 0) as avg_price
  FROM drinks_sold ds
  WHERE ds.tenant_id = p_tenant_id
    AND ds.shift_date = p_date
  GROUP BY ds.drink_name
  ORDER BY total_quantity DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get top staff performers
CREATE OR REPLACE FUNCTION get_top_staff_performers(
  p_tenant_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  staff_id UUID,
  staff_name VARCHAR,
  total_sales DECIMAL,
  drinks_sold INTEGER,
  tables_served INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.staff_id,
    COALESCE(p.full_name, p.email) as staff_name,
    ss.total_sales,
    ss.drinks_sold,
    ss.tables_served
  FROM staff_sales ss
  LEFT JOIN profiles p ON ss.staff_id = p.id
  WHERE ss.tenant_id = p_tenant_id
    AND ss.shift_date = p_date
  ORDER BY ss.total_sales DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get guest entry rate by hour
CREATE OR REPLACE FUNCTION get_hourly_guest_entries(
  p_tenant_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  hour INTEGER,
  entry_count INTEGER,
  checked_in_count INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM ge.created_at)::INTEGER as hour,
    COUNT(*)::INTEGER as entry_count,
    COUNT(*) FILTER (WHERE ge.checked_in = TRUE)::INTEGER as checked_in_count
  FROM guest_list_entries ge
  WHERE ge.tenant_id = p_tenant_id
    AND DATE(ge.created_at) = p_date
  GROUP BY EXTRACT(HOUR FROM ge.created_at)
  ORDER BY hour;
END;
$$;

-- Function: Get drinks sold per hour
CREATE OR REPLACE FUNCTION get_hourly_drinks_sold(
  p_tenant_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  hour INTEGER,
  drinks_count INTEGER,
  revenue DECIMAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.hour_of_day as hour,
    SUM(ds.quantity)::INTEGER as drinks_count,
    COALESCE(SUM(ds.total_price), 0) as revenue
  FROM drinks_sold ds
  WHERE ds.tenant_id = p_tenant_id
    AND ds.shift_date = p_date
  GROUP BY ds.hour_of_day
  ORDER BY hour;
END;
$$;

-- Function: Get active VIP tables count
CREATE OR REPLACE FUNCTION get_active_vip_tables(p_tenant_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO active_count
  FROM tables t
  WHERE t.tenant_id = p_tenant_id
    AND t.is_active = TRUE
    AND t.status IN ('reserved', 'occupied');
    
  RETURN COALESCE(active_count, 0);
END;
$$;

-- Function: Get current crowd size
CREATE OR REPLACE FUNCTION get_current_crowd_size(p_tenant_id UUID)
RETURNS TABLE (
  current_capacity INTEGER,
  max_capacity INTEGER,
  occupancy_rate DECIMAL,
  last_updated TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.current_capacity,
    ct.max_capacity,
    ct.occupancy_rate,
    ct.timestamp as last_updated
  FROM crowd_tracking ct
  WHERE ct.tenant_id = p_tenant_id
    AND ct.recorded_date = CURRENT_DATE
  ORDER BY ct.timestamp DESC
  LIMIT 1;
END;
$$;

-- ============================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================================

-- Trigger: Auto-update staff_sales when drinks are sold
CREATE OR REPLACE FUNCTION update_staff_sales_on_drink_sold()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.served_by IS NOT NULL THEN
    INSERT INTO staff_sales (
      tenant_id,
      staff_id,
      shift_date,
      total_sales,
      drinks_sold
    ) VALUES (
      NEW.tenant_id,
      NEW.served_by,
      NEW.shift_date,
      NEW.total_price,
      NEW.quantity
    )
    ON CONFLICT (staff_id, shift_date, event_id)
    DO UPDATE SET
      total_sales = staff_sales.total_sales + EXCLUDED.total_sales,
      drinks_sold = staff_sales.drinks_sold + EXCLUDED.drinks_sold,
      updated_at = TIMEZONE('utc', NOW());
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_staff_sales_on_drink_sold
  AFTER INSERT ON drinks_sold
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_sales_on_drink_sold();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE drinks_sold ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE crowd_tracking ENABLE ROW LEVEL SECURITY;

-- Policies for drinks_sold
CREATE POLICY drinks_sold_tenant_isolation ON drinks_sold
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Policies for staff_sales
CREATE POLICY staff_sales_tenant_isolation ON staff_sales
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY staff_sales_view_own ON staff_sales
  FOR SELECT
  USING (staff_id = auth.uid() OR tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Policies for crowd_tracking
CREATE POLICY crowd_tracking_tenant_isolation ON crowd_tracking
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- ============================================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE drinks_sold;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE crowd_tracking;

-- ============================================================
-- INITIAL DATA & COMMENTS
-- ============================================================

COMMENT ON FUNCTION get_tonight_revenue_stats IS 'Get revenue statistics for current day';
COMMENT ON FUNCTION get_hourly_revenue IS 'Get revenue broken down by hour';
COMMENT ON FUNCTION get_top_selling_drinks IS 'Get top selling drinks for a date';
COMMENT ON FUNCTION get_top_staff_performers IS 'Get top performing staff by sales';
COMMENT ON FUNCTION get_hourly_guest_entries IS 'Get guest entries by hour';
COMMENT ON FUNCTION get_hourly_drinks_sold IS 'Get drinks sold by hour';
COMMENT ON FUNCTION get_active_vip_tables IS 'Count active VIP tables (reserved or occupied)';
COMMENT ON FUNCTION get_current_crowd_size IS 'Get current crowd size and capacity';
