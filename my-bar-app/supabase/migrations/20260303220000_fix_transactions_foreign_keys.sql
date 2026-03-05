-- Migration: Update transactions table to reference auth.users
-- Date: 2026-03-03
-- Description: Fix foreign key constraints to use auth.users instead of custom users table

-- Drop existing foreign key constraints on transactions
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_user_id_fkey,
DROP CONSTRAINT IF EXISTS transactions_confirmed_by_fkey;

-- Add new foreign keys referencing auth.users
ALTER TABLE transactions
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE transactions
ADD CONSTRAINT transactions_confirmed_by_fkey 
FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Also update the assigned_to in tasks table if it exists
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;

ALTER TABLE tasks
ADD CONSTRAINT tasks_assigned_to_fkey 
FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
