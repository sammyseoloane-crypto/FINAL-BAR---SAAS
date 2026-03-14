-- ================================================
-- FIX: Platform Admin Dashboard 400 Errors
-- Issue: Transactions table missing columns (event_id, metadata)
-- Run this in Supabase SQL Editor
-- ================================================

-- ============================================================
-- DIAGNOSIS
-- ============================================================

-- Check current structure of transactions table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- Expected columns that might be missing:
-- - event_id (UUID)
-- - metadata (JSONB)
-- - type (VARCHAR)

-- ============================================================
-- FIX: Add missing columns to transactions table
-- ============================================================

-- Add event_id column if it doesn't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- Add metadata column if it doesn't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add type column if it doesn't exist  
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- ============================================================
-- FIX: Update foreign keys to reference profiles instead of auth.users
-- This enables PostgREST to join transactions with user profiles
-- ============================================================

-- Drop old foreign keys
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_user_id_fkey CASCADE;

ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_confirmed_by_fkey CASCADE;

-- Add new foreign keys referencing profiles table
ALTER TABLE transactions
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE transactions
ADD CONSTRAINT transactions_confirmed_by_fkey 
FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================
-- REFRESH PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Verify new columns exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'transactions' 
  AND column_name IN ('event_id', 'metadata', 'type')
ORDER BY column_name;

-- Expected result: 3 rows showing event_id, metadata, and type

-- Verify foreign keys are correct
SELECT 
    tc.constraint_name, 
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'transactions'
    AND kcu.column_name IN ('user_id', 'confirmed_by', 'event_id')
ORDER BY kcu.column_name;

-- Expected: 
-- user_id → profiles(id)
-- confirmed_by → profiles(id)
-- event_id → events(id)

-- ============================================================
-- TEST: Try a query that was failing
-- ============================================================

-- This simulates the query the platform admin dashboard makes
SELECT 
  amount,
  status,
  created_at,
  event_id,
  metadata
FROM transactions
WHERE tenant_id IS NULL
LIMIT 5;

-- If this works without error, the fix was successful! ✅
-- If you get an error, check which column is missing from the results above

-- ============================================================
-- NOTES
-- ============================================================

-- Why this happens:
-- - Frontend queries expect event_id and metadata columns
-- - Older migrations didn't include these columns
-- - Foreign keys pointed to auth.users instead of profiles
-- - This causes PostgREST to return 400 errors

-- After applying this fix:
-- - ✅ Platform admin dashboard will load without 400 errors
-- - ✅ Transaction queries will work properly
-- - ✅ Dashboard analytics will display correctly
