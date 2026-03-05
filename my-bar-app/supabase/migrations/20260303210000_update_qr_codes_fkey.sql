-- Migration: Update qr_codes to reference auth.users
-- Date: 2026-03-03
-- Description: Update foreign key to use auth.users instead of custom users table

-- Drop existing foreign key constraint
ALTER TABLE qr_codes
DROP CONSTRAINT IF EXISTS qr_codes_user_id_fkey;

-- Add new foreign key referencing auth.users
ALTER TABLE qr_codes
ADD CONSTRAINT qr_codes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
