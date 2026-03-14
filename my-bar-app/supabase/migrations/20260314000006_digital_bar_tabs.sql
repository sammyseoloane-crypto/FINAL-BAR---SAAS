-- ============================================================
-- DIGITAL BAR TABS SYSTEM
-- ============================================================
-- Migration: 20260314000006_digital_bar_tabs.sql
-- Description: QR code-based digital bar tab system with Stripe payments
-- Created: 2026-03-14
-- ============================================================

-- ============================================================
-- TABS TABLE
-- Main bar tab records
-- ============================================================
CREATE TABLE IF NOT EXISTS tabs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  
  -- Customer information
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(255),
  
  -- Tab status
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled', 'payment_pending')),
  
  -- Financial totals
  subtotal DECIMAL(10, 2) DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount DECIMAL(10, 2) DEFAULT 0 CHECK (tax_amount >= 0),
  tip_amount DECIMAL(10, 2) DEFAULT 0 CHECK (tip_amount >= 0),
  total DECIMAL(10, 2) DEFAULT 0 CHECK (total >= 0),
  
  -- Payment information
  payment_method VARCHAR(50), -- 'stripe', 'cash', 'card', 'transfer'
  payment_intent_id VARCHAR(255), -- Stripe PaymentIntent ID
  payment_status VARCHAR(50), -- 'pending', 'succeeded', 'failed', 'cancelled'
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Staff tracking
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  served_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Primary bartender
  
  -- Timestamps
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Session tracking
  session_id VARCHAR(255), -- For anonymous customer tracking
  qr_code_id UUID, -- Link to QR code used to open tab
  
  -- Metadata
  notes TEXT,
  special_requests TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tabs_tenant_id ON tabs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tabs_table_id ON tabs(table_id);
CREATE INDEX IF NOT EXISTS idx_tabs_status ON tabs(status);
CREATE INDEX IF NOT EXISTS idx_tabs_customer_phone ON tabs(customer_phone);
CREATE INDEX IF NOT EXISTS idx_tabs_opened_at ON tabs(opened_at);
CREATE INDEX IF NOT EXISTS idx_tabs_payment_intent_id ON tabs(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_tabs_served_by ON tabs(served_by);

COMMENT ON TABLE tabs IS 'Digital bar tabs opened via QR codes';

-- ============================================================
-- TAB_ITEMS TABLE
-- Line items on each bar tab
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Product details (snapshot at time of order)
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  drink_name VARCHAR(255) NOT NULL,
  drink_category VARCHAR(100), -- 'beer', 'wine', 'spirits', 'cocktails', 'food', 'non-alcoholic'
  
  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
  
  -- Modifiers/customization
  modifiers JSONB DEFAULT '[]', -- ['extra shot', 'no ice', 'lime']
  special_instructions TEXT,
  
  -- Staff tracking
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'ordered' CHECK (status IN ('ordered', 'preparing', 'served', 'removed', 'cancelled')),
  
  -- Timestamps
  added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  served_at TIMESTAMP WITH TIME ZONE,
  removed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tab_items_tab_id ON tab_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_tab_items_tenant_id ON tab_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tab_items_product_id ON tab_items(product_id);
CREATE INDEX IF NOT EXISTS idx_tab_items_status ON tab_items(status);
CREATE INDEX IF NOT EXISTS idx_tab_items_added_at ON tab_items(added_at);

COMMENT ON TABLE tab_items IS 'Individual items ordered on bar tabs';

-- ============================================================
-- FUNCTIONS FOR TAB MANAGEMENT
-- ============================================================

-- Function: Calculate tab total
CREATE OR REPLACE FUNCTION calculate_tab_total(p_tab_id UUID)
RETURNS TABLE (
  subtotal DECIMAL,
  item_count INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(ti.total_price), 0) as subtotal,
    COUNT(*)::INTEGER as item_count
  FROM tab_items ti
  WHERE ti.tab_id = p_tab_id
    AND ti.status NOT IN ('removed', 'cancelled');
END;
$$;

-- Function: Get open tabs for tenant
CREATE OR REPLACE FUNCTION get_open_tabs(p_tenant_id UUID)
RETURNS TABLE (
  tab_id UUID,
  customer_name VARCHAR,
  table_name VARCHAR,
  item_count BIGINT,
  tab_total DECIMAL,
  opened_at TIMESTAMP WITH TIME ZONE,
  minutes_open INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tab_id,
    t.customer_name,
    tb.name as table_name,
    COUNT(ti.id) as item_count,
    COALESCE(SUM(ti.total_price), 0) as tab_total,
    t.opened_at,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at))::INTEGER / 60 as minutes_open
  FROM tabs t
  LEFT JOIN tables tb ON t.table_id = tb.id
  LEFT JOIN tab_items ti ON t.id = ti.tab_id AND ti.status NOT IN ('removed', 'cancelled')
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'open'
  GROUP BY t.id, t.customer_name, tb.name, t.opened_at
  ORDER BY t.opened_at DESC;
END;
$$;

-- Function: Get tab details with items
CREATE OR REPLACE FUNCTION get_tab_details(p_tab_id UUID)
RETURNS TABLE (
  tab_id UUID,
  customer_name VARCHAR,
  customer_phone VARCHAR,
  table_name VARCHAR,
  status VARCHAR,
  opened_at TIMESTAMP WITH TIME ZONE,
  total DECIMAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tab_id,
    t.customer_name,
    t.customer_phone,
    tb.name as table_name,
    t.status,
    t.opened_at,
    t.total
  FROM tabs t
  LEFT JOIN tables tb ON t.table_id = tb.id
  WHERE t.id = p_tab_id;
END;
$$;

-- Function: Get customer's active tab by phone
CREATE OR REPLACE FUNCTION get_customer_tab_by_phone(p_tenant_id UUID, p_phone VARCHAR)
RETURNS TABLE (
  tab_id UUID,
  customer_name VARCHAR,
  table_name VARCHAR,
  status VARCHAR,
  total DECIMAL,
  opened_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tab_id,
    t.customer_name,
    tb.name as table_name,
    t.status,
    t.total,
    t.opened_at
  FROM tabs t
  LEFT JOIN tables tb ON t.table_id = tb.id
  WHERE t.tenant_id = p_tenant_id
    AND t.customer_phone = p_phone
    AND t.status = 'open'
  ORDER BY t.opened_at DESC
  LIMIT 1;
END;
$$;

-- ============================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================================

-- Trigger: Auto-update tab total when items change
CREATE OR REPLACE FUNCTION update_tab_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_subtotal DECIMAL;
  new_tax DECIMAL;
  new_total DECIMAL;
  tax_rate DECIMAL := 0.15; -- 15% tax rate (adjust as needed)
BEGIN
  -- Calculate new subtotal from all non-removed items
  SELECT COALESCE(SUM(total_price), 0)
  INTO new_subtotal
  FROM tab_items
  WHERE tab_id = COALESCE(NEW.tab_id, OLD.tab_id)
    AND status NOT IN ('removed', 'cancelled');
  
  -- Calculate tax
  new_tax := new_subtotal * tax_rate;
  
  -- Calculate total (subtotal + tax + tip)
  SELECT new_subtotal + new_tax + COALESCE(tip_amount, 0)
  INTO new_total
  FROM tabs
  WHERE id = COALESCE(NEW.tab_id, OLD.tab_id);
  
  -- Update tab
  UPDATE tabs
  SET 
    subtotal = new_subtotal,
    tax_amount = new_tax,
    total = new_total,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = COALESCE(NEW.tab_id, OLD.tab_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_tab_total_on_item_insert ON tab_items;
CREATE TRIGGER trigger_update_tab_total_on_item_insert
  AFTER INSERT ON tab_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_total();

DROP TRIGGER IF EXISTS trigger_update_tab_total_on_item_update ON tab_items;
CREATE TRIGGER trigger_update_tab_total_on_item_update
  AFTER UPDATE ON tab_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_total();

DROP TRIGGER IF EXISTS trigger_update_tab_total_on_item_delete ON tab_items;
CREATE TRIGGER trigger_update_tab_total_on_item_delete
  AFTER DELETE ON tab_items
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_total();

-- Trigger: Update tabs.updated_at timestamp
CREATE OR REPLACE FUNCTION update_tabs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_tabs_updated_at ON tabs;
CREATE TRIGGER trigger_tabs_updated_at
  BEFORE UPDATE ON tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_tabs_updated_at();

-- Trigger: Record to drinks_sold when tab is closed
CREATE OR REPLACE FUNCTION record_drinks_sold_from_tab()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only record when tab closes
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    -- Insert all tab items into drinks_sold for analytics
    INSERT INTO drinks_sold (
      tenant_id,
      product_id,
      drink_name,
      category,
      quantity,
      unit_price,
      total_price,
      transaction_id,
      served_by,
      table_id,
      timestamp,
      shift_date
    )
    SELECT 
      ti.tenant_id,
      ti.product_id,
      ti.drink_name,
      ti.drink_category,
      ti.quantity,
      ti.unit_price,
      ti.total_price,
      NULL, -- No transaction_id yet (will be set when payment processed)
      ti.added_by,
      NEW.table_id,
      ti.added_at,
      DATE(ti.added_at)
    FROM tab_items ti
    WHERE ti.tab_id = NEW.id
      AND ti.status NOT IN ('removed', 'cancelled');
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_record_drinks_sold_from_tab ON tabs;
CREATE TRIGGER trigger_record_drinks_sold_from_tab
  AFTER UPDATE ON tabs
  FOR EACH ROW
  EXECUTE FUNCTION record_drinks_sold_from_tab();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tab_items ENABLE ROW LEVEL SECURITY;

-- Policies for tabs
DROP POLICY IF EXISTS tabs_tenant_isolation ON tabs;
CREATE POLICY tabs_tenant_isolation ON tabs
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Policy: Customers can view their own tabs by phone
DROP POLICY IF EXISTS tabs_customer_view_own ON tabs;
CREATE POLICY tabs_customer_view_own ON tabs
  FOR SELECT
  USING (
    customer_phone IN (
      SELECT phone FROM profiles WHERE id = auth.uid()
    )
    OR tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policies for tab_items
DROP POLICY IF EXISTS tab_items_tenant_isolation ON tab_items;
CREATE POLICY tab_items_tenant_isolation ON tab_items
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Policy: View items from own tabs
DROP POLICY IF EXISTS tab_items_view_from_own_tabs ON tab_items;
CREATE POLICY tab_items_view_from_own_tabs ON tab_items
  FOR SELECT
  USING (
    tab_id IN (
      SELECT id FROM tabs 
      WHERE customer_phone IN (
        SELECT phone FROM profiles WHERE id = auth.uid()
      )
    )
    OR tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================================

DO $$
BEGIN
  -- Add tabs table to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tabs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tabs;
  END IF;
  
  -- Add tab_items table to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tab_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tab_items;
  END IF;
END $$;

-- ============================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================

COMMENT ON FUNCTION calculate_tab_total IS 'Calculate subtotal and item count for a tab';
COMMENT ON FUNCTION get_open_tabs IS 'Get all open tabs for a tenant with summary info';
COMMENT ON FUNCTION get_tab_details IS 'Get detailed information about a specific tab';
COMMENT ON FUNCTION get_customer_tab_by_phone IS 'Find customer active tab by phone number';
COMMENT ON COLUMN tabs.session_id IS 'Anonymous session tracking for customers without accounts';
COMMENT ON COLUMN tabs.payment_intent_id IS 'Stripe PaymentIntent ID for tracking payments';
COMMENT ON COLUMN tab_items.modifiers IS 'JSON array of drink modifiers like ["extra shot", "no ice"]';
