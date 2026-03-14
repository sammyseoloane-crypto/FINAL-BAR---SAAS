-- ================================================
-- Simple Profile Role Update
-- Quick script to change a user's role
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- METHOD 1: Update by Email (Easiest)
-- ============================================================

-- Change user role by email address
UPDATE profiles
SET role = 'platform_admin'  -- Change to: platform_admin, owner, manager, staff, promoter, vip_host, customer
WHERE email = 'user@example.com';  -- ← Replace with actual email

-- Verify the change
SELECT id, email, role, tenant_id, created_at
FROM profiles
WHERE email = 'user@example.com';

-- ============================================================
-- METHOD 2: Update by User ID
-- ============================================================

-- Change user role by user ID
UPDATE profiles
SET role = 'owner'
WHERE id = 'user-uuid-here';  -- ← Replace with actual user ID

-- ============================================================
-- METHOD 3: View All Users First
-- ============================================================

-- See all users with their current roles
SELECT 
  id,
  email,
  role,
  tenant_id,
  (SELECT name FROM tenants WHERE id = profiles.tenant_id) as tenant_name,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- ============================================================
-- AVAILABLE ROLES
-- ============================================================

/*
Available roles:
  - platform_admin  : Full access to all tenants (no tenant_id)
  - owner           : Full access to their tenant
  - manager         : Manage tenant operations
  - staff           : Basic staff access
  - promoter        : Promoter-specific features
  - vip_host        : VIP host features
  - customer        : Customer access only
*/

-- ============================================================
-- COMMON SCENARIOS
-- ============================================================

-- Make someone a platform admin (remove their tenant association)
UPDATE profiles
SET role = 'platform_admin',
    tenant_id = NULL
WHERE email = 'admin@example.com';

-- Change staff to manager
UPDATE profiles
SET role = 'manager'
WHERE email = 'staff@example.com'
  AND role = 'staff';

-- Demote owner to manager
UPDATE profiles
SET role = 'manager'
WHERE email = 'owner@example.com'
  AND role = 'owner';

-- Promote manager to owner
UPDATE profiles
SET role = 'owner'
WHERE email = 'manager@example.com'
  AND role = 'manager';

-- ============================================================
-- BULK UPDATES
-- ============================================================

-- Change all staff in a specific tenant to managers
UPDATE profiles
SET role = 'manager'
WHERE tenant_id = 'tenant-uuid-here'
  AND role = 'staff';

-- Find users by tenant name
SELECT p.id, p.email, p.role
FROM profiles p
JOIN tenants t ON p.tenant_id = t.id
WHERE t.name = 'Da Oceanz';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Count users by role
SELECT 
  role,
  COUNT(*) as count
FROM profiles
GROUP BY role
ORDER BY count DESC;

-- Find all platform admins
SELECT id, email, role, created_at
FROM profiles
WHERE role = 'platform_admin';

-- Find users without a tenant (should only be platform_admin)
SELECT id, email, role, tenant_id
FROM profiles
WHERE tenant_id IS NULL;

-- ============================================================
-- EXAMPLES
-- ============================================================

-- Example 1: Make john@example.com a platform admin
-- UPDATE profiles SET role = 'platform_admin', tenant_id = NULL WHERE email = 'john@example.com';

-- Example 2: Change sarah@bar.com to owner
-- UPDATE profiles SET role = 'owner' WHERE email = 'sarah@bar.com';

-- Example 3: View all users in "Da Oceanz" tenant
-- SELECT p.* FROM profiles p JOIN tenants t ON p.tenant_id = t.id WHERE t.name = 'Da Oceanz';
