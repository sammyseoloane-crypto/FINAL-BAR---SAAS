-- ============================================================
-- AUDIT LOGGING SYSTEM
-- Comprehensive audit trail for compliance and security
-- Created: 2026-03-11
-- ============================================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', etc.
  resource_type VARCHAR(100) NOT NULL, -- 'transaction', 'product', 'user', 'task', etc.
  resource_id UUID, -- ID of the affected resource
  old_values JSONB, -- Previous state (for updates/deletes)
  new_values JSONB, -- New state (for creates/updates)
  ip_address INET, -- Client IP address
  user_agent TEXT, -- Browser/device info
  status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'pending'
  error_message TEXT, -- If action failed
  metadata JSONB, -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Owners and admins can view tenant audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;

CREATE POLICY "Owners and admins can view tenant audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = audit_logs.tenant_id
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- AUTOMATIC AUDIT TRIGGERS
-- ============================================================

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_action VARCHAR(100);
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE';
    v_new_values := to_jsonb(NEW);
    v_tenant_id := (NEW.tenant_id)::UUID;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    v_tenant_id := (NEW.tenant_id)::UUID;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_tenant_id := (OLD.tenant_id)::UUID;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    status
  ) VALUES (
    v_tenant_id,
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    COALESCE((NEW.id)::UUID, (OLD.id)::UUID),
    v_old_values,
    v_new_values,
    'success'
  );

  -- Return appropriate value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for critical tables
DROP TRIGGER IF EXISTS audit_transactions ON transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

DROP TRIGGER IF EXISTS audit_products ON products;
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

DROP TRIGGER IF EXISTS audit_tasks ON tasks;
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

DROP TRIGGER IF EXISTS audit_events ON events;
CREATE TRIGGER audit_events
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- ============================================================
-- AUDIT LOG HELPER FUNCTIONS
-- ============================================================

-- Function to manually log custom actions
CREATE OR REPLACE FUNCTION log_audit_action(
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_audit_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get tenant_id from user profile
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = v_user_id;

  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    status
  ) VALUES (
    v_tenant_id,
    v_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    'success'
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit trail for a resource
CREATE OR REPLACE FUNCTION get_audit_trail(
  p_resource_type VARCHAR,
  p_resource_id UUID
)
RETURNS TABLE (
  id UUID,
  action VARCHAR,
  user_email VARCHAR,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    p.email,
    al.old_values,
    al.new_values,
    al.created_at
  FROM audit_logs al
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE al.resource_type = p_resource_type
    AND al.resource_id = p_resource_id
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPLIANCE & RETENTION
-- ============================================================

-- Function to archive old audit logs (for compliance)
CREATE OR REPLACE FUNCTION archive_audit_logs(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_archived_count INTEGER;
BEGIN
  -- Archive audit logs older than specified days
  -- In production, this would move to an archive table or external storage
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days_old
  RETURNING COUNT(*) INTO v_archived_count;
  
  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance (PCI DSS, GDPR, POPIA)';
COMMENT ON FUNCTION create_audit_log() IS 'Automatic audit logging trigger for all critical tables';
COMMENT ON FUNCTION log_audit_action(VARCHAR, VARCHAR, UUID, JSONB) IS 'Manual audit logging for custom actions';
