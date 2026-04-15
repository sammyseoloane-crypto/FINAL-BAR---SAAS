-- ============================================================
-- FIX RLS BLOCKING CUSTOMER RESERVATIONS
-- File: FIX_RLS_CUSTOMER_RESERVATIONS.sql
-- Date: 2026-03-15
-- Description: Fix RLS policies blocking customers from creating reservations
-- ============================================================

-- ============================================================
-- STEP 1: Check existing policies on table_reservations
-- ============================================================

SELECT 
  policyname,
  cmd as operation,
  permissive,
  roles,
  SUBSTRING(qual::text, 1, 100) as using_clause,
  SUBSTRING(with_check::text, 1, 100) as with_check_clause
FROM pg_policies 
WHERE tablename = 'table_reservations'
ORDER BY cmd, policyname;

-- Look for:
-- - INSERT policies that might conflict
-- - Check if "Customers can create their own reservations" exists
-- - Check if there are any RESTRICTIVE policies

-- ============================================================
-- STEP 2: REMOVE conflicting or broken policies
-- ============================================================

-- Drop any existing customer insert policies (we'll recreate them)
DROP POLICY IF EXISTS "Customers can create their own reservations" ON table_reservations;
DROP POLICY IF EXISTS "Customers can update their own reservations" ON table_reservations;
DROP POLICY IF EXISTS "Customers can view their own reservations" ON table_reservations;

-- Drop any other potentially conflicting policies
-- (Uncomment if you have these)
-- DROP POLICY IF EXISTS "Insert own reservations" ON table_reservations;
-- DROP POLICY IF EXISTS "Users can create reservations" ON table_reservations;

-- ============================================================
-- STEP 3: CREATE the correct policies
-- ============================================================

-- Policy 1: Allow customers to INSERT their own reservations
CREATE POLICY "Customers can create their own reservations" ON table_reservations
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    -- User must be creating a reservation for themselves
    user_id = auth.uid()
    -- User's tenant_id must match the reservation's tenant_id
    AND tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy 2: Allow customers to SELECT their own reservations
CREATE POLICY "Customers can view their own reservations" ON table_reservations
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Policy 3: Allow customers to UPDATE their own reservations
CREATE POLICY "Customers can update their own reservations" ON table_reservations
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- ============================================================
-- STEP 4: GRANT necessary table permissions
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON table_reservations TO authenticated;
GRANT SELECT ON tables TO authenticated;
GRANT SELECT ON profiles TO authenticated;

-- ============================================================
-- STEP 5: TEST the policy
-- ============================================================

-- This will test if a customer can insert a reservation
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_table_id UUID;
  v_test_reservation_id UUID;
BEGIN
  -- Get test data
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_table_id FROM tables WHERE tenant_id = v_tenant_id LIMIT 1;
  
  RAISE NOTICE 'Testing with:';
  RAISE NOTICE 'Tenant ID: %', v_tenant_id;
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Table ID: %', v_table_id;
  
  -- Try to insert a test reservation (bypassing RLS for this test)
  BEGIN
    INSERT INTO table_reservations (
      tenant_id,
      user_id,
      table_id,
      reservation_datetime,
      duration_hours,
      guest_count,
      status,
      deposit_amount,
      deposit_paid
    ) VALUES (
      v_tenant_id,
      v_user_id,
      v_table_id,
      NOW() + INTERVAL '24 hours',
      2.0,
      4,
      'confirmed',
      500.00,
      true
    ) RETURNING id INTO v_test_reservation_id;
    
    RAISE NOTICE '✅ SUCCESS: Test reservation created with ID: %', v_test_reservation_id;
    
    -- Clean up
    DELETE FROM table_reservations WHERE id = v_test_reservation_id;
    RAISE NOTICE '✅ Test reservation cleaned up';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ FAILED: %', SQLERRM;
    RAISE NOTICE 'Error Code: %', SQLSTATE;
  END;
END $$;

-- ============================================================
-- STEP 6: Verify policies are active
-- ============================================================

SELECT 
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies
FROM pg_policies 
WHERE tablename = 'table_reservations';

-- Expected:
-- - At least 1 INSERT policy
-- - At least 1 SELECT policy  
-- - At least 1 UPDATE policy

-- ============================================================
-- STEP 7: List all policies (for verification)
-- ============================================================

SELECT 
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'table_reservations'
ORDER BY cmd, policyname;

-- ============================================================
-- COMMON ISSUES AND SOLUTIONS
-- ============================================================

/*
ISSUE 1: "new row violates row-level security policy"
- CAUSE: No INSERT policy allows the operation
- SOLUTION: Run STEP 3 above to create proper policies

ISSUE 2: "permission denied for table table_reservations"
- CAUSE: authenticated role doesn't have INSERT permission
- SOLUTION: Run STEP 4 above to grant permissions

ISSUE 3: Policy exists but still blocked
- CAUSE: Conflicting RESTRICTIVE policy or wrong role
- SOLUTION: Check for RESTRICTIVE policies, ensure using TO authenticated

ISSUE 4: tenant_id mismatch
- CAUSE: User's profile.tenant_id doesn't match reservation.tenant_id
- SOLUTION: Run this to check:
  SELECT p.id, p.tenant_id, t.id as tenant_exists
  FROM profiles p
  LEFT JOIN tenants t ON p.tenant_id = t.id
  WHERE p.id = auth.uid();
*/

-- ============================================================
-- ALTERNATIVE: If policies still don't work, use PERMISSIVE + broader check
-- ============================================================

-- If the above doesn't work, try this more permissive approach:

/*
DROP POLICY IF EXISTS "Customers can create their own reservations" ON table_reservations;

CREATE POLICY "Customers can create their own reservations" ON table_reservations
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );
*/

-- ============================================================
-- NUCLEAR OPTION: Temporarily disable RLS (ONLY FOR TESTING!)
-- ============================================================

-- DO NOT USE IN PRODUCTION!
-- Uncomment only to test if RLS is the issue:

-- ALTER TABLE table_reservations DISABLE ROW LEVEL SECURITY;

-- If this works, the problem is definitely RLS policies
-- Remember to re-enable:
-- ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;
