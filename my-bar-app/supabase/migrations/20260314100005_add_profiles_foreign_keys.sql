-- Migration: Add foreign key from table_reservations.user_id to profiles
-- Date: 2026-03-14
-- Description: Enable PostgREST to join table_reservations to profiles via user_id

-- Drop the old foreign key constraint to auth.users
ALTER TABLE table_reservations 
DROP CONSTRAINT IF EXISTS table_reservations_user_id_fkey;

-- Add new foreign key to profiles instead
ALTER TABLE table_reservations 
ADD CONSTRAINT table_reservations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Also fix bottle_orders if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bottle_orders') THEN
    ALTER TABLE bottle_orders DROP CONSTRAINT IF EXISTS bottle_orders_user_id_fkey;
    ALTER TABLE bottle_orders ADD CONSTRAINT bottle_orders_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON CONSTRAINT table_reservations_user_id_fkey ON table_reservations 
IS 'Foreign key to profiles enables PostgREST joins via profiles!user_id(...)';
