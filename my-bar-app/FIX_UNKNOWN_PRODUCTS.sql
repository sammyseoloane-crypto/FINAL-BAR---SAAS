-- Fix "Unknown Product" Issue
-- This script identifies transactions with NULL product_id and determines if they need fixing
-- Run this entire script in Supabase SQL Editor

-- ============================================================
-- DIAGNOSTIC: Identify transactions without products
-- ============================================================

-- Check event transactions (these are NORMAL - events don't use product_id)
SELECT 
  COUNT(*) as event_transactions,
  STRING_AGG(DISTINCT tenant_id::text, ', ') as tenants
FROM transactions
WHERE product_id IS NULL
  AND type = 'event_entry';

-- Check transactions that SHOULD have products but don't (these need fixing)
SELECT 
  COUNT(*) as broken_transactions,
  STRING_AGG(DISTINCT tenant_id::text, ', ') as affected_tenants
FROM transactions
WHERE product_id IS NULL
  AND (type = 'product_purchase' OR type IS NULL);

-- ============================================================
-- DETAILS: Show broken transactions
-- ============================================================
SELECT 
  id,
  tenant_id,
  user_id,
  type,
  amount,
  metadata,
  status,
  created_at
FROM transactions
WHERE product_id IS NULL
  AND (type = 'product_purchase' OR type IS NULL)
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================
-- FIX: Create "Unknown Product" and link broken transactions
-- Only fixes product_purchase transactions that should have product_id
-- ============================================================
DO $$
DECLARE
  tenant_record RECORD;
  fallback_product_id UUID;
  updated_count INTEGER;
BEGIN
  FOR tenant_record IN 
    SELECT DISTINCT tenant_id 
    FROM transactions 
    WHERE product_id IS NULL
      AND (type = 'product_purchase' OR type IS NULL)
  LOOP
    -- Check if "Unknown Product" already exists for this tenant
    SELECT id INTO fallback_product_id
    FROM products
    WHERE tenant_id = tenant_record.tenant_id
      AND name = 'Unknown Product';
    
    -- If not, create it
    IF fallback_product_id IS NULL THEN
      INSERT INTO products (tenant_id, name, description, price, type, available)
      VALUES (
        tenant_record.tenant_id,
        'Unknown Product',
        'Fallback product for transactions with missing product data',
        0.00,
        'drink',
        false
      )
      RETURNING id INTO fallback_product_id;
      
      RAISE NOTICE 'Created Unknown Product % for tenant %', fallback_product_id, tenant_record.tenant_id;
    ELSE
      RAISE NOTICE 'Using existing Unknown Product % for tenant %', fallback_product_id, tenant_record.tenant_id;
    END IF;
    
    -- Update only product_purchase transactions with NULL product_id
    UPDATE transactions
    SET product_id = fallback_product_id,
        updated_at = NOW()
    WHERE product_id IS NULL
      AND tenant_id = tenant_record.tenant_id
      AND (type = 'product_purchase' OR type IS NULL);
      
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
      RAISE NOTICE 'Updated % product transactions for tenant %', updated_count, tenant_record.tenant_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Fix complete! Event transactions were left unchanged (they don''t need product_id).';
END $$;

-- ============================================================
-- VERIFY: Check results
-- ============================================================
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ SUCCESS: All product transactions have valid products!'
    ELSE '❌ ISSUE: ' || COUNT(*) || ' product transactions still missing products'
  END as verification_result
FROM transactions t
LEFT JOIN products p ON t.product_id = p.id
WHERE (t.type = 'product_purchase' OR t.type IS NULL)
  AND (p.id IS NULL OR t.product_id IS NULL);

-- ============================================================
-- SUMMARY: Show all transaction types
-- ============================================================
SELECT 
  type,
  COUNT(*) as count,
  COUNT(product_id) as with_product,
  COUNT(*) - COUNT(product_id) as without_product
FROM transactions
GROUP BY type
ORDER BY count DESC;
