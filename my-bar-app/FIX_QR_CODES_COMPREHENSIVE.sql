-- COMPREHENSIVE FIX FOR MISSING QR CODES
-- Handles both valid and invalid user_ids

-- ============================================================
-- STEP 1: DIAGNOSE THE PROBLEM
-- ============================================================

-- See how many transactions have invalid user_ids
SELECT 
  'Transactions with invalid user_ids' as description,
  COUNT(*) as count,
  SUM(t.amount) as total_amount
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed'
  AND au.id IS NULL
  AND NOT EXISTS (SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id);

-- See how many transactions have valid user_ids but missing QR codes
SELECT 
  'Transactions with valid user_ids, missing QR codes' as description,
  COUNT(*) as count,
  SUM(t.amount) as total_amount
FROM transactions t
INNER JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed'
  AND NOT EXISTS (SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id);

-- ============================================================
-- STEP 2: FIX OPTION A - Create QR codes only for valid users
-- ============================================================

-- This creates QR codes for transactions with valid user_ids
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
INNER JOIN auth.users au ON t.user_id = au.id  -- Only valid users
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  )
RETURNING id, transaction_id, code, user_id, created_at;

-- ============================================================
-- STEP 3: FIX OPTION B - Fix invalid user_ids (if needed)
-- ============================================================

-- Option B1: Check if there's a profiles table with the mapping
SELECT 
  t.id as transaction_id,
  t.user_id as old_user_id,
  p.id as profile_id,
  au.id as auth_user_id,
  au.email
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
LEFT JOIN profiles p ON p.id = au.id OR p.email = au.email
WHERE t.status = 'confirmed'
  AND au.id IS NULL
  AND NOT EXISTS (SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id)
LIMIT 10;

-- Option B2: If you want to assign orphaned transactions to a system user
-- First, create or identify a system user
DO $$
DECLARE
  system_user_id UUID;
BEGIN
  -- Check if a system user exists in auth.users
  SELECT id INTO system_user_id FROM auth.users WHERE email = 'system@bar.local' LIMIT 1;
  
  IF system_user_id IS NULL THEN
    RAISE NOTICE 'No system user found. Transactions with invalid user_ids will remain without QR codes.';
  ELSE
    -- Update transactions with invalid user_ids to use system user
    UPDATE transactions
    SET user_id = system_user_id,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('original_user_id', user_id::text, 'fixed_at', now())
    WHERE status = 'confirmed'
      AND user_id NOT IN (SELECT id FROM auth.users)
      AND NOT EXISTS (SELECT 1 FROM qr_codes WHERE transaction_id = transactions.id);
    
    RAISE NOTICE 'Updated % transactions to system user', ROW_COUNT;
  END IF;
END $$;

-- Option B3: Delete transactions with invalid user_ids (DESTRUCTIVE - use with caution)
-- Uncomment only if you want to remove orphaned transactions
-- DELETE FROM transactions 
-- WHERE user_id NOT IN (SELECT id FROM auth.users)
--   AND status = 'confirmed';

-- ============================================================
-- STEP 4: VERIFY THE FIX
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

-- ============================================================
-- STEP 5: VIEW RECENT QR CODES
-- ============================================================

SELECT 
  qr.id,
  qr.code,
  qr.transaction_id,
  qr.user_id,
  au.email as user_email,
  qr.created_at as qr_created,
  t.amount,
  t.type,
  t.status
FROM qr_codes qr
JOIN transactions t ON qr.transaction_id = t.id
LEFT JOIN auth.users au ON qr.user_id = au.id
ORDER BY qr.created_at DESC
LIMIT 20;
