-- ============================================
-- CHECK IF STAFF PROFILES EXIST
-- Run this to see what's in your database
-- ============================================

-- 1. Check all profiles
SELECT 
  id, 
  email, 
  role, 
  tenant_id,
  full_name,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 2. Check current user's profile
SELECT 
  'Current User Info:' as label,
  id, 
  email, 
  role, 
  tenant_id
FROM profiles
WHERE id = auth.uid();

-- 3. Check if any staff/admin profiles exist
SELECT 
  'Staff/Admin Count:' as label,
  COUNT(*) as total
FROM profiles
WHERE role IN ('staff', 'admin', 'manager', 'owner');

-- 4. Check profiles by tenant
SELECT 
  tenant_id,
  COUNT(*) as profile_count,
  STRING_AGG(role, ', ') as roles
FROM profiles
GROUP BY tenant_id;

-- 5. Check if get_user_tenant_and_role() function works
SELECT * FROM get_user_tenant_and_role();

-- 6. Test the RLS policy directly
SELECT 
  'Can you see this profile?' as test,
  id,
  email,
  role
FROM profiles
WHERE role = 'staff'
LIMIT 1;
