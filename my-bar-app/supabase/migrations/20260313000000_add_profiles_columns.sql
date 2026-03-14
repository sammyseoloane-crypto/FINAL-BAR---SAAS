-- Migration: Add missing columns to profiles table
-- Date: 2026-03-13
-- Description: Add full_name and phone columns to profiles table

-- Add full_name column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Create index on full_name for faster searches
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
