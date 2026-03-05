-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP EXISTING TABLES (in reverse order due to foreign keys)
-- ============================================================
DROP TABLE IF EXISTS qr_codes CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Drop the reports view if it exists
DROP VIEW IF EXISTS reports CASCADE;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================
-- TENANTS TABLE
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'trial')),
  subscription_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_tenants_subscription_status ON tenants(subscription_status);

-- ============================================================
-- LOCATIONS TABLE
-- ============================================================
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_locations_tenant_id ON locations(tenant_id);

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'customer')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  type VARCHAR(50) NOT NULL CHECK (type IN ('drink', 'food')),
  is_special BOOLEAN DEFAULT FALSE,
  description TEXT,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_location_id ON products(location_id);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_is_special ON products(is_special);

-- ============================================================
-- EVENTS TABLE
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  entry_fee DECIMAL(10, 2) DEFAULT 0 CHECK (entry_fee >= 0),
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_events_tenant_id ON events(tenant_id);
CREATE INDEX idx_events_location_id ON events(location_id);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_active ON events(active);

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_tasks_location_id ON tasks(location_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'refunded')),
  confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_product_id ON transactions(product_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- ============================================================
-- QR_CODES TABLE
-- ============================================================
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(255) UNIQUE NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_qr_codes_transaction_id ON qr_codes(transaction_id);
CREATE INDEX idx_qr_codes_user_id ON qr_codes(user_id);
CREATE INDEX idx_qr_codes_code ON qr_codes(code);
CREATE INDEX idx_qr_codes_scanned_at ON qr_codes(scanned_at);

-- ============================================================
-- REPORTS VIEW (Virtual table for on-demand reporting)
-- ============================================================
CREATE VIEW reports AS
SELECT 
  t.tenant_id,
  t.id as transaction_id,
  t.user_id,
  t.product_id,
  p.name as product_name,
  p.type as product_type,
  t.amount,
  t.status,
  t.created_at,
  t.confirmed_at,
  DATE(t.created_at) as transaction_date,
  EXTRACT(HOUR FROM t.created_at) as transaction_hour,
  EXTRACT(DOW FROM t.created_at) as day_of_week
FROM transactions t
LEFT JOIN products p ON t.product_id = p.id;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Helper function to get current user's tenant_id and role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_tenant_and_role()
RETURNS TABLE (tenant_id UUID, role VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT u.tenant_id, u.role
  FROM users u
  WHERE u.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TENANTS POLICIES
-- Only owners and admins can view their tenant
-- ============================================================
CREATE POLICY "Owners and admins can view their tenant"
  ON tenants FOR SELECT
  USING (
    id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Allow viewing active tenants for registration"
  ON tenants FOR SELECT
  USING (
    subscription_status = 'active' OR subscription_status = 'trial'
  );

CREATE POLICY "Owners and admins can update their tenant"
  ON tenants FOR UPDATE
  USING (
    id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Allow tenant creation during registration"
  ON tenants FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- LOCATIONS POLICIES
-- ============================================================
CREATE POLICY "Users can view locations of their tenant"
  ON locations FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role()));

CREATE POLICY "Admins and owners can manage locations"
  ON locations FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- ============================================================
-- USERS POLICIES
-- Owner/Admin sees all tenant users
-- Staff and customers see limited user info
-- ============================================================
CREATE POLICY "Owners and admins can view all tenant users"
  ON users FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Staff can view users in their tenant (limited)"
  ON users FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'staff')
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins and owners can manage users"
  ON users FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Users can create their own profile during registration"
  ON users FOR INSERT
  WITH CHECK (
    id = auth.uid()
  );

CREATE POLICY "Admins and owners can update users"
  ON users FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Admins and owners can delete users"
  ON users FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- ============================================================
-- PRODUCTS POLICIES
-- Owner/Admin can manage, Staff/Customers can view by location & tenant
-- ============================================================
CREATE POLICY "Users can view products in their tenant"
  ON products FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role())
    OR auth.uid() IS NULL  -- Allow anonymous viewing for customer-facing apps
  );

CREATE POLICY "Owners and admins can manage products"
  ON products FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Staff can manage products at their locations"
  ON products FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'staff')
  );

-- ============================================================
-- EVENTS POLICIES
-- Owner/Admin can manage, Staff/Customers can view by location & tenant
-- ============================================================
CREATE POLICY "Users can view active events in their tenant or public active events"
  ON events FOR SELECT
  USING (
    (active = TRUE AND tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role()))
    OR (active = TRUE AND auth.uid() IS NULL)  -- Public viewing
    OR tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin', 'staff'))
  );

CREATE POLICY "Owners and admins can manage events"
  ON events FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Owners and admins can update events"
  ON events FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Owners and admins can delete events"
  ON events FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- ============================================================
-- TASKS POLICIES
-- Staff can view only assigned tasks, Owner/Admin sees all tenant tasks
-- ============================================================
CREATE POLICY "Staff can view their assigned tasks"
  ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid() 
    AND tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'staff')
  );

CREATE POLICY "Owners and admins can view all tenant tasks"
  ON tasks FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Staff can update their assigned tasks"
  ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'staff')
  );

CREATE POLICY "Owners and admins can manage all tasks"
  ON tasks FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- ============================================================
-- TRANSACTIONS POLICIES
-- Customers: only their own transactions
-- Staff: view and confirm transactions at their location (same tenant)
-- Owner/Admin: all tenant transactions
-- ============================================================
CREATE POLICY "Customers can view their own transactions"
  ON transactions FOR SELECT
  USING (
    user_id = auth.uid() 
    AND tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'customer')
  );

CREATE POLICY "Staff can view transactions in their tenant"
  ON transactions FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'staff')
  );

CREATE POLICY "Owners and admins can view all tenant transactions"
  ON transactions FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

CREATE POLICY "Customers can create transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND tenant_id IN (SELECT id FROM tenants)
  );

CREATE POLICY "Staff can confirm transactions"
  ON transactions FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'staff')
    AND status = 'pending'  -- Can only confirm pending transactions
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'staff')
  );

CREATE POLICY "Owners and admins can manage all transactions"
  ON transactions FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- ============================================================
-- QR_CODES POLICIES
-- Customers: only their own QR
-- Staff/Owner/Admin: can scan/validate QR at their tenant locations
-- ============================================================
CREATE POLICY "Customers can view their own QR codes"
  ON qr_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view QR codes for their tenant transactions"
  ON qr_codes FOR SELECT
  USING (transaction_id IN (
    SELECT t.id FROM transactions t
    WHERE t.tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin', 'staff'))
  ));

CREATE POLICY "Customers can create their own QR codes"
  ON qr_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can scan and update QR codes at their locations"
  ON qr_codes FOR UPDATE
  USING (transaction_id IN (
    SELECT t.id FROM transactions t
    WHERE t.tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin', 'staff'))
  ))
  WITH CHECK (transaction_id IN (
    SELECT t.id FROM transactions t
    WHERE t.tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin', 'staff'))
  ));

CREATE POLICY "Owners and admins can manage QR codes"
  ON qr_codes FOR ALL
  USING (transaction_id IN (
    SELECT t.id FROM transactions t
    WHERE t.tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  ));

-- ============================================================
-- SEED DATA (Optional - for development/testing)
-- ============================================================

-- Insert sample tenant
INSERT INTO tenants (name, subscription_status) 
VALUES ('Demo Bar', 'active');
