-- DEBUG SCRIPT: Check QR Code Generation After Stripe Payment
-- Run these queries in Supabase SQL Editor to diagnose the issue

-- 1. Check the MOST RECENT transaction (from your last payment)
SELECT 
  id,
  user_id,
  tenant_id,
  type,
  amount,
  status,
  stripe_session_id,
  stripe_payment_intent,
  created_at,
  metadata
FROM transactions
WHERE stripe_session_id = 'cs_test_a1XWM2FFqy4968BGWcbiBmLaXwUzXbbXU6WaNGmxmPxB1JN8FYVGgKPLfl'
ORDER BY created_at DESC;

-- 2. Check if QR codes exist for this session
SELECT 
  qr.id,
  qr.transaction_id,
  qr.user_id,
  qr.code,
  qr.scanned_at,
  qr.created_at,
  t.status as transaction_status,
  t.stripe_session_id
FROM qr_codes qr
LEFT JOIN transactions t ON qr.transaction_id = t.id
WHERE t.stripe_session_id = 'cs_test_a1XWM2FFqy4968BGWcbiBmLaXwUzXbbXU6WaNGmxmPxB1JN8FYVGgKPLfl'
ORDER BY qr.created_at DESC;

-- 3. Find ALL transactions WITHOUT QR codes (this is the problem!)
SELECT 
  t.id as transaction_id,
  t.user_id,
  t.type,
  t.amount,
  t.status,
  t.stripe_session_id,
  t.created_at,
  CASE 
    WHEN qr.id IS NULL THEN '❌ NO QR CODE'
    ELSE '✅ HAS QR CODE'
  END as qr_status
FROM transactions t
LEFT JOIN qr_codes qr ON t.id = qr.transaction_id
WHERE t.status = 'confirmed'
  AND t.stripe_session_id IS NOT NULL
ORDER BY t.created_at DESC
LIMIT 20;

-- 4. Check user_id format - IS IT A UUID?
SELECT 
  id as transaction_id,
  user_id,
  pg_typeof(user_id) as user_id_type,
  LENGTH(user_id::text) as user_id_length,
  user_id::text as user_id_string
FROM transactions
WHERE stripe_session_id = 'cs_test_a1XWM2FFqy4968BGWcbiBmLaXwUzXbbXU6WaNGmxmPxB1JN8FYVGgKPLfl'
LIMIT 1;

-- 5. Check if user_id exists in auth.users
SELECT 
  t.user_id as transaction_user_id,
  au.id as auth_user_id,
  au.email,
  CASE 
    WHEN au.id IS NULL THEN '❌ USER NOT FOUND IN auth.users'
    ELSE '✅ USER EXISTS'
  END as user_exists
FROM transactions t
LEFT JOIN auth.users au ON t.user_id = au.id
WHERE t.stripe_session_id = 'cs_test_a1XWM2FFqy4968BGWcbiBmLaXwUzXbbXU6WaNGmxmPxB1JN8FYVGgKPLfl';

-- 6. MANUAL FIX: Create QR codes for transactions that don't have them
-- Run this ONLY if you confirmed transactions exist without QR codes
INSERT INTO qr_codes (transaction_id, user_id, code)
SELECT 
  t.id, 
  t.user_id, 
  'QR-' || t.id || '-' || extract(epoch from now())::bigint
FROM transactions t
WHERE t.stripe_session_id = 'cs_test_a1XWM2FFqy4968BGWcbiBmLaXwUzXbbXU6WaNGmxmPxB1JN8FYVGgKPLfl'
  AND NOT EXISTS (
    SELECT 1 FROM qr_codes qr WHERE qr.transaction_id = t.id
  )
RETURNING id, transaction_id, code;

-- 7. Verify QR codes were created
SELECT 
  qr.id,
  qr.code,
  qr.transaction_id,
  qr.user_id,
  qr.created_at,
  t.amount,
  t.type,
  t.metadata
FROM qr_codes qr
JOIN transactions t ON qr.transaction_id = t.id
WHERE t.stripe_session_id = 'cs_test_a1XWM2FFqy4968BGWcbiBmLaXwUzXbbXU6WaNGmxmPxB1JN8FYVGgKPLfl'
ORDER BY qr.created_at DESC;
