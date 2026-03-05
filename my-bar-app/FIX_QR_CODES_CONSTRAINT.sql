-- CHECK AND FIX QR_CODES FOREIGN KEY CONSTRAINT
-- The foreign key is still pointing to the old 'users' table instead of 'auth.users'

-- ============================================================
-- STEP 1: CHECK CURRENT FOREIGN KEY CONSTRAINTS
-- ============================================================

-- View all foreign key constraints on qr_codes table
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
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
    AND tc.table_name = 'qr_codes';

-- ============================================================
-- STEP 2: FIX THE FOREIGN KEY CONSTRAINT
-- ============================================================

-- Drop the incorrect foreign key constraint
ALTER TABLE qr_codes
DROP CONSTRAINT IF EXISTS qr_codes_user_id_fkey;

-- Add the correct foreign key referencing auth.users
ALTER TABLE qr_codes
ADD CONSTRAINT qr_codes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- STEP 3: VERIFY THE FIX
-- ============================================================

-- Check the constraint again to confirm it now points to auth.users
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN ccu.table_name = 'users' AND ccu.table_schema = 'auth' THEN '✅ CORRECT - Points to auth.users'
        WHEN ccu.table_name = 'users' THEN '❌ WRONG - Still points to old users table'
        ELSE '⚠️ UNEXPECTED'
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'qr_codes'
    AND kcu.column_name = 'user_id';

-- ============================================================
-- STEP 4: NOW CREATE QR CODES (Run this AFTER fixing the constraint)
-- ============================================================

-- Create QR codes for transactions with valid user_ids in auth.users
INSERT INTO qr_codes (transaction_id, user_id, code)
SELECT 
  t.id as transaction_id,
  t.user_id,
  t.tenant_id || '_' || 
  t.user_id || '_' || 
  t.id || '_' || 
  extract(epoch from now())::bigint || '_' || 
  substr(md5(random()::text || t.id::text), 1, 10) as code
FROM transactions t
INNER JOIN auth.users au ON t.user_id = au.id  -- Only valid users in auth.users
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  )
RETURNING id, transaction_id, code, user_id, created_at;

-- ============================================================
-- STEP 5: FINAL VERIFICATION
-- ============================================================

SELECT 
  'Total confirmed transactions' as metric,
  COUNT(*) as count
FROM transactions
WHERE status = 'confirmed'
UNION ALL
SELECT 
  'Transactions with QR codes' as metric,
  COUNT(*) as count
FROM transactions t
INNER JOIN qr_codes qr ON t.id = qr.transaction_id
WHERE t.status = 'confirmed'
UNION ALL
SELECT 
  'Transactions without QR codes (valid user)' as metric,
  COUNT(*) as count
FROM transactions t
INNER JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed'
  AND NOT EXISTS (SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id)
UNION ALL
SELECT 
  'Transactions without QR codes (invalid user)' as metric,
  COUNT(*) as count
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed'
  AND au.id IS NULL
  AND NOT EXISTS (SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id);
