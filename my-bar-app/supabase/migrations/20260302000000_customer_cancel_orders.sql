-- Migration: Allow customers to cancel their own pending orders
-- Date: 2026-03-02
-- Description: Add RLS policy for customers to update their own pending transactions to cancelled status

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Customers can cancel their own pending orders" ON transactions;

-- Add policy to allow customers to cancel their own pending orders
CREATE POLICY "Customers can cancel their own pending orders"
  ON transactions FOR UPDATE
  USING (
    user_id = auth.uid() 
    AND status = 'pending'  -- Can only cancel pending orders
    AND tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'customer')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'  -- Can only change status to cancelled
    AND tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role = 'customer')
  );
