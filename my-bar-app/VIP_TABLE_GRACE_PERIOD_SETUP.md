# 🕒 VIP Table Grace Period & No-Show Implementation

## ✅ Implementation Complete

This system automatically handles the complete VIP table reservation lifecycle with grace periods and no-show detection.

---

## 📋 **Standard VIP Table Flow**

### **1️⃣ Table Reserved**
Customer books the table
```
Table: VIP 4
Reservation time: 22:00
Guests: 6
Status: confirmed
Grace period: 30 minutes (default)
```

### **2️⃣ Grace Period After Reservation Time**
Clubs allow 15–30 minutes for late arrivals
```
Reservation time: 22:00
Grace period: 30 minutes
Grace ends at: 22:30
Status: confirmed (in grace period)
```

The system tracks:
- `grace_period_minutes` (default: 30)
- `grace_period_end_datetime` (auto-calculated)

### **3️⃣ Guest Check-In**
If guests arrive before grace period ends:
```
Host checks in guests → Status: checked_in
Table becomes active
Bar tab auto-created (already implemented)
```

### **4️⃣ No-Show Reset**
If guests do not arrive by grace period:
```
22:00 - Reservation time
22:30 - Grace ends
22:31 - Auto-marked no_show
Table status → available
```

---

## 🗄️ **Database Changes**

### **New Columns Added:**
```sql
table_reservations:
  - grace_period_minutes (INTEGER, default: 30)
  - grace_period_end_datetime (TIMESTAMP, auto-calculated)
```

### **New Functions:**

1. **`check_and_mark_no_shows()`**
   - Automatically marks reservations as no-show after grace period
   - Should be called every 5 minutes

2. **`get_reservations_in_grace_period(tenant_id)`**
   - Returns all reservations currently in grace period
   - Shows minutes remaining

3. **`process_reservation_status_updates()`**
   - Main scheduler function
   - Call this every 5 minutes via cron job or Edge Function

### **New View:**

**`reservation_status_summary`**
Shows comprehensive status including:
- `grace_status`: upcoming | in_grace_period | should_be_no_show | active | closed
- `minutes_until_no_show`: Countdown during grace period

---

## 🚀 **Setup Instructions**

### **Step 1: Apply Migration**
Run in Supabase SQL Editor:
```sql
-- Copy entire content from:
-- 20260315000004_vip_table_grace_period_no_show.sql
```

### **Step 2: Set Up Automatic No-Show Checking**

**Option A: Using Supabase Edge Function (Recommended)**

Create a scheduled Edge Function that runs every 5 minutes:

```typescript
// supabase/functions/process-reservation-updates/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data, error } = await supabaseAdmin
    .rpc('process_reservation_status_updates')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

Then set up a cron job in Supabase Dashboard or use a service like cron-job.org to call it every 5 minutes.

**Option B: Manual Check (For Testing)**
```sql
-- Run manually to mark no-shows
SELECT * FROM check_and_mark_no_shows();
```

### **Step 3: Verify Setup**
```sql
-- Check reservations in grace period
SELECT * FROM get_reservations_in_grace_period();

-- Check overall status
SELECT * FROM reservation_status_summary
WHERE grace_status = 'in_grace_period';
```

---

## 📊 **Usage Examples**

### **Check Reservations in Grace Period**
```sql
-- For VIP host dashboard
SELECT * FROM get_reservations_in_grace_period('YOUR-TENANT-ID');
```

Returns:
```
reservation_id | table_name | guest_name | reservation_time | grace_ends_at | minutes_remaining
---------------|------------|------------|------------------|---------------|------------------
uuid-123       | VIP 4      | John Doe   | 22:00            | 22:30         | 12.5
```

### **View All Reservation Statuses**
```sql
SELECT 
  table_name,
  guest_name,
  reservation_datetime,
  status,
  grace_status,
  minutes_until_no_show
FROM reservation_status_summary
WHERE status IN ('pending', 'confirmed', 'checked_in')
ORDER BY reservation_datetime;
```

### **Test No-Show Marking**
```sql
-- Create a test reservation with 1-minute grace period
INSERT INTO table_reservations (
  tenant_id,
  table_id,
  user_id,
  reservation_date,
  reservation_time,
  reservation_datetime,
  grace_period_minutes, -- 1 minute for testing
  guest_count,
  contact_email,
  status
) VALUES (
  'YOUR-TENANT-ID',
  'YOUR-TABLE-ID',
  auth.uid(),
  CURRENT_DATE,
  '20:00',
  NOW() - INTERVAL '2 minutes', -- 2 minutes ago
  1, -- 1 minute grace period
  4,
  'test@example.com',
  'confirmed'
);

-- Wait 1 minute, then run:
SELECT * FROM check_and_mark_no_shows();

-- Check if it was marked
SELECT status FROM table_reservations WHERE contact_email = 'test@example.com';
-- Should show: no_show
```

---

## 🎯 **Frontend Integration**

### **Display Grace Period Countdown**

Add to VIP Host Dashboard:

```javascript
const [gracePeriodReservations, setGracePeriodReservations] = useState([]);

useEffect(() => {
  const fetchGracePeriod = async () => {
    const { data } = await supabase
      .rpc('get_reservations_in_grace_period', {
        p_tenant_id: userProfile.tenant_id
      });
    setGracePeriodReservations(data || []);
  };

  fetchGracePeriod();
  // Refresh every minute
  const interval = setInterval(fetchGracePeriod, 60000);
  return () => clearInterval(interval);
}, []);

// Display
{gracePeriodReservations.map(res => (
  <div key={res.reservation_id} className="grace-alert">
    ⏰ {res.table_name} - {res.guest_name}
    <br />
    Grace ends in: {Math.floor(res.minutes_remaining)} minutes
    <button onClick={() => checkIn(res.reservation_id)}>Check In Now</button>
  </div>
))}
```

---

## ⚙️ **Configuration**

### **Change Default Grace Period**
```sql
-- Change default grace period to 15 minutes
ALTER TABLE table_reservations 
ALTER COLUMN grace_period_minutes SET DEFAULT 15;
```

### **Set Custom Grace Period Per Reservation**
When creating a reservation:
```javascript
const reservationData = {
  // ... other fields
  grace_period_minutes: 15, // Custom grace period
};
```

---

## 🔍 **Monitoring**

### **Dashboard Query: Upcoming No-Shows**
```sql
SELECT 
  table_name,
  guest_name,
  reservation_datetime,
  grace_period_end_datetime,
  EXTRACT(EPOCH FROM (grace_period_end_datetime - NOW())) / 60 as minutes_left
FROM reservation_status_summary
WHERE grace_status = 'in_grace_period'
ORDER BY minutes_left ASC;
```

### **Stats Query**
```sql
SELECT 
  DATE(reservation_date) as date,
  COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
  COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
FROM table_reservations
WHERE reservation_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(reservation_date)
ORDER BY date DESC;
```

---

## ✅ **What's Implemented**

- ✅ Grace period tracking (default 30 minutes)
- ✅ Auto-calculation of grace end time
- ✅ Function to check and mark no-shows
- ✅ View showing grace period status
- ✅ Helper functions for monitoring
- ✅ Automatic table status update (already existed)
- ✅ Integration with existing check-in flow

---

## 🎉 **Complete Flow Verification**

1. **Customer books table** → `status: confirmed`, grace period set
2. **Before reservation time** → `grace_status: upcoming`
3. **After reservation time, before grace end** → `grace_status: in_grace_period`
4. **Guest checks in** → `status: checked_in`, bar tab created
5. **Grace period expires without check-in** → Auto marked `no_show`, table becomes `available`

**The VIP Table Grace Period system is fully implemented and ready to use!** 🚀
