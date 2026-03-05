-- Migration: Add cart_items table for persistent cart storage
-- Date: 2026-03-03
-- Description: Store cart items in database for persistence across sessions and devices
-- This migration is idempotent and can be run multiple times safely

-- ============================================================
-- CART_ITEMS TABLE
-- ============================================================
DO $$ 
BEGIN
  -- Create table if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cart_items') THEN
    CREATE TABLE cart_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      event_id UUID REFERENCES events(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      
      -- Ensure either product_id OR event_id is set, not both or neither
      CONSTRAINT cart_item_type_check CHECK (
        (product_id IS NOT NULL AND event_id IS NULL) OR 
        (product_id IS NULL AND event_id IS NOT NULL)
      ),
      
      -- Ensure unique product/event per user (prevent duplicate cart items)
      CONSTRAINT unique_user_product UNIQUE (user_id, product_id),
      CONSTRAINT unique_user_event UNIQUE (user_id, event_id)
    );
    
    RAISE NOTICE 'Created cart_items table';
  ELSE
    RAISE NOTICE 'cart_items table already exists, skipping creation';
  END IF;
END $$;

-- Indexes for performance (CREATE INDEX IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_tenant_id ON cart_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_event_id ON cart_items(event_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_created_at ON cart_items(created_at);

-- Enable RLS (safe to run multiple times)
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES FOR cart_items
-- Users can only manage their own cart items
-- ============================================================
DO $$ 
BEGIN
  -- Drop existing policies if they exist, then recreate
  DROP POLICY IF EXISTS "Users can view their own cart items" ON cart_items;
  CREATE POLICY "Users can view their own cart items"
    ON cart_items FOR SELECT
    USING (user_id = auth.uid());

  DROP POLICY IF EXISTS "Users can add items to their own cart" ON cart_items;
  CREATE POLICY "Users can add items to their own cart"
    ON cart_items FOR INSERT
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "Users can update their own cart items" ON cart_items;
  CREATE POLICY "Users can update their own cart items"
    ON cart_items FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "Users can delete their own cart items" ON cart_items;
  CREATE POLICY "Users can delete their own cart items"
    ON cart_items FOR DELETE
    USING (user_id = auth.uid());

  DROP POLICY IF EXISTS "Owners and admins can view tenant cart items" ON cart_items;
  CREATE POLICY "Owners and admins can view tenant cart items"
    ON cart_items FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM get_user_tenant_and_role() AS u
        WHERE u.role IN ('owner', 'admin') AND u.tenant_id = cart_items.tenant_id
      )
    );
    
  RAISE NOTICE 'Created/updated RLS policies for cart_items';
END $$;

-- Update trigger for cart_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_cart_items_updated_at' 
    AND tgrelid = 'cart_items'::regclass
  ) THEN
    CREATE TRIGGER update_cart_items_updated_at 
      BEFORE UPDATE ON cart_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    RAISE NOTICE 'Created trigger update_cart_items_updated_at';
  ELSE
    RAISE NOTICE 'Trigger update_cart_items_updated_at already exists';
  END IF;
END $$;

-- Function to clean up old cart items (optional - for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_cart_items()
RETURNS void AS $$
BEGIN
  -- Delete cart items older than 30 days
  DELETE FROM cart_items
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
