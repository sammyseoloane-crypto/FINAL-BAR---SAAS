-- ============================================================
-- TWO-FACTOR AUTHENTICATION (2FA) SYSTEM
-- Enhanced security with TOTP, SMS, and backup codes
-- Created: 2026-03-11
-- ============================================================

-- Create 2fa_settings table
CREATE TABLE IF NOT EXISTS two_factor_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  method VARCHAR(50), -- 'totp', 'sms', 'email'
  phone_number VARCHAR(20),
  phone_verified BOOLEAN DEFAULT FALSE,
  totp_secret VARCHAR(100),
  totp_verified BOOLEAN DEFAULT FALSE,
  backup_codes_generated_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create 2fa_backup_codes table
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create 2fa_verification_attempts table
CREATE TABLE IF NOT EXISTS two_factor_verification_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create security_settings table
CREATE TABLE IF NOT EXISTS security_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  password_last_changed TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  password_change_required BOOLEAN DEFAULT FALSE,
  session_timeout_minutes INTEGER DEFAULT 60,
  require_2fa BOOLEAN DEFAULT FALSE,
  allowed_ip_addresses JSONB,
  blocked_ip_addresses JSONB,
  login_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create login_history table
CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  location JSONB, -- { "country": "ZA", "city": "Cape Town" }
  two_factor_used BOOLEAN DEFAULT FALSE,
  failure_reason VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create session_management table
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create password_reset_tokens table (enhanced)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create GDPR/POPIA compliance tables
CREATE TABLE IF NOT EXISTS data_consent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type VARCHAR(100) NOT NULL, -- 'marketing', 'analytics', 'third_party'
  consented BOOLEAN NOT NULL,
  consented_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  version VARCHAR(20), -- Privacy policy version
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS data_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL, -- 'export', 'delete', 'rectify'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(user_id, request_type, status)
);

-- Indexes
CREATE INDEX idx_2fa_settings_user ON two_factor_settings(user_id);
CREATE INDEX idx_2fa_backup_codes_user ON two_factor_backup_codes(user_id);
CREATE INDEX idx_2fa_verification_user ON two_factor_verification_attempts(user_id);
CREATE INDEX idx_security_settings_user ON security_settings(user_id);
CREATE INDEX idx_login_history_user ON login_history(user_id);
CREATE INDEX idx_login_history_created ON login_history(created_at DESC);
CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_expires ON active_sessions(expires_at);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_data_consent_user ON data_consent(user_id);
CREATE INDEX idx_data_requests_user ON data_requests(user_id);

-- Enable RLS
ALTER TABLE two_factor_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own 2FA settings"
  ON two_factor_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own 2FA settings"
  ON two_factor_settings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their backup codes"
  ON two_factor_backup_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their verification attempts"
  ON two_factor_verification_attempts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their security settings"
  ON security_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their security settings"
  ON security_settings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their login history"
  ON login_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their active sessions"
  ON active_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view their data consents"
  ON data_consent FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their data requests"
  ON data_requests FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- 2FA & SECURITY HELPER FUNCTIONS
-- ============================================================

-- Function to generate backup codes
CREATE OR REPLACE FUNCTION generate_backup_codes(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_codes TEXT[] := ARRAY[]::TEXT[];
  v_code TEXT;
  v_i INTEGER;
BEGIN
  -- Delete old backup codes
  DELETE FROM two_factor_backup_codes WHERE user_id = p_user_id;

  -- Generate 10 backup codes
  FOR v_i IN 1..10 LOOP
    v_code := UPPER(SUBSTRING(MD5(random()::TEXT || p_user_id::TEXT) FROM 1 FOR 8));
    v_codes := array_append(v_codes, v_code);
    
    -- Store hashed version
    INSERT INTO two_factor_backup_codes (user_id, code_hash)
    VALUES (p_user_id, crypt(v_code, gen_salt('bf')));
  END LOOP;

  -- Update 2FA settings
  UPDATE two_factor_settings
  SET backup_codes_generated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('codes', v_codes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify backup code
CREATE OR REPLACE FUNCTION verify_backup_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_backup_code two_factor_backup_codes;
BEGIN
  -- Find matching unused backup code
  SELECT * INTO v_backup_code
  FROM two_factor_backup_codes
  WHERE user_id = p_user_id
    AND used = FALSE
    AND code_hash = crypt(p_code, code_hash)
  LIMIT 1;

  IF FOUND THEN
    -- Mark as used
    UPDATE two_factor_backup_codes
    SET used = TRUE, used_at = NOW()
    WHERE id = v_backup_code.id;

    -- Log attempt
    INSERT INTO two_factor_verification_attempts (user_id, method, success)
    VALUES (p_user_id, 'backup_code', TRUE);

    RETURN TRUE;
  ELSE
    -- Log failed attempt
    INSERT INTO two_factor_verification_attempts (user_id, method, success)
    VALUES (p_user_id, 'backup_code', FALSE);

    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log login attempt
CREATE OR REPLACE FUNCTION log_login_attempt(
  p_user_id UUID,
  p_success BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_two_factor_used BOOLEAN DEFAULT FALSE,
  p_failure_reason VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO login_history (
    user_id,
    success,
    ip_address,
    user_agent,
    two_factor_used,
    failure_reason
  ) VALUES (
    p_user_id,
    p_success,
    p_ip_address,
    p_user_agent,
    p_two_factor_used,
    p_failure_reason
  );

  -- Update 2FA last used timestamp
  IF p_success AND p_two_factor_used THEN
    UPDATE two_factor_settings
    SET last_used_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM active_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke all user sessions
CREATE OR REPLACE FUNCTION revoke_all_sessions(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM active_sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to export user data (GDPR/POPIA compliance)
CREATE OR REPLACE FUNCTION export_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_data JSONB;
  v_profile JSONB;
  v_transactions JSONB;
  v_loyalty JSONB;
  v_consents JSONB;
BEGIN
  -- Get user profile
  SELECT to_jsonb(p.*) INTO v_profile
  FROM profiles p
  WHERE p.user_id = p_user_id;

  -- Get transactions
  SELECT jsonb_agg(to_jsonb(t.*)) INTO v_transactions
  FROM transactions t
  WHERE t.user_id = p_user_id;

  -- Get loyalty data
  SELECT jsonb_agg(to_jsonb(cl.*)) INTO v_loyalty
  FROM customer_loyalty cl
  WHERE cl.user_id = p_user_id;

  -- Get consents
  SELECT jsonb_agg(to_jsonb(dc.*)) INTO v_consents
  FROM data_consent dc
  WHERE dc.user_id = p_user_id;

  v_user_data := jsonb_build_object(
    'profile', v_profile,
    'transactions', COALESCE(v_transactions, '[]'::jsonb),
    'loyalty', COALESCE(v_loyalty, '[]'::jsonb),
    'consents', COALESCE(v_consents, '[]'::jsonb),
    'exported_at', NOW()
  );

  -- Log the export request as completed
  UPDATE data_requests
  SET status = 'completed', completed_at = NOW()
  WHERE user_id = p_user_id AND request_type = 'export';

  RETURN v_user_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to request account deletion (GDPR/POPIA)
CREATE OR REPLACE FUNCTION request_account_deletion(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Create deletion request
  INSERT INTO data_requests (user_id, request_type, status)
  VALUES (p_user_id, 'delete', 'pending')
  ON CONFLICT (user_id, request_type, status) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Deletion request submitted. Will be processed within 30 days.',
    'requested_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check password strength
CREATE OR REPLACE FUNCTION check_password_strength(p_password TEXT)
RETURNS JSONB AS $$
DECLARE
  v_score INTEGER := 0;
  v_issues TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Length check
  IF LENGTH(p_password) >= 12 THEN
    v_score := v_score + 2;
  ELSIF LENGTH(p_password) >= 8 THEN
    v_score := v_score + 1;
  ELSE
    v_issues := array_append(v_issues, 'Password must be at least 8 characters');
  END IF;

  -- Uppercase check
  IF p_password ~ '[A-Z]' THEN
    v_score := v_score + 1;
  ELSE
    v_issues := array_append(v_issues, 'Add uppercase letters');
  END IF;

  -- Lowercase check
  IF p_password ~ '[a-z]' THEN
    v_score := v_score + 1;
  ELSE
    v_issues := array_append(v_issues, 'Add lowercase letters');
  END IF;

  -- Number check
  IF p_password ~ '[0-9]' THEN
    v_score := v_score + 1;
  ELSE
    v_issues := array_append(v_issues, 'Add numbers');
  END IF;

  -- Special character check
  IF p_password ~ '[^A-Za-z0-9]' THEN
    v_score := v_score + 1;
  ELSE
    v_issues := array_append(v_issues, 'Add special characters');
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'strength', CASE 
      WHEN v_score >= 6 THEN 'strong'
      WHEN v_score >= 4 THEN 'medium'
      ELSE 'weak'
    END,
    'issues', v_issues
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create security settings
CREATE OR REPLACE FUNCTION create_security_settings_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created_security
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_security_settings_for_user();

-- Comments
COMMENT ON TABLE two_factor_settings IS 'Two-factor authentication configuration per user';
COMMENT ON TABLE two_factor_backup_codes IS 'Hashed backup codes for 2FA recovery';
COMMENT ON TABLE security_settings IS 'User-level security preferences and requirements';
COMMENT ON TABLE login_history IS 'Audit trail of all login attempts';
COMMENT ON TABLE data_consent IS 'GDPR/POPIA consent tracking';
COMMENT ON TABLE data_requests IS 'User data export and deletion requests';
COMMENT ON FUNCTION generate_backup_codes(UUID) IS 'Generate 10 one-time backup codes for 2FA';
COMMENT ON FUNCTION export_user_data(UUID) IS 'Export all user data for GDPR/POPIA compliance';
