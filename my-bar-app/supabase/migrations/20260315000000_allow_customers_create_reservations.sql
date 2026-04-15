-- Migration: Allow customers to create their own table reservations
-- Date: 2026-03-15
-- Description: Add RLS policy so customers can book tables for themselves

-- ============================================================
-- FIX: Allow customers to create their own reservations
-- ============================================================

-- Add a new INSERT policy specifically for customers creating their own reservations
CREATE POLICY "Customers can create their own reservations" ON table_reservations
  FOR INSERT WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    -- User's tenant_id must match the reservation's tenant_id
    AND tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    -- User must be creating a reservation for themselves
    AND user_id = auth.uid()
  );

-- Also allow customers to update their own reservations (e.g., cancel)
CREATE POLICY "Customers can update their own reservations" ON table_reservations
  FOR UPDATE USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- ============================================================
-- VERIFICATION
-- ============================================================

-- List all policies on table_reservations
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'table_reservations'
ORDER BY policyname;
