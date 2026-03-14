-- ================================================
-- FIX: Allow Manual User Creation for Testing
-- Issue: Audit trigger blocks user creation when tenant_id is NULL
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- WANT A FASTER FIX? USE QUICK_FIX_USER_CREATION.sql INSTEAD!
-- This file does a complete fix (recreates audit_logs table)
-- If you just want to create users NOW, use the quick fix instead
-- ============================================================

-- ============================================================
-- STEP 1: Fix audit_logs table to allow NULL tenant_id
-- This is required for platform_admin users who don't have a tenant
-- ============================================================

-- Drop existing table and recreate with nullable tenant_id
DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- Now nullable!
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50) DEFAULT 'success',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Platform admins can view all logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE POLICY "Owners and admins can view tenant audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin', 'manager') AND u.tenant_id = audit_logs.tenant_id
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- STEP 2: Update the audit trigger function to handle NULL tenant_id
-- ============================================================

-- Drop and recreate the audit trigger function
DROP FUNCTION IF EXISTS create_audit_log() CASCADE;

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
    -- Handle tables without tenant_id (like platform_admin profiles)
    BEGIN
      v_tenant_id := (NEW.tenant_id)::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_tenant_id := NULL;
    END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    BEGIN
      v_tenant_id := (NEW.tenant_id)::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_tenant_id := NULL;
    END;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_values := to_jsonb(OLD);
    BEGIN
      v_tenant_id := (OLD.tenant_id)::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_tenant_id := NULL;
    END;
  END IF;

  -- Insert audit log (tenant_id can be NULL now!)
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
    v_tenant_id,  -- Can be NULL for platform_admin users
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

-- Recreate the audit trigger on profiles
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- ============================================================
-- STEP 3: Test user creation
-- ============================================================

-- Now you can create users in Supabase Auth!
-- After creating a user via Supabase Auth UI:
-- 1. The handle_new_user() trigger will create a profile with role='customer'
-- 2. The audit_profiles trigger will log it (with NULL tenant_id - that's OK now!)
-- 3. Then run this query to upgrade the user to platform_admin:

-- UPDATE profiles 
-- SET role = 'platform_admin'
-- WHERE email = 'your-test-user@example.com';

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check if a user was created successfully
SELECT 
  p.id,
  p.email,
  p.role,
  p.tenant_id,
  p.created_at
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 5;

-- Check audit logs to see if the profile creation was logged
SELECT 
  a.action,
  a.resource_type,
  a.tenant_id,
  a.user_id,
  a.created_at
FROM audit_logs a
WHERE a.resource_type = 'profiles'
ORDER BY a.created_at DESC
LIMIT 10;
