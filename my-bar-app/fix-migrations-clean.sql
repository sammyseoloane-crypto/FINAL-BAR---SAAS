-- ============================================================
-- COMPLETE MIGRATION BUNDLE - CLEAN VERSION
-- Fixes: QR Code Scanning + Club Dashboard
-- ============================================================
-- 
-- WHAT THIS FIXES:
-- ✓ QR Code Scanning Error - "Table not found or inactive"
-- ✓ Club Dashboard 400 Errors - Missing functions
-- ✓ All dashboard metrics now load correctly
-- ✓ Creates missing tables: drinks_sold, staff_sales, crowd_tracking
-- ✓ Creates all 11 required functions
--
-- INSTRUCTIONS:
-- 1. Go to: https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click "SQL Editor" in sidebar
-- 4. Click "New Query"
-- 5. Copy this ENTIRE file and paste it
-- 6. Click "Run" or press Ctrl+Enter
-- 7. Refresh your browser after completion
--
-- Expected time: 1-2 minutes
-- ============================================================

-- ============================================================
-- PART 1: PERMANENT QR CODES FOR BAR TABS
-- ============================================================

-- Add QR token column to tables
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(20) UNIQUE;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_tables_qr_token ON tables(qr_token) WHERE qr_token IS NOT NULL;

-- Function to generate unique QR token
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS VARCHAR(20) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  token_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM tables WHERE qr_token = result) INTO token_exists;
    IF NOT token_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate QR token for new tables
CREATE OR REPLACE FUNCTION auto_generate_table_qr_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := generate_qr_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate QR tokens
DROP TRIGGER IF EXISTS trigger_auto_generate_table_qr_token ON tables;
CREATE TRIGGER trigger_auto_generate_table_qr_token
  BEFORE INSERT ON tables
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_table_qr_token();

-- Function to get table by QR token
CREATE OR REPLACE FUNCTION get_table_by_qr_token(p_token VARCHAR)
RETURNS TABLE (
  table_id UUID,
  table_name VARCHAR,
  tenant_id UUID,
  tenant_name VARCHAR,
  location_id UUID,
  capacity INTEGER,
  table_type VARCHAR,
  minimum_spend DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id, t.name, t.tenant_id, tn.name, t.location_id, 
    t.capacity, t.table_type, t.minimum_spend
  FROM tables t
  LEFT JOIN tenants tn ON t.tenant_id = tn.id
  WHERE t.qr_token = p_token AND t.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to regenerate QR token for a table
CREATE OR REPLACE FUNCTION regenerate_table_qr_token(p_table_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  new_token VARCHAR(20);
BEGIN
  new_token := generate_qr_token();
  UPDATE tables SET qr_token = new_token, updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_table_id;
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Generate QR tokens for existing tables
UPDATE tables SET qr_token = generate_qr_token() WHERE qr_token IS NULL;

-- ============================================================
-- PART 2: CLUB DASHBOARD TABLES
-- ============================================================

-- Table: drinks_sold
CREATE TABLE IF NOT EXISTS drinks_sold (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  drink_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2),
  total_price DECIMAL(10, 2),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  served_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  shift_date DATE DEFAULT CURRENT_DATE,
  hour_of_day INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM (timestamp AT TIME ZONE 'UTC'))) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_drinks_sold_tenant_id ON drinks_sold(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drinks_sold_timestamp ON drinks_sold(timestamp);
CREATE INDEX IF NOT EXISTS idx_drinks_sold_shift_date ON drinks_sold(shift_date);
CREATE INDEX IF NOT EXISTS idx_drinks_sold_drink_name ON drinks_sold(drink_name);
CREATE INDEX IF NOT EXISTS idx_drinks_sold_hour_of_day ON drinks_sold(hour_of_day);

-- Table: staff_sales
CREATE TABLE IF NOT EXISTS staff_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
  drinks_sold INTEGER DEFAULT 0,
  tables_served INTEGER DEFAULT 0,
  tips_earned DECIMAL(10, 2) DEFAULT 0,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_staff_sales_tenant_id ON staff_sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_sales_staff_id ON staff_sales(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_sales_shift_date ON staff_sales(shift_date);

-- Table: crowd_tracking
CREATE TABLE IF NOT EXISTS crowd_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  current_capacity INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER NOT NULL,
  occupancy_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN max_capacity > 0 THEN (current_capacity::DECIMAL / max_capacity * 100)
      ELSE 0 
    END
  ) STORED,
  entries_count INTEGER DEFAULT 0,
  exits_count INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  recorded_date DATE DEFAULT CURRENT_DATE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_crowd_tracking_tenant_id ON crowd_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crowd_tracking_timestamp ON crowd_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_crowd_tracking_recorded_date ON crowd_tracking(recorded_date);

-- ============================================================
-- PART 3: CLUB DASHBOARD FUNCTIONS
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
    COALESCE(SUM(t.amount), 0), 
    COUNT(*)::INTEGER, 
    COALESCE(AVG(t.amount), 0)
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id 
    AND t.status = 'confirmed' 
    AND DATE(t.created_at) = CURRENT_DATE;
END;
$$;

-- Function: Get hourly revenue
DROP FUNCTION IF EXISTS get_hourly_revenue(UUID, DATE);
CREATE OR REPLACE FUNCTION get_hourly_revenue(p_tenant_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (hour INTEGER, revenue DECIMAL, transaction_count INTEGER) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM t.created_at)::INTEGER, 
    COALESCE(SUM(t.amount), 0), 
    COUNT(*)::INTEGER
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id 
    AND t.status = 'confirmed' 
    AND DATE(t.created_at) = p_date
  GROUP BY EXTRACT(HOUR FROM t.created_at)
  ORDER BY 1;
END;
$$;

-- Function: Get top selling drinks
DROP FUNCTION IF EXISTS get_top_selling_drinks(UUID, DATE, INTEGER);
CREATE OR REPLACE FUNCTION get_top_selling_drinks(
  p_tenant_id UUID, 
  p_date DATE DEFAULT CURRENT_DATE, 
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (drink_name VARCHAR, total_quantity INTEGER, total_revenue DECIMAL, avg_price DECIMAL) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.drink_name::VARCHAR, 
    SUM(ds.quantity)::INTEGER, 
    COALESCE(SUM(ds.total_price), 0), 
    COALESCE(AVG(ds.unit_price), 0)
  FROM drinks_sold ds
  WHERE ds.tenant_id = p_tenant_id AND ds.shift_date = p_date
  GROUP BY ds.drink_name
  ORDER BY 2 DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get active VIP tables
DROP FUNCTION IF EXISTS get_active_vip_tables(UUID);
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

-- Function: Get top staff performers
DROP FUNCTION IF EXISTS get_top_staff_performers(UUID, DATE, INTEGER);
CREATE OR REPLACE FUNCTION get_top_staff_performers(
  p_tenant_id UUID, 
  p_date DATE DEFAULT CURRENT_DATE, 
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (staff_id UUID, staff_name VARCHAR, total_sales DECIMAL, drinks_sold INTEGER, tables_served INTEGER) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.staff_id, 
    COALESCE(p.full_name, p.email)::VARCHAR, 
    ss.total_sales, 
    ss.drinks_sold, 
    ss.tables_served
  FROM staff_sales ss
  LEFT JOIN profiles p ON ss.staff_id = p.id
  WHERE ss.tenant_id = p_tenant_id AND ss.shift_date = p_date
  ORDER BY ss.total_sales DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get hourly drinks sold
DROP FUNCTION IF EXISTS get_hourly_drinks_sold(UUID, DATE);
CREATE OR REPLACE FUNCTION get_hourly_drinks_sold(p_tenant_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (hour INTEGER, drinks_count INTEGER, revenue DECIMAL) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.hour_of_day, 
    SUM(ds.quantity)::INTEGER, 
    COALESCE(SUM(ds.total_price), 0)
  FROM drinks_sold ds
  WHERE ds.tenant_id = p_tenant_id AND ds.shift_date = p_date
  GROUP BY ds.hour_of_day
  ORDER BY 1;
END;
$$;

-- Function: Get hourly guest entries
DROP FUNCTION IF EXISTS get_hourly_guest_entries(UUID, DATE);
CREATE OR REPLACE FUNCTION get_hourly_guest_entries(p_tenant_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (hour INTEGER, entry_count INTEGER, checked_in_count INTEGER) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM ge.created_at)::INTEGER, 
    COUNT(*)::INTEGER, 
    COUNT(*) FILTER (WHERE ge.checked_in = TRUE)::INTEGER
  FROM guest_list_entries ge
  WHERE ge.tenant_id = p_tenant_id AND DATE(ge.created_at) = p_date
  GROUP BY EXTRACT(HOUR FROM ge.created_at)
  ORDER BY 1;
END;
$$;

-- Function: Get current crowd size
DROP FUNCTION IF EXISTS get_current_crowd_size(UUID);
CREATE OR REPLACE FUNCTION get_current_crowd_size(p_tenant_id UUID)
RETURNS TABLE (current_capacity INTEGER, max_capacity INTEGER, occupancy_rate DECIMAL, last_updated TIMESTAMP WITH TIME ZONE) 
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT ct.current_capacity, ct.max_capacity, ct.occupancy_rate, ct.timestamp
  FROM crowd_tracking ct
  WHERE ct.tenant_id = p_tenant_id AND ct.recorded_date = CURRENT_DATE
  ORDER BY ct.timestamp DESC
  LIMIT 1;
END;
$$;

-- ============================================================
-- PART 4: RLS POLICIES
-- ============================================================

ALTER TABLE drinks_sold ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE crowd_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drinks_sold_tenant_isolation ON drinks_sold;
CREATE POLICY drinks_sold_tenant_isolation ON drinks_sold FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS staff_sales_tenant_isolation ON staff_sales;
CREATE POLICY staff_sales_tenant_isolation ON staff_sales FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS staff_sales_view_own ON staff_sales;
CREATE POLICY staff_sales_view_own ON staff_sales FOR SELECT
USING (staff_id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS crowd_tracking_tenant_isolation ON crowd_tracking;
CREATE POLICY crowd_tracking_tenant_isolation ON crowd_tracking FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION generate_qr_token() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_by_qr_token(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_table_qr_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tonight_revenue_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_revenue(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_selling_drinks(UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_vip_tables(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_staff_performers(UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_drinks_sold(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_guest_entries(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_crowd_size(UUID) TO authenticated ;

-- ============================================================
-- PART 6: VERIFICATION
-- ============================================================

SELECT COUNT(*) as total_tables, COUNT(qr_token) as tables_with_qr_codes
FROM tables;

SELECT table_name, 'CREATED ✓' as status
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('drinks_sold', 'staff_sales', 'crowd_tracking')
ORDER BY table_name;

SELECT routine_name, 'CREATED ✓' as status
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name IN (
  'generate_qr_token', 'get_table_by_qr_token', 'regenerate_table_qr_token',
  'get_tonight_revenue_stats', 'get_hourly_revenue', 'get_top_selling_drinks',
  'get_active_vip_tables', 'get_top_staff_performers', 'get_hourly_drinks_sold',
  'get_hourly_guest_entries', 'get_current_crowd_size'
)
ORDER BY routine_name;

SELECT id, name, qr_token, 
  'https://your-app.netlify.app/tab/start/' || qr_token as qr_url
FROM tables WHERE qr_token IS NOT NULL LIMIT 5;

-- ============================================================
-- ✅ MIGRATION COMPLETE!
-- ============================================================
-- 
-- WHAT GOT FIXED:
-- ✓ QR code scanning works (no "Table not found" error)
-- ✓ Club Dashboard loads (no 400 errors)
-- ✓ 3 tables created: drinks_sold, staff_sales, crowd_tracking
-- ✓ 11 functions created
-- ✓ RLS policies configured
-- ✓ Permissions granted
--
-- WHY SOME METRICS STILL SHOW 0:
-- - Tables are created but EMPTY
-- - They populate as data is added by staff/customers
--
-- NEXT STEPS:
-- 1. Refresh browser (Ctrl+Shift+R)
-- 2. Test /tab/start/[TOKEN]
-- 3. Test /owner/club-dashboard
-- 4. NO MORE 400 ERRORS!
-- ============================================================
