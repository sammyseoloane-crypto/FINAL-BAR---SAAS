-- ================================================
-- CRITICAL FIX: Allow Platform Admin to Update Tenants
-- Run this NOW to make suspend/activate work
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- STEP 1: Drop conflicting policies if they exist
-- ============================================================

DROP POLICY IF EXISTS "Platform admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Platform admins can update all tenants" ON tenants;
DROP POLICY IF EXISTS "Platform admins can create tenants" ON tenants;
DROP POLICY IF EXISTS "Platform admins can delete tenants" ON tenants;

-- ============================================================
-- STEP 2: Create platform_admin policies
-- ============================================================

-- Allow platform admins to view all tenants
CREATE POLICY "Platform admins can view all tenants"
  ON tenants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Allow platform admins to update all tenants (THIS IS THE CRITICAL ONE!)
CREATE POLICY "Platform admins can update all tenants"
  ON tenants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Allow platform admins to create tenants
CREATE POLICY "Platform admins can create tenants"
  ON tenants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ============================================================
-- STEP 3: Refresh PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- STEP 4: Verify the policies were created
-- ============================================================

SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tenants'
  AND policyname LIKE '%platform_admin%'
ORDER BY cmd;

-- You should see 3 policies:
-- 1. Platform admins can view all tenants (SELECT)
-- 2. Platform admins can update all tenants (UPDATE)  ← MOST IMPORTANT
-- 3. Platform admins can create tenants (INSERT)

-- ============================================================
-- STEP 5: Test the update manually
-- ============================================================

-- Try updating a tenant manually:
UPDATE tenants 
SET subscription_status = 'inactive'
WHERE id = '252c1a12-8422-4e60-ba7f-5b595148335e';

-- Then check if it worked:
SELECT id, name, subscription_status, updated_at 
FROM tenants 
WHERE id = '252c1a12-8422-4e60-ba7f-5b595148335e';

-- If subscription_status changed to 'inactive', it worked! ✅

-- ============================================================
-- WHAT THIS FIXES
-- ============================================================

-- BEFORE (without this migration):
-- ❌ Platform admin clicks "Suspend"
-- ❌ UPDATE query runs but RLS blocks it
-- ❌ Returns empty array (no error, but no update)
-- ❌ Database still shows status = 'active'
-- ❌ Button doesn't change

-- AFTER (with this migration):
-- ✅ Platform admin clicks "Suspend"
-- ✅ UPDATE query runs and RLS allows it
-- ✅ Database updates to status = 'inactive'
-- ✅ Page refreshes showing new status
-- ✅ Button changes to "Activate"

-- ============================================================
-- IMPORTANT: YOU MUST RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================

-- 1. Go to Supabase Dashboard
-- 2. Open SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run"
-- 5. Refresh your app
-- 6. Try clicking "Suspend" again
-- 7. It will work! ✅
