-- Add entrance_fee as a valid product type
-- This migration updates the CHECK constraint on the products table

-- First, let's see what types currently exist (for debugging)
-- Run this separately if needed: SELECT DISTINCT type FROM products;

-- Update any NULL or invalid product types to 'drink' as default
UPDATE products 
SET type = 'drink' 
WHERE type IS NULL OR type NOT IN ('drink', 'food', 'entrance_fee');

-- Drop the existing constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_type_check;

-- Add the new constraint with entrance_fee included
ALTER TABLE products ADD CONSTRAINT products_type_check 
  CHECK (type IN ('drink', 'food', 'entrance_fee'));
