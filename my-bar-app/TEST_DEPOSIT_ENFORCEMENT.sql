-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Deposit Payment Enforcement Migration
-- Copy the entire 20260315000002_enforce_deposit_payment_on_confirm.sql
-- migration and run it in your Supabase SQL Editor
-- ============================================================

-- AFTER RUNNING THE MIGRATION, TEST IT:

-- 1️⃣ Find a pending reservation with a deposit
SELECT 
  id,
  table_id,
  guest_count,
  deposit_amount,
  deposit_paid,
  status
FROM table_reservations
WHERE status = 'pending'
  AND deposit_amount > 0
LIMIT 5;

-- 2️⃣ Try to confirm WITHOUT paying deposit (should FAIL)
-- REPLACE 'reservation-id-here' with actual ID
/*
UPDATE table_reservations
SET status = 'confirmed'
WHERE id = 'reservation-id-here';
-- Expected error: "Cannot confirm reservation: Deposit of [amount] must be paid first"
*/

-- 3️⃣ Mark deposit as paid first
/*
SELECT mark_deposit_paid(
  'reservation-id-here'::uuid,
  auth.uid()
);
*/

-- 4️⃣ Verify deposit is marked as paid
/*
SELECT 
  deposit_paid,
  deposit_paid_at
FROM table_reservations
WHERE id = 'reservation-id-here';
*/

-- 5️⃣ Now try to confirm (should SUCCEED)
/*
UPDATE table_reservations
SET status = 'confirmed'
WHERE id = 'reservation-id-here';
*/

-- ============================================================
-- OR USE THE HELPER FUNCTION (RECOMMENDED)
-- ============================================================

-- Confirm with deposit check (will show error if not paid)
/*
SELECT confirm_reservation_with_deposit(
  'reservation-id-here'::uuid,  -- p_reservation_id
  auth.uid(),                    -- p_confirmed_by
  false                          -- p_mark_deposit_paid (set to true to pay and confirm in one step)
);
*/

-- ✅ Result should show:
-- {"success": true, "message": "Reservation confirmed successfully"}

-- ❌ Or if deposit not paid:
-- {"success": false, "error": "Deposit payment required", "deposit_required": true, "deposit_amount": 500.00}
