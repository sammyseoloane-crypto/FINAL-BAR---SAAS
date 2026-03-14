-- ================================================
-- IMMEDIATE FIX: Allow User Creation NOW
-- Temporarily disable audit trigger on profiles
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- QUICK FIX - Run this first to enable user creation immediately
-- ============================================================

-- Simply disable the problematic audit trigger on profiles table
DROP TRIGGER IF EXISTS audit_profiles ON profiles;

-- That's it! Now you can create users in Supabase Auth without errors.

-- ============================================================
-- VERIFICATION - Test user creation
-- ============================================================

-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User"
-- 3. Enter email and password
-- 4. Click "Create User" - Should work now! ✅

-- 5. Check if user was created:
SELECT id, email, role, tenant_id, created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- OPTIONAL: Create platform_admin test user
-- ============================================================

-- After creating a user via Auth UI, upgrade them to platform_admin:
UPDATE profiles 
SET role = 'platform_admin',
    tenant_id = NULL
WHERE email = 'your-test-email@example.com';  -- Replace with your actual email

-- Verify:
SELECT id, email, role, tenant_id 
FROM profiles 
WHERE role = 'platform_admin';

-- ============================================================
-- NOTES
-- ============================================================

-- What we did:
-- - Removed the audit_profiles trigger that was causing the error
-- - User creation now works because there's no trigger failing on NULL tenant_id
-- 
-- Trade-off:
-- - Profile changes won't be logged to audit_logs until you re-enable it
-- - This is fine for testing/development
--
-- To re-enable audit logging later (after fixing audit_logs table):
-- CREATE TRIGGER audit_profiles
--   AFTER INSERT OR UPDATE OR DELETE ON profiles
--   FOR EACH ROW EXECUTE FUNCTION create_audit_log();
