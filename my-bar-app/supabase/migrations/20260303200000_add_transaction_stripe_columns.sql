-- Migration: Add Stripe-related columns to transactions table
-- Date: 2026-03-03
-- Description: Add columns needed for Stripe checkout integration

-- Add Stripe session and payment intent tracking
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_intent VARCHAR(255),
ADD COLUMN IF NOT EXISTS type VARCHAR(50) CHECK (type IN ('product_purchase', 'event_entry', 'subscription')),
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session ON transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent ON transactions(stripe_payment_intent);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
