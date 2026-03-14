-- ================================================
-- FASTEST WAY TO CREATE PLATFORM ADMIN USERS
-- Copy & paste these commands in order
-- ================================================

-- ⚠️ STEP 0: Fix the audit trigger FIRST (run this BEFORE creating users)
DROP TRIGGER IF EXISTS audit_profiles ON profiles;

-- ✅ STEP 1: Now create users in Supabase UI
-- Go to: Authentication > Users > Add User
-- Create user with email: admin@test.com (or your preferred email)
-- Set a password
-- Click "Create User"

-- ⏸️ STEP 2: Wait for profile to be created automatically
-- The handle_new_user() trigger creates a profile with role='customer'
-- Run this to check if profile was created:
SELECT 
  p.id,
  p.email,
  p.role,
  p.tenant_id,
  au.email as auth_email
FROM profiles p
FULL OUTER JOIN auth.users au ON au.id = p.id
WHERE au.email = 'admin@test.com'  -- Replace with your email
ORDER BY p.created_at DESC;

-- If you see a profile with role='customer', continue to Step 3
-- If you DON'T see a profile, the trigger might still be blocking - contact support

-- ✅ STEP 3: Upgrade to platform_admin (replace email)
UPDATE profiles 
SET role = 'platform_admin', tenant_id = NULL
WHERE email = 'admin@test.com';  -- Replace with your email

-- ✅ STEP 4: Verify it worked
SELECT email, role, tenant_id, created_at 
FROM profiles 
WHERE role = 'platform_admin';

-- ================================================
-- MULTIPLE PLATFORM ADMINS AT ONCE
-- ================================================
-- After creating multiple users in Auth UI, upgrade them all:
UPDATE profiles 
SET role = 'platform_admin', tenant_id = NULL
WHERE email IN ('admin1@test.com', 'admin2@test.com', 'admin3@test.com');

-- ================================================
-- 🔧 TROUBLESHOOTING: Profile wasn't created?
-- ================================================
-- If Step 2 shows no profile, manually create it:
INSERT INTO profiles (id, email, role, tenant_id)
SELECT au.id, au.email, 'platform_admin', NULL
FROM auth.users au
WHERE au.email = 'admin@test.com'  -- Replace with your email
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;
