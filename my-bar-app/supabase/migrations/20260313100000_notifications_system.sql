-- ============================================================
-- NOTIFICATIONS SYSTEM
-- Real-time notifications for users across all roles
-- Created: 2026-03-13
-- ============================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- 'payment_confirmed', 'event_reminder', 'low_inventory', 'staff_invited', 'task_assigned', 'qr_scanned'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500), -- Optional link to relevant page
  priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}', -- Additional data like transaction_id, product_id, etc.
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiry for time-sensitive notifications
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_priority ON notifications(priority) WHERE priority IN ('high', 'urgent');

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners and admins can view tenant notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_user_tenant_and_role() AS u
      WHERE u.role IN ('owner', 'admin') AND u.tenant_id = notifications.tenant_id
    )
  );

-- ============================================================
-- NOTIFICATION HELPER FUNCTIONS
-- ============================================================

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_action_url VARCHAR DEFAULT NULL,
  p_priority VARCHAR DEFAULT 'normal',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get tenant_id for the user
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = p_user_id;

  -- Insert notification
  INSERT INTO notifications (
    tenant_id,
    user_id,
    type,
    title,
    message,
    action_url,
    priority,
    metadata
  ) VALUES (
    v_tenant_id,
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_action_url,
    p_priority,
    p_metadata
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = TIMEZONE('utc', NOW())
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all user notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = TIMEZONE('utc', NOW())
  WHERE user_id = auth.uid()
    AND read = FALSE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = auth.uid()
    AND read = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- AUTOMATIC NOTIFICATION TRIGGERS
-- ============================================================

-- Trigger: Notify customer when payment is confirmed
CREATE OR REPLACE FUNCTION notify_payment_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when status changes to confirmed AND user_id exists
  IF NEW.status = 'confirmed' 
     AND (OLD.status IS NULL OR OLD.status != 'confirmed')
     AND NEW.user_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.user_id,
      'payment_confirmed',
      'Payment Confirmed',
      'Your payment of R' || NEW.amount || ' has been confirmed.',
      '/customer/qr-codes',
      'high',
      jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_payment_confirmed
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION notify_payment_confirmed();

-- Trigger: Notify staff when task is assigned
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify when a task is newly assigned
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      'task_assigned',
      'New Task Assigned',
      'You have been assigned: ' || NEW.title,
      '/staff/tasks',
      CASE WHEN NEW.priority = 'urgent' THEN 'urgent' ELSE 'normal' END,
      jsonb_build_object('task_id', NEW.id, 'priority', NEW.priority)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_task_assigned
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- Trigger: Notify when QR code is scanned
CREATE OR REPLACE FUNCTION notify_qr_scanned()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify when QR code is scanned
  IF NEW.scanned_at IS NOT NULL AND (OLD.scanned_at IS NULL OR OLD.scanned_at != NEW.scanned_at) THEN
    PERFORM create_notification(
      NEW.user_id,
      'qr_scanned',
      'QR Code Validated',
      'Your QR code has been scanned and validated.',
      '/customer/orders',
      'normal',
      jsonb_build_object('qr_code_id', NEW.id, 'transaction_id', NEW.transaction_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_qr_scanned
  AFTER UPDATE ON qr_codes
  FOR EACH ROW EXECUTE FUNCTION notify_qr_scanned();

COMMENT ON TABLE notifications IS 'Real-time notifications for users';
COMMENT ON COLUMN notifications.type IS 'Notification type: payment_confirmed, event_reminder, low_inventory, staff_invited, task_assigned, qr_scanned';
