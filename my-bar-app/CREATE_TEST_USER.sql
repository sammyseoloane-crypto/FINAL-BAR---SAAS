-- CREATE A TEST USER FOR DEVELOPMENT
-- Run this in your Supabase SQL Editor to create a test user

-- Step 1: Check existing tenants
SELECT id, name FROM tenants;

-- Step 2: Create a test tenant (if you don't have one)
INSERT INTO tenants (name, subscription_status, subscription_end)
VALUES ('Test Bar', 'active', NOW() + INTERVAL '30 days')
ON CONFLICT DO NOTHING
RETURNING id, name;

-- Step 3: Create test users (REPLACE the tenant_id with the one from Step 1 or 2)
-- Note: You'll need to set the password through Supabase Dashboard or use a proper signup flow

-- For Owner:
-- Go to: https://supabase.com/dashboard/project/pgzlpwnumdoulxqssxsb/auth/users
-- Click "Add User" → "Create New User"
-- Email: owner@test.com
-- Password: Test123456!
-- Then run this to update their profile:

-- REPLACE 'YOUR_TENANT_ID' with actual tenant ID from Step 1/2
UPDATE profiles 
SET role = 'owner', 
    tenant_id = 'YOUR_TENANT_ID'
WHERE email = 'owner@test.com';

-- For Customer:
-- Create via Dashboard: customer@test.com / Test123456!
-- Then update:
UPDATE profiles 
SET role = 'customer', 
    tenant_id = 'YOUR_TENANT_ID'
WHERE email = 'customer@test.com';

-- For Staff:
-- Create via Dashboard: staff@test.com / Test123456!
-- Then update:
UPDATE profiles 
SET role = 'staff', 
    tenant_id = 'YOUR_TENANT_ID'
WHERE email = 'staff@test.com';
