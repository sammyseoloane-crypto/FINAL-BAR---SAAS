-- ============================================================
-- VIP TABLE GRACE PERIOD & AUTOMATIC NO-SHOW HANDLING
-- Migration: 20260315000004_vip_table_grace_period_no_show.sql
-- Date: 2026-03-15
-- Description: Implement grace period for late arrivals and automatic no-show marking
-- ============================================================

-- ============================================================
-- STEP 1: Add grace period column to table_reservations
-- ============================================================

ALTER TABLE table_reservations
ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 30;

COMMENT ON COLUMN table_reservations.grace_period_minutes IS 
'Grace period in minutes after reservation_datetime before marking as no-show (default: 30)';

-- ============================================================
-- STEP 2: Add grace_period_end_datetime for easy querying
-- ============================================================

ALTER TABLE table_reservations
ADD COLUMN IF NOT EXISTS grace_period_end_datetime TIMESTAMP WITH TIME ZONE;

-- Populate existing records
UPDATE table_reservations
SET grace_period_end_datetime = reservation_datetime + (COALESCE(grace_period_minutes, 30) || ' minutes')::INTERVAL
WHERE grace_period_end_datetime IS NULL;

CREATE INDEX IF NOT EXISTS idx_table_reservations_grace_period_end 
ON table_reservations(grace_period_end_datetime) 
WHERE status IN ('pending', 'confirmed');

-- ============================================================
-- STEP 3: Create trigger to auto-calculate grace_period_end_datetime
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_grace_period_end()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically calculate grace period end datetime
  IF NEW.reservation_datetime IS NOT NULL THEN
    NEW.grace_period_end_datetime := NEW.reservation_datetime + 
      (COALESCE(NEW.grace_period_minutes, 30) || ' minutes')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_calculate_grace_period_end ON table_reservations;

CREATE TRIGGER trigger_calculate_grace_period_end
  BEFORE INSERT OR UPDATE OF reservation_datetime, grace_period_minutes
  ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_grace_period_end();

COMMENT ON FUNCTION calculate_grace_period_end IS 
'Automatically calculates grace_period_end_datetime when reservation time or grace period changes';

-- ============================================================
-- STEP 4: Function to check and mark no-shows
-- ============================================================

CREATE OR REPLACE FUNCTION check_and_mark_no_shows()
RETURNS TABLE (
  reservation_id UUID,
  table_name TEXT,
  reservation_time TIMESTAMP WITH TIME ZONE,
  grace_ended_at TIMESTAMP WITH TIME ZONE,
  marked_no_show BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Mark reservations as no_show if grace period has passed
  UPDATE table_reservations tr
  SET 
    status = 'no_show',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'auto_marked_no_show', true,
        'marked_no_show_at', NOW(),
        'grace_period_minutes', grace_period_minutes
      )
  WHERE tr.status IN ('pending', 'confirmed')
    AND tr.grace_period_end_datetime IS NOT NULL
    AND tr.grace_period_end_datetime < NOW()
    AND tr.checked_in_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Return details of marked reservations
  RETURN QUERY
  SELECT 
    tr.id as reservation_id,
    t.name as table_name,
    tr.reservation_datetime as reservation_time,
    tr.grace_period_end_datetime as grace_ended_at,
    true as marked_no_show
  FROM table_reservations tr
  JOIN tables t ON tr.table_id = t.id
  WHERE tr.status = 'no_show'
    AND tr.metadata->>'auto_marked_no_show' = 'true'
    AND tr.metadata->>'marked_no_show_at' >= (NOW() - INTERVAL '1 minute')::text
  ORDER BY tr.grace_period_end_datetime DESC;
  
  RAISE NOTICE 'Marked % reservations as no-show', v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_mark_no_shows() TO authenticated;

COMMENT ON FUNCTION check_and_mark_no_shows IS 
'Checks for reservations past their grace period and marks them as no-show';

-- ============================================================
-- STEP 5: Function to get reservations in grace period
-- ============================================================

CREATE OR REPLACE FUNCTION get_reservations_in_grace_period(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  reservation_id UUID,
  table_name TEXT,
  guest_name TEXT,
  reservation_time TIMESTAMP WITH TIME ZONE,
  grace_ends_at TIMESTAMP WITH TIME ZONE,
  minutes_remaining INTEGER,
  status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tr.id as reservation_id,
    t.name as table_name,
    COALESCE(p.full_name, p.email) as guest_name,
    tr.reservation_datetime as reservation_time,
    tr.grace_period_end_datetime as grace_ends_at,
    EXTRACT(EPOCH FROM (tr.grace_period_end_datetime - NOW())) / 60 as minutes_remaining,
    tr.status
  FROM table_reservations tr
  JOIN tables t ON tr.table_id = t.id
  LEFT JOIN profiles p ON tr.user_id = p.id
  WHERE tr.status IN ('pending', 'confirmed')
    AND tr.reservation_datetime <= NOW()
    AND tr.grace_period_end_datetime > NOW()
    AND (p_tenant_id IS NULL OR tr.tenant_id = p_tenant_id)
  ORDER BY tr.grace_period_end_datetime ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_reservations_in_grace_period(UUID) TO authenticated;

COMMENT ON FUNCTION get_reservations_in_grace_period IS 
'Returns all reservations currently in their grace period (between reservation time and grace end)';

-- ============================================================
-- STEP 6: View for active reservations with grace status
-- ============================================================

CREATE OR REPLACE VIEW reservation_status_summary AS
SELECT 
  tr.id,
  tr.tenant_id,
  tr.table_id,
  t.name as table_name,
  tr.user_id,
  COALESCE(p.full_name, p.email) as guest_name,
  tr.reservation_datetime,
  tr.grace_period_end_datetime,
  tr.checked_in_at,
  tr.status,
  CASE 
    WHEN tr.status = 'checked_in' THEN 'active'
    WHEN tr.status IN ('completed', 'cancelled', 'no_show') THEN 'closed'
    WHEN NOW() < tr.reservation_datetime THEN 'upcoming'
    WHEN NOW() >= tr.reservation_datetime AND NOW() < tr.grace_period_end_datetime THEN 'in_grace_period'
    WHEN NOW() >= tr.grace_period_end_datetime AND tr.status IN ('pending', 'confirmed') THEN 'should_be_no_show'
    ELSE 'unknown'
  END as grace_status,
  CASE 
    WHEN NOW() >= tr.reservation_datetime AND NOW() < tr.grace_period_end_datetime 
    THEN EXTRACT(EPOCH FROM (tr.grace_period_end_datetime - NOW())) / 60
    ELSE NULL
  END as minutes_until_no_show,
  tr.deposit_amount,
  tr.deposit_paid,
  tr.minimum_spend,
  tr.actual_spend
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
LEFT JOIN profiles p ON tr.user_id = p.id
WHERE tr.status NOT IN ('cancelled');

GRANT SELECT ON reservation_status_summary TO authenticated;

COMMENT ON VIEW reservation_status_summary IS 
'Comprehensive view of reservation statuses including grace period information';

-- ============================================================
-- STEP 7: Create a scheduled job helper function
-- ============================================================

-- This function should be called periodically (e.g., every 5 minutes via pg_cron or external scheduler)
CREATE OR REPLACE FUNCTION process_reservation_status_updates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_no_show_count INTEGER;
  v_result JSONB;
BEGIN
  -- Mark no-shows
  PERFORM check_and_mark_no_shows();
  
  GET DIAGNOSTICS v_no_show_count = ROW_COUNT;
  
  -- Build result
  v_result := jsonb_build_object(
    'timestamp', NOW(),
    'no_shows_marked', v_no_show_count,
    'success', true
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION process_reservation_status_updates() TO authenticated, service_role;

COMMENT ON FUNCTION process_reservation_status_updates IS 
'Main function to process all reservation status updates - call this periodically (every 5 minutes)';

-- ============================================================
-- STEP 8: Add RLS policy for grace period functions
-- ============================================================

-- Staff can call these functions
CREATE POLICY "Staff can check no-shows" ON table_reservations
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin', 'manager', 'staff', 'vip_host')
    )
  );

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check if columns were added
SELECT 
  column_name, 
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'table_reservations' 
  AND column_name IN ('grace_period_minutes', 'grace_period_end_datetime')
ORDER BY column_name;

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_calculate_grace_period_end';

-- Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_grace_period_end',
    'check_and_mark_no_shows',
    'get_reservations_in_grace_period',
    'process_reservation_status_updates'
  )
ORDER BY routine_name;

-- Check view
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'reservation_status_summary';
