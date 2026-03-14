-- ============================================================
-- OFFLINE MODE & SYNC INFRASTRUCTURE
-- Support for offline QR scanning and order syncing
-- Created: 2026-03-11
-- ============================================================

-- Create offline_queue table for pending syncs
CREATE TABLE IF NOT EXISTS offline_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'scan_qr', 'confirm_payment', 'create_transaction', etc.
  resource_type VARCHAR(100) NOT NULL,
  resource_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'synced', 'failed', 'conflict'
  sync_attempts INTEGER DEFAULT 0,
  last_sync_attempt TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  device_id VARCHAR(255),
  created_at_device TIMESTAMP WITH TIME ZONE NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_offline_queue_tenant_id ON offline_queue(tenant_id);
CREATE INDEX idx_offline_queue_user_id ON offline_queue(user_id);
CREATE INDEX idx_offline_queue_status ON offline_queue(status);
CREATE INDEX idx_offline_queue_created_at ON offline_queue(created_at DESC);

-- Create device_sync_status table
CREATE TABLE IF NOT EXISTS device_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  device_type VARCHAR(100), -- 'mobile', 'tablet', 'desktop'
  last_sync TIMESTAMP WITH TIME ZONE,
  pending_items INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT false,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, device_id)
);

CREATE INDEX idx_device_sync_user_id ON device_sync_status(user_id);
CREATE INDEX idx_device_sync_device_id ON device_sync_status(device_id);
CREATE INDEX idx_device_sync_is_online ON device_sync_status(is_online);

-- Enable RLS
ALTER TABLE offline_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offline_queue
CREATE POLICY "Users can view their own offline queue"
  ON offline_queue FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert to their offline queue"
  ON offline_queue FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their offline queue"
  ON offline_queue FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view tenant offline queue"
  ON offline_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = offline_queue.tenant_id
    )
  );

-- RLS Policies for device_sync_status
CREATE POLICY "Users can view their own devices"
  ON device_sync_status FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own devices"
  ON device_sync_status FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- OFFLINE MODE HELPER FUNCTIONS
-- ============================================================

-- Function to queue offline action
CREATE OR REPLACE FUNCTION queue_offline_action(
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_data JSONB,
  p_device_id VARCHAR,
  p_created_at_device TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = v_user_id;

  -- Insert into offline queue
  INSERT INTO offline_queue (
    tenant_id,
    user_id,
    action,
    resource_type,
    resource_data,
    device_id,
    created_at_device,
    status
  ) VALUES (
    v_tenant_id,
    v_user_id,
    p_action,
    p_resource_type,
    p_resource_data,
    p_device_id,
    p_created_at_device,
    'pending'
  ) RETURNING id INTO v_queue_id;

  -- Update device sync status
  UPDATE device_sync_status
  SET pending_items = pending_items + 1,
      updated_at = NOW()
  WHERE user_id = v_user_id AND device_id = p_device_id;

  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process offline queue item
CREATE OR REPLACE FUNCTION process_offline_queue_item(p_queue_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_item offline_queue;
  v_result JSONB;
  v_transaction_id UUID;
BEGIN
  -- Get queue item
  SELECT * INTO v_item FROM offline_queue WHERE id = p_queue_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
  END IF;

  -- Process based on action type
  CASE v_item.action
    WHEN 'scan_qr' THEN
      -- Process QR scan
      -- Update QR code as scanned
      UPDATE qr_codes
      SET scanned_at = v_item.created_at_device
      WHERE code = (v_item.resource_data->>'qr_code');

      v_result := jsonb_build_object('success', true, 'action', 'scan_qr');

    WHEN 'confirm_payment' THEN
      -- Process payment confirmation
      UPDATE transactions
      SET 
        status = 'confirmed',
        confirmed_by = v_item.user_id,
        confirmed_at = v_item.created_at_device
      WHERE id = (v_item.resource_data->>'transaction_id')::UUID;

      v_result := jsonb_build_object('success', true, 'action', 'confirm_payment');

    WHEN 'create_transaction' THEN
      -- Create transaction from offline data
      INSERT INTO transactions (
        tenant_id,
        user_id,
        product_id,
        amount,
        status,
        created_at
      ) VALUES (
        v_item.tenant_id,
        (v_item.resource_data->>'user_id')::UUID,
        (v_item.resource_data->>'product_id')::UUID,
        (v_item.resource_data->>'amount')::DECIMAL,
        'confirmed',
        v_item.created_at_device
      ) RETURNING id INTO v_transaction_id;

      v_result := jsonb_build_object(
        'success', true, 
        'action', 'create_transaction',
        'transaction_id', v_transaction_id
      );

    ELSE
      v_result := jsonb_build_object('success', false, 'error', 'Unknown action type');
  END CASE;

  -- Mark as synced
  UPDATE offline_queue
  SET 
    status = 'synced',
    synced_at = NOW(),
    sync_attempts = sync_attempts + 1,
    last_sync_attempt = NOW()
  WHERE id = p_queue_id;

  -- Update device sync status
  UPDATE device_sync_status
  SET 
    pending_items = GREATEST(0, pending_items - 1),
    last_sync = NOW(),
    updated_at = NOW()
  WHERE user_id = v_item.user_id AND device_id = v_item.device_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Mark as failed
    UPDATE offline_queue
    SET 
      status = 'failed',
      sync_attempts = sync_attempts + 1,
      last_sync_attempt = NOW(),
      error_message = SQLERRM
    WHERE id = p_queue_id;

    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync all pending items for a device
CREATE OR REPLACE FUNCTION sync_device_queue(p_device_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_item_count INTEGER;
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_queue_item RECORD;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Get pending items count
  SELECT COUNT(*) INTO v_item_count
  FROM offline_queue
  WHERE user_id = v_user_id 
    AND device_id = p_device_id 
    AND status = 'pending';

  -- Process each pending item
  FOR v_queue_item IN 
    SELECT id FROM offline_queue
    WHERE user_id = v_user_id 
      AND device_id = p_device_id 
      AND status = 'pending'
    ORDER BY created_at_device ASC
  LOOP
    v_result := process_offline_queue_item(v_queue_item.id);
    
    IF (v_result->>'success')::BOOLEAN THEN
      v_success_count := v_success_count + 1;
    ELSE
      v_failed_count := v_failed_count + 1;
    END IF;
  END LOOP;

  -- Update device heartbeat
  UPDATE device_sync_status
  SET 
    last_heartbeat = NOW(),
    is_online = true,
    updated_at = NOW()
  WHERE user_id = v_user_id AND device_id = p_device_id;

  RETURN jsonb_build_object(
    'total', v_item_count,
    'synced', v_success_count,
    'failed', v_failed_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to register device
CREATE OR REPLACE FUNCTION register_device(
  p_device_id VARCHAR,
  p_device_name VARCHAR,
  p_device_type VARCHAR DEFAULT 'mobile'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_device_rec_id UUID;
BEGIN
  v_user_id := auth.uid();

  INSERT INTO device_sync_status (
    user_id,
    device_id,
    device_name,
    device_type,
    last_heartbeat,
    is_online
  ) VALUES (
    v_user_id,
    p_device_id,
    p_device_name,
    p_device_type,
    NOW(),
    true
  )
  ON CONFLICT (user_id, device_id) 
  DO UPDATE SET
    device_name = EXCLUDED.device_name,
    device_type = EXCLUDED.device_type,
    last_heartbeat = NOW(),
    is_online = true,
    updated_at = NOW()
  RETURNING id INTO v_device_rec_id;

  RETURN v_device_rec_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE offline_queue IS 'Queue for offline actions waiting to be synced';
COMMENT ON TABLE device_sync_status IS 'Track device sync status and heartbeat';
COMMENT ON FUNCTION queue_offline_action(VARCHAR, VARCHAR, JSONB, VARCHAR, TIMESTAMP WITH TIME ZONE) IS 'Queue an action for later sync';
COMMENT ON FUNCTION sync_device_queue(VARCHAR) IS 'Sync all pending items for a device';
