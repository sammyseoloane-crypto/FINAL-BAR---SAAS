-- ============================================================
-- ADVANCED ANALYTICS & REPORTING SYSTEM
-- Business intelligence, cohort analysis, and automated reports
-- Created: 2026-03-11
-- ============================================================

-- Create analytics_snapshots table (daily aggregations)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  revenue DECIMAL(15, 2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  customer_count INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  repeat_customers INTEGER DEFAULT 0,
  avg_transaction_value DECIMAL(10, 2) DEFAULT 0,
  top_product_id UUID REFERENCES products(id),
  top_product_revenue DECIMAL(10, 2),
  total_loyalty_points_awarded INTEGER DEFAULT 0,
  total_loyalty_points_redeemed INTEGER DEFAULT 0,
  peak_hour INTEGER,
  peak_hour_revenue DECIMAL(10, 2),
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, snapshot_date)
);

-- Create hourly_metrics table (for real-time dashboards)
CREATE TABLE IF NOT EXISTS hourly_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hour_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  revenue DECIMAL(10, 2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  unique_customers INTEGER DEFAULT 0,
  avg_wait_time_minutes DECIMAL(5, 2),
  staff_count INTEGER,
  location_id UUID REFERENCES locations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, hour_timestamp, location_id)
);

-- Create product_analytics table
CREATE TABLE IF NOT EXISTS product_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  units_sold INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  cost_of_goods DECIMAL(10, 2) DEFAULT 0,
  gross_profit DECIMAL(10, 2) DEFAULT 0,
  avg_selling_price DECIMAL(10, 2),
  refund_count INTEGER DEFAULT 0,
  stock_level INTEGER,
  days_until_stockout INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, product_id, date)
);

-- Create customer_metrics table
CREATE TABLE IF NOT EXISTS customer_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_purchase_date DATE,
  last_purchase_date DATE,
  total_purchases INTEGER DEFAULT 0,
  total_spent DECIMAL(15, 2) DEFAULT 0,
  avg_order_value DECIMAL(10, 2) DEFAULT 0,
  lifetime_value DECIMAL(15, 2) DEFAULT 0,
  loyalty_tier VARCHAR(50),
  days_since_last_purchase INTEGER,
  churn_risk_score DECIMAL(3, 2), -- 0.00 to 1.00
  favorite_product_id UUID REFERENCES products(id),
  favorite_location_id UUID REFERENCES locations(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, user_id)
);

-- Create cohort_analysis table
CREATE TABLE IF NOT EXISTS cohort_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cohort_month DATE NOT NULL, -- First day of month customer joined
  months_since_join INTEGER NOT NULL,
  customer_count INTEGER NOT NULL,
  retained_customers INTEGER NOT NULL,
  retention_rate DECIMAL(5, 2),
  total_revenue DECIMAL(15, 2),
  avg_revenue_per_customer DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, cohort_month, months_since_join)
);

-- Create event_analytics table
CREATE TABLE IF NOT EXISTS event_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  unique_customers INTEGER DEFAULT 0,
  avg_spend_per_customer DECIMAL(10, 2),
  top_products JSONB, -- [{product_id, name, units_sold, revenue}]
  peak_hour INTEGER,
  customer_satisfaction_score DECIMAL(3, 2),
  profit_margin DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(tenant_id, event_id)
);

-- Create scheduled_reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  report_type VARCHAR(100) NOT NULL, -- 'daily_sales', 'weekly_summary', 'monthly_financial', 'inventory', 'staff_performance'
  frequency VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
  recipients JSONB NOT NULL, -- Array of email addresses
  filters JSONB, -- Location, date range, product category
  format VARCHAR(20) DEFAULT 'pdf', -- 'pdf', 'csv', 'excel'
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create report_history table
CREATE TABLE IF NOT EXISTS report_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_data JSONB NOT NULL,
  file_url TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  sent_to JSONB,
  status VARCHAR(50) DEFAULT 'generated' -- 'generated', 'sent', 'failed'
);

-- Create custom_kpis table
CREATE TABLE IF NOT EXISTS custom_kpis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  calculation_formula TEXT NOT NULL, -- SQL query or formula
  target_value DECIMAL(15, 2),
  current_value DECIMAL(15, 2),
  unit VARCHAR(50), -- 'currency', 'percentage', 'count'
  category VARCHAR(100), -- 'revenue', 'customer', 'inventory', 'staff'
  display_on_dashboard BOOLEAN DEFAULT TRUE,
  alert_threshold DECIMAL(15, 2),
  alert_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create performance_benchmarks table
CREATE TABLE IF NOT EXISTS performance_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name VARCHAR(200) NOT NULL,
  industry_average DECIMAL(15, 2),
  tenant_value DECIMAL(15, 2),
  percentile DECIMAL(5, 2), -- Where tenant ranks compared to others
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX idx_analytics_snapshots_tenant_date ON analytics_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX idx_hourly_metrics_tenant_time ON hourly_metrics(tenant_id, hour_timestamp DESC);
CREATE INDEX idx_product_analytics_tenant_product ON product_analytics(tenant_id, product_id, date DESC);
CREATE INDEX idx_customer_metrics_tenant_user ON customer_metrics(tenant_id, user_id);
CREATE INDEX idx_customer_metrics_churn ON customer_metrics(churn_risk_score DESC) WHERE churn_risk_score > 0.7;
CREATE INDEX idx_cohort_analysis_tenant ON cohort_analysis(tenant_id, cohort_month);
CREATE INDEX idx_event_analytics_tenant_event ON event_analytics(tenant_id, event_id);
CREATE INDEX idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_report_history_tenant ON report_history(tenant_id, generated_at DESC);
CREATE INDEX idx_custom_kpis_tenant ON custom_kpis(tenant_id);

-- Enable RLS
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_benchmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view analytics"
  ON analytics_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = analytics_snapshots.tenant_id
    )
  );

CREATE POLICY "Admins can view hourly metrics"
  ON hourly_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = hourly_metrics.tenant_id
    )
  );

CREATE POLICY "Admins can view product analytics"
  ON product_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = product_analytics.tenant_id
    )
  );

CREATE POLICY "Admins can view customer metrics"
  ON customer_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = customer_metrics.tenant_id
    )
  );

CREATE POLICY "Admins can view cohort analysis"
  ON cohort_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = cohort_analysis.tenant_id
    )
  );

CREATE POLICY "Admins can manage scheduled reports"
  ON scheduled_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = scheduled_reports.tenant_id
    )
  );

CREATE POLICY "Admins can view custom KPIs"
  ON custom_kpis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = custom_kpis.tenant_id
    )
  );

-- ============================================================
-- ANALYTICS & REPORTING FUNCTIONS
-- ============================================================

-- Function to generate daily snapshot
CREATE OR REPLACE FUNCTION generate_daily_snapshot(
  p_tenant_id UUID,
  p_snapshot_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Calculate daily stats
  SELECT
    COUNT(DISTINCT t.id) as transaction_count,
    SUM(t.amount) as revenue,
    COUNT(DISTINCT t.user_id) as customer_count,
    AVG(t.amount) as avg_transaction_value,
    (
      SELECT product_id 
      FROM transactions 
      WHERE tenant_id = p_tenant_id 
        AND DATE(created_at) = p_snapshot_date
      GROUP BY product_id
      ORDER BY SUM(amount) DESC
      LIMIT 1
    ) as top_product_id
  INTO v_stats
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND DATE(t.created_at) = p_snapshot_date;

  -- Insert or update snapshot
  INSERT INTO analytics_snapshots (
    tenant_id,
    snapshot_date,
    revenue,
    transaction_count,
    customer_count,
    avg_transaction_value,
    top_product_id
  ) VALUES (
    p_tenant_id,
    p_snapshot_date,
    COALESCE(v_stats.revenue, 0),
    COALESCE(v_stats.transaction_count, 0),
    COALESCE(v_stats.customer_count, 0),
    COALESCE(v_stats.avg_transaction_value, 0),
    v_stats.top_product_id
  )
  ON CONFLICT (tenant_id, snapshot_date)
  DO UPDATE SET
    revenue = EXCLUDED.revenue,
    transaction_count = EXCLUDED.transaction_count,
    customer_count = EXCLUDED.customer_count,
    avg_transaction_value = EXCLUDED.avg_transaction_value,
    top_product_id = EXCLUDED.top_product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update customer metrics
CREATE OR REPLACE FUNCTION update_customer_metrics(p_user_id UUID, p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  v_metrics RECORD;
BEGIN
  -- Calculate customer metrics
  SELECT
    MIN(DATE(created_at)) as first_purchase,
    MAX(DATE(created_at)) as last_purchase,
    COUNT(*) as total_purchases,
    SUM(amount) as total_spent,
    AVG(amount) as avg_order_value,
    CURRENT_DATE - MAX(DATE(created_at)) as days_since_last
  INTO v_metrics
  FROM transactions
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND status = 'completed';

  -- Calculate churn risk (simple model: 1.0 if > 90 days inactive)
  DECLARE
    v_churn_risk DECIMAL(3, 2);
  BEGIN
    IF v_metrics.days_since_last > 90 THEN
      v_churn_risk := 1.00;
    ELSIF v_metrics.days_since_last > 60 THEN
      v_churn_risk := 0.75;
    ELSIF v_metrics.days_since_last > 30 THEN
      v_churn_risk := 0.50;
    ELSE
      v_churn_risk := 0.25;
    END IF;

    -- Insert or update
    INSERT INTO customer_metrics (
      tenant_id,
      user_id,
      first_purchase_date,
      last_purchase_date,
      total_purchases,
      total_spent,
      avg_order_value,
      lifetime_value,
      days_since_last_purchase,
      churn_risk_score
    ) VALUES (
      p_tenant_id,
      p_user_id,
      v_metrics.first_purchase,
      v_metrics.last_purchase,
      COALESCE(v_metrics.total_purchases, 0),
      COALESCE(v_metrics.total_spent, 0),
      COALESCE(v_metrics.avg_order_value, 0),
      COALESCE(v_metrics.total_spent, 0),
      COALESCE(v_metrics.days_since_last, 0),
      v_churn_risk
    )
    ON CONFLICT (tenant_id, user_id)
    DO UPDATE SET
      last_purchase_date = EXCLUDED.last_purchase_date,
      total_purchases = EXCLUDED.total_purchases,
      total_spent = EXCLUDED.total_spent,
      avg_order_value = EXCLUDED.avg_order_value,
      lifetime_value = EXCLUDED.lifetime_value,
      days_since_last_purchase = EXCLUDED.days_since_last_purchase,
      churn_risk_score = EXCLUDED.churn_risk_score,
      updated_at = NOW();
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to generate cohort analysis
CREATE OR REPLACE FUNCTION generate_cohort_analysis(
  p_tenant_id UUID,
  p_cohort_month DATE
)
RETURNS VOID AS $$
DECLARE
  v_month_offset INTEGER;
  v_cohort_users UUID[];
BEGIN
  -- Get users who joined in this cohort month
  SELECT ARRAY_AGG(DISTINCT user_id) INTO v_cohort_users
  FROM transactions
  WHERE tenant_id = p_tenant_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_cohort_month)
  GROUP BY user_id
  HAVING MIN(created_at) >= p_cohort_month
    AND MIN(created_at) < p_cohort_month + INTERVAL '1 month';

  -- Generate retention data for each month since join
  FOR v_month_offset IN 0..12 LOOP
    DECLARE
      v_target_month DATE := p_cohort_month + (v_month_offset || ' months')::INTERVAL;
      v_retained_count INTEGER;
      v_revenue DECIMAL(15, 2);
    BEGIN
      -- Count retained customers (made purchase in target month)
      SELECT 
        COUNT(DISTINCT user_id),
        SUM(amount)
      INTO v_retained_count, v_revenue
      FROM transactions
      WHERE tenant_id = p_tenant_id
        AND user_id = ANY(v_cohort_users)
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', v_target_month);

      INSERT INTO cohort_analysis (
        tenant_id,
        cohort_month,
        months_since_join,
        customer_count,
        retained_customers,
        retention_rate,
        total_revenue,
        avg_revenue_per_customer
      ) VALUES (
        p_tenant_id,
        p_cohort_month,
        v_month_offset,
        ARRAY_LENGTH(v_cohort_users, 1),
        COALESCE(v_retained_count, 0),
        CASE WHEN ARRAY_LENGTH(v_cohort_users, 1) > 0 
          THEN (COALESCE(v_retained_count, 0)::DECIMAL / ARRAY_LENGTH(v_cohort_users, 1) * 100)
          ELSE 0 
        END,
        COALESCE(v_revenue, 0),
        CASE WHEN v_retained_count > 0 
          THEN v_revenue / v_retained_count 
          ELSE 0 
        END
      )
      ON CONFLICT (tenant_id, cohort_month, months_since_join)
      DO UPDATE SET
        retained_customers = EXCLUDED.retained_customers,
        retention_rate = EXCLUDED.retention_rate,
        total_revenue = EXCLUDED.total_revenue,
        avg_revenue_per_customer = EXCLUDED.avg_revenue_per_customer;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get sales trends
CREATE OR REPLACE FUNCTION get_sales_trends(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_interval VARCHAR DEFAULT 'day' -- 'hour', 'day', 'week', 'month'
)
RETURNS TABLE (
  period TIMESTAMP WITH TIME ZONE,
  revenue DECIMAL(15, 2),
  transaction_count BIGINT,
  avg_transaction DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(p_interval, t.created_at) as period,
    SUM(t.amount)::DECIMAL(15, 2) as revenue,
    COUNT(*)::BIGINT as transaction_count,
    AVG(t.amount)::DECIMAL(10, 2) as avg_transaction
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND DATE(t.created_at) BETWEEN p_start_date AND p_end_date
    AND t.status = 'completed'
  GROUP BY DATE_TRUNC(p_interval, t.created_at)
  ORDER BY period;
END;
$$ LANGUAGE plpgsql;

-- Function to get top products
CREATE OR REPLACE FUNCTION get_top_products(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  product_name VARCHAR,
  units_sold BIGINT,
  revenue DECIMAL(15, 2),
  avg_price DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as product_id,
    p.name as product_name,
    COUNT(*)::BIGINT as units_sold,
    SUM(t.amount)::DECIMAL(15, 2) as revenue,
    AVG(t.amount)::DECIMAL(10, 2) as avg_price
  FROM transactions t
  JOIN products p ON t.product_id = p.id
  WHERE t.tenant_id = p_tenant_id
    AND DATE(t.created_at) BETWEEN p_start_date AND p_end_date
    AND t.status = 'completed'
  GROUP BY p.id, p.name
  ORDER BY revenue DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer metrics on new transaction
CREATE OR REPLACE FUNCTION trigger_update_customer_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    PERFORM update_customer_metrics(NEW.user_id, NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_transaction_completed_update_metrics
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION trigger_update_customer_metrics();

-- Comments
COMMENT ON TABLE analytics_snapshots IS 'Daily aggregated business metrics per tenant';
COMMENT ON TABLE customer_metrics IS 'Customer lifetime value and churn prediction';
COMMENT ON TABLE cohort_analysis IS 'Customer retention analysis by monthly cohorts';
COMMENT ON TABLE scheduled_reports IS 'Automated report generation configuration';
COMMENT ON FUNCTION generate_daily_snapshot(UUID, DATE) IS 'Aggregate daily metrics for tenant';
COMMENT ON FUNCTION update_customer_metrics(UUID, UUID) IS 'Calculate customer LTV and churn risk';
COMMENT ON FUNCTION generate_cohort_analysis(UUID, DATE) IS 'Build monthly cohort retention data';
