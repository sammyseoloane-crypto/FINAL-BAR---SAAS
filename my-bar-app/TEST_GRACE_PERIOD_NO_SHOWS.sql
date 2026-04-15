-- ============================================================
-- TEST GRACE PERIOD & NO-SHOW SYSTEM
-- ============================================================
-- This file tests the table reservation grace period and automatic no-show marking
-- Run these queries in order to verify the system works correctly

-- ============================================================
-- STEP 1: Create a test reservation that should be marked as no-show
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_table_id UUID;
  v_user_id UUID;
  v_reservation_id UUID;
BEGIN
  -- Get a tenant to test with
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found. Please create a tenant first.';
  END IF;
  
  -- Get a table
  SELECT id INTO v_table_id FROM tables WHERE tenant_id = v_tenant_id LIMIT 1;
  
  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'No table found for tenant. Please create a table first.';
  END IF;
  
  -- Get a user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found. Please create a user first.';
  END IF;
  
  -- Create a reservation 1 hour in the past (should be past grace period)
  INSERT INTO table_reservations (
    tenant_id,
    table_id,
    user_id,
    reservation_date,
    reservation_time,
    reservation_datetime,
    guest_count,
    status,
    grace_period_minutes,
    deposit_amount,
    minimum_spend
  ) VALUES (
    v_tenant_id,
    v_table_id,
    v_user_id,
    CURRENT_DATE,
    '18:00:00',
    NOW() - INTERVAL '1 hour', -- 1 hour ago
    4,
    'confirmed',
    30, -- 30 minute grace period (so it expired 30 minutes ago)
    500,
    2000
  )
  RETURNING id INTO v_reservation_id;
  
  RAISE NOTICE 'Test reservation created: %', v_reservation_id;
  RAISE NOTICE 'Reservation time: % (1 hour ago)', NOW() - INTERVAL '1 hour';
  RAISE NOTICE 'Grace period ends: % (30 minutes ago)', NOW() - INTERVAL '30 minutes';
END $$;

-- ============================================================
-- STEP 2: Check grace period calculation
-- ============================================================

SELECT 
  id,
  reservation_datetime,
  grace_period_minutes,
  grace_period_end_datetime,
  grace_period_end_datetime < NOW() as should_be_no_show,
  status
FROM table_reservations
WHERE reservation_datetime > NOW() - INTERVAL '2 hours'
ORDER BY reservation_datetime DESC
LIMIT 5;

-- ============================================================
-- STEP 3: View reservations in grace period
-- ============================================================

SELECT * FROM get_reservations_in_grace_period();

-- ============================================================
-- STEP 4: Check reservations that should be marked as no-show
-- ============================================================

SELECT 
  tr.id,
  tr.reservation_datetime,
  tr.grace_period_end_datetime,
  tr.status,
  CASE 
    WHEN tr.status IN ('pending', 'confirmed') 
      AND tr.grace_period_end_datetime < NOW() 
      AND tr.checked_in_at IS NULL 
    THEN 'SHOULD BE NO-SHOW'
    ELSE 'OK'
  END as action_needed
FROM table_reservations tr
WHERE tr.status IN ('pending', 'confirmed')
  AND tr.grace_period_end_datetime < NOW()
ORDER BY tr.grace_period_end_datetime DESC;

-- ============================================================
-- STEP 5: Run the no-show check function
-- ============================================================

SELECT * FROM check_and_mark_no_shows();

-- ============================================================
-- STEP 6: Verify the reservation was marked as no-show
-- ============================================================

SELECT 
  id,
  reservation_datetime,
  grace_period_end_datetime,
  status,
  metadata->>'auto_marked_no_show' as auto_marked,
  metadata->>'marked_no_show_at' as marked_at
FROM table_reservations
WHERE reservation_datetime > NOW() - INTERVAL '2 hours'
  AND status = 'no_show'
ORDER BY reservation_datetime DESC
LIMIT 5;

-- ============================================================
-- STEP 7: Test the main processing function
-- ============================================================

SELECT * FROM process_reservation_status_updates();

-- ============================================================
-- STEP 8: View reservation status summary
-- ============================================================

SELECT *
FROM reservation_status_summary
WHERE grace_status IN ('upcoming', 'in_grace_period', 'should_be_no_show')
ORDER BY reservation_datetime
LIMIT 10;

-- ============================================================
-- STEP 9: Clean up test data (if needed)
-- ============================================================

/*
DELETE FROM table_reservations
WHERE reservation_datetime > NOW() - INTERVAL '2 hours'
  AND status = 'no_show'
  AND metadata->>'auto_marked_no_show' = 'true';
*/

-- ============================================================
-- MONITORING QUERIES
-- ============================================================

-- Count of reservations by status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE metadata->>'auto_marked_no_show' = 'true') as auto_marked_count
FROM table_reservations
WHERE reservation_date >= CURRENT_DATE - 7
GROUP BY status
ORDER BY status;

-- Recent no-shows
SELECT 
  tr.id,
  t.name as table_name,
  tr.reservation_datetime,
  tr.grace_period_end_datetime,
  tr.metadata->>'marked_no_show_at' as marked_at,
  EXTRACT(EPOCH FROM (NOW() - (tr.metadata->>'marked_no_show_at')::timestamptz)) / 60 as minutes_since_marked
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.status = 'no_show'
  AND tr.metadata->>'auto_marked_no_show' = 'true'
ORDER BY tr.grace_period_end_datetime DESC
LIMIT 20;

-- Reservations expiring soon (within 10 minutes)
SELECT 
  tr.id,
  t.name as table_name,
  p.email as guest_email,
  tr.reservation_datetime,
  tr.grace_period_end_datetime,
  EXTRACT(EPOCH FROM (tr.grace_period_end_datetime - NOW())) / 60 as minutes_remaining
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
LEFT JOIN profiles p ON tr.user_id = p.id
WHERE tr.status IN ('pending', 'confirmed')
  AND tr.grace_period_end_datetime > NOW()
  AND tr.grace_period_end_datetime < NOW() + INTERVAL '10 minutes'
ORDER BY tr.grace_period_end_datetime;

-- ============================================================
-- EXPECTED RESULTS
-- ============================================================

/*
STEP 5: Should return the test reservation that was marked as no-show
STEP 6: Should show status = 'no_show' and auto_marked_no_show = true
STEP 7: Should return JSON with no_shows_marked count
STEP 8: Should show grace_status for all reservations

If any reservation has grace_status = 'should_be_no_show', 
it means the automatic marking is working correctly!
*/
