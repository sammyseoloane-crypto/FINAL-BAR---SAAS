-- ============================================================
-- HIGH CONCURRENCY OPTIMIZATION
-- Database optimizations, caching, connection pooling, and performance
-- Created: 2026-03-11
-- ============================================================

-- Create materialized views for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_revenue_summary AS
SELECT
  tr.tenant_id,
  DATE_TRUNC('day', tr.created_at) as date,
  COUNT(DISTINCT tr.id) as transaction_count,
  COUNT(DISTINCT tr.user_id) as unique_customers,
  SUM(tr.amount) as total_revenue,
  AVG(tr.amount) as avg_transaction_value,
  MAX(tr.created_at) as last_updated
FROM transactions tr
JOIN tenants t ON tr.tenant_id = t.id
WHERE tr.status = 'completed'
GROUP BY tr.tenant_id, DATE_TRUNC('day', tr.created_at);

CREATE UNIQUE INDEX idx_mv_tenant_revenue_unique ON mv_tenant_revenue_summary(tenant_id, date);
CREATE INDEX idx_mv_tenant_revenue_date ON mv_tenant_revenue_summary(date DESC);

-- Create materialized view for product performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_performance AS
SELECT
  p.id as product_id,
  p.tenant_id,
  p.name,
  COUNT(oi.id) as times_sold,
  SUM(oi.quantity) as total_quantity_sold,
  SUM(oi.price * oi.quantity) as total_revenue,
  AVG(oi.price) as avg_price,
  MAX(o.created_at) as last_sold_at,
  NOW() as refreshed_at
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
GROUP BY p.id, p.tenant_id, p.name;

CREATE UNIQUE INDEX idx_mv_product_performance_unique ON mv_product_performance(product_id);
CREATE INDEX idx_mv_product_performance_tenant ON mv_product_performance(tenant_id);
CREATE INDEX idx_mv_product_performance_revenue ON mv_product_performance(total_revenue DESC);

-- Create query performance monitoring table
CREATE TABLE IF NOT EXISTS query_performance_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_name VARCHAR(200),
  execution_time_ms INTEGER,
  rows_returned INTEGER,
  tenant_id UUID,
  user_id UUID,
  query_hash VARCHAR(64),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_query_performance_name ON query_performance_log(query_name);
CREATE INDEX idx_query_performance_time ON query_performance_log(execution_time_ms DESC);
CREATE INDEX idx_query_performance_executed ON query_performance_log(executed_at DESC);

-- Create cache invalidation tracking
CREATE TABLE IF NOT EXISTS cache_invalidation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key VARCHAR(255) NOT NULL,
  tenant_id UUID,
  invalidation_reason VARCHAR(200),
  invalidated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_cache_invalidation_key ON cache_invalidation_log(cache_key);
CREATE INDEX idx_cache_invalidation_tenant ON cache_invalidation_log(tenant_id);

-- Create database connection pool monitoring
CREATE TABLE IF NOT EXISTS connection_pool_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  active_connections INTEGER NOT NULL,
  idle_connections INTEGER NOT NULL,
  waiting_connections INTEGER DEFAULT 0,
  max_connections INTEGER NOT NULL,
  utilization_percentage DECIMAL(5, 2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_connection_pool_timestamp ON connection_pool_metrics(timestamp DESC);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL, -- IP address, user_id, or API key
  endpoint VARCHAR(200) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  window_end TIMESTAMP WITH TIME ZONE,
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_end);

-- ============================================================
-- OPTIMIZED INDEXES FOR HIGH CONCURRENCY
-- ============================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created_status 
  ON transactions(tenant_id, created_at DESC, status) 
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_transactions_user_tenant_created 
  ON transactions(user_id, tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_tenant_available 
  ON products(tenant_id, available) 
  WHERE available = true;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role 
  ON profiles(tenant_id, role);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_assigned 
  ON tasks(tenant_id, status, assigned_to);

CREATE INDEX IF NOT EXISTS idx_events_tenant_date 
  ON events(tenant_id, date DESC);

-- Partial indexes for hot data
CREATE INDEX IF NOT EXISTS idx_transactions_recent 
  ON transactions(created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_login_history_recent 
  ON login_history(user_id, created_at DESC);

-- BRIN indexes for time-series data
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_brin 
  ON audit_logs USING BRIN(created_at);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_brin 
  ON loyalty_transactions USING BRIN(created_at);

-- ============================================================
-- INDEXES FOR NEW FEATURES (Offline, Loyalty, Analytics, Currency, Tax)
-- ============================================================

-- Offline Queue indexes for sync performance
CREATE INDEX IF NOT EXISTS idx_offline_queue_device_status 
  ON offline_queue(device_id, status) 
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_offline_queue_synced_at 
  ON offline_queue(synced_at DESC) 
  WHERE synced_at IS NOT NULL;

-- Loyalty system indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_user_program 
  ON customer_loyalty(user_id, loyalty_program_id);

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_points_balance 
  ON customer_loyalty(points_balance DESC) 
  WHERE points_balance > 0;

CREATE INDEX IF NOT EXISTS idx_customer_loyalty_tier 
  ON customer_loyalty(current_tier, lifetime_points DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_created 
  ON loyalty_transactions(customer_loyalty_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_catalog_tenant_active_points 
  ON rewards_catalog(tenant_id, points_cost ASC) 
  WHERE active = true;

-- Analytics optimization indexes
CREATE INDEX IF NOT EXISTS idx_order_items_product_created 
  ON order_items(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_status_created 
  ON transactions(tenant_id, status, created_at DESC) 
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method_status 
  ON transactions(payment_method, status) 
  WHERE status = 'completed';

-- Currency and exchange rate indexes
CREATE INDEX IF NOT EXISTS idx_exchange_rates_from_to 
  ON exchange_rates(from_currency, to_currency, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_updated 
  ON exchange_rates(updated_at DESC) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_currencies_active 
  ON currencies(is_active, code) 
  WHERE is_active = true;

-- Tax calculation indexes
CREATE INDEX IF NOT EXISTS idx_tax_categories_tenant_active 
  ON tax_categories(tenant_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tax_categories_applies_to_all 
  ON tax_categories(tenant_id, applies_to_all) 
  WHERE applies_to_all = true;

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values_gin 
  ON audit_logs USING GIN(new_values);

CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values_gin 
  ON audit_logs USING GIN(old_values);

-- ============================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_revenue_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_loyalty_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_analytics;
END;
$$ LANGUAGE plpgsql;

-- Function to log slow queries
CREATE OR REPLACE FUNCTION log_query_performance(
  p_query_name VARCHAR,
  p_execution_time_ms INTEGER,
  p_rows_returned INTEGER DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO query_performance_log (
    query_name,
    execution_time_ms,
    rows_returned,
    tenant_id,
    user_id
  ) VALUES (
    p_query_name,
    p_execution_time_ms,
    p_rows_returned,
    p_tenant_id,
    auth.uid()
  );

  -- Alert if query is very slow (> 5 seconds)
  IF p_execution_time_ms > 5000 THEN
    -- Could trigger notification system here
    RAISE WARNING 'Slow query detected: % took % ms', p_query_name, p_execution_time_ms;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier VARCHAR,
  p_endpoint VARCHAR,
  p_max_requests INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
BEGIN
  -- Clean up old rate limit records
  DELETE FROM rate_limits 
  WHERE window_end < NOW() - INTERVAL '1 hour';

  -- Get current request count in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start > v_window_start;

  IF v_current_count >= p_max_requests THEN
    RETURN FALSE; -- Rate limit exceeded
  END IF;

  -- Increment counter
  INSERT INTO rate_limits (
    identifier,
    endpoint,
    request_count,
    window_start,
    window_end
  ) VALUES (
    p_identifier,
    p_endpoint,
    1,
    NOW(),
    NOW() + (p_window_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1;

  RETURN TRUE; -- Request allowed
END;
$$ LANGUAGE plpgsql;

-- Function to get database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'database_size', pg_database_size(current_database()),
    'total_tables', COUNT(*),
    'total_indexes', (SELECT COUNT(*) FROM pg_indexes),
    'cache_hit_ratio', (
      SELECT ROUND(
        100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0),
        2
      )
      FROM pg_statio_user_tables
    ),
    'active_connections', (
      SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'
    ),
    'idle_connections', (
      SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle'
    )
  ) INTO v_stats
  FROM information_schema.tables
  WHERE table_schema = 'public';

  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze table bloat
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE (
  table_name VARCHAR,
  bloat_percentage DECIMAL(5, 2),
  wasted_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    schemaname || '.' || tablename as table_name,
    ROUND(100 * (pg_total_relation_size(schemaname||'.'||tablename)::NUMERIC - 
          pg_relation_size(schemaname||'.'||tablename)::NUMERIC) / 
          NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0), 2) as bloat_percentage,
    (pg_total_relation_size(schemaname||'.'||tablename) - 
     pg_relation_size(schemaname||'.'||tablename))::BIGINT as wasted_bytes
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY wasted_bytes DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to optimize tenant data partitioning
CREATE OR REPLACE FUNCTION partition_tenant_data(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_transaction_count INTEGER;
  v_should_partition BOOLEAN := FALSE;
BEGIN
  -- Count transactions for tenant
  SELECT COUNT(*) INTO v_transaction_count
  FROM transactions
  WHERE tenant_id = p_tenant_id;

  -- Recommend partitioning if > 1M transactions
  IF v_transaction_count > 1000000 THEN
    v_should_partition := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'transaction_count', v_transaction_count,
    'should_partition', v_should_partition,
    'recommendation', CASE 
      WHEN v_should_partition THEN 'Consider creating dedicated partition for this tenant'
      ELSE 'Current structure is optimal'
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get slow queries report
CREATE OR REPLACE FUNCTION get_slow_queries_report(
  p_threshold_ms INTEGER DEFAULT 1000,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  query_name VARCHAR,
  avg_execution_time_ms NUMERIC,
  max_execution_time_ms INTEGER,
  execution_count BIGINT,
  total_time_ms BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    qpl.query_name,
    ROUND(AVG(qpl.execution_time_ms), 2) as avg_execution_time_ms,
    MAX(qpl.execution_time_ms) as max_execution_time_ms,
    COUNT(*)::BIGINT as execution_count,
    SUM(qpl.execution_time_ms)::BIGINT as total_time_ms
  FROM query_performance_log qpl
  WHERE qpl.execution_time_ms > p_threshold_ms
    AND qpl.executed_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY qpl.query_name
  ORDER BY total_time_ms DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VACUUM AND MAINTENANCE AUTOMATION
-- ============================================================

-- Function to run maintenance tasks
CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS JSONB AS $$
DECLARE
  v_results JSONB;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
BEGIN
  v_start_time := CLOCK_TIMESTAMP();

  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW mv_tenant_revenue_summary;
  REFRESH MATERIALIZED VIEW mv_product_performance;

  -- Clean up old rate limits (> 24 hours)
  DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '24 hours';

  -- Clean up old query logs (> 30 days)
  DELETE FROM query_performance_log WHERE executed_at < NOW() - INTERVAL '30 days';

  -- Clean up old cache invalidation logs (> 7 days)
  DELETE FROM cache_invalidation_log WHERE invalidated_at < NOW() - INTERVAL '7 days';

  -- Analyze tables for query planner
  ANALYZE transactions;
  ANALYZE products;
  ANALYZE profiles;
  ANALYZE customer_loyalty;

  v_end_time := CLOCK_TIMESTAMP();

  v_results := jsonb_build_object(
    'success', true,
    'duration_seconds', EXTRACT(EPOCH FROM (v_end_time - v_start_time)),
    'tasks_completed', jsonb_build_array(
      'materialized_views_refreshed',
      'old_rate_limits_cleaned',
      'old_query_logs_cleaned',
      'tables_analyzed'
    )
  );

  RETURN v_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_table_stats AS
SELECT
  schemaname,
  relname as tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) - 
                 pg_relation_size(schemaname||'.'||relname)) as indexes_size,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;

CREATE OR REPLACE VIEW v_index_usage AS
SELECT
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Comments
COMMENT ON MATERIALIZED VIEW mv_tenant_revenue_summary IS 'Pre-aggregated daily revenue metrics per tenant for fast dashboard loading';
COMMENT ON MATERIALIZED VIEW mv_product_performance IS 'Product sales performance summary for quick analytics';
COMMENT ON TABLE query_performance_log IS 'Log of query execution times for performance monitoring';
COMMENT ON TABLE rate_limits IS 'API and endpoint rate limiting per user/IP';
COMMENT ON FUNCTION refresh_materialized_views() IS 'Refresh all materialized views concurrently';
COMMENT ON FUNCTION check_rate_limit(VARCHAR, VARCHAR, INTEGER, INTEGER) IS 'Check if request is within rate limit';
COMMENT ON FUNCTION run_maintenance_tasks() IS 'Automated database maintenance and cleanup';
COMMENT ON VIEW v_table_stats IS 'Table size and health statistics';
COMMENT ON VIEW v_index_usage IS 'Index usage statistics for optimization';
ADDITIONAL MATERIALIZED VIEWS FOR NEW FEATURES
-- ============================================================

-- Loyalty program statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_loyalty_stats AS
SELECT
  lp.id as program_id,
  lp.tenant_id,
  lp.name as program_name,
  COUNT(DISTINCT cl.id) as total_members,
  SUM(cl.points_balance) as total_points_outstanding,
  SUM(cl.lifetime_points) as total_points_issued,
  SUM(cl.points_redeemed) as total_points_redeemed,
  AVG(cl.points_balance) as avg_points_per_member,
  COUNT(DISTINCT CASE WHEN cl.current_tier = 'vip' THEN cl.id END) as vip_members,
  COUNT(DISTINCT CASE WHEN cl.current_tier = 'platinum' THEN cl.id END) as platinum_members,
  NOW() as refreshed_at
FROM loyalty_programs lp
LEFT JOIN customer_loyalty cl ON cl.loyalty_program_id = lp.id
GROUP BY lp.id, lp.tenant_id, lp.name;

CREATE UNIQUE INDEX idx_mv_loyalty_stats_unique ON mv_loyalty_stats(program_id);
CREATE INDEX idx_mv_loyalty_stats_tenant ON mv_loyalty_stats(tenant_id);

-- Customer analytics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_analytics AS
SELECT
  p.id as customer_id,
  p.tenant_id,
  p.full_name,
  COUNT(DISTINCT t.id) as total_transactions,
  SUM(t.amount) as lifetime_value,
  AVG(t.amount) as avg_transaction_value,
  MAX(t.created_at) as last_transaction_date,
  MIN(t.created_at) as first_transaction_date,
  cl.points_balance as loyalty_points,
  cl.current_tier as loyalty_tier,
  NOW() as refreshed_at
FROM profiles p
LEFT JOIN transactions t ON t.user_id = p.id AND t.status = 'completed'
LEFT JOIN customer_loyalty cl ON cl.user_id = p.id
WHERE p.role = 'customer'
GROUP BY p.id, p.tenant_id, p.full_name, cl.points_balance, cl.current_tier;

CREATE UNIQUE INDEX idx_mv_customer_analytics_unique ON mv_customer_analytics(customer_id);
CREATE INDEX idx_mv_customer_analytics_tenant_ltv ON mv_customer_analytics(tenant_id, lifetime_value DESC);

-- ============================================================
-- 
-- ============================================================
-- SCHEDULED JOBS (requires pg_cron extension)
-- ============================================================

-- Uncomment the lines below if pg_cron is enabled:

-- SELECT cron.schedule(
--   'refresh-materialized-views',
--   '*/15 * * * *', -- Every 15 minutes
--   'SELECT refresh_materialized_views()'
-- );

-- SELECT cron.schedule(
--   'maintenance-tasks',
--   '0 2 * * *', -- Daily at 2 AM
--   'SELECT run_maintenance_tasks()'
-- );

-- SELECT cron.schedule(
--   'generate-daily-snapshots',
--   '0 1 * * *', -- Daily at 1 AM
--   'SELECT generate_daily_snapshot(tenant_id) FROM tenants WHERE subscription_status = ''active'''
-- );
