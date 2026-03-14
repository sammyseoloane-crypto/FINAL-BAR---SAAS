-- Migration: Update events RLS policies to include manager role
-- Date: 2026-03-14
-- Description: Allow managers to view and edit events, but not create or delete them

-- Drop existing policies (including all possible names for idempotency)
DROP POLICY IF EXISTS "Users can view active events in their tenant or public active events" ON events;
DROP POLICY IF EXISTS "Owners and admins can manage events" ON events;
DROP POLICY IF EXISTS "Owners and admins can create events" ON events;
DROP POLICY IF EXISTS "Owners and admins can update events" ON events;
DROP POLICY IF EXISTS "Owners, admins, and managers can update events" ON events;
DROP POLICY IF EXISTS "Owners and admins can delete events" ON events;

-- Recreate SELECT policy with manager included
CREATE POLICY "Users can view active events in their tenant or public active events"
  ON events FOR SELECT
  USING (
    (active = TRUE AND tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role()))
    OR (active = TRUE AND auth.uid() IS NULL)  -- Public viewing
    OR tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin', 'manager', 'staff'))
  );

-- INSERT policy - only owner and admin (managers cannot create events)
CREATE POLICY "Owners and admins can create events"
  ON events FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );

-- UPDATE policy - owner, admin, and manager can edit events
CREATE POLICY "Owners, admins, and managers can update events"
  ON events FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin', 'manager'))
  );

-- DELETE policy - only owner and admin (managers cannot delete events)
CREATE POLICY "Owners and admins can delete events"
  ON events FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role() WHERE role IN ('owner', 'admin'))
  );
