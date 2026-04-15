-- ============================================================
-- SAMPLE DATA FOR CLUB DASHBOARD TESTING
-- ============================================================
-- 
-- PURPOSE:
-- Populates sample data to test the Club Dashboard functionality
-- Creates realistic data for drinks, staff sales, crowd tracking, etc.
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Replace 'YOUR_TENANT_ID_HERE' with your actual tenant ID
-- 3. Run this script
-- 4. Refresh /owner/club-dashboard to see live data
--
-- ============================================================

-- ============================================================
-- STEP 1: GET YOUR TENANT ID
-- ============================================================
-- Run this first to find your tenant_id:
-- SELECT id, name FROM tenants ORDER BY created_at DESC LIMIT 5;

-- Replace this with your actual tenant_id from the query above
DO $$
DECLARE
  v_tenant_id UUID;
  v_staff_id UUID;
  v_product_id UUID;
  v_table_id UUID;
  v_event_id UUID;
  i INTEGER;
  random_hour INTEGER;
BEGIN
  -- Get the first tenant (or replace with specific tenant_id)
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at DESC LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Please create a tenant first.';
  END IF;

  RAISE NOTICE 'Using Tenant ID: %', v_tenant_id;

  -- Get a staff member
  SELECT id INTO v_staff_id 
  FROM profiles 
  WHERE tenant_id = v_tenant_id AND role IN ('staff', 'manager', 'owner')
  LIMIT 1;

  IF v_staff_id IS NULL THEN
    RAISE NOTICE 'No staff member found, using first user in tenant';
    SELECT id INTO v_staff_id FROM profiles WHERE tenant_id = v_tenant_id LIMIT 1;
  END IF;

  -- Get a product
  SELECT id INTO v_product_id FROM products WHERE tenant_id = v_tenant_id LIMIT 1;

  -- Get a table
  SELECT id INTO v_table_id FROM tables WHERE tenant_id = v_tenant_id LIMIT 1;

  -- ============================================================
  -- STEP 2: CREATE SAMPLE TRANSACTIONS (Revenue)
  -- ============================================================
  RAISE NOTICE 'Creating sample transactions...';
  
  FOR i IN 1..30 LOOP
    random_hour := 18 + floor(random() * 6)::INTEGER; -- Between 18:00 and 23:00
    
    INSERT INTO transactions (tenant_id, user_id, product_id, amount, status, created_at)
    VALUES (
      v_tenant_id,
      v_staff_id,
      v_product_id,
      (50 + random() * 500)::DECIMAL(10,2), -- R50 to R550
      'confirmed',
      CURRENT_DATE + (random_hour || ' hours')::INTERVAL
    );
  END LOOP;

  -- ============================================================
  -- STEP 3: CREATE SAMPLE DRINKS SOLD
  -- ============================================================
  RAISE NOTICE 'Creating sample drinks sold...';
  
  -- Popular drinks
  FOR i IN 1..20 LOOP
    random_hour := 19 + floor(random() * 5)::INTEGER;
    
    INSERT INTO drinks_sold (
      tenant_id, product_id, drink_name, category, quantity, 
      unit_price, total_price, served_by, table_id, 
      timestamp, shift_date
    )
    VALUES (
      v_tenant_id,
      v_product_id,
      (ARRAY['Vodka Lime', 'Whiskey Neat', 'Gin & Tonic', 'Mojito', 'Margarita'])[ceil(random() * 5)],
      'Cocktails',
      1 + floor(random() * 3)::INTEGER, -- 1-3 drinks
      80.00,
      80.00 * (1 + floor(random() * 3)),
      v_staff_id,
      v_table_id,
      CURRENT_DATE + (random_hour || ' hours')::INTERVAL,
      CURRENT_DATE
    );
  END LOOP;

  -- Beer sales
  FOR i IN 1..15 LOOP
    random_hour := 20 + floor(random() * 4)::INTEGER;
    
    INSERT INTO drinks_sold (
      tenant_id, drink_name, category, quantity, 
      unit_price, total_price, served_by, timestamp, shift_date
    )
    VALUES (
      v_tenant_id,
      (ARRAY['Castle Lager', 'Black Label', 'Savanna', 'Heineken', 'Corona'])[ceil(random() * 5)],
      'Beer',
      1 + floor(random() * 2)::INTEGER,
      35.00,
      35.00 * (1 + floor(random() * 2)),
      v_staff_id,
      CURRENT_DATE + (random_hour || ' hours')::INTERVAL,
      CURRENT_DATE
    );
  END LOOP;

  -- ============================================================
  -- STEP 4: CREATE STAFF SALES DATA
  -- ============================================================
  RAISE NOTICE 'Creating staff sales records...';
  
  INSERT INTO staff_sales (
    tenant_id, staff_id, total_sales, drinks_sold, 
    tables_served, tips_earned, shift_date
  )
  VALUES (
    v_tenant_id,
    v_staff_id,
    2500.00 + (random() * 1500)::DECIMAL(10,2),
    25 + floor(random() * 20)::INTEGER,
    5 + floor(random() * 5)::INTEGER,
    200.00 + (random() * 300)::DECIMAL(10,2),
    CURRENT_DATE
  );

  -- ============================================================
  -- STEP 5: CREATE CROWD TRACKING DATA
  -- ============================================================
  RAISE NOTICE 'Creating crowd tracking data...';
  
  -- Create entries for different times throughout the evening
  FOR i IN 0..5 LOOP
    INSERT INTO crowd_tracking (
      tenant_id, current_capacity, max_capacity, 
      entries_count, exits_count, timestamp, recorded_date
    )
    VALUES (
      v_tenant_id,
      50 + (i * 30) + floor(random() * 20)::INTEGER, -- Growing crowd
      500,
      (i * 40) + floor(random() * 15)::INTEGER,
      (i * 5) + floor(random() * 5)::INTEGER,
      CURRENT_DATE + ((18 + i) || ' hours')::INTERVAL,
      CURRENT_DATE
    );
  END LOOP;

  -- ============================================================
  -- STEP 6: UPDATE TABLE STATUSES
  -- ============================================================
  RAISE NOTICE 'Updating table statuses...';
  
  -- Set some tables to reserved/occupied
  UPDATE tables 
  SET status = (ARRAY['reserved', 'occupied', 'available'])[ceil(random() * 3)]
  WHERE tenant_id = v_tenant_id
  AND id IN (
    SELECT id FROM tables WHERE tenant_id = v_tenant_id LIMIT 5
  );

  -- ============================================================
  -- STEP 7: CREATE GUEST LIST ENTRIES
  -- ============================================================
  RAISE NOTICE 'Creating guest list entries...';
  
  -- Check if guest_list table exists first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_lists') THEN
    RAISE NOTICE 'Guest list functionality available';
    
    DECLARE
      v_guest_list_id UUID;
      v_list_name TEXT;
    BEGIN
      -- Create a guest list for today
      v_list_name := 'Tonight - ' || TO_CHAR(CURRENT_DATE, 'Day, Mon DD');
      
      INSERT INTO guest_lists (
        tenant_id, list_name, event_date,
        max_guests, status, created_by
      )
      VALUES (
        v_tenant_id,
        v_list_name,
        CURRENT_DATE,
        200,
        'active',
        v_staff_id
      )
      RETURNING id INTO v_guest_list_id;
      
      -- Create sample guest list entries
      FOR i IN 1..15 LOOP
        random_hour := 19 + floor(random() * 4)::INTEGER;
        
        INSERT INTO guest_list_entries (
          tenant_id, guest_list_id, guest_name, guest_phone,
          checked_in, checked_in_at, created_at
        )
        VALUES (
          v_tenant_id,
          v_guest_list_id,
          'Guest ' || i,
          '+27' || (600000000 + floor(random() * 99999999))::TEXT,
          (random() > 0.3), -- 70% checked in
          CURRENT_DATE + (random_hour || ' hours')::INTERVAL,
          CURRENT_DATE + ((random_hour - 2) || ' hours')::INTERVAL
        );
      END LOOP;
    END;
  ELSE
    RAISE NOTICE 'Guest list table not found, skipping';
  END IF;

  RAISE NOTICE '✅ Sample data created successfully!';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '  - 30 transactions';
  RAISE NOTICE '  - 35 drinks sold';
  RAISE NOTICE '  - Staff sales records';
  RAISE NOTICE '  - Crowd tracking (6 entries)';
  RAISE NOTICE '  - Updated table statuses';
  RAISE NOTICE '  - 15 guest list entries';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Go to /owner/club-dashboard';
  RAISE NOTICE '  2. Refresh the page';
  RAISE NOTICE '  3. You should see live metrics!';

END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Count records created today
SELECT 
  (SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as transactions_today,
  (SELECT COUNT(*) FROM drinks_sold WHERE shift_date = CURRENT_DATE) as drinks_today,
  (SELECT COUNT(*) FROM staff_sales WHERE shift_date = CURRENT_DATE) as staff_records_today,
  (SELECT COUNT(*) FROM crowd_tracking WHERE recorded_date = CURRENT_DATE) as crowd_records_today;

-- Test the dashboard functions
SELECT * FROM get_tonight_revenue_stats(
  (SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1)
);

SELECT * FROM get_active_vip_tables(
  (SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1)
);

SELECT * FROM get_top_selling_drinks(
  (SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1),
  CURRENT_DATE,
  5
);

-- ============================================================
-- CLEAN UP (Optional - Run to remove sample data)
-- ============================================================
/*
-- Uncomment to delete sample data:

DELETE FROM guest_list_entries WHERE DATE(created_at) = CURRENT_DATE;
DELETE FROM guest_lists WHERE event_date = CURRENT_DATE;
DELETE FROM drinks_sold WHERE shift_date = CURRENT_DATE;
DELETE FROM staff_sales WHERE shift_date = CURRENT_DATE;
DELETE FROM crowd_tracking WHERE recorded_date = CURRENT_DATE;
DELETE FROM transactions WHERE DATE(created_at) = CURRENT_DATE;

*/
