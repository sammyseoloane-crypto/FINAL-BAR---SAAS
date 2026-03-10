-- Verify QR Code Generation for Confirmed Transactions
-- This script checks that QR codes are properly created when transactions are confirmed
-- Run this in Supabase SQL Editor

-- ============================================================
-- CHECK 1: Confirmed transactions without QR codes (ISSUE)
-- ============================================================
SELECT 
  t.id as transaction_id,
  t.tenant_id,
  t.user_id,
  t.status,
  t.amount,
  t.type,
  t.confirmed_at,
  t.created_at,
  CASE 
    WHEN qr.id IS NULL THEN '❌ MISSING QR CODE'
    ELSE '✅ HAS QR CODE'
  END as qr_status
FROM transactions t
LEFT JOIN qr_codes qr ON qr.transaction_id = t.id
WHERE t.status = 'confirmed'
  AND qr.id IS NULL
ORDER BY t.confirmed_at DESC;

-- ============================================================
-- CHECK 2: Summary of all transactions by status and QR code presence
-- ============================================================
SELECT 
  t.status,
  COUNT(*) as total_transactions,
  COUNT(qr.id) as transactions_with_qr,
  COUNT(*) - COUNT(qr.id) as transactions_without_qr,
  ROUND(COUNT(qr.id)::numeric / COUNT(*)::numeric * 100, 2) as qr_coverage_percent
FROM transactions t
LEFT JOIN qr_codes qr ON qr.transaction_id = t.id
GROUP BY t.status
ORDER BY t.status;

-- ============================================================
-- CHECK 3: QR codes without valid transactions (orphaned QR codes)
-- ============================================================
SELECT 
  qr.id as qr_code_id,
  qr.transaction_id,
  qr.code,
  qr.scanned_at,
  qr.created_at,
  CASE 
    WHEN t.id IS NULL THEN '❌ ORPHANED (no transaction)'
    WHEN t.status != 'confirmed' THEN '⚠️ Transaction not confirmed'
    ELSE '✅ Valid'
  END as status
FROM qr_codes qr
LEFT JOIN transactions t ON t.id = qr.transaction_id
WHERE t.id IS NULL OR t.status != 'confirmed'
ORDER BY qr.created_at DESC;

-- ============================================================
-- CHECK 4: Duplicate QR codes for same transaction (should not exist)
-- ============================================================
SELECT 
  transaction_id,
  COUNT(*) as qr_count,
  STRING_AGG(id::text, ', ') as qr_code_ids
FROM qr_codes
GROUP BY transaction_id
HAVING COUNT(*) > 1;

-- ============================================================
-- CHECK 5: Recent confirmed transactions and their QR codes (last 50)
-- ============================================================
SELECT 
  t.id as transaction_id,
  t.status,
  t.amount,
  t.type,
  p.name as product_name,
  t.metadata->>'product_name' as metadata_product_name,
  qr.id as qr_code_id,
  qr.code as qr_code_string,
  qr.scanned_at,
  t.confirmed_at,
  t.created_at as transaction_created
FROM transactions t
LEFT JOIN qr_codes qr ON qr.transaction_id = t.id
LEFT JOIN products p ON p.id = t.product_id
WHERE t.status = 'confirmed'
ORDER BY t.confirmed_at DESC
LIMIT 50;

-- ============================================================
-- CHECK 6: QR code statistics
-- ============================================================
SELECT 
  COUNT(DISTINCT qr.id) as total_qr_codes,
  COUNT(DISTINCT CASE WHEN qr.scanned_at IS NOT NULL THEN qr.id END) as scanned_qr_codes,
  COUNT(DISTINCT CASE WHEN qr.scanned_at IS NULL THEN qr.id END) as unscanned_qr_codes,
  COUNT(DISTINCT CASE WHEN qr.created_at > NOW() - INTERVAL '24 hours' THEN qr.id END) as qr_codes_last_24h,
  COUNT(DISTINCT CASE WHEN qr.created_at > NOW() - INTERVAL '24 hours' AND qr.scanned_at IS NULL THEN qr.id END) as active_qr_codes_last_24h
FROM qr_codes qr;

-- ============================================================
-- FIX: Create missing QR codes for confirmed transactions
-- ============================================================
-- CAUTION: Only run this if CHECK 1 shows missing QR codes
-- This will create QR codes for all confirmed transactions that don't have one

/*
DO $$
DECLARE
  trans_record RECORD;
  qr_code_string VARCHAR;
  qr_record RECORD;
BEGIN
  FOR trans_record IN 
    SELECT t.*
    FROM transactions t
    LEFT JOIN qr_codes qr ON qr.transaction_id = t.id
    WHERE t.status = 'confirmed'
      AND qr.id IS NULL
  LOOP
    -- Generate QR code string
    qr_code_string := trans_record.tenant_id || '_' || 
                      trans_record.user_id || '_' || 
                      trans_record.id || '_' || 
                      EXTRACT(EPOCH FROM NOW())::bigint || '_' || 
                      substr(md5(random()::text), 1, 10);
    
    -- Insert QR code
    INSERT INTO qr_codes (transaction_id, user_id, code)
    VALUES (trans_record.id, trans_record.user_id, qr_code_string)
    RETURNING * INTO qr_record;
    
    RAISE NOTICE 'Created QR code % for transaction %', qr_record.id, trans_record.id;
  END LOOP;
  
  RAISE NOTICE 'QR code creation complete!';
END $$;
*/

-- ============================================================
-- VERIFY: After running the fix, check results
-- ============================================================
-- Run CHECK 1 again to verify all confirmed transactions have QR codes
