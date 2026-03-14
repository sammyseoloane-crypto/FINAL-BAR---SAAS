-- Migration: Add VIP Host role to table_reservations RLS policies
-- Date: 2026-03-14
-- Description: Allow vip_host role to view and manage table reservations and bottle orders

-- ============================================================
-- TABLE RESERVATIONS RLS UPDATES
-- ============================================================

-- Drop all existing policies on table_reservations
DROP POLICY IF EXISTS "Users can view their own reservations" ON table_reservations;
DROP POLICY IF EXISTS "Staff can create reservations" ON table_reservations;
DROP POLICY IF EXISTS "Staff can update reservations" ON table_reservations;
DROP POLICY IF EXISTS "Staff can delete reservations" ON table_reservations;
DROP POLICY IF EXISTS "table_reservations_tenant_isolation" ON table_reservations;
DROP POLICY IF EXISTS "Owners and admins can manage reservations" ON table_reservations;
DROP POLICY IF EXISTS "Users can view reservations" ON table_reservations;

-- Recreate SELECT policy with vip_host included
CREATE POLICY "Users can view their own reservations" ON table_reservations
  FOR SELECT USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff', 'vip_host')
    )
  );

-- INSERT policy - staff and vip_host can create reservations
CREATE POLICY "Staff can create reservations" ON table_reservations
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff', 'vip_host')
    )
  );

-- UPDATE policy - staff and vip_host can update reservations
CREATE POLICY "Staff can update reservations" ON table_reservations
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'staff', 'vip_host')
    )
  );

-- DELETE policy - only owner and admin can delete reservations
CREATE POLICY "Staff can delete reservations" ON table_reservations
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- BOTTLE ORDERS RLS UPDATES
-- ============================================================

-- Drop existing policy
DROP POLICY IF EXISTS "bottle_orders_tenant_isolation" ON bottle_orders;

-- Recreate with vip_host included
CREATE POLICY bottle_orders_tenant_isolation ON bottle_orders
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'staff', 'vip_host')
      )
    )
  );
