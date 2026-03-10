-- Check all users in the auth system
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- Check all profiles
SELECT 
  id,
  email,
  role,
  tenant_id,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- Check if profiles match auth users
SELECT 
  au.email AS auth_email,
  au.email_confirmed_at,
  p.email AS profile_email,
  p.role,
  p.tenant_id,
  t.name AS tenant_name
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN tenants t ON p.tenant_id = t.id
ORDER BY au.created_at DESC;
