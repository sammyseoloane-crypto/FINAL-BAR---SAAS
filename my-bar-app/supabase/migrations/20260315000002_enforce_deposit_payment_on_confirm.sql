-- ============================================================
-- ENFORCE DEPOSIT PAYMENT BEFORE CONFIRMATION
-- Migration: 20260315000002_enforce_deposit_payment_on_confirm.sql
-- Date: 2026-03-15
-- Description: Ensure deposit is paid before reservation can be confirmed
-- ============================================================

-- ============================================================
-- STEP 1: Create trigger function to validate deposit payment
-- ============================================================

CREATE OR REPLACE FUNCTION validate_deposit_before_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only run this check when status is changing TO 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- If there's a deposit amount, ensure it's been paid
    IF NEW.deposit_amount > 0 AND (NEW.deposit_paid IS NULL OR NEW.deposit_paid = FALSE) THEN
      RAISE EXCEPTION 'Cannot confirm reservation: Deposit of % must be paid first', 
        NEW.deposit_amount;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 2: Create the trigger
-- ============================================================

DROP TRIGGER IF EXISTS trigger_validate_deposit_before_confirm ON table_reservations;

CREATE TRIGGER trigger_validate_deposit_before_confirm
  BEFORE UPDATE ON table_reservations
  FOR EACH ROW
  EXECUTE FUNCTION validate_deposit_before_confirm();

COMMENT ON FUNCTION validate_deposit_before_confirm IS 
'Validates that deposit is paid before allowing reservation confirmation';

-- ============================================================
-- STEP 3: Create function to mark deposit as paid
-- ============================================================

CREATE OR REPLACE FUNCTION mark_deposit_paid(
  p_reservation_id UUID,
  p_marked_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_deposit_amount DECIMAL(10, 2);
BEGIN
  -- Get reservation details
  SELECT tenant_id, deposit_amount
  INTO v_tenant_id, v_deposit_amount
  FROM table_reservations
  WHERE id = p_reservation_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  
  -- Verify user has permission (same tenant, staff role)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_marked_by
      AND tenant_id = v_tenant_id
      AND role IN ('owner', 'admin', 'manager', 'staff', 'vip_host')
  ) THEN
    RAISE EXCEPTION 'User does not have permission to mark deposit as paid';
  END IF;
  
  -- Update deposit status
  UPDATE table_reservations
  SET 
    deposit_paid = TRUE,
    deposit_paid_at = NOW(),
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'deposit_marked_paid_by', p_marked_by,
        'deposit_marked_paid_at', NOW()
      )
  WHERE id = p_reservation_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_deposit_paid(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION mark_deposit_paid IS 
'Mark a reservation deposit as paid (staff/VIP host only)';

-- ============================================================
-- STEP 4: Create function to confirm reservation with deposit check
-- ============================================================

CREATE OR REPLACE FUNCTION confirm_reservation_with_deposit(
  p_reservation_id UUID,
  p_confirmed_by UUID,
  p_mark_deposit_paid BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_deposit_amount DECIMAL(10, 2);
  v_deposit_paid BOOLEAN;
  v_result JSONB;
BEGIN
  -- Get reservation details
  SELECT tenant_id, deposit_amount, deposit_paid
  INTO v_tenant_id, v_deposit_amount, v_deposit_paid
  FROM table_reservations
  WHERE id = p_reservation_id;
  
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reservation not found'
    );
  END IF;
  
  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_confirmed_by
      AND tenant_id = v_tenant_id
      AND role IN ('owner', 'admin', 'manager', 'staff', 'vip_host')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User does not have permission to confirm reservations'
    );
  END IF;
  
  -- If deposit required but not paid, and not marking as paid now
  IF v_deposit_amount > 0 AND NOT COALESCE(v_deposit_paid, FALSE) AND NOT p_mark_deposit_paid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Deposit payment required',
      'deposit_required', true,
      'deposit_amount', v_deposit_amount
    );
  END IF;
  
  -- Mark deposit as paid if requested
  IF p_mark_deposit_paid AND v_deposit_amount > 0 THEN
    UPDATE table_reservations
    SET 
      deposit_paid = TRUE,
      deposit_paid_at = NOW()
    WHERE id = p_reservation_id;
  END IF;
  
  -- Confirm the reservation
  UPDATE table_reservations
  SET 
    status = 'confirmed',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'confirmed_by', p_confirmed_by,
        'confirmed_at', NOW()
      )
  WHERE id = p_reservation_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Reservation confirmed successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_reservation_with_deposit(UUID, UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION confirm_reservation_with_deposit IS 
'Confirm a reservation with deposit validation and optional payment marking';

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check triggers
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_validate_deposit_before_confirm';

-- Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'validate_deposit_before_confirm',
    'mark_deposit_paid',
    'confirm_reservation_with_deposit'
  );
