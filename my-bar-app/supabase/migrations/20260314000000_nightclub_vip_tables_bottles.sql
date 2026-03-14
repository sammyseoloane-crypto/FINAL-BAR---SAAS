-- ============================================================
-- NIGHTCLUB MANAGEMENT SYSTEM - PART 1
-- VIP Tables, Bottle Service, Bar Tabs
-- Created: 2026-03-14
-- ============================================================

-- ============================================================
-- PHASE 1: VIP TABLE BOOKING SYSTEM
-- ============================================================

-- Tables (physical venue tables)
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  -- Table details
  name VARCHAR(100) NOT NULL, -- 'VIP 1', 'Table A', 'Booth 5'
  table_number VARCHAR(50),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  table_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'vip', 'booth', 'bar'
  
  -- Location in venue
  floor_level INTEGER DEFAULT 1,
  zone VARCHAR(100), -- 'Main Floor', 'VIP Section', 'Rooftop'
  position_x INTEGER, -- For floor map visualization
  position_y INTEGER,
  
  -- Pricing
  minimum_spend DECIMAL(10, 2) DEFAULT 0,
  reservation_fee DECIMAL(10, 2) DEFAULT 0,
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  hourly_rate DECIMAL(10, 2),
  
  -- Features
  has_bottle_service BOOLEAN DEFAULT FALSE,
  has_waiter_service BOOLEAN DEFAULT FALSE,
  is_outdoor BOOLEAN DEFAULT FALSE,
  is_accessible BOOLEAN DEFAULT TRUE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'available', -- 'available', 'reserved', 'occupied', 'maintenance'
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  description TEXT,
  amenities JSONB DEFAULT '[]', -- ["DJ View", "Dance Floor", "Private"]
  photos JSONB DEFAULT '[]',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_tables_tenant ON tables(tenant_id);
CREATE INDEX idx_tables_location ON tables(location_id);
CREATE INDEX idx_tables_status ON tables(status) WHERE status IN ('available', 'reserved');
CREATE INDEX idx_tables_type ON tables(table_type);

-- Table Reservations
CREATE TABLE IF NOT EXISTS table_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  
  -- Reservation details
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  reservation_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_hours DECIMAL(4, 2) DEFAULT 2.0,
  end_datetime TIMESTAMP WITH TIME ZONE,
  
  -- Guest details
  guest_count INTEGER NOT NULL CHECK (guest_count > 0),
  guest_names JSONB DEFAULT '[]',
  contact_phone VARCHAR(20),
  contact_email VARCHAR(255),
  
  -- Financial
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT FALSE,
  deposit_paid_at TIMESTAMP WITH TIME ZONE,
  minimum_spend DECIMAL(10, 2) DEFAULT 0,
  actual_spend DECIMAL(10, 2) DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  -- Check-in/out
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID REFERENCES auth.users(id),
  checked_out_at TIMESTAMP WITH TIME ZONE,
  
  -- Special requests
  special_requests TEXT,
  dietary_restrictions TEXT,
  celebration_type VARCHAR(100), -- 'birthday', 'anniversary', 'corporate'
  
  -- Notifications
  reminder_sent BOOLEAN DEFAULT FALSE,
  confirmation_sent BOOLEAN DEFAULT FALSE,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_table_reservations_tenant ON table_reservations(tenant_id);
CREATE INDEX idx_table_reservations_table ON table_reservations(table_id);
CREATE INDEX idx_table_reservations_user ON table_reservations(user_id);
CREATE INDEX idx_table_reservations_event ON table_reservations(event_id);
CREATE INDEX idx_table_reservations_date ON table_reservations(reservation_date);
CREATE INDEX idx_table_reservations_datetime ON table_reservations(reservation_datetime);
CREATE INDEX idx_table_reservations_status ON table_reservations(status);

-- Reservation Guests
CREATE TABLE IF NOT EXISTS reservation_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES table_reservations(id) ON DELETE CASCADE,
  
  -- Guest info
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name VARCHAR(255) NOT NULL,
  guest_phone VARCHAR(20),
  guest_email VARCHAR(255),
  
  -- Status
  invitation_status VARCHAR(50) DEFAULT 'invited', -- 'invited', 'confirmed', 'declined', 'attended'
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  
  -- RSVP
  rsvp_response VARCHAR(50),
  rsvp_at TIMESTAMP WITH TIME ZONE,
  plus_ones INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_reservation_guests_tenant ON reservation_guests(tenant_id);
CREATE INDEX idx_reservation_guests_reservation ON reservation_guests(reservation_id);
CREATE INDEX idx_reservation_guests_user ON reservation_guests(user_id);

-- ============================================================
-- PHASE 2: BOTTLE SERVICE SYSTEM
-- ============================================================

-- Bottle Packages
CREATE TABLE IF NOT EXISTS bottle_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Package details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  package_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'premium', 'ultra_premium', 'custom'
  
  -- Items included
  items JSONB NOT NULL, -- [{"product_id": "...", "quantity": 2, "name": "Grey Goose"}]
  
  -- Pricing
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  original_price DECIMAL(10, 2),
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Availability
  min_guests INTEGER,
  max_guests INTEGER,
  requires_table_reservation BOOLEAN DEFAULT TRUE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  -- Valid dates
  valid_from DATE,
  valid_until DATE,
  available_days JSONB, -- [1,2,3,4,5,6,0] for days of week
  
  -- Media
  image_url TEXT,
  photos JSONB DEFAULT '[]',
  
  -- Limits
  max_orders_per_night INTEGER,
  current_orders_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_bottle_packages_tenant ON bottle_packages(tenant_id);
CREATE INDEX idx_bottle_packages_active ON bottle_packages(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_bottle_packages_featured ON bottle_packages(is_featured) WHERE is_featured = TRUE;

-- Bottle Orders
CREATE TABLE IF NOT EXISTS bottle_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES bottle_packages(id) ON DELETE SET NULL,
  table_reservation_id UUID REFERENCES table_reservations(id) ON DELETE SET NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Order details
  order_date DATE NOT NULL,
  delivery_time TIMESTAMP WITH TIME ZONE NOT NULL,
  guest_count INTEGER,
  
  -- Financial
  subtotal DECIMAL(10, 2) NOT NULL,
  service_charge DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  prepaid_amount DECIMAL(10, 2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT FALSE,
  
  -- Payment
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'refunded'
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'delivered', 'completed', 'cancelled'
  
  -- Service
  assigned_waiter_id UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivered_by UUID REFERENCES auth.users(id),
  
  -- Special requests
  special_instructions TEXT,
  ice_preference VARCHAR(50), -- 'regular', 'extra', 'no_ice'
  mixer_preferences JSONB DEFAULT '[]',
  
  -- Rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  rated_at TIMESTAMP WITH TIME ZONE,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_bottle_orders_tenant ON bottle_orders(tenant_id);
CREATE INDEX idx_bottle_orders_user ON bottle_orders(user_id);
CREATE INDEX idx_bottle_orders_package ON bottle_orders(package_id);
CREATE INDEX idx_bottle_orders_table ON bottle_orders(table_id);
CREATE INDEX idx_bottle_orders_status ON bottle_orders(status);
CREATE INDEX idx_bottle_orders_date ON bottle_orders(order_date);
CREATE INDEX idx_bottle_orders_waiter ON bottle_orders(assigned_waiter_id) WHERE assigned_waiter_id IS NOT NULL;

-- Bottle Order Items
CREATE TABLE IF NOT EXISTS bottle_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bottle_order_id UUID NOT NULL REFERENCES bottle_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Item details
  item_name VARCHAR(255) NOT NULL,
  item_type VARCHAR(50) DEFAULT 'bottle', -- 'bottle', 'mixer', 'extra'
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  
  -- Pricing
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  
  -- Service
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  notes TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_bottle_order_items_tenant ON bottle_order_items(tenant_id);
CREATE INDEX idx_bottle_order_items_order ON bottle_order_items(bottle_order_id);
CREATE INDEX idx_bottle_order_items_product ON bottle_order_items(product_id);

-- ============================================================
-- PHASE 3: DIGITAL BAR TABS
-- ============================================================

CREATE TABLE IF NOT EXISTS bar_tabs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Tab details
  tab_number VARCHAR(50) UNIQUE,
  tab_name VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'closed', 'overdue', 'suspended'
  
  -- Timestamps
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  closed_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Financial
  total_amount DECIMAL(15, 2) DEFAULT 0,
  paid_amount DECIMAL(15, 2) DEFAULT 0,
  tip_amount DECIMAL(10, 2) DEFAULT 0,
  service_charge DECIMAL(10, 2) DEFAULT 0,
  balance_due DECIMAL(15, 2) DEFAULT 0,
  
  -- Limits
  credit_limit DECIMAL(10, 2) DEFAULT 1000.00,
  warning_threshold DECIMAL(10, 2) DEFAULT 800.00,
  
  -- Transaction count
  item_count INTEGER DEFAULT 0,
  
  -- Payment
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  
  -- Staff
  opened_by UUID REFERENCES auth.users(id),
  closed_by UUID REFERENCES auth.users(id),
  
  -- QR Code
  qr_code_id UUID,
  qr_scanned_at TIMESTAMP WITH TIME ZONE,
  
  -- Auto-close
  auto_close_time TIMESTAMP WITH TIME ZONE,
  
  -- Notifications
  warning_sent BOOLEAN DEFAULT FALSE,
  overdue_notification_sent BOOLEAN DEFAULT FALSE,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_bar_tabs_tenant ON bar_tabs(tenant_id);
CREATE INDEX idx_bar_tabs_user ON bar_tabs(user_id);
CREATE INDEX idx_bar_tabs_status ON bar_tabs(status);
CREATE INDEX idx_bar_tabs_opened_at ON bar_tabs(opened_at DESC);
CREATE INDEX idx_bar_tabs_tab_number ON bar_tabs(tab_number) WHERE tab_number IS NOT NULL;
CREATE INDEX idx_bar_tabs_open ON bar_tabs(tenant_id, status) WHERE status = 'open';

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottle_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottle_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottle_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_tabs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Tables: Staff and customers can view, staff can manage
CREATE POLICY tables_tenant_isolation ON tables
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Table Reservations: Users can see own, staff see all
CREATE POLICY table_reservations_tenant_isolation ON table_reservations
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Reservation Guests: Reservation owner and invited guests can see
CREATE POLICY reservation_guests_tenant_isolation ON reservation_guests
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM table_reservations
        WHERE id = reservation_guests.reservation_id
        AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Bottle Packages: Everyone can view active packages
CREATE POLICY bottle_packages_view ON bottle_packages
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      is_active = TRUE
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Bottle Packages: Staff can manage
CREATE POLICY bottle_packages_manage ON bottle_packages
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Bottle Orders: Users see own, staff see all
CREATE POLICY bottle_orders_tenant_isolation ON bottle_orders
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Bottle Order Items: Inherit from bottle_orders
CREATE POLICY bottle_order_items_tenant_isolation ON bottle_order_items
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM bottle_orders
        WHERE id = bottle_order_items.bottle_order_id
        AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- Bar Tabs: Users see own, staff see all
CREATE POLICY bar_tabs_tenant_isolation ON bar_tabs
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff')
      )
    )
  );

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tables_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER table_reservations_updated_at BEFORE UPDATE ON table_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER bottle_packages_updated_at BEFORE UPDATE ON bottle_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER bottle_orders_updated_at BEFORE UPDATE ON bottle_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER bar_tabs_updated_at BEFORE UPDATE ON bar_tabs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update bar tab balance when changed
CREATE OR REPLACE FUNCTION update_bar_tab_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_due = NEW.total_amount - NEW.paid_amount;
  NEW.last_activity_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bar_tabs_balance_update BEFORE UPDATE ON bar_tabs
  FOR EACH ROW
  WHEN (OLD.total_amount IS DISTINCT FROM NEW.total_amount OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
  EXECUTE FUNCTION update_bar_tab_balance();

-- Generate unique tab number
CREATE OR REPLACE FUNCTION generate_tab_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tab_number IS NULL THEN
    NEW.tab_number = 'TAB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('bar_tabs_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bar_tabs_generate_number BEFORE INSERT ON bar_tabs
  FOR EACH ROW EXECUTE FUNCTION generate_tab_number();
