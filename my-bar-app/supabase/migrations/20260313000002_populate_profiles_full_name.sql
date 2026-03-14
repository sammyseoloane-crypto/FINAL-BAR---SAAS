-- Migration: Populate full_name for existing profiles
-- Date: 2026-03-13
-- Description: Set full_name from email for existing profiles that don't have it

-- Update profiles where full_name is null
-- Extract the part before @ in email as a temporary full_name
UPDATE profiles
SET full_name = INITCAP(SPLIT_PART(email, '@', 1))
WHERE full_name IS NULL OR full_name = '';

-- Alternative: If you want to use the entire email as the name for now
-- UPDATE profiles
-- SET full_name = email
-- WHERE full_name IS NULL OR full_name = '';
