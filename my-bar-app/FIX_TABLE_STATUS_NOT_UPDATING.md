# FIX: Table Not Updating to Reserved After Payment

## Issue Description

When a customer reserves a table and pays via Stripe, the table status should automatically update from `available` to `reserved`. However, the table remains showing as available even after successful payment and reservation creation.

## Root Cause Analysis

The issue is caused by the database trigger `auto_update_table_status` either:
1. Not being applied to the database (migration not run)
2. Not firing due to RLS policies blocking the UPDATE
3. Failing silently due to permissions issues

## Expected Behavior

```
Customer books table → Stripe payment → Reservation created (status='confirmed') 
→ Trigger fires → Table status updates to 'reserved' → UI shows table as reserved
```

## Step-by-Step Fix

### Step 1: Verify Migration Was Applied

Open Supabase SQL Editor and run:

```sql
-- Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'auto_update_table_status';

-- Check if triggers exist
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%auto_update_table_status%';
```

**Expected Results:**
- Function query: Should return 1 row
- Triggers query: Should return 2 rows (INSERT and UPDATE triggers)

**If No Results:** The migration was not applied. Continue to Step 2.

### Step 2: Apply the Migration

Run this migration in Supabase SQL Editor:

**File:** `/supabase/migrations/20260315000003_auto_update_table_status.sql`

Copy and paste the entire file contents into Supabase SQL Editor and execute.

### Step 3: Grant Necessary Permissions

The trigger function uses `SECURITY DEFINER` but may need explicit permissions:

```sql
-- Grant UPDATE permission on tables
GRANT UPDATE ON tables TO authenticated;
GRANT UPDATE ON tables TO service_role;
GRANT UPDATE ON tables TO postgres;
```

### Step 4: Verify RLS Policies Allow Updates

Check if RLS policies are blocking the update:

```sql
-- Check existing policies on tables
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'tables'
ORDER BY policyname;
```

If you see policies that block UPDATE operations, you may need to adjust them or use a different approach.

### Step 5: Test the Trigger Manually

Run this test in Supabase SQL Editor:

```sql
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_table_id UUID;
  v_table_status_before TEXT;
  v_table_status_after TEXT;
BEGIN
  -- Get IDs for testing
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_table_id FROM tables WHERE tenant_id = v_tenant_id AND status = 'available' LIMIT 1;
  
  -- Check status before
  SELECT status INTO v_table_status_before FROM tables WHERE id = v_table_id;
  RAISE NOTICE 'Table status BEFORE: %', v_table_status_before;
  
  -- Create test reservation
  INSERT INTO table_reservations (
    tenant_id, user_id, table_id,
    reservation_datetime, duration_hours, guest_count,
    status, deposit_amount, deposit_paid
  ) VALUES (
    v_tenant_id, v_user_id, v_table_id,
    NOW() + INTERVAL '3 hours', 2.0, 4,
    'confirmed', 500.00, true
  );
  
  -- Check status after
  SELECT status INTO v_table_status_after FROM tables WHERE id = v_table_id;
  RAISE NOTICE 'Table status AFTER: %', v_table_status_after;
  
  -- Clean up
  DELETE FROM table_reservations WHERE table_id = v_table_id AND reservation_datetime > NOW();
  UPDATE tables SET status = 'available' WHERE id = v_table_id;
  
  -- Report result
  IF v_table_status_after = 'reserved' THEN
    RAISE NOTICE '✅ SUCCESS: Trigger is working correctly!';
  ELSE
    RAISE WARNING '❌ FAILED: Trigger did not update table status. Check permissions and RLS policies.';
  END IF;
END $$;
```

**Expected Output in Messages:**
```
NOTICE:  Table status BEFORE: available
NOTICE:  Table status AFTER: reserved
NOTICE:  ✅ SUCCESS: Trigger is working correctly!
```

### Step 6: Alternative Fix - Update Trigger to Bypass RLS

If RLS policies are blocking the update, modify the trigger function to use postgres role:

```sql
CREATE OR REPLACE FUNCTION auto_update_table_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a new reservation is created or updated to confirmed/checked_in
  IF (TG_OP = 'INSERT' AND NEW.status IN ('pending', 'confirmed', 'checked_in')) OR
     (TG_OP = 'UPDATE' AND NEW.status IN ('confirmed', 'checked_in') AND 
      (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'checked_in'))) THEN
    
    -- Update table status to 'reserved' using postgres privileges
    EXECUTE format('UPDATE tables SET status = %L, updated_at = NOW() WHERE id = %L',
                   'reserved', NEW.table_id);
    
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
      EXECUTE format('UPDATE tables SET status = %L, updated_at = NOW() WHERE id = %L',
                     'available', NEW.table_id);
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate triggers
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
```

### Step 7: Manual Fix for Existing Reservations

To immediately fix tables that should already be reserved:

```sql
-- Update all tables that have active confirmed reservations
UPDATE tables t
SET status = 'reserved', updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM table_reservations tr
  WHERE tr.table_id = t.id
    AND tr.status IN ('pending', 'confirmed', 'checked_in')
    AND tr.reservation_datetime >= NOW() - INTERVAL '4 hours'
    AND tr.reservation_datetime <= NOW() + INTERVAL '48 hours'
)
AND t.status != 'reserved';

-- See how many were updated
SELECT COUNT(*) as tables_updated FROM tables WHERE status = 'reserved';
```

## Testing After Fix

### 1. Test in Browser Console

After applying the fix, make a test reservation. Open browser DevTools console and look for these messages:

```
✅ Reservation created successfully
Table ID: xxx-xxx-xxx
Reservation status: confirmed
📊 Table status after reservation: reserved
📊 Table updated at: 2026-03-15T...
```

**If you see:**
```
⚠️ WARNING: Table status is not "reserved"!
Expected: "reserved", Got: available
```
→ The trigger is still not working. Run Step 6 (Alternative Fix).

### 2. Verify in Database

```sql
-- Check recent reservation and table status
SELECT 
  tr.id as reservation_id,
  t.name as table_name,
  t.status as table_status,
  tr.status as reservation_status,
  tr.deposit_paid,
  tr.created_at,
  t.updated_at as table_updated_at
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY tr.created_at DESC
LIMIT 5;
```

**Expected:** `table_status` should be `reserved` for rows with `reservation_status` = `confirmed`

### 3. Verify in UI

1. Log in as customer
2. Go to "Available Tables"
3. Book a table with deposit
4. Complete Stripe payment
5. Return to tables page

**Expected:** 
- Table should show "RESERVED" badge
- Table should have reduced opacity (0.7)
- If "Show only available tables" is checked, reserved table should not appear

## Prevention

To prevent this issue in the future:

1. **Always apply migrations in order**
2. **Test triggers after migration:**
   ```sql
   SELECT * FROM test_auto_update_table_status();
   ```
3. **Monitor trigger execution:**
   ```sql
   SELECT * FROM pg_stat_user_functions WHERE funcname = 'auto_update_table_status';
   ```

## Diagnostic Queries

If issues persist, run the comprehensive diagnostic script:

**File:** `DEBUG_TABLE_STATUS_UPDATE.sql`

This will check:
- ✓ Function exists
- ✓ Triggers exist
- ✓ Permissions are correct
- ✓ RLS policies allow updates
- ✓ Trigger is actually firing
- ✓ Table status is being updated

## Common Errors and Solutions

### Error: "permission denied for table tables"
**Solution:** Run:
```sql
GRANT ALL ON tables TO authenticated;
GRANT ALL ON tables TO service_role;
```

### Error: "new row violates row-level security policy"
**Solution:** Use the alternative trigger function in Step 6 that uses `EXECUTE format()` to bypass RLS.

### Table status updates but UI doesn't reflect it
**Solution:** Frontend caching issue. The updated code now:
1. Waits 1000ms after creating reservation
2. Re-fetches table data
3. Logs status to console

Check browser console for status confirmation.

### Trigger exists but never fires
**Solution:** Check that the trigger is on the correct table:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%auto_update%';
```

Should show `table_reservations` as the event_object_table.

## Implementation Details

### Files Modified

1. **Migration:** `20260315000003_auto_update_table_status.sql`
   - Creates trigger function
   - Creates INSERT and UPDATE triggers
   - Creates `is_table_available()` helper function

2. **Frontend:** `src/pages/customer/TableBookingPage.jsx`
   - Added console logging for debugging
   - Added table status verification after reservation
   - Increased wait time from 500ms to 1000ms
   - Added warning messages to console if trigger fails

3. **Diagnostic:** `DEBUG_TABLE_STATUS_UPDATE.sql`
   - Comprehensive troubleshooting queries
   - Test scripts to verify trigger operation
   - Manual fix queries

### How the Trigger Works

```sql
Trigger: trigger_auto_update_table_status_insert
When: AFTER INSERT ON table_reservations
For Each Row: Executes auto_update_table_status()

Logic:
IF new reservation status IN ('pending', 'confirmed', 'checked_in') THEN
  UPDATE tables SET status = 'reserved' WHERE id = NEW.table_id
END IF
```

## Support

If the issue persists after following all steps:

1. Run the full diagnostic script: `DEBUG_TABLE_STATUS_UPDATE.sql`
2. Check browser console for error messages
3. Check Supabase logs for trigger execution errors
4. Verify that migrations ran successfully in order
5. Check if there are any custom RLS policies blocking the update

## Success Criteria

✅ Function `auto_update_table_status()` exists  
✅ Two triggers exist (INSERT and UPDATE)  
✅ Test script shows status changes from `available` to `reserved`  
✅ Browser console shows correct status after booking  
✅ UI immediately shows table as reserved after payment  
✅ Diagnostic script passes all checks
