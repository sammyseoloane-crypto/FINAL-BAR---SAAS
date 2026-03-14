-- Migration: Add missing roles to profiles table
-- Date: 2026-03-14
-- Description: Add platform_admin, manager, promoter, and vip_host roles

-- Drop the existing role constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with all 7 roles
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('platform_admin', 'owner', 'manager', 'staff', 'promoter', 'vip_host', 'customer'));

-- Update existing 'admin' records to 'platform_admin'
UPDATE profiles 
SET role = 'platform_admin' 
WHERE role = 'admin';

-- Create index for new roles for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_extended ON profiles(role) 
WHERE role IN ('manager', 'promoter', 'vip_host');

-- Add helpful comment
COMMENT ON COLUMN profiles.role IS 'User role: platform_admin (SaaS owner), owner (venue owner), manager (venue manager), staff (bartender/cashier), promoter (event promoter), vip_host (table host), customer (end user)';
