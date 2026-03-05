-- ============================================================
-- EMAIL LOGS TABLE
-- Track all emails sent from the system
-- ============================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  email_to VARCHAR(255) NOT NULL,
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN (
    'signup_verification',
    'password_reset',
    'staff_invitation',
    'order_confirmation',
    'notification'
  )),
  subject VARCHAR(500),
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced', 'opened')),
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_id ON email_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_to ON email_logs(email_to);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Owners and admins can view tenant email logs" ON email_logs;
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;
DROP POLICY IF EXISTS "System can insert email logs" ON email_logs;
DROP POLICY IF EXISTS "Owners and admins can update tenant email logs" ON email_logs;

-- Owners and admins can view their tenant's email logs
CREATE POLICY "Owners and admins can view tenant email logs"
  ON email_logs FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  USING (user_id = auth.uid());

-- System can insert email logs (no user restriction for initial signup)
CREATE POLICY "System can insert email logs"
  ON email_logs FOR INSERT
  WITH CHECK (true);

-- Owners and admins can update email status (for tracking opens, etc.)
CREATE POLICY "Owners and admins can update tenant email logs"
  ON email_logs FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Create a view for email statistics by tenant
CREATE OR REPLACE VIEW email_statistics AS
SELECT 
  tenant_id,
  email_type,
  status,
  COUNT(*) as count,
  DATE(sent_at) as sent_date
FROM email_logs
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, email_type, status, DATE(sent_at);

-- Grant access to the view
GRANT SELECT ON email_statistics TO authenticated;

COMMENT ON TABLE email_logs IS 'Tracks all emails sent from the system for monitoring and debugging';
COMMENT ON COLUMN email_logs.email_type IS 'Type of email: signup_verification, password_reset, staff_invitation, order_confirmation, notification';
COMMENT ON COLUMN email_logs.status IS 'Email status: sent, delivered, failed, bounced, opened';
COMMENT ON COLUMN email_logs.metadata IS 'Additional metadata about the email (template_id, campaign_id, etc.)';
