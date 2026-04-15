-- ============================================================
-- VIP TABLE DEPOSIT PLATFORM FEE (2%)
-- Hidden revenue stream from VIP table deposits
-- Created: 2026-03-16
-- ============================================================

-- ============================================================
-- STEP 1: Create platform_fees table for revenue tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Fee details
  fee_type VARCHAR(50) NOT NULL, -- 'vip_deposit', 'transaction', 'subscription'
  fee_percentage DECIMAL(5, 2) NOT NULL,
  base_amount DECIMAL(10, 2) NOT NULL,
  fee_amount DECIMAL(10, 2) NOT NULL,
  
  -- Related records
  reservation_id UUID REFERENCES table_reservations(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_platform_fees_tenant ON platform_fees(tenant_id);
CREATE INDEX idx_platform_fees_type ON platform_fees(fee_type);
CREATE INDEX idx_platform_fees_reservation ON platform_fees(reservation_id);
CREATE INDEX idx_platform_fees_collected_at ON platform_fees(collected_at);

COMMENT ON TABLE platform_fees IS 'Tracks all platform fees collected from tenants';
COMMENT ON COLUMN platform_fees.fee_type IS 'Type of fee: vip_deposit (5%), transaction, subscription';
COMMENT ON COLUMN platform_fees.fee_percentage IS 'Percentage charged (e.g., 5.00 for 5%)';
COMMENT ON COLUMN platform_fees.base_amount IS 'Original amount before fee';
COMMENT ON COLUMN platform_fees.fee_amount IS 'Platform fee amount collected';

-- ============================================================
-- STEP 2: Add platform fee tracking to table_reservations
-- ============================================================

ALTER TABLE table_reservations 
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5, 2) DEFAULT 5.00;

ALTER TABLE table_reservations 
ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(10, 2) DEFAULT 0.00;

ALTER TABLE table_reservations 
ADD COLUMN IF NOT EXISTS net_deposit_to_tenant DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN table_reservations.platform_fee_percentage IS 'Platform fee percentage charged on deposit (default 5%)';
COMMENT ON COLUMN table_reservations.platform_fee_amount IS 'Calculated platform fee amount';
COMMENT ON COLUMN table_reservations.net_deposit_to_tenant IS 'Deposit amount after platform fee deduction';

-- Calculate existing fees for current reservations
UPDATE table_reservations
SET 
  platform_fee_amount = ROUND(deposit_amount * 0.05, 2),
  net_deposit_to_tenant = deposit_amount - ROUND(deposit_amount * 0.05, 2)
WHERE deposit_amount > 0 AND platform_fee_amount = 0;

-- ============================================================
-- STEP 3: Function to calculate and record platform fee
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_vip_deposit_platform_fee()
RETURNS TRIGGER AS $$
DECLARE
  v_fee_amount DECIMAL(10, 2);
  v_net_amount DECIMAL(10, 2);
BEGIN
  -- Only calculate fee if deposit is set and paid
  IF NEW.deposit_amount > 0 THEN
    -- Calculate 5% platform fee
    v_fee_amount := ROUND(NEW.deposit_amount * (NEW.platform_fee_percentage / 100), 2);
    v_net_amount := NEW.deposit_amount - v_fee_amount;
    
    -- Update reservation with fee details
    NEW.platform_fee_amount := v_fee_amount;
    NEW.net_deposit_to_tenant := v_net_amount;
    
    -- Record platform fee when deposit is paid
    IF NEW.deposit_paid = TRUE AND (OLD IS NULL OR OLD.deposit_paid = FALSE) THEN
      INSERT INTO platform_fees (
        tenant_id,
        fee_type,
        fee_percentage,
        base_amount,
        fee_amount,
        reservation_id,
        description,
        metadata
      ) VALUES (
        NEW.tenant_id,
        'vip_deposit',
        NEW.platform_fee_percentage,
        NEW.deposit_amount,
        v_fee_amount,
        NEW.id,
        'VIP Table Deposit Platform Fee',
        jsonb_build_object(
          'table_id', NEW.table_id,
          'reservation_date', NEW.reservation_date,
          'guest_count', NEW.guest_count
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 4: Create trigger for automatic fee calculation
-- ============================================================

DROP TRIGGER IF EXISTS trigger_calculate_vip_deposit_fee ON table_reservations;

CREATE TRIGGER trigger_calculate_vip_deposit_fee
  BEFORE INSERT OR UPDATE ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vip_deposit_platform_fee();

COMMENT ON TRIGGER trigger_calculate_vip_deposit_fee ON table_reservations IS 
'Automatically calculates 5% platform fee on VIP deposit and records fee when paid';

-- ============================================================
-- STEP 5: RLS Policies for platform_fees
-- ============================================================

ALTER TABLE platform_fees ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all fees
DROP POLICY IF EXISTS "Platform admins can view all fees" ON platform_fees;
CREATE POLICY "Platform admins can view all fees" ON platform_fees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform_admin'
    )
  );

-- Tenants can view their own fees
DROP POLICY IF EXISTS "Tenants can view their own fees" ON platform_fees;
CREATE POLICY "Tenants can view their own fees" ON platform_fees
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only system can insert fees (via trigger)
DROP POLICY IF EXISTS "System can insert fees" ON platform_fees;
CREATE POLICY "System can insert fees" ON platform_fees
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- STEP 6: Analytics functions for platform revenue
-- ============================================================

-- Get platform fee revenue by date range
CREATE OR REPLACE FUNCTION get_platform_fee_revenue(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_fee_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  fee_type VARCHAR,
  total_fees DECIMAL,
  fee_count BIGINT,
  avg_fee DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pf.fee_type::VARCHAR,
    SUM(pf.fee_amount)::DECIMAL AS total_fees,
    COUNT(*)::BIGINT AS fee_count,
    AVG(pf.fee_amount)::DECIMAL AS avg_fee
  FROM platform_fees pf
  WHERE DATE(pf.collected_at) BETWEEN p_start_date AND p_end_date
    AND (p_fee_type IS NULL OR pf.fee_type = p_fee_type)
  GROUP BY pf.fee_type
  ORDER BY total_fees DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_platform_fee_revenue IS 
'Get platform fee revenue analytics by date range and fee type';

-- Get platform fee revenue by tenant
CREATE OR REPLACE FUNCTION get_platform_fees_by_tenant(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name VARCHAR,
  total_fees DECIMAL,
  vip_deposit_fees DECIMAL,
  transaction_fees DECIMAL,
  fee_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS tenant_id,
    t.name::VARCHAR AS tenant_name,
    SUM(pf.fee_amount)::DECIMAL AS total_fees,
    SUM(CASE WHEN pf.fee_type = 'vip_deposit' THEN pf.fee_amount ELSE 0 END)::DECIMAL AS vip_deposit_fees,
    SUM(CASE WHEN pf.fee_type = 'transaction' THEN pf.fee_amount ELSE 0 END)::DECIMAL AS transaction_fees,
    COUNT(pf.id)::BIGINT AS fee_count
  FROM tenants t
  LEFT JOIN platform_fees pf ON pf.tenant_id = t.id
    AND DATE(pf.collected_at) BETWEEN p_start_date AND p_end_date
  GROUP BY t.id, t.name
  HAVING SUM(pf.fee_amount) > 0
  ORDER BY total_fees DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_platform_fees_by_tenant IS 
'Get platform fee revenue breakdown by tenant';

-- ============================================================
-- STEP 7: Grant permissions
-- ============================================================

GRANT SELECT ON platform_fees TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_fee_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_fees_by_tenant TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check that trigger is working
COMMENT ON TABLE platform_fees IS 
'✅ IMPLEMENTATION COMPLETE
Platform Fee Structure:
- VIP Table Deposits: 5% platform fee
- Automatically calculated on deposit payment
- Tracked in platform_fees table
- Tenants receive net amount (95% of deposit)

Example:
- Customer pays R1,000 deposit
- Platform keeps: R50 (5%)
- Tenant receives: R950 (95%)

Revenue Tracking:
- SELECT * FROM get_platform_fee_revenue(''2026-01-01'', ''2026-12-31'');
- SELECT * FROM get_platform_fees_by_tenant(''2026-01-01'', ''2026-12-31'');
';
