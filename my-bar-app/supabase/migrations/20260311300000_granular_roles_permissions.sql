-- ============================================================
-- GRANULAR ROLES & PERMISSIONS SYSTEM
-- Fine-grained access control and shift scheduling
-- Created: 2026-03-11
-- ============================================================

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'products', 'transactions', 'staff', 'reports', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create roles table (extends existing role system)
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  base_role VARCHAR(50) NOT NULL CHECK (base_role IN ('owner', 'admin', 'staff', 'customer')),
  description TEXT,
  permissions JSONB DEFAULT '[]', -- Array of permission names
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, name)
);

-- Create role_assignments table
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, tenant_id, custom_role_id)
);

-- Create shifts table for shift scheduling
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_type VARCHAR(50) DEFAULT 'regular', -- 'regular', 'overtime', 'split'
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  break_duration INTEGER DEFAULT 0, -- minutes
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'
  clock_in_time TIMESTAMP WITH TIME ZONE,
  clock_out_time TIMESTAMP WITH TIME ZONE,
  actual_hours DECIMAL(5, 2),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT valid_shift_times CHECK (end_time > start_time)
);

-- Create shift_templates table
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  location_id UUID REFERENCES locations(id),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 0,
  required_role VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX idx_custom_roles_tenant_id ON custom_roles(tenant_id);
CREATE INDEX idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX idx_role_assignments_tenant_id ON role_assignments(tenant_id);
CREATE INDEX idx_shifts_tenant_id ON shifts(tenant_id);
CREATE INDEX idx_shifts_user_id ON shifts(user_id);
CREATE INDEX idx_shifts_location_id ON shifts(location_id);
CREATE INDEX idx_shifts_start_time ON shifts(start_time);
CREATE INDEX idx_shifts_status ON shifts(status);

-- Enable RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Permissions
CREATE POLICY "Anyone can view permissions"
  ON permissions FOR SELECT
  USING (true);

-- RLS Policies - Custom Roles
CREATE POLICY "Users can view tenant custom roles"
  ON custom_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = custom_roles.tenant_id
    )
  );

CREATE POLICY "Admins can manage custom roles"
  ON custom_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = custom_roles.tenant_id
    )
  );

-- RLS Policies - Role Assignments
CREATE POLICY "Users can view their role assignments"
  ON role_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage role assignments"
  ON role_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = role_assignments.tenant_id
    )
  );

-- RLS Policies - Shifts
CREATE POLICY "Users can view their own shifts"
  ON shifts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view shifts at their location"
  ON shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role = 'staff' AND u.tenant_id = shifts.tenant_id
    )
  );

CREATE POLICY "Admins can manage all shifts"
  ON shifts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = shifts.tenant_id
    )
  );

CREATE POLICY "Users can update their own shift status"
  ON shifts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies - Shift Templates
CREATE POLICY "Users can view tenant shift templates"
  ON shift_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = shift_templates.tenant_id
    )
  );

CREATE POLICY "Admins can manage shift templates"
  ON shift_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = shift_templates.tenant_id
    )
  );

-- ============================================================
-- INSERT DEFAULT PERMISSIONS
-- ============================================================

INSERT INTO permissions (name, display_name, description, category) VALUES
-- Product Management
('products.view', 'View Products', 'View product catalog', 'products'),
('products.create', 'Create Products', 'Add new products', 'products'),
('products.edit', 'Edit Products', 'Modify existing products', 'products'),
('products.delete', 'Delete Products', 'Remove products', 'products'),
('products.manage_inventory', 'Manage Inventory', 'Update stock levels', 'products'),

-- Transaction Management
('transactions.view_own', 'View Own Transactions', 'View personal transaction history', 'transactions'),
('transactions.view_all', 'View All Transactions', 'View all tenant transactions', 'transactions'),
('transactions.create', 'Create Transactions', 'Process new transactions', 'transactions'),
('transactions.confirm', 'Confirm Payments', 'Confirm customer payments', 'transactions'),
('transactions.refund', 'Process Refunds', 'Issue refunds', 'transactions'),
('transactions.cancel', 'Cancel Orders', 'Cancel pending orders', 'transactions'),

-- Staff Management
('staff.view', 'View Staff', 'View staff list', 'staff'),
('staff.invite', 'Invite Staff', 'Send staff invitations', 'staff'),
('staff.edit', 'Edit Staff', 'Modify staff details', 'staff'),
('staff.remove', 'Remove Staff', 'Deactivate staff members', 'staff'),
('staff.manage_roles', 'Manage Roles', 'Assign roles and permissions', 'staff'),

-- Task Management
('tasks.view_own', 'View Own Tasks', 'View assigned tasks', 'tasks'),
('tasks.view_all', 'View All Tasks', 'View all tenant tasks', 'tasks'),
('tasks.create', 'Create Tasks', 'Create new tasks', 'tasks'),
('tasks.assign', 'Assign Tasks', 'Assign tasks to staff', 'tasks'),
('tasks.update', 'Update Tasks', 'Modify task details', 'tasks'),
('tasks.delete', 'Delete Tasks', 'Remove tasks', 'tasks'),

-- Reporting
('reports.basic', 'Basic Reports', 'View basic analytics', 'reports'),
('reports.advanced', 'Advanced Reports', 'View detailed analytics', 'reports'),
('reports.export', 'Export Reports', 'Download report data', 'reports'),
('reports.realtime', 'Real-Time Analytics', 'Access live dashboards', 'reports'),

-- Location Management
('locations.view', 'View Locations', 'View all locations', 'locations'),
('locations.create', 'Create Locations', 'Add new locations', 'locations'),
('locations.edit', 'Edit Locations', 'Modify location details', 'locations'),
('locations.delete', 'Delete Locations', 'Remove locations', 'locations'),

-- Events
('events.view', 'View Events', 'View event list', 'events'),
('events.create', 'Create Events', 'Add new events', 'events'),
('events.edit', 'Edit Events', 'Modify events', 'events'),
('events.delete', 'Delete Events', 'Remove events', 'events'),

-- QR Code & Scanner
('qr.scan', 'Scan QR Codes', 'Scan customer QR codes', 'qr'),
('qr.generate', 'Generate QR Codes', 'Create QR codes', 'qr'),
('qr.view', 'View QR Codes', 'View QR code history', 'qr'),

-- Settings
('settings.view', 'View Settings', 'View system settings', 'settings'),
('settings.edit', 'Edit Settings', 'Modify system settings', 'settings'),
('settings.subscription', 'Manage Subscription', 'Manage billing', 'settings'),

-- Shifts
('shifts.view_own', 'View Own Shifts', 'View personal schedule', 'shifts'),
('shifts.view_all', 'View All Shifts', 'View team schedules', 'shifts'),
('shifts.manage', 'Manage Shifts', 'Create and assign shifts', 'shifts'),
('shifts.clock_in_out', 'Clock In/Out', 'Record shift times', 'shifts');

-- ============================================================
-- PERMISSION HELPER FUNCTIONS
-- ============================================================

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_permission_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN := false;
  v_base_role VARCHAR;
  v_custom_permissions JSONB;
BEGIN
  -- Get user's base role
  SELECT role INTO v_base_role FROM profiles WHERE id = p_user_id;

  -- Owner and Admin have all permissions
  IF v_base_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  -- Check custom role permissions
  SELECT INTO v_custom_permissions cr.permissions
  FROM role_assignments ra
  JOIN custom_roles cr ON cr.id = ra.custom_role_id
  WHERE ra.user_id = p_user_id
    AND ra.is_active = true
    AND (ra.expires_at IS NULL OR ra.expires_at > NOW())
  LIMIT 1;

  IF v_custom_permissions IS NOT NULL THEN
    v_has_permission := v_custom_permissions ? p_permission_name;
  END IF;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clock in/out
CREATE OR REPLACE FUNCTION clock_shift(
  p_shift_id UUID,
  p_action VARCHAR -- 'in' or 'out'
)
RETURNS JSONB AS $$
DECLARE
  v_shift shifts;
  v_result JSONB;
BEGIN
  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
  END IF;

  IF p_action = 'in' THEN
    IF v_shift.clock_in_time IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already clocked in');
    END IF;

    UPDATE shifts
    SET 
      clock_in_time = NOW(),
      status = 'in_progress',
      updated_at = NOW()
    WHERE id = p_shift_id;

    v_result := jsonb_build_object('success', true, 'clock_in_time', NOW());

  ELSIF p_action = 'out' THEN
    IF v_shift.clock_in_time IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not clocked in');
    END IF;

    IF v_shift.clock_out_time IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already clocked out');
    END IF;

    -- Calculate actual hours
    DECLARE
      v_hours DECIMAL(5, 2);
    BEGIN
      v_hours := EXTRACT(EPOCH FROM (NOW() - v_shift.clock_in_time)) / 3600;
      
      -- Subtract break duration
      v_hours := v_hours - (v_shift.break_duration / 60.0);

      UPDATE shifts
      SET 
        clock_out_time = NOW(),
        actual_hours = v_hours,
        status = 'completed',
        updated_at = NOW()
      WHERE id = p_shift_id;

      v_result := jsonb_build_object(
        'success', true, 
        'clock_out_time', NOW(),
        'actual_hours', v_hours
      );
    END;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  -- Log audit
  PERFORM log_audit_action(
    'SHIFT_CLOCK_' || UPPER(p_action),
    'shift',
    p_shift_id,
    v_result
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE custom_roles IS 'Tenant-specific custom roles with granular permissions';
COMMENT ON TABLE shifts IS 'Staff shift scheduling and time tracking';
COMMENT ON FUNCTION user_has_permission(UUID, VARCHAR) IS 'Check if user has specific permission';
COMMENT ON FUNCTION clock_shift(UUID, VARCHAR) IS 'Clock in or out of a shift';
