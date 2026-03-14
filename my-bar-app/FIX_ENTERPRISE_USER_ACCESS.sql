-- ============================================================
-- AUTO-FIX: Link your profile to enterprise tenant
-- Automatically finds enterprise tenant and links your profile
-- ============================================================

-- STEP 1: See what will be updated (preview)
SELECT 
  'Current state' as status,
  auth.uid() as your_user_id,
  p.email,
  p.role,
  p.tenant_id as current_tenant_id,
  t.id as enterprise_tenant_id,
  t.name as enterprise_tenant_name
FROM profiles p
CROSS JOIN LATERAL (
  SELECT id, name 
  FROM tenants 
  WHERE subscription_tier = 'enterprise'
  ORDER BY created_at DESC
  LIMIT 1
) t
WHERE p.id = auth.uid();
-- Review this to make sure it's YOUR enterprise tenant

-- ============================================================
-- STEP 2: Auto-link your profile to enterprise tenant
-- ============================================================

UPDATE profiles
SET tenant_id = (
  SELECT id 
  FROM tenants 
  WHERE subscription_tier = 'enterprise'
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE id = auth.uid()
  AND tenant_id IS NULL;  -- Only update if not already set

-- Alternative if you have multiple enterprise tenants, specify by name:
/*
UPDATE profiles
SET tenant_id = (
  SELECT id 
  FROM tenants 
  WHERE subscription_tier = 'enterprise'
    AND name = 'Your Venue Name Here'  -- Replace with actual name
  LIMIT 1
)
WHERE id = auth.uid();
*/

-- ============================================================
-- STEP 3: Verify the update worked
-- ============================================================

SELECT 
  'After update' as status,
  auth.uid() as your_user_id,
  p.email,
  p.role,
  p.tenant_id,
  t.name as tenant_name,
  t.subscription_tier
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.id = auth.uid();
-- tenant_id should now be populated

-- ============================================================
-- STEP 4: Test the view now
-- ============================================================

SELECT * FROM tenant_subscription_details;
-- Should now show your enterprise tenant!

-- ============================================================
-- If you have multiple enterprise tenants, list them first
-- ============================================================

SELECT 
  id,
  name,
  subscription_tier,
  subscription_status,
  created_at,
  'Use this ID to update profile' as note
FROM tenants
WHERE subscription_tier = 'enterprise'
ORDER BY created_at DESC;

-- Then manually pick the right one:
/*
UPDATE profiles
SET tenant_id = 'copy-the-id-from-above'
WHERE id = auth.uid();
*/
