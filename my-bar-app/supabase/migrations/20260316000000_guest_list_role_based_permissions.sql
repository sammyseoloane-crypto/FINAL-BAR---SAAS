-- Guest List Role-Based Permissions
-- This migration adds RLS policies to enforce role-based permissions for guest list operations

-- Drop existing policies if any
DROP POLICY IF EXISTS "guest_entries_insert_policy" ON guest_list_entries;
DROP POLICY IF EXISTS "guest_entries_update_policy" ON guest_list_entries;
DROP POLICY IF EXISTS "guest_entries_delete_policy" ON guest_list_entries;
DROP POLICY IF EXISTS "guest_entries_select_policy" ON guest_list_entries;

-- SELECT Policy: All authenticated users in the tenant can view guest list entries
CREATE POLICY "guest_entries_select_policy"
ON guest_list_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_list_entries.tenant_id
  )
);

-- INSERT Policy: Users with permission can add guests
-- Owner, Manager, VIP Host, Promoter can add guests
-- Staff cannot add guests
CREATE POLICY "guest_entries_insert_policy"
ON guest_list_entries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_list_entries.tenant_id
    AND profiles.role IN ('owner', 'manager', 'vip_host', 'promoter')
  )
  AND guest_list_entries.added_by = auth.uid()
  AND guest_list_entries.tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- UPDATE Policy: Role-based edit permissions
-- Owner, Manager: Can edit all guests
-- VIP Host: Can edit all guests
-- Promoter: Can only edit guests they added
-- Staff: Cannot edit guests
CREATE POLICY "guest_entries_update_policy"
ON guest_list_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_list_entries.tenant_id
    AND (
      -- Owners and managers can edit all guests
      profiles.role IN ('owner', 'manager') OR
      -- VIP hosts can edit all guests
      profiles.role = 'vip_host' OR
      -- Promoters can only edit their own guests
      (profiles.role = 'promoter' AND guest_list_entries.added_by = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_list_entries.tenant_id
    AND (
      -- Owners and managers can edit all guests
      profiles.role IN ('owner', 'manager') OR
      -- VIP hosts can edit all guests
      profiles.role = 'vip_host' OR
      -- Promoters can only edit their own guests
      (profiles.role = 'promoter' AND guest_list_entries.added_by = auth.uid())
    )
  )
);

-- DELETE Policy: Only Owner and Manager can remove guests
-- VIP Host, Promoter, Staff cannot remove guests
CREATE POLICY "guest_entries_delete_policy"
ON guest_list_entries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_list_entries.tenant_id
    AND profiles.role IN ('owner', 'manager')
  )
);

-- Guest Lists Policies
-- Drop existing if any
DROP POLICY IF EXISTS "guest_lists_select_policy" ON guest_lists;
DROP POLICY IF EXISTS "guest_lists_insert_policy" ON guest_lists;
DROP POLICY IF EXISTS "guest_lists_update_policy" ON guest_lists;
DROP POLICY IF EXISTS "guest_lists_delete_policy" ON guest_lists;

-- SELECT: All authenticated users in tenant can view guest lists
CREATE POLICY "guest_lists_select_policy"
ON guest_lists
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_lists.tenant_id
  )
);

-- INSERT: Owner, Manager, Promoter can create guest lists
-- VIP Host and Staff cannot create lists
CREATE POLICY "guest_lists_insert_policy"
ON guest_lists
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_lists.tenant_id
    AND profiles.role IN ('owner', 'manager', 'promoter')
  )
  AND guest_lists.tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

-- UPDATE: Owner, Manager can update any list
-- Promoter can only update their own lists
CREATE POLICY "guest_lists_update_policy"
ON guest_lists
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_lists.tenant_id
    AND (
      profiles.role IN ('owner', 'manager') OR
      (profiles.role = 'promoter' AND guest_lists.promoter_id = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_lists.tenant_id
    AND (
      profiles.role IN ('owner', 'manager') OR
      (profiles.role = 'promoter' AND guest_lists.promoter_id = auth.uid())
    )
  )
);

-- DELETE: Owner, Manager can delete any list
-- Promoter can only delete their own lists
CREATE POLICY "guest_lists_delete_policy"
ON guest_lists
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.tenant_id = guest_lists.tenant_id
    AND (
      profiles.role IN ('owner', 'manager') OR
      (profiles.role = 'promoter' AND guest_lists.promoter_id = auth.uid())
    )
  )
);

COMMENT ON POLICY "guest_entries_select_policy" ON guest_list_entries IS 'All authenticated users in tenant can view guest entries';
COMMENT ON POLICY "guest_entries_insert_policy" ON guest_list_entries IS 'Owner, Manager, VIP Host, Promoter can add guests';
COMMENT ON POLICY "guest_entries_update_policy" ON guest_list_entries IS 'Owner/Manager/VIP Host can edit all guests, Promoter can edit own guests';
COMMENT ON POLICY "guest_entries_delete_policy" ON guest_list_entries IS 'Only Owner and Manager can remove guests';

COMMENT ON POLICY "guest_lists_select_policy" ON guest_lists IS 'All authenticated users in tenant can view guest lists';
COMMENT ON POLICY "guest_lists_insert_policy" ON guest_lists IS 'Owner, Manager, Promoter can create guest lists';
COMMENT ON POLICY "guest_lists_update_policy" ON guest_lists IS 'Owner/Manager can update all lists, Promoter can update own lists';
COMMENT ON POLICY "guest_lists_delete_policy" ON guest_lists IS 'Owner/Manager can delete all lists, Promoter can delete own lists';
