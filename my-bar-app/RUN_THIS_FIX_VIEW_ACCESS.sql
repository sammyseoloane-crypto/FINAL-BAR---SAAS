-- ============================================================
-- INSTANT FIX: Link your profile to the enterprise tenant
-- ============================================================

-- This query automatically finds the enterprise tenant and 
-- updates your profile to link to it

UPDATE profiles
SET tenant_id = (
  SELECT id 
  FROM tenants 
  WHERE subscription_tier = 'enterprise'
  LIMIT 1
)
WHERE id = auth.uid();

-- ✅ Done! Now test the view:
SELECT * FROM tenant_subscription_details;

-- You should now see your enterprise tenant details!
