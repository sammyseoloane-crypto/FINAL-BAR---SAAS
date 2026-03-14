-- ================================================
-- FIX: Tenants Page - Column Does Not Exist Error
-- Error: column tenants.status does not exist
-- Date: 2026-03-14
-- ================================================

-- ============================================================
-- PROBLEM
-- ============================================================

-- Error: column tenants.status does not exist
-- The tenants table doesn't have a 'status' column
-- The code was trying to query and update a non-existent column

-- ============================================================
-- TENANTS TABLE STRUCTURE
-- ============================================================

-- Check what columns actually exist in tenants table:
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tenants'
ORDER BY ordinal_position;

-- Actual columns include:
-- - id
-- - name
-- - subscription_status (trial, active, past_due, cancelled, inactive)
-- - subscription_tier (trial, starter, growth, pro, enterprise)
-- - stripe_subscription_id
-- - stripe_customer_id
-- - created_at, updated_at
-- BUT NOT 'status'

-- ============================================================
-- SOLUTION APPLIED
-- ============================================================

-- Frontend Changes (TenantManagementPage.jsx):
-- ✅ Removed 'status' from SELECT query
-- ✅ Changed suspend function to update 'subscription_status' to 'inactive'
-- ✅ Changed activate function to update 'subscription_status' to 'active'
-- ✅ Updated button logic to check subscription_status instead of status
-- ✅ Fixed all ESLint indentation errors

-- ============================================================
-- OPTIONAL: Add status column if you want it
-- ============================================================

-- If you need a separate 'status' column for tenant-level status
-- (different from subscription_status), you can add it:

-- ALTER TABLE tenants 
-- ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'
-- CHECK (status IN ('active', 'suspended', 'pending', 'deleted'));

-- CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- However, this is OPTIONAL and NOT REQUIRED
-- The subscription_status column serves the same purpose

-- ============================================================
-- UNDERSTANDING SUBSCRIPTION_STATUS VALUES
-- ============================================================

SELECT DISTINCT subscription_status, COUNT(*) as count
FROM tenants
GROUP BY subscription_status
ORDER BY count DESC;

-- Possible values:
-- • 'trial' - Free trial period
-- • 'active' - Paying customer, subscription active
-- • 'past_due' - Payment failed, subscription at risk
-- • 'cancelled' - Subscription ended by user
-- • 'inactive' - Suspended by platform admin

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Test the query that the page now uses:
SELECT 
  id,
  name,
  subscription_status,
  subscription_tier,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;

-- This should work without errors ✅

-- ============================================================
-- TESTING SUSPEND/ACTIVATE FUNCTIONS
-- ============================================================

-- Test suspending a tenant (sets subscription_status to 'inactive'):
-- UPDATE tenants 
-- SET subscription_status = 'inactive'
-- WHERE id = 'your-tenant-id-here';

-- Test activating a tenant (sets subscription_status to 'active'):
-- UPDATE tenants 
-- SET subscription_status = 'active'
-- WHERE id = 'your-tenant-id-here';

-- Verify the change:
-- SELECT id, name, subscription_status 
-- FROM tenants 
-- WHERE id = 'your-tenant-id-here';

-- ============================================================
-- SUMMARY
-- ============================================================

-- What was wrong:
-- ❌ Code tried to use tenants.status column that doesn't exist
-- ❌ Attempted to SET status = 'suspended' or 'active'
-- ❌ Checked tenant.status in UI logic

-- What was fixed:
-- ✅ Use subscription_status column instead (which exists)
-- ✅ Set subscription_status to 'inactive' for suspend
-- ✅ Set subscription_status to 'active' for activate
-- ✅ Check subscription_status in UI logic
-- ✅ Show 'Activate' button when status is 'inactive' or 'cancelled'
-- ✅ Show 'Suspend' button for all other statuses

-- No database changes needed - just frontend fixes!
