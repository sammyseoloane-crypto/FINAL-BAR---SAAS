-- ============================================================
-- MULTI-CURRENCY & TAX COMPLIANCE SYSTEM
-- Support for multiple currencies, tax calculation, and financial compliance
-- Created: 2026-03-11
-- ============================================================

-- Add currency support to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) DEFAULT 'ZAR';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_registration_name VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_system VARCHAR(50) DEFAULT 'VAT'; -- 'VAT', 'GST', 'Sales Tax'
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_tax_rate DECIMAL(5, 2) DEFAULT 15.00; -- VAT 15% for South Africa

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  decimal_places INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
  to_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
  rate DECIMAL(15, 8) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(100), -- 'manual', 'api', 'bank'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(from_currency, to_currency, effective_date)
);

-- Create tax_categories table
CREATE TABLE IF NOT EXISTS tax_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  rate DECIMAL(5, 2) NOT NULL,
  description TEXT,
  is_inclusive BOOLEAN DEFAULT TRUE, -- Price includes tax
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add tax and currency columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_category_id UUID REFERENCES tax_categories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) DEFAULT 'ZAR';
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2);

-- Add tax and currency columns to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'ZAR';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15, 8);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_base_currency DECIMAL(10, 2); -- Amount in tenant's base currency

-- Create tax_reports table for compliance
CREATE TABLE IF NOT EXISTS tax_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL, -- 'VAT_RETURN', 'SALES_TAX', 'GST_RETURN'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales DECIMAL(15, 2) NOT NULL,
  total_tax_collected DECIMAL(15, 2) NOT NULL,
  total_refunds DECIMAL(15, 2) DEFAULT 0,
  total_tax_refunded DECIMAL(15, 2) DEFAULT 0,
  net_tax_payable DECIMAL(15, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'paid'
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by UUID REFERENCES auth.users(id),
  report_data JSONB, -- Detailed breakdown
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX idx_exchange_rates_from ON exchange_rates(from_currency);
CREATE INDEX idx_exchange_rates_to ON exchange_rates(to_currency);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(effective_date DESC);
CREATE INDEX idx_tax_categories_tenant ON tax_categories(tenant_id);
CREATE INDEX idx_tax_reports_tenant ON tax_reports(tenant_id);
CREATE INDEX idx_tax_reports_period ON tax_reports(period_start, period_end);

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active currencies"
  ON currencies FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view exchange rates"
  ON exchange_rates FOR SELECT
  USING (true);

CREATE POLICY "Users can view tenant tax categories"
  ON tax_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.tenant_id = tax_categories.tenant_id
    )
  );

CREATE POLICY "Admins can manage tax categories"
  ON tax_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = tax_categories.tenant_id
    )
  );

CREATE POLICY "Owners can view tax reports"
  ON tax_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = tax_reports.tenant_id
    )
  );

CREATE POLICY "Owners can manage tax reports"
  ON tax_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = tax_reports.tenant_id
    )
  );

-- ============================================================
-- INSERT DEFAULT CURRENCIES
-- ============================================================

INSERT INTO currencies (code, name, symbol, decimal_places) VALUES
('ZAR', 'South African Rand', 'R', 2),
('USD', 'US Dollar', '$', 2),
('EUR', 'Euro', '€', 2),
('GBP', 'British Pound', '£', 2),
('JPY', 'Japanese Yen', '¥', 0),
('AUD', 'Australian Dollar', 'A$', 2),
('CAD', 'Canadian Dollar', 'C$', 2),
('CHF', 'Swiss Franc', 'CHF', 2),
('CNY', 'Chinese Yuan', '¥', 2),
('BWP', 'Botswana Pula', 'P', 2),
('NAD', 'Namibian Dollar', 'N$', 2),
('KES', 'Kenyan Shilling', 'KSh', 2),
('NGN', 'Nigerian Naira', '₦', 2);

-- Insert sample exchange rates (base currency ZAR)
INSERT INTO exchange_rates (from_currency, to_currency, rate, source) VALUES
('ZAR', 'USD', 0.053, 'manual'),
('USD', 'ZAR', 18.85, 'manual'),
('ZAR', 'EUR', 0.049, 'manual'),
('EUR', 'ZAR', 20.40, 'manual'),
('ZAR', 'GBP', 0.042, 'manual'),
('GBP', 'ZAR', 23.80, 'manual');

-- ============================================================
-- CURRENCY & TAX HELPER FUNCTIONS
-- ============================================================

-- Function to get latest exchange rate
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(15, 8) AS $$
DECLARE
  v_rate DECIMAL(15, 8);
BEGIN
  -- If same currency, rate is 1
  IF p_from_currency = p_to_currency THEN
    RETURN 1.0;
  END IF;

  -- Get most recent rate on or before the specified date
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'Exchange rate not found for % to % on %', p_from_currency, p_to_currency, p_date;
  END IF;

  RETURN v_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to convert currency
CREATE OR REPLACE FUNCTION convert_currency(
  p_amount DECIMAL(15, 2),
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
  v_rate DECIMAL(15, 8);
  v_converted DECIMAL(15, 2);
BEGIN
  v_rate := get_exchange_rate(p_from_currency, p_to_currency, p_date);
  v_converted := p_amount * v_rate;
  RETURN ROUND(v_converted, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate tax
CREATE OR REPLACE FUNCTION calculate_tax(
  p_amount DECIMAL(10, 2),
  p_tax_rate DECIMAL(5, 2),
  p_tax_inclusive BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  subtotal DECIMAL(10, 2),
  tax_amount DECIMAL(10, 2),
  total DECIMAL(10, 2)
) AS $$
DECLARE
  v_subtotal DECIMAL(10, 2);
  v_tax_amount DECIMAL(10, 2);
  v_total DECIMAL(10, 2);
BEGIN
  IF p_tax_inclusive THEN
    -- Price includes tax, extract it
    v_total := p_amount;
    v_tax_amount := ROUND(p_amount * p_tax_rate / (100 + p_tax_rate), 2);
    v_subtotal := v_total - v_tax_amount;
  ELSE
    -- Price excludes tax, add it
    v_subtotal := p_amount;
    v_tax_amount := ROUND(p_amount * p_tax_rate / 100, 2);
    v_total := v_subtotal + v_tax_amount;
  END IF;

  RETURN QUERY SELECT v_subtotal, v_tax_amount, v_total;
END;
$$ LANGUAGE plpgsql;

-- Function to generate tax report
CREATE OR REPLACE FUNCTION generate_tax_report(
  p_tenant_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS UUID AS $$
DECLARE
  v_report_id UUID;
  v_total_sales DECIMAL(15, 2);
  v_total_tax DECIMAL(15, 2);
  v_total_refunds DECIMAL(15, 2);
  v_total_tax_refunded DECIMAL(15, 2);
  v_net_tax DECIMAL(15, 2);
  v_report_data JSONB;
BEGIN
  -- Calculate sales and tax
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(tax_amount), 0)
  INTO v_total_sales, v_total_tax
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND status = 'confirmed'
    AND created_at::DATE BETWEEN p_period_start AND p_period_end;

  -- Calculate refunds
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(tax_amount), 0)
  INTO v_total_refunds, v_total_tax_refunded
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND status = 'refunded'
    AND created_at::DATE BETWEEN p_period_start AND p_period_end;

  -- Calculate net tax payable
  v_net_tax := v_total_tax - v_total_tax_refunded;

  -- Build detailed report data
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start', p_period_start,
      'end', p_period_end
    ),
    'sales', jsonb_build_object(
      'total', v_total_sales,
      'tax', v_total_tax
    ),
    'refunds', jsonb_build_object(
      'total', v_total_refunds,
      'tax', v_total_tax_refunded
    ),
    'breakdown_by_rate', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'tax_rate', tax_rate,
          'total_sales', SUM(amount),
          'tax_collected', SUM(tax_amount),
          'transaction_count', COUNT(*)
        )
      )
      FROM transactions
      WHERE tenant_id = p_tenant_id
        AND status = 'confirmed'
        AND created_at::DATE BETWEEN p_period_start AND p_period_end
      GROUP BY tax_rate
    )
  ) INTO v_report_data;

  -- Insert report
  INSERT INTO tax_reports (
    tenant_id,
    report_type,
    period_start,
    period_end,
    total_sales,
    total_tax_collected,
    total_refunds,
    total_tax_refunded,
    net_tax_payable,
    report_data,
    status
  ) VALUES (
    p_tenant_id,
    'VAT_RETURN',
    p_period_start,
    p_period_end,
    v_total_sales,
    v_total_tax,
    v_total_refunds,
    v_total_tax_refunded,
    v_net_tax,
    v_report_data,
    'draft'
  ) RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE currencies IS 'Supported currencies for international transactions';
COMMENT ON TABLE exchange_rates IS 'Currency exchange rates with effective dates';
COMMENT ON TABLE tax_categories IS 'Tax categories for different product types';
COMMENT ON TABLE tax_reports IS 'Tax compliance reports (VAT, GST, Sales Tax)';
COMMENT ON FUNCTION convert_currency(DECIMAL, VARCHAR, VARCHAR, DATE) IS 'Convert amount between currencies';
COMMENT ON FUNCTION calculate_tax(DECIMAL, DECIMAL, BOOLEAN) IS 'Calculate tax amounts (inclusive or exclusive)';
COMMENT ON FUNCTION generate_tax_report(UUID, DATE, DATE) IS 'Generate tax report for a period';
