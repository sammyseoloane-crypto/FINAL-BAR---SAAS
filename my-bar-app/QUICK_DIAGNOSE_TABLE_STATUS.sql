-- ============================================================
-- QUICK DIAGNOSTIC: Table Status Issue
-- File: QUICK_DIAGNOSE_TABLE_STATUS.sql
-- Date: 2026-03-15
-- Description: Quick 3-step diagnostic for table status problems
-- ============================================================

-- ============================================================
-- QUICK CHECK #1: Do you have tables in your database?
-- ============================================================

SELECT 
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE status = 'available') as available_tables,
  COUNT(*) FILTER (WHERE status = 'reserved') as reserved_tables,
  COUNT(*) FILTER (WHERE is_active = true) as active_tables
FROM tables;

-- Expected: At least some tables should exist
-- If total_tables = 0: YOU NEED TO CREATE TABLES FIRST!
-- This is likely your issue - no tables = can't book anything!

-- ============================================================
-- QUICK CHECK #2: Does the trigger function exist?
-- ============================================================

SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Function exists'
    ELSE '❌ Function missing - Run migration 20260315000003'
  END as status
FROM information_schema.routines
WHERE routine_name = 'auto_update_table_status';

-- ============================================================
-- QUICK CHECK #3: Do the triggers exist?
-- ============================================================

SELECT 
  CASE 
    WHEN COUNT(*) = 2 THEN '✅ Both triggers exist (INSERT and UPDATE)'
    WHEN COUNT(*) = 1 THEN '⚠️ Only 1 trigger exists - Re-run migration'
    ELSE '❌ No triggers found - Run migration 20260315000003'
  END as status
FROM information_schema.triggers
WHERE trigger_name LIKE '%auto_update_table_status%';

-- ============================================================
-- QUICK CHECK #4: Recent reservations and their table status
-- ============================================================

SELECT 
  tr.created_at::timestamp as when_created,
  t.name as table_name,
  tr.status as reservation_status,
  t.status as table_status,
  CASE 
    WHEN tr.status IN ('confirmed', 'checked_in') AND t.status = 'reserved' THEN '✅ Correct'
    WHEN tr.status IN ('confirmed', 'checked_in') AND t.status != 'reserved' THEN '❌ Trigger failed!'
    ELSE 'ℹ️ Pending or completed'
  END as check_result
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.created_at > NOW() - INTERVAL '2 hours'
ORDER BY tr.created_at DESC
LIMIT 10;

-- Look for rows with "❌ Trigger failed!" - that's your problem

-- ============================================================
-- SUMMARY: What to do based on results
-- ============================================================

/*
IF QUICK CHECK #1 shows total_tables = 0:
  → YOUR ISSUE: You need to create tables first!
  → SOLUTION: Log in as owner/manager and create tables in your venue
  → Go to: Tables Management page and add tables
  
IF Function or Triggers are missing:
  → YOUR ISSUE: Migration not applied
  → SOLUTION: Run /supabase/migrations/20260315000003_auto_update_table_status.sql
  
IF Check #4 shows "❌ Trigger failed!":
  → YOUR ISSUE: Trigger exists but not working
  → SOLUTION: Run these commands:
  
  GRANT UPDATE ON tables TO authenticated;
  GRANT UPDATE ON tables TO service_role;
  
  -- Then manually fix existing reservations:
  UPDATE tables t
  SET status = 'reserved', updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM table_reservations tr
    WHERE tr.table_id = t.id
      AND tr.status IN ('confirmed', 'checked_in')
      AND tr.reservation_datetime >= NOW() - INTERVAL '4 hours'
  );
*/

-- ============================================================
-- QUICK FIX: If you have no tables, here's a sample table
-- ============================================================

-- Uncomment and modify to create a test table:

/*
INSERT INTO tables (
  tenant_id,
  name,
  table_type,
  capacity,
  status,
  deposit_amount,
  minimum_spend,
  is_active,
  zone,
  description
) VALUES (
  'YOUR_TENANT_ID_HERE',  -- Get from: SELECT id FROM tenants LIMIT 1;
  'VIP Table 1',
  'vip',
  6,
  'available',
  500.00,
  2000.00,
  true,
  'VIP Section',
  'Premium VIP table with bottle service'
);
*/
