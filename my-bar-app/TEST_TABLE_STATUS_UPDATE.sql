-- ============================================================
-- TEST: Table Status Auto-Update After Payment
-- ============================================================

-- 1️⃣ Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE '%auto_update_table_status%';

-- Expected: 2 triggers (INSERT and UPDATE on table_reservations)

-- ============================================================

-- 2️⃣ Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'auto_update_table_status';

-- Expected: 1 function

-- ============================================================

-- 3️⃣ Check current table statuses
SELECT 
  id,
  name,
  status,
  table_type,
  updated_at
FROM tables
ORDER BY name;

-- All tables should show 'available' unless they have active reservations

-- ============================================================

-- 4️⃣ Check active reservations
SELECT 
  tr.id,
  t.name as table_name,
  t.status as table_status,
  tr.status as reservation_status,
  tr.deposit_paid,
  tr.created_at
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.status IN ('pending', 'confirmed', 'checked_in')
ORDER BY tr.created_at DESC
LIMIT 10;

-- Tables with active reservations should have status = 'reserved'

-- ============================================================

-- 5️⃣ Test the trigger manually
-- OPTION A: If you don't have the migration run yet, run it from
-- 20260315000003_auto_update_table_status.sql

-- OPTION B: Test by creating a test reservation

/*
-- Find an available table
SELECT id, name, status FROM tables WHERE status = 'available' LIMIT 1;

-- Create a test reservation (REPLACE IDs with real ones)
INSERT INTO table_reservations (
  tenant_id,
  table_id,
  user_id,
  reservation_date,
  reservation_time,
  reservation_datetime,
  duration_hours,
  end_datetime,
  guest_count,
  contact_email,
  deposit_amount,
  deposit_paid,
  deposit_paid_at,
  minimum_spend,
  status
) VALUES (
  'YOUR-TENANT-ID',
  'YOUR-TABLE-ID',
  auth.uid(),
  CURRENT_DATE + INTERVAL '1 day',
  '20:00',
  (CURRENT_DATE + INTERVAL '1 day')::timestamp + '20:00'::time,
  2.0,
  (CURRENT_DATE + INTERVAL '1 day')::timestamp + '22:00'::time,
  4,
  'test@example.com',
  500.00,
  true,
  NOW(),
  1000.00,
  'confirmed'
);

-- Check if table status changed to 'reserved'
SELECT id, name, status FROM tables WHERE id = 'YOUR-TABLE-ID';
-- Expected: status = 'reserved'
*/

-- ============================================================

-- 6️⃣ Check for any errors in trigger execution
-- If the trigger isn't working, check PostgreSQL logs in Supabase dashboard

-- ============================================================

-- 7️⃣ Force update all reserved tables based on current reservations
-- Run this if tables aren't updating properly

/*
-- Mark all tables as reserved if they have active reservations
UPDATE tables t
SET status = 'reserved'
WHERE EXISTS (
  SELECT 1 FROM table_reservations tr
  WHERE tr.table_id = t.id
    AND tr.status IN ('pending', 'confirmed', 'checked_in')
    AND tr.reservation_datetime >= NOW() - INTERVAL '2 hours'
);

-- Mark all tables as available if they have no active reservations
UPDATE tables t
SET status = 'available'
WHERE NOT EXISTS (
  SELECT 1 FROM table_reservations tr
  WHERE tr.table_id = t.id
    AND tr.status IN ('pending', 'confirmed', 'checked_in')
    AND tr.reservation_datetime >= NOW() - INTERVAL '2 hours'
)
AND status != 'maintenance';
*/
