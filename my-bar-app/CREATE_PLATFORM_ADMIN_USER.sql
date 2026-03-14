-- ================================================
-- CREATE PLATFORM ADMIN USER
-- Quick script to create and configure platform_admin users
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- INSTRUCTIONS
-- ============================================================

-- 1. First, create a user in Supabase Auth UI:
--    - Go to Authentication > Users
--    - Click "Add User"
--    - Enter email and password
--    - Click "Create User"

-- 2. Then run this script below, replacing the email with your test user's email

-- ============================================================
-- UPGRADE USER TO PLATFORM_ADMIN
-- ============================================================

-- Replace 'test-admin@example.com' with your actual test user's email
UPDATE profiles 
SET role = 'platform_admin',
    tenant_id = NULL  -- Platform admins don't belong to any tenant
WHERE email = 'test-admin@example.com';

-- ============================================================
-- VERIFY THE PLATFORM ADMIN WAS CREATED
-- ============================================================

SELECT 
  id,
  email,
  role,
  tenant_id,
  created_at
FROM profiles
WHERE role = 'platform_admin'
ORDER BY created_at DESC;

-- Expected result should show your user with:
-- - role = 'platform_admin'
-- - tenant_id = NULL

-- ============================================================
-- CREATE MULTIPLE TEST USERS (OPTIONAL)
-- ============================================================

-- If you need multiple platform_admin users for testing:

-- UPDATE profiles SET role = 'platform_admin', tenant_id = NULL 
-- WHERE email = 'admin1@example.com';

-- UPDATE profiles SET role = 'platform_admin', tenant_id = NULL 
-- WHERE email = 'admin2@example.com';

-- UPDATE profiles SET role = 'platform_admin', tenant_id = NULL 
-- WHERE email = 'admin3@example.com';

-- ============================================================
-- CREATE TENANT OWNER FOR TESTING (OPTIONAL)
-- ============================================================

-- If you need to test with a venue owner:

-- First, get a tenant_id (or create one if needed):
-- SELECT id, name FROM tenants LIMIT 5;

-- Then update the user:
-- UPDATE profiles 
-- SET role = 'owner',
--     tenant_id = 'your-tenant-id-here'
-- WHERE email = 'owner@example.com';

-- ============================================================
-- CLEANUP TEST USERS (OPTIONAL)
-- ============================================================

-- To remove test users:
-- DELETE FROM auth.users WHERE email = 'test-admin@example.com';
-- (This will cascade delete the profile automatically)
