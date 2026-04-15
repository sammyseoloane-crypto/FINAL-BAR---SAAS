-- ============================================================
-- SUMMARY: Table Reservation with Deposit Payment
-- ============================================================

This implementation adds the following features:

## 🔐 **1. Deposit Payment Enforcement**
Migration: 20260315000002_enforce_deposit_payment_on_confirm.sql

- ✅ Database trigger prevents confirmation without deposit payment
- ✅ VIP hosts can mark deposits as paid
- ✅ Frontend shows deposit status with visual indicators

## 🪑 **2. Auto-Update Table Status**
Migration: 20260315000003_auto_update_table_status.sql

- ✅ Tables automatically change to 'reserved' when booked
- ✅ Tables return to 'available' when reservation ends/cancelled
- ✅ New function `is_table_available()` for availability checking

## 💳 **3. Customer Payment F low**
Updated: src/pages/customer/TableBookingPage.jsx

- ✅ Customers MUST pay deposit before booking
- ✅ Stripe integration for secure payments
- ✅ Reservation auto-created after successful payment
- ✅ Deposit marked as paid immediately
- ✅ Table status updates automatically

---

## 📋 **Installation Steps**

### Step 1: Apply Migrations
Run these in Supabase SQL Editor:

```sql
-- Run migration 1: Deposit enforcement
-- Copy 20260315000002_enforce_deposit_payment_on_confirm.sql

-- Run migration 2: Table status automation
-- Copy 20260315000003_auto_update_table_status.sql
```

### Step 2: Test the Flow

```sql
-- Check triggers exist
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_validate_deposit_before_confirm',
  'trigger_auto_update_table_status_insert',
  'trigger_auto_update_table_status_update'
);
-- Expected: 3 rows
```

### Step 3: Test Customer Booking Flow

1. Go to `/customer/tables` as a customer
2. Select a table with a deposit
3. Fill out booking form
4. Click "Pay Deposit & Reserve"
5. Complete Stripe payment
6. Return to site → Reservation auto-created
7. Check table status → Should be 'reserved'

---

## 🔄 **Complete Workflow**

### Customer Books Table:
```
Customer selects table
↓
Fills booking form
↓
Clicks "Pay Deposit & Reserve (Rxxx)"
↓
Redirected to Stripe
↓
Completes payment
↓
Returns to site with ?success=true&session_id=xxx
↓
Reservation auto-created with:
  - status: 'confirmed'
  - deposit_paid: true
  - deposit_paid_at: NOW()
↓
Table status → 'reserved'
```

### VIP Host Workflow:
```
Sees reservations list
↓
Pending with unpaid deposit → "Mark Paid" button
↓
Marks deposit as paid
↓
Confirms reservation
↓
Checks in guest → Bar tab auto-created
```

---

## ✅ **Verification Queries**

```sql
-- 1. Check active reservations
SELECT 
  tr.id,
  t.name as table_name,
  t.status as table_status,
  tr.status as reservation_status,
  tr.deposit_amount,
  tr.deposit_paid,
  tr.reservation_datetime
FROM table_reservations tr
JOIN tables t ON tr.table_id = t.id
WHERE tr.status IN ('confirmed', 'checked_in')
ORDER BY tr.reservation_datetime;

-- 2. Check tables that are reserved
SELECT 
  id,
  name,
  status,
  updated_at
FROM tables
WHERE status = 'reserved';

-- 3. Check bar tabs created on check-in
SELECT 
  bt.tab_number,
  bt.tab_type,
  bt.status,
  tr.status as reservation_status,
  bt.created_at
FROM bar_tabs bt
JOIN table_reservations tr ON bt.table_reservation_id = tr.id
WHERE bt.tab_type = 'vip_table'
ORDER BY bt.created_at DESC;
```

---

## 🎉 **Features Enabled**

✅ **Customers:**
- Must pay deposit before booking
- Instant confirmation after payment
- See deposit status in reservations

✅ **VIP Hosts:**
- See deposit payment status
- Can mark deposits as paid (for cash/other)
- Cannot confirm without deposit
- Auto bar tab creation on check-in

✅ **System:**
- Tables auto-update to 'reserved'
- Payment tracking via Stripe
- Full audit trail of deposits

---

## 🚨 **Important Notes**

1. **Stripe Keys Required**
   - Ensure `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env`
   - Ensure `STRIPE_SECRET_KEY` is set in Supabase Edge Function secrets

2. **Success URL**
   - Customers return to `/customer/tables?success=true&session_id=xxx`
   - Reservation is created automatically

3. **Table Status**
   - Only changes to 'reserved' for active reservations
   - Returns to 'available' when no active reservations

4. **Deposit Payment**
   - Once paid via Stripe, cannot be unmarked
   - VIP hosts can mark as paid for cash deposits
   - Database enforces payment before confirmation
