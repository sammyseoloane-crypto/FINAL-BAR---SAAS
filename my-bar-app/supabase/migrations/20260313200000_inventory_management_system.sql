-- ============================================================
-- INVENTORY MANAGEMENT SYSTEM
-- Comprehensive stock tracking, suppliers, and purchase orders
-- Created: 2026-03-13
-- ============================================================

-- ============================================================
-- 1. SUPPLIERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_number VARCHAR(100),
  payment_terms VARCHAR(100), -- 'net_30', 'net_60', 'cash_on_delivery'
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX idx_suppliers_is_active ON suppliers(is_active);

-- ============================================================
-- 2. INVENTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  current_stock DECIMAL(10, 2) DEFAULT 0 CHECK (current_stock >= 0),
  minimum_stock DECIMAL(10, 2) DEFAULT 0 CHECK (minimum_stock >= 0),
  maximum_stock DECIMAL(10, 2),
  reorder_point DECIMAL(10, 2), -- When to automatically reorder
  reorder_quantity DECIMAL(10, 2), -- How much to reorder
  unit_of_measure VARCHAR(50) DEFAULT 'units', -- 'units', 'liters', 'kg', 'cases'
  cost_per_unit DECIMAL(10, 2), -- Purchase cost
  last_restocked_at TIMESTAMP WITH TIME ZONE,
  last_restocked_by UUID REFERENCES auth.users(id),
  low_stock_alert_sent BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, product_id, location_id)
);

CREATE INDEX idx_inventory_tenant_id ON inventory(tenant_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_location_id ON inventory(location_id);
CREATE INDEX idx_inventory_low_stock ON inventory(current_stock, minimum_stock) WHERE current_stock <= minimum_stock;

-- ============================================================
-- 3. PURCHASE ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  po_number VARCHAR(100) NOT NULL, -- Unique purchase order number
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  subtotal DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'ZAR',
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  received_by UUID REFERENCES auth.users(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, po_number)
);

CREATE INDEX idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date DESC);

-- ============================================================
-- 4. PURCHASE ORDER ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_ordered DECIMAL(10, 2) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received DECIMAL(10, 2) DEFAULT 0 CHECK (quantity_received >= 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(15, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  unit_of_measure VARCHAR(50) DEFAULT 'units',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_po_items_purchase_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_product_id ON purchase_order_items(product_id);

-- ============================================================
-- 5. STOCK MOVEMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('sale', 'restock', 'adjustment', 'transfer', 'waste', 'return', 'initial')),
  quantity DECIMAL(10, 2) NOT NULL, -- Positive for additions, negative for reductions
  previous_stock DECIMAL(10, 2),
  new_stock DECIMAL(10, 2),
  unit_of_measure VARCHAR(50) DEFAULT 'units',
  reference_type VARCHAR(100), -- 'transaction', 'purchase_order', 'manual_adjustment'
  reference_id UUID, -- ID of related transaction/PO
  performed_by UUID REFERENCES auth.users(id),
  reason TEXT, -- Explanation for adjustment/waste
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_stock_movements_tenant_id ON stock_movements(tenant_id);
CREATE INDEX idx_stock_movements_inventory_id ON stock_movements(inventory_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Suppliers Policies
CREATE POLICY "Tenant users can view suppliers"
  ON suppliers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = suppliers.tenant_id
    )
  );

CREATE POLICY "Owners and admins can manage suppliers"
  ON suppliers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = suppliers.tenant_id
    )
  );

-- Inventory Policies
CREATE POLICY "Tenant users can view inventory"
  ON inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = inventory.tenant_id
    )
  );

CREATE POLICY "Owners, admins, and staff can manage inventory"
  ON inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin', 'staff') AND u.tenant_id = inventory.tenant_id
    )
  );

-- Purchase Orders Policies
CREATE POLICY "Tenant users can view purchase orders"
  ON purchase_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = purchase_orders.tenant_id
    )
  );

CREATE POLICY "Owners and admins can manage purchase orders"
  ON purchase_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = purchase_orders.tenant_id
    )
  );

-- Purchase Order Items Policies
CREATE POLICY "Users can view PO items for accessible POs"
  ON purchase_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      INNER JOIN get_user_tenant_and_role() AS u ON u.tenant_id = po.tenant_id
      WHERE po.id = purchase_order_items.purchase_order_id
    )
  );

CREATE POLICY "Owners and admins can manage PO items"
  ON purchase_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      INNER JOIN get_user_tenant_and_role() AS u ON u.role IN ('owner', 'admin') AND u.tenant_id = po.tenant_id
      WHERE po.id = purchase_order_items.purchase_order_id
    )
  );

-- Stock Movements Policies
CREATE POLICY "Tenant users can view stock movements"
  ON stock_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = stock_movements.tenant_id
    )
  );

CREATE POLICY "System can insert stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners and admins can manage stock movements"
  ON stock_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = stock_movements.tenant_id
    )
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to reduce stock when product is sold
CREATE OR REPLACE FUNCTION reduce_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_inventory_id UUID;
  v_product_id UUID;
  v_location_id UUID;
  v_previous_stock DECIMAL(10, 2);
  v_new_stock DECIMAL(10, 2);
  v_quantity DECIMAL(10, 2) := 1; -- Default quantity
BEGIN
  -- Only process confirmed transactions
  IF NEW.status = 'confirmed' AND NEW.product_id IS NOT NULL THEN
    v_product_id := NEW.product_id;
    
    -- Get quantity from metadata if available
    IF NEW.metadata ? 'quantity' THEN
      v_quantity := (NEW.metadata->>'quantity')::DECIMAL;
    END IF;
    
    -- Find inventory record (use first available location if not specified)
    SELECT id, location_id, current_stock INTO v_inventory_id, v_location_id, v_previous_stock
    FROM inventory
    WHERE tenant_id = NEW.tenant_id
      AND product_id = v_product_id
    LIMIT 1;
    
    IF v_inventory_id IS NOT NULL THEN
      -- Update inventory
      UPDATE inventory
      SET current_stock = GREATEST(current_stock - v_quantity, 0),
          updated_at = NOW()
      WHERE id = v_inventory_id
      RETURNING current_stock INTO v_new_stock;
      
      -- Log stock movement
      INSERT INTO stock_movements (
        tenant_id,
        inventory_id,
        product_id,
        location_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        reference_type,
        reference_id,
        performed_by,
        reason
      ) VALUES (
        NEW.tenant_id,
        v_inventory_id,
        v_product_id,
        v_location_id,
        'sale',
        -v_quantity,
        v_previous_stock,
        v_new_stock,
        'transaction',
        NEW.id,
        NEW.confirmed_by,
        'Automatic stock reduction from sale'
      );
      
      -- Check if low stock and send notification
      IF v_new_stock <= (SELECT minimum_stock FROM inventory WHERE id = v_inventory_id) THEN
        -- Notify owner/admin of low stock
        PERFORM create_notification(
          (SELECT id FROM profiles WHERE tenant_id = NEW.tenant_id AND role = 'owner' LIMIT 1),
          'low_inventory',
          'Low Stock Alert',
          'Product stock is low. Current: ' || v_new_stock || ' units',
          '/owner/inventory',
          'high',
          jsonb_build_object('product_id', v_product_id, 'current_stock', v_new_stock)
        );
        
        -- Mark alert as sent
        UPDATE inventory
        SET low_stock_alert_sent = TRUE
        WHERE id = v_inventory_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-reduce inventory on sale
CREATE TRIGGER trigger_reduce_inventory_on_sale
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION reduce_inventory_on_sale();

-- Function to update PO totals
CREATE OR REPLACE FUNCTION update_purchase_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
  v_subtotal DECIMAL(15, 2);
BEGIN
  v_po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  
  -- Calculate subtotal from line items
  SELECT SUM(line_total) INTO v_subtotal
  FROM purchase_order_items
  WHERE purchase_order_id = v_po_id;
  
  -- Update purchase order
  UPDATE purchase_orders
  SET 
    subtotal = COALESCE(v_subtotal, 0),
    total_amount = COALESCE(v_subtotal, 0) + COALESCE(tax_amount, 0),
    updated_at = NOW()
  WHERE id = v_po_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update PO totals when items change
CREATE TRIGGER trigger_update_po_totals_on_insert
  AFTER INSERT ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_purchase_order_totals();

CREATE TRIGGER trigger_update_po_totals_on_update
  AFTER UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_purchase_order_totals();

CREATE TRIGGER trigger_update_po_totals_on_delete
  AFTER DELETE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_purchase_order_totals();

-- Function to receive purchase order and update inventory
CREATE OR REPLACE FUNCTION receive_purchase_order(
  p_po_id UUID,
  p_received_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tenant_id UUID;
  v_location_id UUID;
  v_item RECORD;
  v_inventory_id UUID;
  v_previous_stock DECIMAL(10, 2);
BEGIN
  -- Get PO details
  SELECT tenant_id, location_id INTO v_tenant_id, v_location_id
  FROM purchase_orders
  WHERE id = p_po_id;
  
  -- Process each item
  FOR v_item IN 
    SELECT * FROM purchase_order_items WHERE purchase_order_id = p_po_id
  LOOP
    -- Find or create inventory record
    SELECT id, current_stock INTO v_inventory_id, v_previous_stock
    FROM inventory
    WHERE tenant_id = v_tenant_id
      AND product_id = v_item.product_id
      AND location_id = v_location_id;
    
    IF v_inventory_id IS NULL THEN
      -- Create new inventory record
      INSERT INTO inventory (
        tenant_id,
        product_id,
        location_id,
        current_stock,
        last_restocked_at,
        last_restocked_by
      ) VALUES (
        v_tenant_id,
        v_item.product_id,
        v_location_id,
        v_item.quantity_received,
        NOW(),
        p_received_by
      ) RETURNING id, current_stock INTO v_inventory_id, v_previous_stock;
      
      v_previous_stock := 0;
    ELSE
      -- Update existing inventory
      UPDATE inventory
      SET 
        current_stock = current_stock + v_item.quantity_received,
        last_restocked_at = NOW(),
        last_restocked_by = p_received_by,
        low_stock_alert_sent = FALSE
      WHERE id = v_inventory_id;
    END IF;
    
    -- Log stock movement
    INSERT INTO stock_movements (
      tenant_id,
      inventory_id,
      product_id,
      location_id,
      movement_type,
      quantity,
      previous_stock,
      new_stock,
      reference_type,
      reference_id,
      performed_by,
      reason
    ) VALUES (
      v_tenant_id,
      v_inventory_id,
      v_item.product_id,
      v_location_id,
      'restock',
      v_item.quantity_received,
      v_previous_stock,
      v_previous_stock + v_item.quantity_received,
      'purchase_order',
      p_po_id,
      p_received_by,
      'Received from purchase order'
    );
  END LOOP;
  
  -- Update PO status
  UPDATE purchase_orders
  SET 
    status = 'received',
    actual_delivery_date = CURRENT_DATE,
    received_by = p_received_by,
    updated_at = NOW()
  WHERE id = p_po_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update triggers for inventory
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE inventory IS 'Product inventory tracking per location';
COMMENT ON TABLE suppliers IS 'Supplier and vendor management';
COMMENT ON TABLE purchase_orders IS 'Purchase orders for inventory restocking';
COMMENT ON TABLE stock_movements IS 'Audit trail of all inventory changes';
