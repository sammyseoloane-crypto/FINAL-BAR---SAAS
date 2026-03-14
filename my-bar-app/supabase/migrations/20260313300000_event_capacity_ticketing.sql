-- ============================================================
-- EVENT CAPACITY & TICKETING SYSTEM
-- Prevent overselling and manage event tickets
-- Created: 2026-03-13
-- ============================================================

-- Add capacity columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER CHECK (capacity > 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS tickets_sold INTEGER DEFAULT 0 CHECK (tickets_sold >= 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS vip_capacity INTEGER CHECK (vip_capacity >= 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS vip_tickets_sold INTEGER DEFAULT 0 CHECK (vip_tickets_sold >= 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS early_bird_price DECIMAL(10, 2) CHECK (early_bird_price >= 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS vip_price DECIMAL(10, 2) CHECK (vip_price >= 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS early_bird_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_waitlist BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS waitlist_count INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sold_out BOOLEAN GENERATED ALWAYS AS (
  capacity IS NOT NULL AND tickets_sold >= capacity
) STORED;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_capacity ON events(capacity, tickets_sold);
CREATE INDEX IF NOT EXISTS idx_events_sold_out ON events(sold_out) WHERE sold_out = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_date_active ON events(date, active) WHERE active = TRUE;

-- Create event_tickets table for detailed ticket tracking
CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_type VARCHAR(50) DEFAULT 'general' CHECK (ticket_type IN ('general', 'vip', 'early_bird', 'complimentary')),
  ticket_number VARCHAR(100) UNIQUE NOT NULL,
  price_paid DECIMAL(10, 2) NOT NULL CHECK (price_paid >= 0),
  status VARCHAR(50) DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled', 'refunded', 'transferred')),
  qr_code_id UUID REFERENCES qr_codes(id),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES auth.users(id), -- Staff member who scanned
  transferred_to UUID REFERENCES auth.users(id),
  transferred_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_event_tickets_tenant_id ON event_tickets(tenant_id);
CREATE INDEX idx_event_tickets_event_id ON event_tickets(event_id);
CREATE INDEX idx_event_tickets_user_id ON event_tickets(user_id);
CREATE INDEX idx_event_tickets_transaction_id ON event_tickets(transaction_id);
CREATE INDEX idx_event_tickets_status ON event_tickets(status);
CREATE INDEX idx_event_tickets_ticket_number ON event_tickets(ticket_number);

-- Create event waitlist table
CREATE TABLE IF NOT EXISTS event_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER, -- Position in waitlist
  notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  ticket_offered_at TIMESTAMP WITH TIME ZONE,
  offer_expires_at TIMESTAMP WITH TIME ZONE,
  converted_to_ticket BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_waitlist_event_id ON event_waitlist(event_id);
CREATE INDEX idx_event_waitlist_user_id ON event_waitlist(user_id);
CREATE INDEX idx_event_waitlist_position ON event_waitlist(event_id, position);

-- Enable RLS
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_tickets
CREATE POLICY "Users can view their own tickets"
  ON event_tickets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view tenant event tickets"
  ON event_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin', 'staff') AND u.tenant_id = event_tickets.tenant_id
    )
  );

CREATE POLICY "System can create tickets"
  ON event_tickets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own tickets"
  ON event_tickets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update event tickets"
  ON event_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin', 'staff') AND u.tenant_id = event_tickets.tenant_id
    )
  );

-- RLS Policies for event_waitlist
CREATE POLICY "Users can view their own waitlist entries"
  ON event_waitlist FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view event waitlists"
  ON event_waitlist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin', 'staff') AND u.tenant_id = event_waitlist.tenant_id
    )
  );

CREATE POLICY "Users can join waitlist"
  ON event_waitlist FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage waitlist"
  ON event_waitlist FOR ALL
  USING (true);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to check event capacity before purchase
CREATE OR REPLACE FUNCTION check_event_capacity(
  p_event_id UUID,
  p_ticket_type VARCHAR,
  p_quantity INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_capacity INTEGER;
  v_tickets_sold INTEGER;
  v_vip_capacity INTEGER;
  v_vip_tickets_sold INTEGER;
  v_available BOOLEAN;
BEGIN
  SELECT capacity, tickets_sold, vip_capacity, vip_tickets_sold
  INTO v_capacity, v_tickets_sold, v_vip_capacity, v_vip_tickets_sold
  FROM events
  WHERE id = p_event_id;
  
  IF p_ticket_type IN ('vip') THEN
    -- Check VIP capacity
    IF v_vip_capacity IS NULL THEN
      RETURN FALSE;
    END IF;
    v_available := (v_vip_tickets_sold + p_quantity) <= v_vip_capacity;
  ELSE
    -- Check general capacity
    IF v_capacity IS NULL THEN
      RETURN TRUE; -- No capacity limit
    END IF;
    v_available := (v_tickets_sold + p_quantity) <= v_capacity;
  END IF;
  
  RETURN v_available;
END;
$$ LANGUAGE plpgsql;

-- Function to increment tickets sold
CREATE OR REPLACE FUNCTION increment_event_tickets()
RETURNS TRIGGER AS $$
DECLARE
  v_event_id UUID;
  v_ticket_type VARCHAR;
  v_quantity INTEGER := 1;
BEGIN
  -- Only process confirmed event transactions
  IF NEW.status = 'confirmed' AND NEW.type = 'event_entry' AND NEW.event_id IS NOT NULL THEN
    v_event_id := NEW.event_id;
    
    -- Get ticket type from metadata
    v_ticket_type := COALESCE(NEW.metadata->>'ticket_type', 'general');
    
    -- Get quantity from metadata
    IF NEW.metadata ? 'quantity' THEN
      v_quantity := (NEW.metadata->>'quantity')::INTEGER;
    END IF;
    
    -- Update event tickets sold
    IF v_ticket_type = 'vip' THEN
      UPDATE events
      SET vip_tickets_sold = COALESCE(vip_tickets_sold, 0) + v_quantity,
          updated_at = NOW()
      WHERE id = v_event_id;
    ELSE
      UPDATE events
      SET tickets_sold = COALESCE(tickets_sold, 0) + v_quantity,
          updated_at = NOW()
      WHERE id = v_event_id;
    END IF;
    
    -- Create event ticket record
    INSERT INTO event_tickets (
      tenant_id,
      event_id,
      transaction_id,
      user_id,
      ticket_type,
      ticket_number,
      price_paid,
      status
    ) VALUES (
      NEW.tenant_id,
      v_event_id,
      NEW.id,
      NEW.user_id,
      v_ticket_type,
      'TKT-' || UPPER(SUBSTRING(NEW.id::TEXT FROM 1 FOR 8)),
      NEW.amount,
      'valid'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment tickets sold
DROP TRIGGER IF EXISTS trigger_increment_event_tickets ON transactions;
CREATE TRIGGER trigger_increment_event_tickets
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION increment_event_tickets();

-- Function to add to waitlist
CREATE OR REPLACE FUNCTION add_to_event_waitlist(
  p_event_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_tenant_id UUID;
  v_position INTEGER;
BEGIN
  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM events
  WHERE id = p_event_id;
  
  -- Get next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
  FROM event_waitlist
  WHERE event_id = p_event_id;
  
  -- Insert waitlist entry
  INSERT INTO event_waitlist (
    tenant_id,
    event_id,
    user_id,
    position
  ) VALUES (
    v_tenant_id,
    p_event_id,
    p_user_id,
    v_position
  );
  
  -- Update waitlist count
  UPDATE events
  SET waitlist_count = COALESCE(waitlist_count, 0) + 1
  WHERE id = p_event_id;
  
  RETURN v_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process waitlist when ticket is cancelled
CREATE OR REPLACE FUNCTION process_event_waitlist()
RETURNS TRIGGER AS $$
DECLARE
  v_event_id UUID;
  v_next_user RECORD;
BEGIN
  -- When a ticket is cancelled, offer it to next person on waitlist
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    v_event_id := NEW.event_id;
    
    -- Get next person on waitlist
    SELECT * INTO v_next_user
    FROM event_waitlist
    WHERE event_id = v_event_id
      AND notified = FALSE
      AND converted_to_ticket = FALSE
    ORDER BY position ASC
    LIMIT 1;
    
    IF v_next_user.id IS NOT NULL THEN
      -- Send notification
      PERFORM create_notification(
        v_next_user.user_id,
        'event_reminder',
        'Event Ticket Available',
        'A ticket is now available for the event you waitlisted for. Offer expires in 24 hours.',
        '/customer/events/' || v_event_id,
        'urgent',
        jsonb_build_object('event_id', v_event_id, 'waitlist_id', v_next_user.id)
      );
      
      -- Update waitlist entry
      UPDATE event_waitlist
      SET 
        notified = TRUE,
        notification_sent_at = NOW(),
        ticket_offered_at = NOW(),
        offer_expires_at = NOW() + INTERVAL '24 hours'
      WHERE id = v_next_user.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process waitlist
DROP TRIGGER IF EXISTS trigger_process_event_waitlist ON event_tickets;
CREATE TRIGGER trigger_process_event_waitlist
  AFTER UPDATE ON event_tickets
  FOR EACH ROW EXECUTE FUNCTION process_event_waitlist();

-- Function to get event availability
CREATE OR REPLACE FUNCTION get_event_availability(p_event_id UUID)
RETURNS TABLE (
  total_capacity INTEGER,
  tickets_sold INTEGER,
  tickets_available INTEGER,
  vip_capacity INTEGER,
  vip_sold INTEGER,
  vip_available INTEGER,
  is_sold_out BOOLEAN,
  waitlist_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.capacity,
    e.tickets_sold,
    CASE 
      WHEN e.capacity IS NULL THEN NULL
      ELSE e.capacity - e.tickets_sold
    END,
    e.vip_capacity,
    e.vip_tickets_sold,
    CASE 
      WHEN e.vip_capacity IS NULL THEN NULL
      ELSE e.vip_capacity - e.vip_tickets_sold
    END,
    e.sold_out,
    e.waitlist_count
  FROM events e
  WHERE e.id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- Update triggers
CREATE TRIGGER update_event_tickets_updated_at BEFORE UPDATE ON event_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE event_tickets IS 'Individual event tickets with QR codes';
COMMENT ON TABLE event_waitlist IS 'Waitlist for sold-out events';
COMMENT ON COLUMN events.capacity IS 'Maximum number of tickets available';
COMMENT ON COLUMN events.tickets_sold IS 'Number of tickets sold (auto-incremented)';
