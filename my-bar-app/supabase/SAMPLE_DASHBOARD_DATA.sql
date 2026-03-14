-- ============================================================
-- CLUB DASHBOARD SAMPLE DATA
-- ============================================================
-- IMPORTANT: Replace '252c1a12-8422-4e60-ba7f-5b595148335e' with your actual tenant_id
-- Get your tenant_id by running: SELECT id, name FROM tenants LIMIT 1;
-- ============================================================

-- ============================================================
-- FIX: Update notification trigger to handle NULL user_id
-- ============================================================
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

-- ============================================================
-- SAMPLE DRINKS SOLD
-- ============================================================
INSERT INTO drinks_sold (tenant_id, drink_name, category, quantity, unit_price, total_price, timestamp, shift_date)
VALUES 
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Mojito', 'cocktails', 5, 120.00, 600.00, NOW() - INTERVAL '2 hours', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Beer', 'beer', 10, 45.00, 450.00, NOW() - INTERVAL '2 hours', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Whiskey', 'spirits', 3, 150.00, 450.00, NOW() - INTERVAL '1 hour', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Margarita', 'cocktails', 7, 110.00, 770.00, NOW() - INTERVAL '1 hour', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Wine', 'wine', 4, 80.00, 320.00, NOW(), CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Vodka Tonic', 'cocktails', 6, 95.00, 570.00, NOW(), CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Tequila Shot', 'spirits', 8, 60.00, 480.00, NOW(), CURRENT_DATE);

-- ============================================================
-- SAMPLE TRANSACTIONS
-- ============================================================
INSERT INTO transactions (tenant_id, amount, status, created_at)
VALUES 
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 1500.00, 'confirmed', NOW() - INTERVAL '3 hours'),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 750.00, 'confirmed', NOW() - INTERVAL '2 hours'),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 2200.00, 'confirmed', NOW() - INTERVAL '1 hour'),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 890.00, 'confirmed', NOW() - INTERVAL '30 minutes'),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 1650.00, 'confirmed', NOW());

-- ============================================================
-- SAMPLE GUEST LISTS & ENTRIES
-- ============================================================
-- First create a guest list, then add entries to it

-- Create a guest list for tonight
INSERT INTO guest_lists (tenant_id, list_name, list_type, event_date, max_guests, status, description)
VALUES 
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Friday Night VIP List', 'vip', CURRENT_DATE, 50, 'active', 'VIP guests for Friday night party')
ON CONFLICT DO NOTHING
RETURNING id;

-- Get the guest list ID for reference
DO $$
DECLARE
  v_guest_list_id UUID;
BEGIN
  -- Get or create the guest list
  SELECT id INTO v_guest_list_id 
  FROM guest_lists 
  WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e' 
    AND list_name = 'Friday Night VIP List'
  LIMIT 1;

  -- If no guest list exists, create one
  IF v_guest_list_id IS NULL THEN
    INSERT INTO guest_lists (tenant_id, list_name, list_type, event_date, max_guests, status)
    VALUES ('252c1a12-8422-4e60-ba7f-5b595148335e', 'Friday Night VIP List', 'vip', CURRENT_DATE, 50, 'active')
    RETURNING id INTO v_guest_list_id;
  END IF;

  -- Now insert guest list entries
  INSERT INTO guest_list_entries (tenant_id, guest_list_id, guest_name, guest_email, checked_in, checked_in_at, status, created_at)
  VALUES 
    ('252c1a12-8422-4e60-ba7f-5b595148335e', v_guest_list_id, 'John Smith', 'john@example.com', TRUE, NOW() - INTERVAL '3 hours', 'checked_in', NOW() - INTERVAL '1 day'),
    ('252c1a12-8422-4e60-ba7f-5b595148335e', v_guest_list_id, 'Sarah Johnson', 'sarah@example.com', TRUE, NOW() - INTERVAL '2 hours', 'checked_in', NOW() - INTERVAL '1 day'),
    ('252c1a12-8422-4e60-ba7f-5b595148335e', v_guest_list_id, 'Mike Brown', 'mike@example.com', TRUE, NOW() - INTERVAL '2 hours', 'checked_in', NOW() - INTERVAL '1 day'),
    ('252c1a12-8422-4e60-ba7f-5b595148335e', v_guest_list_id, 'Emma Davis', 'emma@example.com', TRUE, NOW() - INTERVAL '1 hour', 'checked_in', NOW() - INTERVAL '1 day'),
    ('252c1a12-8422-4e60-ba7f-5b595148335e', v_guest_list_id, 'David Wilson', 'david@example.com', TRUE, NOW() - INTERVAL '1 hour', 'checked_in', NOW() - INTERVAL '1 day'),
    ('252c1a12-8422-4e60-ba7f-5b595148335e', v_guest_list_id, 'Lisa Anderson', 'lisa@example.com', TRUE, NOW(), 'checked_in', NOW() - INTERVAL '2 days')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- SAMPLE STAFF SALES (OPTIONAL - Skipped for now)
-- ============================================================
-- NOTE: Uncomment this section if you have actual staff user IDs
-- To get staff IDs, run: SELECT id, email FROM auth.users LIMIT 5;
-- Then replace the UUIDs below with real user IDs

-- INSERT INTO staff_sales (tenant_id, staff_id, total_sales, drinks_sold, tables_served, shift_date)
-- VALUES 
--   ('252c1a12-8422-4e60-ba7f-5b595148335e', 'YOUR-STAFF-UUID-1', 2500.00, 25, 5, CURRENT_DATE),
--   ('252c1a12-8422-4e60-ba7f-5b595148335e', 'YOUR-STAFF-UUID-2', 1800.00, 18, 3, CURRENT_DATE),
--   ('252c1a12-8422-4e60-ba7f-5b595148335e', 'YOUR-STAFF-UUID-3', 1200.00, 12, 2, CURRENT_DATE)
-- ON CONFLICT (staff_id, shift_date, event_id) 
-- DO UPDATE SET
--   total_sales = staff_sales.total_sales + EXCLUDED.total_sales,
--   drinks_sold = staff_sales.drinks_sold + EXCLUDED.drinks_sold;

-- ============================================================
-- SAMPLE CROWD TRACKING
-- ============================================================
INSERT INTO crowd_tracking (tenant_id, current_capacity, max_capacity, entries_count, exits_count, timestamp, recorded_date)
VALUES 
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 50, 500, 50, 0, NOW() - INTERVAL '4 hours', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 120, 500, 120, 0, NOW() - INTERVAL '3 hours', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 200, 500, 200, 0, NOW() - INTERVAL '2 hours', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 280, 500, 300, 20, NOW() - INTERVAL '1 hour', CURRENT_DATE),
  ('252c1a12-8422-4e60-ba7f-5b595148335e', 350, 500, 380, 30, NOW(), CURRENT_DATE);

-- ============================================================
-- VERIFY DATA WAS INSERTED
-- ============================================================
SELECT 'Drinks Sold:' as table_name, COUNT(*)::TEXT as record_count FROM drinks_sold WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e'
UNION ALL
SELECT 'Transactions:', COUNT(*)::TEXT FROM transactions WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e' AND DATE(created_at) = CURRENT_DATE
UNION ALL
SELECT 'Guest Lists:', COUNT(*)::TEXT FROM guest_lists WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e'
UNION ALL
SELECT 'Guest Entries:', COUNT(*)::TEXT FROM guest_list_entries WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e' AND checked_in = TRUE
UNION ALL
SELECT 'Crowd Tracking:', COUNT(*)::TEXT FROM crowd_tracking WHERE tenant_id = '252c1a12-8422-4e60-ba7f-5b595148335e';
