-- ============================================================
-- VERIFICATION: Auto Bar Tab Creation on Check-In
-- Run these queries to verify everything is working
-- ============================================================

-- 1️⃣ Check if all columns were added successfully
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bar_tabs' 
  AND column_name IN ('tab_type', 'table_reservation_id')
ORDER BY column_name;

-- Expected: 2 rows
-- tab_type | character varying | YES
-- table_reservation_id | uuid | YES

-- ============================================================

-- 2️⃣ Check if bar_tab_id was added to transactions
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions' 
  AND column_name = 'bar_tab_id';

-- Expected: 1 row
-- bar_tab_id | uuid | YES

-- ============================================================

-- 3️⃣ Verify trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_create_bar_tab_on_checkin';

-- Expected: 1 row showing UPDATE trigger on table_reservations

-- ============================================================

-- 4️⃣ Verify functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'auto_create_bar_tab_on_checkin',
    'get_active_table_tab',
    'add_item_to_table_tab'
  )
ORDER BY routine_name;

-- Expected: 3 rows (all should be FUNCTION)

-- ============================================================

-- 5️⃣ Check active_vip_table_tabs view exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'active_vip_table_tabs';

-- Expected: 1 row showing VIEW

-- ============================================================

-- 6️⃣ View all current bar tabs (if any)
SELECT 
  id,
  tab_number,
  tab_type,
  status,
  total_amount,
  table_reservation_id
FROM bar_tabs
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================

-- 7️⃣ TEST: Check in a reservation (REPLACE WITH REAL IDs)
-- First, find a pending reservation
SELECT 
  id,
  table_id,
  user_id,
  tenant_id,
  status,
  reservation_datetime,
  guest_count,
  minimum_spend
FROM table_reservations
WHERE status IN ('pending', 'confirmed')
ORDER BY reservation_datetime
LIMIT 5;

-- Copy an ID from above, then run:
/*
UPDATE table_reservations
SET 
  status = 'checked_in',
  checked_in_at = NOW(),
  checked_in_by = auth.uid()
WHERE id = 'YOUR-RESERVATION-ID-HERE';
*/

-- ============================================================

-- 8️⃣ Verify bar tab was auto-created
-- Run this AFTER checking in a reservation
SELECT 
  bt.tab_number,
  bt.tab_type,
  bt.status,
  bt.total_amount,
  bt.table_reservation_id,
  tr.status as reservation_status,
  tr.minimum_spend
FROM bar_tabs bt
INNER JOIN table_reservations tr ON bt.table_reservation_id = tr.id
WHERE tr.status = 'checked_in'
ORDER BY bt.created_at DESC
LIMIT 5;

-- Expected: Bar tab should exist with:
-- - tab_type = 'vip_table'
-- - status = 'open'
-- - table_reservation_id matches the checked-in reservation

-- ============================================================

-- 9️⃣ View active VIP table tabs using the new view
SELECT * FROM active_vip_table_tabs;

-- ============================================================

-- 🔟 TEST: Add item to a table tab
-- First, get a bar tab ID
SELECT id, tab_number, status 
FROM bar_tabs 
WHERE status = 'open' 
LIMIT 1;

-- Get a product ID
SELECT id, name, price 
FROM products 
WHERE available = true 
LIMIT 5;

-- Then call the function (REPLACE WITH REAL IDs):
/*
SELECT add_item_to_table_tab(
  'BAR-TAB-ID-HERE'::uuid,       -- p_bar_tab_id
  'PRODUCT-ID-HERE'::uuid,       -- p_product_id
  2,                             -- p_quantity
  150.00,                        -- p_unit_price
  auth.uid(),                    -- p_added_by
  'Extra ice'                    -- p_notes
);
*/

-- ============================================================

-- ✅ COMPLETE VERIFICATION
-- If all queries above return expected results, the migration is successful!
