-- ================================================
-- FIX: Failed to create user - Database error
-- Issue: profiles table CHECK constraint too restrictive
-- Date: 2026-03-14
-- ================================================

-- PROBLEM:
-- The profiles table has a CHECK constraint that only allows:
--   'owner', 'admin', 'staff', 'customer'
-- But the system uses 7 roles:
--   'platform_admin', 'owner', 'manager', 'staff', 'promoter', 'vip_host', 'customer'
-- 
-- When you create a user manually in Supabase, the handle_new_user() trigger
-- fails because it can't insert the profile with the restricted role options.

-- SOLUTION:
-- Apply the migration in Supabase SQL Editor
-- (The full RLS updates are already in separate migration files, but this is the critical fix)

-- ============================================================
-- STEP 1: Add missing roles to profiles table
-- File: 20260314100000_add_missing_roles.sql
-- THIS IS THE CRITICAL FIX - After this, user creation will work!
-- ============================================================

-- Drop the existing role constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with all 7 roles
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('platform_admin', 'owner', 'manager', 'staff', 'promoter', 'vip_host', 'customer'));

-- Update existing 'admin' records to 'platform_admin'
UPDATE profiles 
SET role = 'platform_admin' 
WHERE role = 'admin';

-- Create index for new roles for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_extended ON profiles(role) 
WHERE role IN ('manager', 'promoter', 'vip_host');

-- Add helpful comment
COMMENT ON COLUMN profiles.role IS 'User role: platform_admin (SaaS owner), owner (venue owner), manager (venue manager), staff (bartender/cashier), promoter (event promoter), vip_host (table host), customer (end user)';

-- ============================================================
-- VERIFICATION QUERY
-- Run this after applying the migration to confirm it worked
-- ============================================================

-- Check the current constraint
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = connamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'profiles'
  AND con.contype = 'c'; -- 'c' = CHECK constraint

-- Expected result should show:
-- role IN ('platform_admin', 'owner', 'manager', 'staff', 'promoter', 'vip_host', 'customer')

-- ============================================================
-- TEST: Try creating a test user
-- ============================================================

-- After applying the migration above, try creating a user again in Supabase Auth
-- It should now work without errors!

-- ============================================================
-- RECOMMENDED: Apply additional role-related migrations
-- These are optional but recommended for full new role support
-- ============================================================

-- STEP 2: Update RLS policies for new roles
-- File: 20260314100001_update_profiles_rls_for_new_roles.sql
-- Allows platform_admin and manager to view/manage profiles

-- STEP 3: Fix check_usage_limit function
-- File: 20260314100002_fix_check_usage_limit_function.sql
-- Updates usage limit checking to work with new roles

-- STEP 4: Update events RLS for managers
-- File: 20260314100003_update_events_rls_for_managers.sql
-- Allows managers to view/manage events

-- STEP 5: Add VIP Host to table reservations RLS
-- File: 20260314100004_add_vip_host_to_table_reservations_rls.sql
-- Allows vip_host role to manage table reservations

-- STEP 6: Add profiles foreign keys
-- File: 20260314100005_add_profiles_foreign_keys.sql
-- Ensures data integrity for profile references

-- You can run these migrations from the migrations folder in Supabase SQL Editor
-- They're located at: supabase/migrations/2026031410000*.sql
