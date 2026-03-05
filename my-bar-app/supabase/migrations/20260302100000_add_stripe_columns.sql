-- Add Stripe payment tracking columns to transactions table
-- Migration: Add Stripe integration support
-- Created: 2026-03-02

-- Add Stripe session and payment intent tracking
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

-- Add index for faster lookups by Stripe session ID
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session 
ON transactions(stripe_session_id);

-- Add index for faster lookups by Stripe payment intent
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent 
ON transactions(stripe_payment_intent);

-- Add comment for documentation
COMMENT ON COLUMN transactions.stripe_session_id IS 'Stripe Checkout Session ID for tracking payments';
COMMENT ON COLUMN transactions.stripe_payment_intent IS 'Stripe Payment Intent ID for refunds and tracking';
