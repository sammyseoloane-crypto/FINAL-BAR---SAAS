-- ============================================
-- FIX GUEST LISTS FOREIGN KEY CONSTRAINT
-- This adds the missing FK between guest_lists and events
-- ============================================

-- Step 1: Check current state
SELECT 
  'Current guest_lists table info:' as status,
  COUNT(*) as total_guest_lists,
  COUNT(event_id) as with_event_id,
  COUNT(*) - COUNT(event_id) as null_event_ids
FROM guest_lists;

-- Step 2: Check if FK constraint already exists
SELECT 
  'Existing FK constraints:' as status,
  conname as constraint_name,
  conrelid::regclass as table_name,
  confrelid::regclass as foreign_table
FROM pg_constraint
WHERE conrelid = 'guest_lists'::regclass
  AND contype = 'f';

-- Step 3: Add FK constraint if it doesn't exist
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'guest_lists_event_id_fkey'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE guest_lists
    ADD CONSTRAINT guest_lists_event_id_fkey
    FOREIGN KEY (event_id)
    REFERENCES events(id)
    ON DELETE CASCADE;
    
    RAISE NOTICE 'FK constraint added successfully';
  ELSE
    RAISE NOTICE 'FK constraint already exists';
  END IF;
END $$;

-- Step 4: Reload PostgREST schema cache (CRITICAL!)
NOTIFY pgrst, 'reload schema';

-- Step 5: Verify the fix
SELECT 
  'Verification:' as status,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'guest_lists'::regclass
  AND contype = 'f'
  AND conname = 'guest_lists_event_id_fkey';

-- Step 6: Test query that was failing
SELECT 
  'Test Query - Should work now:' as status,
  COUNT(*) as guest_lists_with_events
FROM guest_lists
INNER JOIN events ON guest_lists.event_id = events.id;
