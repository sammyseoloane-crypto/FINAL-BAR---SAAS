-- FIX MISSING QR CODES
-- This script creates QR codes for all confirmed transactions that don't have them
-- Run this in your Supabase SQL Editor

-- Step 1: Check how many transactions are missing QR codes
SELECT 
  COUNT(*) as missing_qr_count,
  SUM(amount) as total_amount
FROM transactions t
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  );

-- Step 2: See which transactions are missing QR codes
SELECT 
  t.id as transaction_id,
  t.user_id,
  t.tenant_id,
  t.type,
  t.amount,
  t.status,
  t.stripe_session_id,
  t.created_at,
  '❌ NO QR CODE' as status
FROM transactions t
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  )
ORDER BY t.created_at DESC
LIMIT 50;

-- Step 3: CREATE QR CODES for all confirmed transactions missing them
-- This uses the same format as the webhook for consistency
-- ONLY creates QR codes for transactions with VALID user_ids in auth.users
INSERT INTO qr_codes (transaction_id, user_id, code)
SELECT 
  t.id as transaction_id,
  t.user_id,
  -- Generate unique QR code in same format as webhook: tenant_user_transaction_timestamp_random
  t.tenant_id || '_' || 
  t.user_id || '_' || 
  t.id || '_' || 
  extract(epoch from now())::bigint || '_' || 
  substr(md5(random()::text || t.id::text), 1, 10) as code
FROM transactions t
INNER JOIN auth.users au ON t.user_id = au.id  -- IMPORTANT: Only include transactions with valid users
WHERE t.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  )
RETURNING id, transaction_id, code, created_at;

-- Step 4: Verify all confirmed transactions now have QR codes
SELECT 
  COUNT(*) as total_confirmed_transactions,
  SUM(CASE WHEN qr.id IS NOT NULL THEN 1 ELSE 0 END) as transactions_with_qr,
  SUM(CASE WHEN qr.id IS NULL AND au.id IS NOT NULL THEN 1 ELSE 0 END) as transactions_without_qr_valid_user,
  SUM(CASE WHEN qr.id IS NULL AND au.id IS NULL THEN 1 ELSE 0 END) as transactions_without_qr_invalid_user
FROM transactions t
LEFT JOIN qr_codes qr ON t.id = qr.transaction_id
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE t.status = 'confirmed';

-- Step 5: View recent QR codes created
SELECT 
  qr.id,
  qr.code,
  qr.transaction_id,
  qr.user_id,
  qr.created_at,
  t.amount,
  t.type,
  t.status
FROM qr_codes qr
JOIN transactions t ON qr.transaction_id = t.id
ORDER BY qr.created_at DESC
LIMIT 20;
