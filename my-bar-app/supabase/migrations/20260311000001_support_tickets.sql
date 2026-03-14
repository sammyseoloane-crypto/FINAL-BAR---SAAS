-- Migration: Create support_tickets table for error reporting and support
-- Purpose: Store user-submitted bug reports, feature requests, and support tickets

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User Information
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Ticket Information
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'performance', 'usability', 'security', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  
  -- Admin Response
  admin_response TEXT,
  admin_responder_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata (browser info, URL, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_severity ON support_tickets(severity);
CREATE INDEX idx_support_tickets_type ON support_tickets(type);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "Users can create support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Owners can view tenant tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can update tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON support_tickets;

-- 1. Users can insert their own tickets (authenticated or anonymous)
CREATE POLICY "Users can create support tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- 2. Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- 3. Tenant owners can view tickets from their tenant
CREATE POLICY "Owners can view tenant tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.tenant_id = support_tickets.tenant_id
        AND profiles.role = 'owner'
    )
  );

-- 4. Platform admins/support staff can view all tickets
CREATE POLICY "Admins can view all tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
    )
  );

-- 5. Admins can update any ticket (add responses, change status)
CREATE POLICY "Admins can update tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support', 'owner')
    )
  );

-- 6. Admins can delete tickets
CREATE POLICY "Admins can delete tickets"
  ON support_tickets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_updated_at();

-- Comments for documentation
COMMENT ON TABLE support_tickets IS 'User-submitted support tickets, bug reports, and feature requests';
COMMENT ON COLUMN support_tickets.type IS 'Type of issue: bug, feature, performance, usability, security, other';
COMMENT ON COLUMN support_tickets.severity IS 'Issue severity: low, medium, high, critical';
COMMENT ON COLUMN support_tickets.status IS 'Ticket status: open, in_progress, resolved, closed';
COMMENT ON COLUMN support_tickets.metadata IS 'Browser info, URL, viewport size, user agent, etc.';
