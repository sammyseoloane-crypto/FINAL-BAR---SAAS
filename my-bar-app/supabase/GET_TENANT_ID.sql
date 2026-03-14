-- ============================================================
-- GET YOUR TENANT ID
-- ============================================================
-- Run this first to find your tenant_id
-- Copy the result and use it in the sample data script below

SELECT 
  id as tenant_id,
  name as tenant_name,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;

-- If you need to find your user's tenant_id specifically:
SELECT 
  p.tenant_id,
  p.email,
  p.role,
  t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE p.id = auth.uid();
