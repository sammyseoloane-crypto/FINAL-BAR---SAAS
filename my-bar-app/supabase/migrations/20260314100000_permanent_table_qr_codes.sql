-- ============================================================
-- PERMANENT QR CODES FOR BAR TABS
-- Add QR token support to tables for permanent location QR codes
-- ============================================================

-- Add QR token column to tables
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(20) UNIQUE;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_tables_qr_token ON tables(qr_token) WHERE qr_token IS NOT NULL;

-- Function to generate unique QR token
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS VARCHAR(20) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar chars (I,1,O,0)
  result TEXT := '';
  i INTEGER;
  token_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    
    -- Generate 8-character token
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM tables WHERE qr_token = result) INTO token_exists;
    
    -- If unique, return it
    IF NOT token_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate QR token for new tables
CREATE OR REPLACE FUNCTION auto_generate_table_qr_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate QR token if not provided
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := generate_qr_token();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate QR tokens
DROP TRIGGER IF EXISTS trigger_auto_generate_table_qr_token ON tables;
CREATE TRIGGER trigger_auto_generate_table_qr_token
  BEFORE INSERT ON tables
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_table_qr_token();

-- Generate QR tokens for existing tables that don't have one
UPDATE tables
SET qr_token = generate_qr_token()
WHERE qr_token IS NULL;

-- Function to get table by QR token
CREATE OR REPLACE FUNCTION get_table_by_qr_token(p_token VARCHAR)
RETURNS TABLE (
  table_id UUID,
  table_name VARCHAR,
  tenant_id UUID,
  tenant_name VARCHAR,
  location_id UUID,
  capacity INTEGER,
  table_type VARCHAR,
  minimum_spend DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as table_id,
    t.name as table_name,
    t.tenant_id,
    tn.name as tenant_name,
    t.location_id,
    t.capacity,
    t.table_type,
    t.minimum_spend
  FROM tables t
  LEFT JOIN tenants tn ON t.tenant_id = tn.id
  WHERE t.qr_token = p_token
    AND t.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to regenerate QR token for a table
CREATE OR REPLACE FUNCTION regenerate_table_qr_token(p_table_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  new_token VARCHAR(20);
BEGIN
  new_token := generate_qr_token();
  
  UPDATE tables
  SET qr_token = new_token,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_table_id;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- View for QR code management
CREATE OR REPLACE VIEW table_qr_codes AS
SELECT 
  t.id as table_id,
  t.tenant_id,
  t.name as table_name,
  t.zone,
  t.capacity,
  t.table_type,
  t.qr_token,
  t.status,
  t.is_active,
  tn.name as tenant_name,
  -- Generate full QR URL
  CONCAT('/tab/start/', t.qr_token) as qr_url,
  t.created_at,
  t.updated_at
FROM tables t
LEFT JOIN tenants tn ON t.tenant_id = tn.id
WHERE t.qr_token IS NOT NULL;

GRANT SELECT ON table_qr_codes TO authenticated;

-- RLS for table_qr_codes view
CREATE POLICY table_qr_codes_tenant_isolation ON tables
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    OR
    -- Platform admins see all
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    )
  );

-- Comments
COMMENT ON COLUMN tables.qr_token IS 'Permanent QR code token for opening bar tabs';
COMMENT ON FUNCTION generate_qr_token IS 'Generate unique 8-character QR token';
COMMENT ON FUNCTION get_table_by_qr_token IS 'Look up table information by QR token';
COMMENT ON FUNCTION regenerate_table_qr_token IS 'Generate new QR token for a table';
COMMENT ON VIEW table_qr_codes IS 'Manage QR codes for tables/locations';

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check that all tables now have QR tokens
SELECT 
  COUNT(*) as total_tables,
  COUNT(qr_token) as tables_with_qr,
  COUNT(*) - COUNT(qr_token) as tables_without_qr
FROM tables;

-- View sample QR codes
SELECT 
  table_name,
  qr_token,
  qr_url,
  tenant_name
FROM table_qr_codes
LIMIT 10;

-- Test QR token lookup
SELECT * FROM get_table_by_qr_token('TEST1234');
