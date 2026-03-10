-- ============================================================
-- Enable Realtime for Analytics Dashboard
-- ============================================================
-- This migration enables real-time subscriptions for the transactions table
-- to support live analytics and reporting

-- Enable realtime for transactions table
ALTER TABLE transactions REPLICA IDENTITY FULL;

-- Add transactions to the realtime publication
-- This allows clients to subscribe to INSERT, UPDATE, DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Optional: Enable realtime for products table (for product updates)
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- Optional: Enable realtime for events table (for event updates)
ALTER TABLE events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Add helpful comment
COMMENT ON TABLE transactions IS 'Realtime enabled for live analytics dashboard updates';
