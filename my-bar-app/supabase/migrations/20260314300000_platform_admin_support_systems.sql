-- ================================================
-- Platform Admin Support Systems
-- Support Tickets & Audit Logs Tables
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- SUPPORT TICKETS TABLE
-- Track customer support requests
-- ============================================================

-- Drop existing table if it exists to ensure clean creation
DROP TABLE IF EXISTS support_tickets CASCADE;

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at);

-- ============================================================
-- AUDIT LOGS TABLE
-- Track all system events and user actions
-- ============================================================

-- Drop existing table if it exists to ensure clean creation
DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  resource_type VARCHAR(50),
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Support Tickets RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
    )
  );

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
    )
  );

-- Platform admins can view all tickets
CREATE POLICY "Platform admins can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Platform admins and assigned staff can update tickets
CREATE POLICY "Platform admins can update tickets"
  ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
        AND (role = 'platform_admin' OR id = support_tickets.assigned_to)
    )
  );

-- Audit Logs RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all logs
CREATE POLICY "Platform admins can view all logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- System can insert logs (allow service role)
CREATE POLICY "System can insert logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS trigger_update_support_tickets_updated_at ON support_tickets;
DROP FUNCTION IF EXISTS update_support_tickets_updated_at();


-- ============================================================
-- TRIGGER: Update support_tickets updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  
  -- Set resolved_at when status changes to resolved or closed
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at = TIMEZONE('utc', NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_updated_at();

-- ============================================================
-- FUNCTION: Create audit log entry
-- ============================================================

-- Drop any existing versions of the function with CASCADE to remove dependent triggers
DROP FUNCTION IF EXISTS create_audit_log(VARCHAR, TEXT, UUID, UUID, VARCHAR, UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS create_audit_log(VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_audit_log CASCADE;

CREATE OR REPLACE FUNCTION create_audit_log(
  p_action VARCHAR,
  p_description TEXT,
  p_tenant_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_resource_type VARCHAR DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    description,
    tenant_id,
    user_id,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_action,
    p_description,
    p_tenant_id,
    p_user_id,
    p_resource_type,
    p_resource_id,
    p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_audit_log TO authenticated;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE support_tickets IS 'Customer support ticket system for platform-wide issue tracking';
COMMENT ON TABLE audit_logs IS 'System-wide audit log for tracking all user actions and events';
COMMENT ON FUNCTION create_audit_log IS 'Helper function to create audit log entries programmatically';
