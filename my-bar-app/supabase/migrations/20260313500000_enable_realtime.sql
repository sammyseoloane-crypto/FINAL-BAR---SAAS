-- ============================================================
-- ENABLE REALTIME FOR DASHBOARD UPDATES
-- Real-time subscriptions for owner/staff dashboards
-- Created: 2026-03-13
-- ============================================================

-- Enable realtime on key tables for live dashboard updates
-- Note: Realtime replication must be enabled in Supabase dashboard

-- Function to safely add table to realtime publication
DO $$
DECLARE
  tables_to_add TEXT[] := ARRAY[
    'transactions',
    'qr_codes',
    'inventory',
    'stock_movements',
    'notifications',
    'event_tickets',
    'tasks',
    'analytics_snapshots',
    'hourly_metrics',
    'purchase_orders',
    'event_waitlist',
    'audit_logs'
  ];
  table_name TEXT;
  is_member BOOLEAN;
BEGIN
  FOREACH table_name IN ARRAY tables_to_add
  LOOP
    -- Check if table exists first
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_name
    ) THEN
      -- Check if table is already in publication
      SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = table_name
      ) INTO is_member;
      
      -- Only add if not already a member
      IF NOT is_member THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
        RAISE NOTICE 'Added table % to supabase_realtime publication', table_name;
      ELSE
        RAISE NOTICE 'Table % already in supabase_realtime publication', table_name;
      END IF;
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping', table_name;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- REALTIME HELPER FUNCTIONS
-- ============================================================

-- Function to broadcast custom realtime event
CREATE OR REPLACE FUNCTION broadcast_realtime_event(
  p_event_type VARCHAR,
  p_payload JSONB
)
RETURNS VOID AS $$
BEGIN
  -- This is a placeholder for custom realtime broadcasting
  -- Actual implementation would use pg_notify or Supabase Realtime channels
  PERFORM pg_notify('realtime_events', jsonb_build_object(
    'event_type', p_event_type,
    'payload', p_payload,
    'timestamp', NOW()
  )::TEXT);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to broadcast transaction confirmations
CREATE OR REPLACE FUNCTION broadcast_transaction_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    PERFORM broadcast_realtime_event(
      'transaction_confirmed',
      jsonb_build_object(
        'transaction_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'amount', NEW.amount,
        'user_id', NEW.user_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_broadcast_transaction_confirmed ON transactions;
CREATE TRIGGER trigger_broadcast_transaction_confirmed
  AFTER UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION broadcast_transaction_confirmed();

-- Trigger function to broadcast inventory low stock
CREATE OR REPLACE FUNCTION broadcast_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.minimum_stock AND OLD.current_stock > OLD.minimum_stock THEN
    PERFORM broadcast_realtime_event(
      'low_stock_alert',
      jsonb_build_object(
        'inventory_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'product_id', NEW.product_id,
        'current_stock', NEW.current_stock,
        'minimum_stock', NEW.minimum_stock
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_broadcast_low_stock ON inventory;
CREATE TRIGGER trigger_broadcast_low_stock
  AFTER UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION broadcast_low_stock();

-- Trigger function to broadcast event sold out
CREATE OR REPLACE FUNCTION broadcast_event_sold_out()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sold_out = TRUE AND (OLD.sold_out IS NULL OR OLD.sold_out = FALSE) THEN
    PERFORM broadcast_realtime_event(
      'event_sold_out',
      jsonb_build_object(
        'event_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'event_name', NEW.name,
        'tickets_sold', NEW.tickets_sold,
        'capacity', NEW.capacity
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_broadcast_event_sold_out ON events;
CREATE TRIGGER trigger_broadcast_event_sold_out
  AFTER UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION broadcast_event_sold_out();

COMMENT ON FUNCTION broadcast_realtime_event IS 'Broadcasts custom realtime events to connected clients';
