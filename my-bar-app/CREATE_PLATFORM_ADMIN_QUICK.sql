-- ================================================
-- CREATE PLATFORM ADMIN USERS - Quick Script
-- Run this in Supabase SQL Editor
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- ⚠️ STEP 1: Fix user creation FIRST (run this BEFORE creating users)
-- ============================================================

-- Remove the problematic audit trigger
DROP TRIGGER IF EXISTS audit_profiles ON profiles;

-- ============================================================
-- ✅ STEP 2: Create users in Supabase Auth UI
-- ============================================================

-- Go to: Authentication > Users > Add User
-- Create users with these emails (or your own):
--   • admin@test.com
--   • superadmin@test.com
--   • platform@test.com

-- Set passwords for each user and click "Create User"

-- ============================================================
-- ⏸️ STEP 2.5: Verify profiles were created automatically
-- ============================================================

-- Check if profiles exist for the users you just created
SELECT 
  au.email as auth_email,
  p.email as profile_email,
  p.role,
  p.tenant_id,
  p.created_at,
  CASE 
    WHEN p.id IS NULL THEN '❌ NO PROFILE - CREATE FAILED'
    ELSE '✅ Profile exists'
  END as status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email IN ('admin@test.com', 'superadmin@test.com', 'platform@test.com')
ORDER BY au.created_at DESC;

-- You should see all users with "✅ Profile exists" and role='customer'
-- If you see "❌ NO PROFILE", something is still blocking profile creation

-- ============================================================
-- ✅ STEP 3: Upgrade users to platform_admin
-- ============================================================

-- Single user:
UPDATE profiles 
SET role = 'platform_admin', tenant_id = NULL
WHERE email = 'admin@test.com';

-- Multiple users at once:
UPDATE profiles 
SET role = 'platform_admin', tenant_id = NULL
WHERE email IN (
  'admin@test.com',
  'superadmin@test.com',
  'platform@test.com'
);

-- ============================================================
-- ✅ STEP 4: Verify platform admins were created
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

-- Expected result:
-- • role = 'platform_admin'
-- • tenant_id = NULL (platform admins don't belong to any tenant)

-- ============================================================
-- 🔧 TROUBLESHOOTING: If profiles weren't created
-- ============================================================

-- If Step 2.5 showed "❌ NO PROFILE", manually create profiles:
INSERT INTO profiles (id, email, role, tenant_id)
SELECT 
  au.id,
  au.email,
  'platform_admin',
  NULL
FROM auth.users au
WHERE au.email IN ('admin@test.com', 'superadmin@test.com', 'platform@test.com')
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Then verify again:
SELECT email, role FROM profiles WHERE role = 'platform_admin';

-- ============================================================
-- BONUS: Create test users with different roles
-- ============================================================

-- After creating users in Auth UI, assign different roles:

-- Venue Owner (needs a tenant)
UPDATE profiles 
SET role = 'owner', 
    tenant_id = (SELECT id FROM tenants LIMIT 1)  -- Replace with actual tenant_id
WHERE email = 'owner@test.com';

-- Manager (needs a tenant)
UPDATE profiles 
SET role = 'manager', 
    tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE email = 'manager@test.com';

-- Staff (needs a tenant)
UPDATE profiles 
SET role = 'staff', 
    tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE email = 'staff@test.com';

-- Promoter (needs a tenant)
UPDATE profiles 
SET role = 'promoter', 
    tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE email = 'promoter@test.com';

-- VIP Host (needs a tenant)
UPDATE profiles 
SET role = 'vip_host', 
    tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE email = 'viphost@test.com';

-- Customer (optional tenant)
UPDATE profiles 
SET role = 'customer', 
    tenant_id = NULL
WHERE email = 'customer@test.com';

-- ============================================================
-- CLEANUP: Remove test users
-- ============================================================

-- To delete test users later (cascades to profiles automatically):
-- DELETE FROM auth.users WHERE email = 'admin@test.com';
-- DELETE FROM auth.users WHERE email IN ('admin@test.com', 'superadmin@test.com');

-- ============================================================
-- QUICK REFERENCE: All 7 Roles
-- ============================================================

-- role              | tenant_id | Description
-- ------------------|-----------|------------------------------------------
-- platform_admin    | NULL      | SaaS owner (you), manages all tenants
-- owner             | REQUIRED  | Venue owner, full access to their tenant
-- manager           | REQUIRED  | Venue manager, most access to their tenant
-- staff             | REQUIRED  | Bartender/cashier, limited access
-- promoter          | REQUIRED  | Event promoter, manages guest lists
-- vip_host          | REQUIRED  | Table host, manages VIP reservations
-- customer          | OPTIONAL  | End user, ordering drinks/tickets
