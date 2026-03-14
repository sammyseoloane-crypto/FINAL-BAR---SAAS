-- ================================================
-- CRITICAL FIX: Transactions Foreign Keys
-- Run this in Supabase SQL Editor to fix the 400 errors
-- ================================================

-- Step 1: Drop existing foreign key constraints on transactions
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_user_id_fkey CASCADE;

ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_confirmed_by_fkey CASCADE;

-- Step 2: Add new foreign keys referencing profiles table
-- This enables PostgREST to automatically join transactions with profiles
ALTER TABLE transactions
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE transactions
ADD CONSTRAINT transactions_confirmed_by_fkey 
FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Step 3: Add event_id column if it doesn't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS event_id UUID;

-- Step 4: Add metadata column if it doesn't exist (for backward compatibility)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Step 5: Add type column if it doesn't exist (for event_entry tracking)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- Step 6: Add event_id foreign key
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_event_id_fkey' 
        AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 7: Ensure event_id index exists
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id);

-- Step 8: Also fix tasks table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey CASCADE;
        ALTER TABLE tasks
        ADD CONSTRAINT tasks_assigned_to_fkey 
        FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 9: Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the foreign keys were created
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'transactions'
ORDER BY tc.constraint_name;
