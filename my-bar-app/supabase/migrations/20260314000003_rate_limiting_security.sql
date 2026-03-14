-- ============================================================
-- RATE LIMITING & SECURITY ENHANCEMENTS
-- Production Protection for Nightclub Platform
-- Created: 2026-03-14
-- ============================================================

-- ============================================================
-- RATE LIMITING TABLES
-- ============================================================

-- Track API request rates per user/IP
CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifier
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  
  -- Request details
  request_method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE
  request_path TEXT NOT NULL,
  user_agent TEXT,
  
  -- Tracking
  request_count INTEGER DEFAULT 1,
  first_request_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_request_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Window tracking (reset every X minutes)
  window_start TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  window_duration_seconds INTEGER DEFAULT 60,
  
  -- Status
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_until TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_rate_limit_user ON rate_limit_requests(user_id);
CREATE INDEX idx_rate_limit_ip ON rate_limit_requests(ip_address);
CREATE INDEX idx_rate_limit_endpoint ON rate_limit_requests(endpoint);
CREATE INDEX idx_rate_limit_window ON rate_limit_requests(window_start);
CREATE INDEX idx_rate_limit_blocked ON rate_limit_requests(is_blocked) WHERE is_blocked = TRUE;

-- Failed login attempts tracking
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifier
  email VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  
  -- Attempt details
  attempt_count INTEGER DEFAULT 1,
  success BOOLEAN DEFAULT FALSE,
  failure_reason TEXT,
  
  -- Tracking
  first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Lockout
  is_locked BOOLEAN DEFAULT FALSE,
  locked_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_locked ON login_attempts(is_locked) WHERE is_locked = TRUE;
CREATE INDEX idx_login_attempts_time ON login_attempts(last_attempt_at DESC);

-- Suspicious activity log
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Event details
  event_type VARCHAR(100) NOT NULL, -- 'suspicious_qr_scan', 'rate_limit_exceeded', 'sql_injection_attempt', etc.
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  
  -- User/IP
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  
  -- Context
  endpoint VARCHAR(255),
  request_data JSONB,
  response_status INTEGER,
  
  -- Description
  event_description TEXT NOT NULL,
  alert_sent BOOLEAN DEFAULT FALSE,
  
  -- Investigation
  is_false_positive BOOLEAN DEFAULT FALSE,
  investigated_by UUID REFERENCES auth.users(id),
  investigated_at TIMESTAMP WITH TIME ZONE,
  investigation_notes TEXT,
  
  -- Action taken
  action_taken VARCHAR(100), -- 'blocked', 'warned', 'monitored', 'escalated'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_ip ON security_events(ip_address);
CREATE INDEX idx_security_events_time ON security_events(created_at DESC);

-- ============================================================
-- RATE LIMITING FUNCTIONS
-- ============================================================

-- Function to check and enforce rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_ip_address INET,
  p_endpoint VARCHAR,
  p_limit INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_requests INTEGER,
  reset_time TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_is_blocked BOOLEAN;
  v_blocked_until TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_start := TIMEZONE('utc', NOW()) - INTERVAL '1 second' * p_window_seconds;
  
  -- Check if IP is currently blocked
  SELECT is_blocked, blocked_until INTO v_is_blocked, v_blocked_until
  FROM rate_limit_requests
  WHERE ip_address = p_ip_address
    AND endpoint = p_endpoint
    AND is_blocked = TRUE
    AND blocked_until > TIMEZONE('utc', NOW())
  LIMIT 1;
  
  IF v_is_blocked THEN
    RETURN QUERY SELECT FALSE, 0, v_blocked_until;
    RETURN;
  END IF;
  
  -- Count requests in current window
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM rate_limit_requests
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
    AND ip_address = p_ip_address
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;
  
  -- Check if limit exceeded
  IF v_current_count >= p_limit THEN
    -- Block the IP temporarily
    INSERT INTO rate_limit_requests (
      user_id, ip_address, endpoint, request_count,
      window_start, window_duration_seconds,
      is_blocked, blocked_until, blocked_reason
    ) VALUES (
      p_user_id, p_ip_address, p_endpoint, 1,
      TIMEZONE('utc', NOW()), p_window_seconds,
      TRUE, TIMEZONE('utc', NOW()) + INTERVAL '15 minutes',
      'Rate limit exceeded'
    );
    
    -- Log security event
    INSERT INTO security_events (
      event_type, severity, user_id, ip_address,
      endpoint, event_description
    ) VALUES (
      'rate_limit_exceeded', 'medium', p_user_id, p_ip_address,
      p_endpoint, 'User exceeded rate limit: ' || p_limit || ' requests per ' || p_window_seconds || ' seconds'
    );
    
    RETURN QUERY SELECT FALSE, 0, (TIMEZONE('utc', NOW()) + INTERVAL '15 minutes')::TIMESTAMP WITH TIME ZONE;
  ELSE
    -- Allow request and increment counter
    INSERT INTO rate_limit_requests (
      user_id, ip_address, endpoint, request_count,
      window_start, window_duration_seconds
    ) VALUES (
      p_user_id, p_ip_address, p_endpoint, 1,
      TIMEZONE('utc', NOW()), p_window_seconds
    )
    ON CONFLICT DO NOTHING;
    
    RETURN QUERY SELECT 
      TRUE, 
      (p_limit - v_current_count - 1)::INTEGER,
      (v_window_start + INTERVAL '1 second' * p_window_seconds)::TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track failed login attempts
CREATE OR REPLACE FUNCTION track_login_attempt(
  p_email VARCHAR,
  p_ip_address INET,
  p_user_agent TEXT,
  p_success BOOLEAN,
  
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_attempt_count INTEGER;
  v_is_locked BOOLEAN;
BEGIN
  -- Check existing attempts in last 15 minutes
  SELECT 
    COALESCE(SUM(attempt_count), 0),
    BOOL_OR(is_locked AND locked_until > TIMEZONE('utc', NOW()))
  INTO v_attempt_count, v_is_locked
  FROM login_attempts
  WHERE email = p_email
    AND last_attempt_at > TIMEZONE('utc', NOW()) - INTERVAL '15 minutes';
  
  -- If already locked, deny
  IF v_is_locked THEN
    RETURN FALSE;
  END IF;
  
  -- Insert or update attempt record
  INSERT INTO login_attempts (
    email, ip_address, user_agent, attempt_count,
    success, failure_reason, first_attempt_at, last_attempt_at
  ) VALUES (
    p_email, p_ip_address, p_user_agent, 1,
    p_success, p_failure_reason,
    TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW())
  )
  ON CONFLICT DO NOTHING;
  
  -- If failed login and exceeded threshold (5 attempts), lock account
  IF NOT p_success AND v_attempt_count >= 5 THEN
    UPDATE login_attempts
    SET is_locked = TRUE,
        locked_until = TIMEZONE('utc', NOW()) + INTERVAL '30 minutes'
    WHERE email = p_email
      AND last_attempt_at > TIMEZONE('utc', NOW()) - INTERVAL '15 minutes';
    
    -- Log security event
    INSERT INTO security_events (
      event_type, severity, ip_address, user_agent,
      event_description
    ) VALUES (
      'account_locked', 'high', p_ip_address, p_user_agent,
      'Account locked due to excessive failed login attempts: ' || p_email
    );
    
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log suspicious activity
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type VARCHAR,
  p_severity VARCHAR,
  p_user_id UUID,
  p_ip_address INET,
  p_endpoint VARCHAR,
  p_description TEXT,
  p_request_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (
    event_type, severity, user_id, ip_address,
    endpoint, event_description, request_data
  ) VALUES (
    p_event_type, p_severity, p_user_id, p_ip_address,
    p_endpoint, p_description, p_request_data
  )
  RETURNING id INTO v_event_id;
  
  -- If critical severity, could trigger alerts here
  IF p_severity = 'critical' THEN
    -- Could integrate with notification system
    RAISE NOTICE 'CRITICAL SECURITY EVENT: %', p_description;
  END IF;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CLEANUP FUNCTIONS
-- ============================================================

-- Clean up old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_records()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limit_requests
  WHERE created_at < TIMEZONE('utc', NOW()) - INTERVAL '1 hour'
    AND is_blocked = FALSE;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Clean up old login attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_login_attempts()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < TIMEZONE('utc', NOW()) - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (Admin only access)
-- ============================================================

-- Rate limit requests - Admin only
CREATE POLICY rate_limit_requests_admin_only ON rate_limit_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Login attempts - Admin only
CREATE POLICY login_attempts_admin_only ON login_attempts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Security events - Admin only
CREATE POLICY security_events_admin_only ON security_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- SCHEDULED CLEANUP (Execute daily via cron or pg_cron)
-- ============================================================

-- Example cron job (if pg_cron extension is installed):
-- SELECT cron.schedule('cleanup-rate-limits', '0 */1 * * *', 'SELECT cleanup_rate_limit_records()');
-- SELECT cron.schedule('cleanup-login-attempts', '0 2 * * *', 'SELECT cleanup_login_attempts()');

-- ============================================================
-- USAGE EXAMPLES
-- ============================================================

/*
-- Check rate limit for user
SELECT * FROM check_rate_limit(
  '123e4567-e89b-12d3-a456-426614174000'::UUID, -- user_id
  '192.168.1.1'::INET, -- ip_address
  '/api/transactions', -- endpoint
  100, -- limit (requests)
  60 -- window (seconds)
);

-- Track login attempt
SELECT track_login_attempt(
  'user@example.com', -- email
  '192.168.1.1'::INET, -- ip_address
  'Mozilla/5.0...', -- user_agent
  FALSE, -- success
  'Invalid password' -- failure_reason
);

-- Log security event
SELECT log_security_event(
  'suspicious_qr_scan', -- event_type
  'medium', -- severity
  '123e4567-e89b-12d3-a456-426614174000'::UUID, -- user_id
  '192.168.1.1'::INET, -- ip_address
  '/api/qr/validate', -- endpoint
  'Unusual QR scan pattern detected', -- description
  '{"qr_code": "ABC123", "scan_count": 10}'::JSONB -- request_data
);

-- Clean up old records
SELECT cleanup_rate_limit_records();
SELECT cleanup_login_attempts();
*/
