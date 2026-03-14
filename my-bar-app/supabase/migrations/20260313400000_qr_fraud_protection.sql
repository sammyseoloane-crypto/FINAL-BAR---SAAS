-- ============================================================
-- QR CODE FRAUD PROTECTION
-- Prevent duplicate scans and track usage
-- Created: 2026-03-13
-- ============================================================

-- Add fraud protection columns to qr_codes table
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0 CHECK (scan_count >= 0);
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS scan_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT TRUE;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS invalidation_reason TEXT;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create indexes for fraud detection
CREATE INDEX IF NOT EXISTS idx_qr_codes_is_valid ON qr_codes(is_valid);
CREATE INDEX IF NOT EXISTS idx_qr_codes_scan_count ON qr_codes(scan_count) WHERE scan_count > 1;
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at) WHERE expires_at IS NOT NULL;

-- Create qr_scan_history table for audit trail
CREATE TABLE IF NOT EXISTS qr_scan_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  scanned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_result VARCHAR(50) NOT NULL CHECK (scan_result IN ('success', 'already_used', 'expired', 'invalid', 'fraud_detected')),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  fraud_score DECIMAL(3, 2), -- 0.00 to 1.00, higher = more suspicious
  fraud_indicators JSONB, -- Array of detected fraud patterns
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_qr_scan_history_qr_code_id ON qr_scan_history(qr_code_id);
CREATE INDEX idx_qr_scan_history_scanned_by ON qr_scan_history(scanned_by);
CREATE INDEX idx_qr_scan_history_scan_result ON qr_scan_history(scan_result);
CREATE INDEX idx_qr_scan_history_created_at ON qr_scan_history(created_at DESC);
CREATE INDEX idx_qr_scan_history_fraud_score ON qr_scan_history(fraud_score) WHERE fraud_score > 0.5;

-- Enable RLS
ALTER TABLE qr_scan_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for qr_scan_history
CREATE POLICY "Staff can view scan history"
  ON qr_scan_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM qr_codes qr
      INNER JOIN transactions t ON t.id = qr.transaction_id
      INNER JOIN get_user_tenant_and_role() AS u ON u.role IN ('owner', 'admin', 'staff') AND u.tenant_id = t.tenant_id
      WHERE qr.id = qr_scan_history.qr_code_id
    )
  );

CREATE POLICY "System can insert scan history"
  ON qr_scan_history FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- FRAUD DETECTION FUNCTIONS
-- ============================================================

-- Function to detect potential fraud patterns
CREATE OR REPLACE FUNCTION detect_qr_fraud(
  p_qr_code_id UUID,
  p_scanned_by UUID,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE (
  is_fraud BOOLEAN,
  fraud_score DECIMAL(3, 2),
  indicators JSONB
) AS $$
DECLARE
  v_scan_count INTEGER;
  v_recent_scans INTEGER;
  v_different_ips INTEGER;
  v_time_since_creation INTERVAL;
  v_score DECIMAL(3, 2) := 0.0;
  v_indicators JSONB := '[]'::JSONB;
BEGIN
  -- Get current scan count
  SELECT qr_codes.scan_count INTO v_scan_count
  FROM qr_codes
  WHERE id = p_qr_code_id;
  
  -- Check 1: Already scanned (highest priority)
  IF v_scan_count > 0 THEN
    v_score := v_score + 0.5;
    v_indicators := v_indicators || '["already_scanned"]'::JSONB;
  END IF;
  
  -- Check 2: Multiple scans in short time period
  SELECT COUNT(*) INTO v_recent_scans
  FROM qr_scan_history
  WHERE qr_code_id = p_qr_code_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF v_recent_scans > 3 THEN
    v_score := v_score + 0.3;
    v_indicators := v_indicators || '["rapid_multiple_scans"]'::JSONB;
  END IF;
  
  -- Check 3: Different IP addresses
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(DISTINCT ip_address) INTO v_different_ips
    FROM qr_scan_history
    WHERE qr_code_id = p_qr_code_id
      AND ip_address IS NOT NULL;
    
    IF v_different_ips > 2 THEN
      v_score := v_score + 0.2;
      v_indicators := v_indicators || '["multiple_ip_addresses"]'::JSONB;
    END IF;
  END IF;
  
  -- Check 4: Scan shortly after creation (potential fraud)
  SELECT AGE(NOW(), created_at) INTO v_time_since_creation
  FROM qr_codes
  WHERE id = p_qr_code_id;
  
  IF v_time_since_creation < INTERVAL '5 minutes' AND v_scan_count > 0 THEN
    v_score := v_score + 0.15;
    v_indicators := v_indicators || '["suspicious_timing"]'::JSONB;
  END IF;
  
  -- Normalize score to max 1.0
  v_score := LEAST(v_score, 1.0);
  
  RETURN QUERY SELECT 
    v_score > 0.5,
    v_score,
    v_indicators;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and scan QR code
CREATE OR REPLACE FUNCTION validate_qr_code(
  p_qr_code VARCHAR,
  p_scanned_by UUID,
  p_location_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_valid BOOLEAN,
  status VARCHAR,
  message TEXT,
  transaction_id UUID,
  qr_code_id UUID,
  fraud_detected BOOLEAN
) AS $$
DECLARE
  v_qr RECORD;
  v_fraud_check RECORD;
  v_scan_result VARCHAR;
  v_message TEXT;
BEGIN
  -- Find QR code
  SELECT * INTO v_qr
  FROM qr_codes
  WHERE code = p_qr_code;
  
  IF v_qr.id IS NULL THEN
    -- QR code not found
    RETURN QUERY SELECT 
      FALSE,
      'invalid'::VARCHAR,
      'QR code not found'::TEXT,
      NULL::UUID,
      NULL::UUID,
      FALSE;
    RETURN;
  END IF;
  
  -- Check if already invalidated
  IF v_qr.is_valid = FALSE THEN
    v_scan_result := 'invalid';
    v_message := 'QR code has been invalidated: ' || COALESCE(v_qr.invalidation_reason, 'Unknown reason');
    
    -- Log scan attempt
    INSERT INTO qr_scan_history (
      qr_code_id,
      transaction_id,
      scanned_by,
      scan_result,
      location_id,
      ip_address,
      user_agent,
      notes
    ) VALUES (
      v_qr.id,
      v_qr.transaction_id,
      p_scanned_by,
      v_scan_result,
      p_location_id,
      p_ip_address,
      p_user_agent,
      v_message
    );
    
    RETURN QUERY SELECT 
      FALSE,
      v_scan_result,
      v_message,
      v_qr.transaction_id,
      v_qr.id,
      FALSE;
    RETURN;
  END IF;
  
  -- Check if expired
  IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < NOW() THEN
    v_scan_result := 'expired';
    v_message := 'QR code has expired';
    
    -- Log scan attempt
    INSERT INTO qr_scan_history (
      qr_code_id,
      transaction_id,
      scanned_by,
      scan_result,
      location_id,
      ip_address,
      user_agent,
      notes
    ) VALUES (
      v_qr.id,
      v_qr.transaction_id,
      p_scanned_by,
      v_scan_result,
      p_location_id,
      p_ip_address,
      p_user_agent,
      v_message
    );
    
    RETURN QUERY SELECT 
      FALSE,
      v_scan_result,
      v_message,
      v_qr.transaction_id,
      v_qr.id,
      FALSE;
    RETURN;
  END IF;
  
  -- Check if already used
  IF v_qr.scanned_at IS NOT NULL THEN
    v_scan_result := 'already_used';
    v_message := 'QR code has already been scanned at ' || v_qr.scanned_at::TEXT;
    
    -- Detect fraud
    SELECT * INTO v_fraud_check
    FROM detect_qr_fraud(v_qr.id, p_scanned_by, p_ip_address);
    
    -- Log scan attempt with fraud info
    INSERT INTO qr_scan_history (
      qr_code_id,
      transaction_id,
      scanned_by,
      scan_result,
      location_id,
      ip_address,
      user_agent,
      fraud_score,
      fraud_indicators,
      notes
    ) VALUES (
      v_qr.id,
      v_qr.transaction_id,
      p_scanned_by,
      CASE WHEN v_fraud_check.is_fraud THEN 'fraud_detected' ELSE v_scan_result END,
      p_location_id,
      p_ip_address,
      p_user_agent,
      v_fraud_check.fraud_score,
      v_fraud_check.indicators,
      v_message
    );
    
    RETURN QUERY SELECT 
      FALSE,
      v_scan_result,
      v_message,
      v_qr.transaction_id,
      v_qr.id,
      v_fraud_check.is_fraud;
    RETURN;
  END IF;
  
  -- QR code is valid - mark as scanned
  UPDATE qr_codes
  SET 
    scanned_at = NOW(),
    used_by = p_scanned_by,
    scan_count = scan_count + 1,
    scan_location_id = p_location_id,
    ip_address = p_ip_address,
    user_agent = p_user_agent
  WHERE id = v_qr.id;
  
  -- Log successful scan
  INSERT INTO qr_scan_history (
    qr_code_id,
    transaction_id,
    scanned_by,
    scan_result,
    location_id,
    ip_address,
    user_agent,
    fraud_score,
    notes
  ) VALUES (
    v_qr.id,
    v_qr.transaction_id,
    p_scanned_by,
    'success',
    p_location_id,
    p_ip_address,
    p_user_agent,
    0.0,
    'QR code scanned successfully'
  );
  
  v_scan_result := 'success';
  v_message := 'QR code validated successfully';
  
  RETURN QUERY SELECT 
    TRUE,
    v_scan_result,
    v_message,
    v_qr.transaction_id,
    v_qr.id,
    FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to invalidate QR code
CREATE OR REPLACE FUNCTION invalidate_qr_code(
  p_qr_code_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE qr_codes
  SET 
    is_valid = FALSE,
    invalidated_at = NOW(),
    invalidation_reason = p_reason
  WHERE id = p_qr_code_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get QR code fraud statistics for tenant
CREATE OR REPLACE FUNCTION get_qr_fraud_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_scans BIGINT,
  successful_scans BIGINT,
  duplicate_scans BIGINT,
  fraud_attempts BIGINT,
  fraud_rate DECIMAL(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) AS total_scans,
    COUNT(*) FILTER (WHERE scan_result = 'success') AS successful_scans,
    COUNT(*) FILTER (WHERE scan_result = 'already_used') AS duplicate_scans,
    COUNT(*) FILTER (WHERE scan_result = 'fraud_detected') AS fraud_attempts,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE scan_result = 'fraud_detected')::DECIMAL / COUNT(*) * 100)
      ELSE 0
    END AS fraud_rate
  FROM qr_scan_history qsh
  INNER JOIN qr_codes qr ON qr.id = qsh.qr_code_id
  INNER JOIN transactions t ON t.id = qr.transaction_id
  WHERE t.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE qr_scan_history IS 'Audit trail of all QR code scan attempts including fraud detection';
COMMENT ON COLUMN qr_codes.scan_count IS 'Number of times this QR code has been scanned (should be 0 or 1 for valid codes)';
COMMENT ON COLUMN qr_codes.used_by IS 'Staff member who scanned the QR code';
COMMENT ON FUNCTION validate_qr_code IS 'Validates QR code, checks for fraud, and marks as used';
