-- Migration: Fix transactions foreign keys to reference profiles
-- Date: 2026-03-13
-- Description: Update transactions table foreign keys to reference profiles table instead of auth.users
--              This enables PostgREST to automatically join transactions with profiles

-- Drop existing foreign key constraints on transactions
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_user_id_fkey,
DROP CONSTRAINT IF EXISTS transactions_confirmed_by_fkey;

-- Add new foreign keys referencing profiles (which already references auth.users)
-- This creates a direct relationship between transactions and profiles
ALTER TABLE transactions
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE transactions
ADD CONSTRAINT transactions_confirmed_by_fkey 
FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Also update tasks table if it exists
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;

ALTER TABLE tasks
ADD CONSTRAINT tasks_assigned_to_fkey 
FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
