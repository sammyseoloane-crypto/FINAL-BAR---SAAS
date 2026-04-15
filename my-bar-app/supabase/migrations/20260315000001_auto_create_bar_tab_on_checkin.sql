-- ============================================================
-- AUTO-CREATE BAR TAB ON VIP TABLE CHECK-IN
-- Migration: 20260315000001_auto_create_bar_tab_on_checkin.sql
-- Date: 2026-03-15
-- Description: Automatically create a bar tab when VIP reservation is checked in
-- ============================================================

-- ============================================================
-- STEP 1: Add bar_tab_id to transactions table
-- Link transactions to bar tabs for table service tracking
-- ============================================================

-- Add bar_tab_id foreign key to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS bar_tab_id UUID REFERENCES bar_tabs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_bar_tab_id ON transactions(bar_tab_id);

COMMENT ON COLUMN transactions.bar_tab_id IS 'Links transaction to a bar tab for VIP table service';

-- ============================================================
-- STEP 2: Add tab_type to bar_tabs
-- Distinguish between different types of tabs
-- ============================================================

ALTER TABLE bar_tabs
ADD COLUMN IF NOT EXISTS tab_type VARCHAR(50) DEFAULT 'regular';

-- Add constraint for tab_type
ALTER TABLE bar_tabs 
DROP CONSTRAINT IF EXISTS bar_tabs_tab_type_check;

ALTER TABLE bar_tabs
ADD CONSTRAINT bar_tabs_tab_type_check 
CHECK (tab_type IN ('regular', 'vip_table', 'event', 'bar', 'bottle_service'));

CREATE INDEX IF NOT EXISTS idx_bar_tabs_tab_type ON bar_tabs(tab_type);

COMMENT ON COLUMN bar_tabs.tab_type IS 'Type of tab: regular, vip_table, event, bar, bottle_service';

-- Add table_reservation_id for linking tabs to reservations
ALTER TABLE bar_tabs
ADD COLUMN IF NOT EXISTS table_reservation_id UUID REFERENCES table_reservations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bar_tabs_reservation_id ON bar_tabs(table_reservation_id);

-- ============================================================
-- STEP 3: Create trigger function to auto-create bar tab on check-in
-- ============================================================

CREATE OR REPLACE FUNCTION auto_create_bar_tab_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tab_number VARCHAR(50);
  v_table_name VARCHAR(255);
  v_minimum_spend DECIMAL(10, 2);
BEGIN
  -- Only create tab when status changes to 'checked_in'
  IF NEW.status = 'checked_in' AND (OLD.status IS NULL OR OLD.status != 'checked_in') THEN
    
    -- Get table name for tab number
    SELECT name INTO v_table_name
    FROM tables
    WHERE id = NEW.table_id;
    
    -- Get minimum spend from reservation
    v_minimum_spend := COALESCE(NEW.minimum_spend, 0);
    
    -- Generate unique tab number
    v_tab_number := 'VIP-' || UPPER(SUBSTRING(NEW.table_id::text, 1, 8)) || '-' || TO_CHAR(NOW(), 'YYMMDD-HH24MI');
    
    -- Create the bar tab
    INSERT INTO bar_tabs (
      tenant_id,
      user_id,
      location_id,
      table_id,
      event_id,
      tab_number,
      tab_name,
      tab_type,
      table_reservation_id,
      status,
      opened_at,
      opened_by,
      credit_limit,
      warning_threshold,
      metadata
    ) VALUES (
      NEW.tenant_id,
      NEW.user_id,
      NEW.location_id,
      NEW.table_id,
      NEW.event_id,
      v_tab_number,
      'VIP Table - ' || COALESCE(v_table_name, 'Table ' || NEW.table_id::text),
      'vip_table',
      NEW.id,
      'open',
      NEW.checked_in_at,
      NEW.checked_in_by,
      v_minimum_spend * 2, -- Credit limit = 2x minimum spend
      v_minimum_spend * 1.5, -- Warning at 1.5x minimum
      jsonb_build_object(
        'reservation_id', NEW.id,
        'guest_count', NEW.guest_count,
        'minimum_spend', v_minimum_spend,
        'special_requests', NEW.special_requests,
        'auto_created', true,
        'created_at', NOW()
      )
    );
    
    -- Update reservation metadata to include tab creation info
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'bar_tab_created', true,
        'bar_tab_number', v_tab_number,
        'bar_tab_created_at', NOW()
      );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 4: Create the trigger
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auto_create_bar_tab_on_checkin ON table_reservations;

CREATE TRIGGER trigger_auto_create_bar_tab_on_checkin
  BEFORE UPDATE ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_bar_tab_on_checkin();

COMMENT ON FUNCTION auto_create_bar_tab_on_checkin IS 
'Automatically creates a bar tab when a VIP table reservation is checked in';

-- ============================================================
-- STEP 5: Create helper function to get active table tab
-- ============================================================

CREATE OR REPLACE FUNCTION get_active_table_tab(p_table_id UUID)
RETURNS TABLE (
  tab_id UUID,
  tab_number VARCHAR,
  tab_name VARCHAR,
  customer_name VARCHAR,
  guest_count INTEGER,
  minimum_spend DECIMAL,
  current_spend DECIMAL,
  remaining_spend DECIMAL,
  opened_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id as tab_id,
    bt.tab_number,
    bt.tab_name,
    p.full_name as customer_name,
    tr.guest_count,
    tr.minimum_spend,
    bt.total_amount as current_spend,
    GREATEST(0, tr.minimum_spend - bt.total_amount) as remaining_spend,
    bt.opened_at,
    bt.status
  FROM bar_tabs bt
  LEFT JOIN profiles p ON bt.user_id = p.id
  LEFT JOIN table_reservations tr ON bt.table_reservation_id = tr.id
  WHERE bt.table_id = p_table_id
    AND bt.status = 'open'
    AND bt.tab_type = 'vip_table'
  ORDER BY bt.opened_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_table_tab(UUID) TO authenticated;

COMMENT ON FUNCTION get_active_table_tab IS 
'Get the currently active bar tab for a specific VIP table';

-- ============================================================
-- STEP 6: Create function to add item to table tab
-- ============================================================

CREATE OR REPLACE FUNCTION add_item_to_table_tab(
  p_bar_tab_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_price DECIMAL,
  p_added_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_tenant_id UUID;
  v_total_price DECIMAL;
BEGIN
  -- Get tenant_id from bar tab
  SELECT tenant_id INTO v_tenant_id
  FROM bar_tabs
  WHERE id = p_bar_tab_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Bar tab not found';
  END IF;
  
  -- Calculate total
  v_total_price := p_unit_price * p_quantity;
  
  -- Create transaction for this item
  INSERT INTO transactions (
    tenant_id,
    user_id,
    product_id,
    amount,
    status,
    payment_method,
    bar_tab_id,
    confirmed_by,
    confirmed_at,
    metadata
  ) VALUES (
    v_tenant_id,
    p_added_by,
    p_product_id,
    v_total_price,
    'pending', -- Pending until tab is closed
    'bar_tab',
    p_bar_tab_id,
    p_added_by,
    NOW(),
    jsonb_build_object(
      'quantity', p_quantity,
      'unit_price', p_unit_price,
      'notes', p_notes,
      'added_to_tab_at', NOW()
    )
  )
  RETURNING id INTO v_transaction_id;
  
  -- Update bar tab total
  UPDATE bar_tabs
  SET 
    total_amount = total_amount + v_total_price,
    balance_due = balance_due + v_total_price,
    item_count = item_count + 1,
    last_activity_at = NOW(),
    updated_at = NOW()
  WHERE id = p_bar_tab_id;
  
  RETURN v_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION add_item_to_table_tab(UUID, UUID, INTEGER, DECIMAL, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION add_item_to_table_tab IS 
'Add a drink/item to a VIP table tab and update totals';

-- ============================================================
-- STEP 7: Update RLS policies for bar_tabs
-- ============================================================

-- Drop existing policy
DROP POLICY IF EXISTS "VIP hosts can manage table tabs" ON bar_tabs;

-- Allow VIP hosts and staff to manage table tabs
CREATE POLICY "VIP hosts can manage table tabs" ON bar_tabs
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager', 'staff', 'vip_host')
    )
  );

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- View all active VIP table tabs
CREATE OR REPLACE VIEW active_vip_table_tabs AS
SELECT 
  bt.id as tab_id,
  bt.tab_number,
  bt.tab_name,
  t.name as table_name,
  p.full_name as guest_name,
  p.email as guest_email,
  tr.guest_count,
  tr.minimum_spend,
  bt.total_amount as current_spend,
  GREATEST(0, tr.minimum_spend - bt.total_amount) as remaining_minimum,
  bt.item_count,
  bt.opened_at,
  EXTRACT(EPOCH FROM (NOW() - bt.opened_at))/60 as minutes_open,
  bt.status
FROM bar_tabs bt
INNER JOIN tables t ON bt.table_id = t.id
LEFT JOIN profiles p ON bt.user_id = p.id
LEFT JOIN table_reservations tr ON bt.table_reservation_id = tr.id
WHERE bt.status = 'open'
  AND bt.tab_type = 'vip_table'
ORDER BY bt.opened_at DESC;

-- Add comment after view is created
COMMENT ON VIEW active_vip_table_tabs IS 'Shows all currently open VIP table tabs';

-- Grant access to the view
GRANT SELECT ON active_vip_table_tabs TO authenticated;
