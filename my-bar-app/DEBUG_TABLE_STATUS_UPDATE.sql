-- ============================================================
-- DIAGNOSTIC SCRIPT: Table Status Update Issues
-- File: DEBUG_TABLE_STATUS_UPDATE.sql
-- Date: 2026-03-15
-- Description: Diagnose why table status isn't updating after reservation
-- ============================================================

-- ============================================================
-- STEP 1: Check if auto_update_table_status function exists
-- ============================================================

SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'auto_update_table_status';

-- Expected: Should return 1 row showing the function exists
-- If empty: Migration 20260315000003 was not applied

-- ============================================================
-- STEP 2: Check if triggers exist
-- ============================================================

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE '%auto_update_table_status%';

-- Expected: Should return 2 rows (INSERT and UPDATE triggers)
-- If empty: Triggers were not created

-- ============================================================
-- STEP 3: Check current table statuses
-- ============================================================

SELECT 
  id,
  name,
  table_type,
  status,
  capacity,
  deposit_amount,
  updated_at
FROM tables
WHERE tenant_id = (SELECT tenant_id FROM auth.users LIMIT 1)
ORDER BY name;

-- This shows all tables and their current status

-- ============================================================
-- STEP 4: Check active reservations and corresponding table status
-- ============================================================

SELECT 
  tr.id as reservation_id,
  t.name as table_name,
  t.status as current_table_status,
  tr.status as reservation_status,
  tr.reservation_datetime,
  tr.deposit_paid,
  tr.created_at as reservation_created_at,
  t.updated_at as table_updated_at
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.status IN ('pending', 'confirmed', 'checked_in')
  AND tr.reservation_datetime >= NOW() - INTERVAL '24 hours'
ORDER BY tr.created_at DESC;

-- Expected: Tables should have status='reserved' for active reservations
-- If table_status='available' but reservation_status='confirmed': Trigger didn't fire

-- ============================================================
-- STEP 5: Test the trigger manually
-- ============================================================

-- First, get a table ID and user ID
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_table_id UUID;
  v_table_status TEXT;
  v_table_count INTEGER;
BEGIN
  -- Get tenant and user
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  
  -- Check if we have a tenant
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE '❌ SKIPPED: No tenants found in database. Cannot run test.';
    RETURN;
  END IF;
  
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  
  -- Check if we have a user
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ SKIPPED: No users found in database. Cannot run test.';
    RETURN;
  END IF;
  
  -- Check if tables exist
  SELECT COUNT(*) INTO v_table_count FROM tables WHERE tenant_id = v_tenant_id;
  
  IF v_table_count = 0 THEN
    RAISE NOTICE '❌ SKIPPED: No tables found for tenant. Please create tables first.';
    RAISE NOTICE 'ℹ️  Tenant ID: %', v_tenant_id;
    RAISE NOTICE 'ℹ️  You need to add tables to your venue before testing reservations.';
    RETURN;
  END IF;
  
  -- Get a table ID
  SELECT id INTO v_table_id 
  FROM tables 
  WHERE tenant_id = v_tenant_id 
    AND is_active = true
  ORDER BY created_at 
  LIMIT 1;
  
  -- Final check
  IF v_table_id IS NULL THEN
    RAISE NOTICE '❌ SKIPPED: No active tables found for tenant.';
    RETURN;
  END IF;
  
  RAISE NOTICE '🧪 Running trigger test...';
  RAISE NOTICE 'ℹ️  Tenant ID: %', v_tenant_id;
  RAISE NOTICE 'ℹ️  User ID: %', v_user_id;
  RAISE NOTICE 'ℹ️  Table ID: %', v_table_id;
  
  -- Check current table status
  SELECT status INTO v_table_status FROM tables WHERE id = v_table_id;
  RAISE NOTICE 'Table status BEFORE test reservation: %', v_table_status;
  
  -- Create a test reservation
  INSERT INTO table_reservations (
    tenant_id,
    user_id,
    table_id,
    reservation_datetime,
    duration_hours,
    guest_count,
    status,
    deposit_amount,
    deposit_paid
  ) VALUES (
    v_tenant_id,
    v_user_id,
    v_table_id,
    NOW() + INTERVAL '2 hours',
    2.0,
    4,
    'confirmed',  -- This should trigger the status update
    500.00,
    true
  );
  
  -- Check table status after
  SELECT status INTO v_table_status FROM tables WHERE id = v_table_id;
  RAISE NOTICE 'Table status AFTER test reservation: %', v_table_status;
  
  -- Evaluate result
  IF v_table_status = 'reserved' THEN
    RAISE NOTICE '✅ SUCCESS: Trigger is working correctly!';
  ELSE
    RAISE NOTICE '❌ FAILED: Table status should be "reserved" but is "%"', v_table_status;
    RAISE NOTICE 'ℹ️  This means the auto_update_table_status trigger is not working.';
    RAISE NOTICE 'ℹ️  Check the QUICK FIX sections below for solutions.';
  END IF;
  
  -- Clean up test reservation
  DELETE FROM table_reservations 
  WHERE table_id = v_table_id 
    AND reservation_datetime > NOW();
    
  -- Reset table status
  UPDATE tables SET status = 'available' WHERE id = v_table_id;
  
  RAISE NOTICE '🧹 Test completed and cleaned up';
END $$;

-- Expected output in NOTICES:
-- NOTICE:  Table status BEFORE test reservation: available
-- NOTICE:  Table status AFTER test reservation: reserved
-- If AFTER shows 'available': Trigger is not working

-- ============================================================
-- STEP 6: Check RLS policies on tables
-- ============================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tables'
ORDER BY policyname;

-- Check if there's a policy blocking UPDATE operations
-- Look for policies with cmd='UPDATE' or cmd='ALL'

-- ============================================================
-- STEP 7: Check for errors in function execution
-- ============================================================

-- Enable logging for function calls (run as superuser if possible)
-- Then check pg_stat_statements or logs

-- To see if function is being called but failing:
SELECT * FROM pg_stat_user_functions
WHERE funcname = 'auto_update_table_status';

-- ============================================================
-- STEP 8: Manually test the trigger function
-- ============================================================

DO $$
DECLARE
  v_test_record RECORD;
  v_result RECORD;
BEGIN
  -- Create a mock NEW record
  SELECT 
    gen_random_uuid() as id,
    (SELECT id FROM tenants LIMIT 1) as tenant_id,
    (SELECT id FROM auth.users LIMIT 1) as user_id,
    (SELECT id FROM tables LIMIT 1) as table_id,
    NOW() + INTERVAL '2 hours' as reservation_datetime,
    2.0 as duration_hours,
    4 as guest_count,
    'confirmed' as status,
    500.00 as deposit_amount,
    true as deposit_paid,
    NOW() as created_at,
    NOW() as updated_at
  INTO v_test_record;
  
  -- This won't work directly but shows the structure
  RAISE NOTICE 'Test record would have table_id: %', v_test_record.table_id;
END $$;

-- ============================================================
-- STEP 9: Check if tables have the 'status' column
-- ============================================================

SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tables'
  AND column_name = 'status';

-- Expected: Should show 'status' column exists
-- If empty: Tables table doesn't have status column

-- ============================================================
-- STEP 10: List recent reservation insertions with table updates
-- ============================================================

SELECT 
  tr.id,
  tr.created_at as reservation_created,
  tr.status as reservation_status,
  tr.deposit_paid,
  t.name as table_name,
  t.status as table_status,
  t.updated_at as table_updated
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.created_at > NOW() - INTERVAL '1 hour'
ORDER BY tr.created_at DESC;

-- Look at timestamps: table_updated should be >= reservation_created if trigger worked

-- ============================================================
-- COMMON ISSUES AND SOLUTIONS
-- ============================================================

/*
ISSUE 1: Function doesn't exist
- SOLUTION: Run migration 20260315000003_auto_update_table_status.sql

ISSUE 2: Triggers don't exist
- SOLUTION: Check migration ran completely, may need to re-run trigger creation

ISSUE 3: Table status = 'available' even with confirmed reservation
- SOLUTION: Trigger is not firing or failing silently
- Check RLS policies on tables
- Verify SECURITY DEFINER function has proper permissions

ISSUE 4: Permission denied errors
- SOLUTION: The function uses SECURITY DEFINER but may need explicit GRANT
- Run: GRANT UPDATE ON tables TO authenticated;

ISSUE 5: Trigger fires but table not updated
- SOLUTION: RLS policy might be blocking the UPDATE
- Check policies with cmd='UPDATE' on tables
- May need to adjust RLS policies or use postgres role

ISSUE 6: Frontend shows old data
- SOLUTION: Frontend caching issue
- Increase wait time after reservation creation
- Add force reload: await loadData(true)
*/

-- ============================================================
-- QUICK FIX: Grant necessary permissions
-- ============================================================

-- If trigger exists but not working, try granting permissions:

GRANT UPDATE ON tables TO authenticated;
GRANT UPDATE ON tables TO service_role;

-- ============================================================
-- QUICK FIX: Manually update table statuses
-- ============================================================

-- Temporarily fix existing reservations:

UPDATE tables t
SET status = 'reserved'
WHERE EXISTS (
  SELECT 1 FROM table_reservations tr
  WHERE tr.table_id = t.id
    AND tr.status IN ('pending', 'confirmed', 'checked_in')
    AND tr.reservation_datetime >= NOW() - INTERVAL '4 hours'
    AND tr.reservation_datetime <= NOW() + INTERVAL '24 hours'
);

-- ============================================================
-- QUICK FIX: Re-create the trigger if it's not working
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auto_update_table_status_insert ON table_reservations;
DROP TRIGGER IF EXISTS trigger_auto_update_table_status_update ON table_reservations;

CREATE TRIGGER trigger_auto_update_table_status_insert
  AFTER INSERT ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_table_status();

CREATE TRIGGER trigger_auto_update_table_status_update
  AFTER UPDATE ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_table_status();
