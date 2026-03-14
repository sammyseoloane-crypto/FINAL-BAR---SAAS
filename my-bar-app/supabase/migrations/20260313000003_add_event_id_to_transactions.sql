-- Migration: Add event_id column to transactions table
-- Date: 2026-03-13
-- Description: Add event_id column to properly track event-related transactions

-- Add event_id column to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- Create index on event_id for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id);

-- Migrate existing event data from metadata to event_id column
-- This updates transactions where metadata contains an event_id
UPDATE transactions
SET event_id = (metadata->>'event_id')::UUID
WHERE type = 'event_entry' 
  AND metadata->>'event_id' IS NOT NULL
  AND event_id IS NULL;
