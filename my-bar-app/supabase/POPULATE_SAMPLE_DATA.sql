-- ============================================================
-- POPULATE SAMPLE DASHBOARD DATA
-- ============================================================
-- 
-- BEFORE RUNNING: Replace 'PASTE-YOUR-TENANT-ID-HERE' below
-- with your actual tenant ID (UUID format)
--
-- To get your tenant ID, run this query first:
--   SELECT id, name FROM tenants ORDER BY created_at DESC LIMIT 1;
--
-- Then run this file:
--   supabase db query --file supabase/POPULATE_SAMPLE_DATA.sql
--
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID := '252c1a12-8422-4e60-ba7f-5b595148335e'::uuid;  -- ⚠️ CHANGE THIS!
BEGIN
  -- Verify tenant exists
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant ID % does not exist in tenants table', v_tenant_id;
  END IF;

  -- SUCCESS: Insert sample events (simplified schema)
  INSERT INTO events (tenant_id, name, description, entry_fee, date, active)
  VALUES
    (v_tenant_id, 'New Year''s Eve Bash', 'Ring in the new year with style! VIP tables, premium drinks, live DJ', 250.00, '2025-12-31 22:00:00+00'::TIMESTAMP WITH TIME ZONE, true),
    (v_tenant_id, 'Friday Night Live', 'Live music performances featuring local bands and artists', 180.00, '2025-03-21 21:00:00+00'::TIMESTAMP WITH TIME ZONE, true),
    (v_tenant_id, 'Summer Rooftop Party', 'Sunset rooftop vibes with cocktails and chill music', 150.00, '2026-06-15 18:00:00+00'::TIMESTAMP WITH TIME ZONE, true),
    (v_tenant_id, 'Ladies Night Special', 'Half-price drinks for ladies, complimentary welcome cocktail', 100.00, '2026-03-20 20:00:00+00'::TIMESTAMP WITH TIME ZONE, true);

  -- SUCCESS: Insert sample VIP tables (uses 'tables' table)
  INSERT INTO tables (tenant_id, name, table_number, capacity, table_type, zone, minimum_spend, reservation_fee, has_bottle_service, status)
  VALUES
    (v_tenant_id, 'VIP Booth 1', 'VIP-01', 8, 'vip', 'VIP Section', 5000.00, 500.00, true, 'available'),
    (v_tenant_id, 'VIP Booth 2', 'VIP-02', 6, 'vip', 'VIP Section', 4000.00, 400.00, true, 'available'),
    (v_tenant_id, 'Private Lounge', 'VIP-03', 10, 'vip', 'Private Floor', 6500.00, 650.00, true, 'reserved'),
    (v_tenant_id, 'Bar Side Table', 'TB-04', 4, 'standard', 'Main Floor', 1500.00, 150.00, false, 'available'),
    (v_tenant_id, 'Rooftop Exclusive', 'VIP-05', 12, 'vip', 'Rooftop', 8000.00, 800.00, true, 'available');

  -- SUCCESS: Insert sample products (drinks & food)
  INSERT INTO products (tenant_id, name, price, type, description, available)
  VALUES
    (v_tenant_id, 'Premium Vodka', 450.00, 'drink', 'Top-shelf vodka bottle for VIP service', true),
    (v_tenant_id, 'Craft Beer', 55.00, 'drink', 'Locally brewed craft beer selection', true),
    (v_tenant_id, 'Champagne Moet', 1200.00, 'drink', 'Moet & Chandon champagne bottle', true),
    (v_tenant_id, 'Red Bull Energy', 35.00, 'drink', 'Energy drink mixer for cocktails', true),
    (v_tenant_id, 'Nachos Platter', 85.00, 'food', 'Loaded nachos with cheese, jalapeños, and guacamole', true),
    (v_tenant_id, 'Chicken Wings', 95.00, 'food', 'Spicy buffalo wings with ranch dip', true);

  RAISE NOTICE 'SUCCESS! Sample data loaded for tenant: %', v_tenant_id;
  RAISE NOTICE '  - 4 Events created';
  RAISE NOTICE '  - 5 VIP Tables created';
  RAISE NOTICE '  - 6 Products created';
END $$;

-- Verify the data
SELECT 
  (SELECT COUNT(*) FROM events WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e'::uuid) as events_count,
  (SELECT COUNT(*) FROM tables WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e'::uuid) as tables_count,
  (SELECT COUNT(*) FROM products WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e'::uuid) as products_count;

