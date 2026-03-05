-- DIAGNOSE USER ID ISSUES
-- Find out why user_ids in transactions don't exist in auth.users

-- Step 1: Check which transactions have invalid user_ids
SELECT 
  t.id as transaction_id,
  t.user_id as transaction_user_id,
  t.tenant_id,
  t.type,
  t.amount,
  t.status,
  t.created_at,
  CASE 
    WHEN au.id IS NULL THEN '❌ USER NOT IN auth.users'
    ELSE '✅ USER EXISTS'
  END as user_status,
  au.email as user_email
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  )
ORDER BY t.created_at DESC;

-- Step 2: Count transactions by user existence
SELECT 
  COUNT(*) as total_transactions,
  SUM(CASE WHEN au.id IS NOT NULL THEN 1 ELSE 0 END) as valid_user_ids,
  SUM(CASE WHEN au.id IS NULL THEN 1 ELSE 0 END) as invalid_user_ids
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  );

-- Step 3: Show the specific invalid user_ids
SELECT DISTINCT
  t.user_id as invalid_user_id,
  COUNT(*) as transaction_count,
  SUM(t.amount) as total_amount,
  MIN(t.created_at) as first_transaction,
  MAX(t.created_at) as last_transaction
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE au.id IS NULL
  AND t.status = 'confirmed'
GROUP BY t.user_id
ORDER BY transaction_count DESC;

-- Step 4: Check if these are UUIDs from a different table
-- Maybe there's a profiles table or custom users table?
SELECT 
  t.user_id as transaction_user_id,
  p.id as profile_id,
  p.email as profile_email,
  p.role as profile_role
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
LEFT JOIN profiles p ON t.user_id = p.id
WHERE au.id IS NULL
  AND t.status = 'confirmed'
LIMIT 10;

-- Step 5: FIX - Create QR codes ONLY for transactions with VALID user_ids
INSERT INTO qr_codes (transaction_id, user_id, code)
SELECT 
  t.id as transaction_id,
  t.user_id,
  -- Generate unique QR code in same format as webhook
  t.tenant_id || '_' || 
  t.user_id || '_' || 
  t.id || '_' || 
  extract(epoch from now())::bigint || '_' || 
  substr(md5(random()::text || t.id::text), 1, 10) as code
FROM transactions t
INNER JOIN auth.users au ON t.user_id = au.id  -- Only include transactions with valid users
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  )
RETURNING id, transaction_id, code, user_id, created_at;

-- Step 6: Verify the fix
SELECT 
  COUNT(*) as total_confirmed_transactions,
  SUM(CASE WHEN qr.id IS NOT NULL THEN 1 ELSE 0 END) as transactions_with_qr,
  SUM(CASE WHEN qr.id IS NULL THEN 1 ELSE 0 END) as transactions_without_qr,
  SUM(CASE WHEN qr.id IS NULL AND au.id IS NULL THEN 1 ELSE 0 END) as missing_qr_due_to_invalid_user
FROM transactions t
LEFT JOIN qr_codes qr ON t.id = qr.transaction_id
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed';
