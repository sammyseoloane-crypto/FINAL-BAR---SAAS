-- ============================================================
-- FIX: Notification Trigger for Transactions without user_id
-- ============================================================
-- This fixes the error when inserting transactions without user_id

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

-- Success message
SELECT 'Notification trigger fixed! You can now insert transactions without user_id.' as status;
