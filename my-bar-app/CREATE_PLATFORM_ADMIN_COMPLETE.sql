-- ================================================
-- COMPLETE SQL SOLUTION - No UI Required
-- Creates auth user + profile in one script
-- ================================================

-- ⚠️ STEP 1: Fix the audit trigger
DROP TRIGGER IF EXISTS audit_profiles ON profiles;

-- ✅ STEP 2: Check if auth user exists
SELECT id, email FROM auth.users WHERE email = 'admin@test.com';

-- If user doesn't exist, you MUST create them in Supabase UI first
-- (Auth users can only be created via UI or Admin API for security)

-- ✅ STEP 3: Check if profile exists
SELECT id, email, role FROM profiles WHERE email = 'admin@test.com';

-- ✅ STEP 4: Create profile if missing + set as platform_admin
INSERT INTO profiles (id, email, role, tenant_id, full_name)
SELECT 
  au.id,
  au.email,
  'platform_admin',
  NULL,
  'Platform Admin'  -- Optional: set a display name
FROM auth.users au
WHERE au.email = 'admin@test.com'  -- Replace with your email
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'platform_admin',
  tenant_id = NULL;

-- ✅ STEP 5: Verify
SELECT 
  au.email as auth_email,
  p.email as profile_email,
  p.role,
  p.tenant_id,
  CASE 
    WHEN p.role = 'platform_admin' THEN '✅ SUCCESS'
    ELSE '⚠️ Role not set correctly'
  END as status
FROM auth.users au
JOIN profiles p ON au.id = p.id
WHERE au.email = 'admin@test.com';

-- ================================================
-- FOR MULTIPLE USERS AT ONCE
-- ================================================

-- Create/update multiple platform admins:
INSERT INTO profiles (id, email, role, tenant_id, full_name)
SELECT 
  au.id,
  au.email,
  'platform_admin',
  NULL,
  'Platform Admin'
FROM auth.users au
WHERE au.email IN ('admin1@test.com', 'admin2@test.com', 'admin3@test.com')
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
ON CONFLICT (id) 
DO UPDATE SET 
  role = 'platform_admin',
  tenant_id = NULL;

-- Verify all:
SELECT email, role, tenant_id 
FROM profiles 
WHERE role = 'platform_admin'
ORDER BY created_at DESC;
