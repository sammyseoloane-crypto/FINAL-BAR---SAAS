-- ============================================================
-- AUTO-UPDATE TABLE STATUS BASED ON RESERVATIONS
-- Migration: 20260315000003_auto_update_table_status.sql
-- Date: 2026-03-15
-- Description: Automatically update table status when reservations are created/updated
-- ============================================================

-- ============================================================
-- STEP 1: Create trigger function to update table status
-- ============================================================

CREATE OR REPLACE FUNCTION auto_update_table_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a new reservation is created or updated to confirmed/checked_in
  IF (TG_OP = 'INSERT' AND NEW.status IN ('pending', 'confirmed', 'checked_in')) OR
     (TG_OP = 'UPDATE' AND NEW.status IN ('confirmed', 'checked_in') AND 
      (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'checked_in'))) THEN
    
    -- Update table status to 'reserved'
    UPDATE tables
    SET 
      status = 'reserved',
      updated_at = NOW()
    WHERE id = NEW.table_id;
    
  -- When reservation is cancelled, completed, or no_show
  ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('cancelled', 'completed', 'no_show') AND
        OLD.status IN ('pending', 'confirmed', 'checked_in') THEN
    
    -- Check if there are other active reservations for this table
    IF NOT EXISTS (
      SELECT 1 FROM table_reservations
      WHERE table_id = NEW.table_id
        AND id != NEW.id
        AND status IN ('pending', 'confirmed', 'checked_in')
        AND reservation_datetime >= NOW() - INTERVAL '2 hours'
    ) THEN
      -- No other active reservations, mark table as available
      UPDATE tables
      SET 
        status = 'available',
        updated_at = NOW()
      WHERE id = NEW.table_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 2: Create the triggers
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auto_update_table_status_insert ON table_reservations;
DROP TRIGGER IF EXISTS trigger_auto_update_table_status_update ON table_reservations;

CREATE TRIGGER trigger_auto_update_table_status_insert
  AFTER INSERT ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_table_status();

CREATE TRIGGER trigger_auto_update_table_status_update
  AFTER UPDATE ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_table_status();

COMMENT ON FUNCTION auto_update_table_status IS 
'Automatically updates table status based on reservation state';

-- ============================================================
-- STEP 3: Add metadata tracking to tables
-- ============================================================

ALTER TABLE tables
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tables_metadata ON tables USING gin(metadata);

-- ============================================================
-- STEP 4: Function to check table availability for specific time
-- ============================================================

CREATE OR REPLACE FUNCTION is_table_available(
  p_table_id UUID,
  p_reservation_datetime TIMESTAMP WITH TIME ZONE,
  p_duration_hours DECIMAL DEFAULT 2.0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available BOOLEAN;
  v_end_datetime TIMESTAMP WITH TIME ZONE;
BEGIN
  v_end_datetime := p_reservation_datetime + (p_duration_hours || ' hours')::INTERVAL;
  
  -- Check if table has any conflicting reservations
  SELECT NOT EXISTS (
    SELECT 1 FROM table_reservations
    WHERE table_id = p_table_id
      AND status IN ('pending', 'confirmed', 'checked_in')
      AND (
        -- New reservation starts during existing reservation
        (p_reservation_datetime >= reservation_datetime AND p_reservation_datetime < end_datetime)
        OR
        -- New reservation ends during existing reservation
        (v_end_datetime > reservation_datetime AND v_end_datetime <= end_datetime)
        OR
        -- New reservation completely encompasses existing reservation
        (p_reservation_datetime <= reservation_datetime AND v_end_datetime >= end_datetime)
      )
  ) INTO v_available;
  
  RETURN v_available;
END;
$$;

GRANT EXECUTE ON FUNCTION is_table_available(UUID, TIMESTAMP WITH TIME ZONE, DECIMAL) TO authenticated;

COMMENT ON FUNCTION is_table_available IS 
'Check if a table is available for booking at a specific date/time';

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_auto_update_table_status%';

-- Check function
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('auto_update_table_status', 'is_table_available');
