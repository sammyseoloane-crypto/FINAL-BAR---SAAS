# VIP Table Revenue Maximizer - Deployment Guide

## 🎯 Overview

This guide will help you deploy the smart pricing engine for VIP tables with dynamic minimum spend adjustments based on demand.

**Features:**
- 🎚️ Smart Pricing Engine (>60% reserved → +20%, >80% reserved → +50%)
- 📊 Revenue Heatmap (visual analytics)
- 🎨 Modern React Dashboard
- ⚡ Real-time Updates
- 📈 Automatic Price Adjustments

---

## 📋 What's Been Created

### 1. Database Migration
**File:** `supabase/migrations/20260314000004_smart_pricing_engine.sql`

**Schema Changes:**
- Added `base_min_spend`, `current_min_spend`, `pricing_tier` to `tables`
- Added `expected_capacity` to `events`
- Created `table_pricing_history` for audit trail

**Functions:**
1. `calculate_dynamic_minimum_spend()` - Calculates pricing based on occupancy
2. `update_table_pricing()` - Updates all tables with dynamic pricing
3. `get_table_revenue_stats()` - Revenue analytics for heatmap

**Trigger:**
- Auto-updates pricing when reservations are made/cancelled

### 2. React Dashboard
**File:** `src/components/VIPTablesDashboard.jsx` + `.css`

**Views:**
- **Grid View:** Table cards with status (green/yellow/red)
- **Heatmap View:** 30-day revenue visualization

**Features:**
- Reserve tables
- Update pricing
- View occupancy stats
- Real-time updates via Supabase subscriptions

### 3. Routing & Navigation
- ✅ Route added: `/owner/vip-tables`
- ✅ Navigation link added: "🥂 VIP Tables" in owner sidebar

---

## 🚀 Deployment Steps

### Step 1: Deploy Database Migration

**Option A: Using Supabase CLI (Recommended)**
```powershell
cd "D:\MULTI-TENANT BAR SAAS APP\my-bar-app"

# Login to Supabase (if not already)
npx supabase login

# Link to your project
npx supabase link --project-ref pgzlpwnumdoulxqssxsb

# Push migration
npx supabase db push
```

**Option B: Using Supabase Dashboard**
1. Go to https://supabase.com/dashboard/project/pgzlpwnumdoulxqssxsb/sql
2. Click "New query"
3. Copy contents of `supabase/migrations/20260314000004_smart_pricing_engine.sql`
4. Paste and click "Run"

**Option C: Direct PostgreSQL**
```powershell
# Set password in environment
$env:PGPASSWORD = "your_supabase_password"

# Run migration
psql -h db.pgzlpwnumdoulxqssxsb.supabase.co `
     -U postgres `
     -d postgres `
     -f "supabase/migrations/20260314000004_smart_pricing_engine.sql"
```

---

### Step 2: Verify Migration Success

Run these SQL queries in Supabase Dashboard SQL Editor:

```sql
-- 1. Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tables' 
  AND column_name IN ('base_min_spend', 'current_min_spend', 'pricing_tier');
-- Expected: 3 rows

-- 2. Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'calculate_dynamic_minimum_spend',
  'update_table_pricing',
  'get_table_revenue_stats'
);
-- Expected: 3 rows

-- 3. Check trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_reservation_pricing_update';
-- Expected: 1 row

-- 4. Check table_pricing_history exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'table_pricing_history';
-- Expected: 1 row
```

---

### Step 3: Initialize Existing Tables

Run this to set base prices for existing tables:

```sql
-- Update existing tables with base pricing
UPDATE tables 
SET 
  base_min_spend = COALESCE(minimum_spend, 0),
  current_min_spend = COALESCE(minimum_spend, 0),
  pricing_tier = 'standard'
WHERE base_min_spend IS NULL;

-- Verify
SELECT name, base_min_spend, current_min_spend, pricing_tier 
FROM tables 
LIMIT 10;
```

---

### Step 4: Test Smart Pricing

**Test Scenario 1: Standard Pricing (< 60% occupancy)**
```sql
-- Simulate 50% occupancy
SELECT * FROM calculate_dynamic_minimum_spend(
  (SELECT id FROM tenants LIMIT 1), -- Your tenant ID
  NULL,
  CURRENT_DATE
);
-- Expected: adjustment_percentage = 0, pricing_tier = 'standard'
```

**Test Scenario 2: High Demand (60-80% occupancy)**
```sql
-- Create reservations to reach 65% occupancy
-- (You'll need to create actual reservations for your tables)

-- Then check pricing
SELECT 
  table_id,
  base_min_spend,
  current_min_spend,
  pricing_tier,
  adjustment_percentage,
  occupancy_rate
FROM calculate_dynamic_minimum_spend(
  (SELECT id FROM tenants LIMIT 1),
  NULL,
  CURRENT_DATE
);
-- Expected: adjustment_percentage = 20, pricing_tier = 'high_demand'
--          current_min_spend = base_min_spend * 1.2
```

**Test Scenario 3: Peak Pricing (> 80% occupancy)**
```sql
-- Create enough reservations to reach 85% occupancy
-- Then check pricing (same query as above)
-- Expected: adjustment_percentage = 50, pricing_tier = 'peak'
--          current_min_spend = base_min_spend * 1.5
```

---

### Step 5: Test Revenue Analytics

```sql
-- Get 30-day revenue stats
SELECT * FROM get_table_revenue_stats(
  (SELECT id FROM tenants LIMIT 1),
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);
-- Expected: List of tables with revenue, reservation count, avg spend
```

---

### Step 6: Start Development Server

```powershell
cd "D:\MULTI-TENANT BAR SAAS APP\my-bar-app"

# Install any missing dependencies
npm install

# Start dev server
npm run dev
```

---

### Step 7: Access Dashboard

1. **Login** as owner or admin
2. **Navigate** to sidebar → "🥂 VIP Tables"
3. **URL:** http://localhost:5173/owner/vip-tables

**Dashboard Features:**
- View all tables with color-coded status
- See current occupancy rate and pricing tier
- Reserve tables
- Update base minimum spend
- Switch to heatmap view for revenue analytics

---

## 🧪 Testing Checklist

### Functional Tests

- [ ] **Grid View Loads:** All tables displayed with correct status colors
- [ ] **Pricing Stats:** Occupancy rate and pricing tier show correctly
- [ ] **Reserve Table:** Modal opens, form submits successfully
- [ ] **Update Pricing:** Modal opens, base price updates in database
- [ ] **Real-time Updates:** Create reservation → table status changes automatically
- [ ] **Heatmap View:** Revenue statistics display with color gradient
- [ ] **Navigation:** Sidebar link works, route is protected (owner/admin only)

### Smart Pricing Tests

- [ ] **Low Occupancy (< 60%):** pricing_tier = 'standard', no adjustment
- [ ] **Medium Occupancy (60-80%):** pricing_tier = 'high_demand', +20% adjustment
- [ ] **High Occupancy (> 80%):** pricing_tier = 'peak', +50% adjustment
- [ ] **Trigger Test:** Create reservation → pricing updates automatically
- [ ] **History Tracking:** table_pricing_history records changes

### Data Tests

```sql
-- Test 1: Verify base prices set
SELECT COUNT(*) FROM tables WHERE base_min_spend > 0;

-- Test 2: Verify pricing function works
SELECT COUNT(*) FROM calculate_dynamic_minimum_spend(
  (SELECT id FROM tenants LIMIT 1), 
  NULL, 
  CURRENT_DATE
);

-- Test 3: Check reservations exist
SELECT COUNT(*) FROM table_reservations WHERE status = 'confirmed';

-- Test 4: Verify revenue stats
SELECT COUNT(*) FROM get_table_revenue_stats(
  (SELECT id FROM tenants LIMIT 1),
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);
```

---

## 🎨 How Smart Pricing Works

### Pricing Rules

```
Base Min Spend: R3,000

Occupancy < 60%:
  Current Min Spend = R3,000 (no change)
  Tier = 'standard'

Occupancy 60-80%:
  Current Min Spend = R3,600 (+20%)
  Tier = 'high_demand'

Occupancy > 80%:
  Current Min Spend = R4,500 (+50%)
  Tier = 'peak'
```

### Automatic Triggers

**When a reservation is created/updated:**
1. Trigger detects change in `table_reservations`
2. Calls `calculate_dynamic_minimum_spend()`
3. Updates all tables' `current_min_spend` and `pricing_tier`
4. Records change in `table_pricing_history`

**Real-world Example:**
- Friday night event at your nightclub
- 10 total VIP tables
- 7 tables get reserved (70% occupancy)
- System automatically increases min spend by 20%
- Last 3 tables now cost R3,600 instead of R3,000
- More revenue per table!

---

## 📊 Revenue Heatmap

The heatmap visualizes which tables generate the most revenue:

**Color Scale:**
- 🟥 Dark Red = Top performers (highest revenue)
- 🟧 Orange = Medium performers
- 🟨 Yellow = Lower performers
- ⬜ Gray = No revenue data

**Metrics Shown:**
- Total revenue (last 30 days)
- Reservation count
- Average spend per reservation
- Revenue rank (#1, #2, etc.)

**Use Cases:**
- Identify premium table locations
- Adjust pricing strategy
- Staff training (upselling at high-value tables)
- Floor plan optimization

---

## 🔧 Customization Options

### Adjust Pricing Tiers

Edit `calculate_dynamic_minimum_spend()` function:

```sql
-- Current rules:
IF v_occupancy_rate > 80 THEN
  v_multiplier := 1.5;  -- Change to 1.6 for 60% increase
  v_tier := 'peak';
ELSIF v_occupancy_rate > 60 THEN
  v_multiplier := 1.2;  -- Change to 1.3 for 30% increase
  v_tier := 'high_demand';
ELSE
  v_multiplier := 1.0;
  v_tier := 'standard';
END IF;
```

### Add New Pricing Tier

```sql
-- Example: Add "super_peak" for > 90% occupancy
IF v_occupancy_rate > 90 THEN
  v_multiplier := 2.0;  -- Double the price!
  v_tier := 'super_peak';
ELSIF v_occupancy_rate > 80 THEN
  v_multiplier := 1.5;
  v_tier := 'peak';
-- ... rest of logic
```

### Event-Based Pricing

Tables can have different pricing for special events:

```sql
-- Pass event_id to calculate dynamic pricing
SELECT * FROM calculate_dynamic_minimum_spend(
  tenant_id,
  'event-uuid-here',  -- New Year's Eve event
  '2026-12-31'
);
```

---

## 🐛 Troubleshooting

### Issue: "Function does not exist"

**Cause:** Migration not applied successfully

**Fix:**
```sql
-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%pricing%';

-- If empty, re-run migration
```

---

### Issue: "Pricing not updating automatically"

**Cause:** Trigger not firing

**Fix:**
```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trigger_reservation_pricing_update';

-- Manually trigger update
SELECT update_table_pricing(
  'your-tenant-id',
  NULL,
  CURRENT_DATE
);
```

---

### Issue: "Dashboard shows 0% occupancy"

**Cause:** No reservations or tenant_id mismatch

**Fix:**
```sql
-- Check tenant_id in profile
SELECT tenant_id FROM profiles WHERE id = auth.uid();

-- Check reservations for today
SELECT COUNT(*) FROM table_reservations 
WHERE reservation_date = CURRENT_DATE 
  AND status IN ('confirmed', 'checked_in');
```

---

### Issue: "Heatmap is all gray"

**Cause:** No completed reservations with actual_spend

**Fix:**
```sql
-- Check for completed reservations
SELECT COUNT(*) FROM table_reservations 
WHERE status = 'completed' 
  AND actual_spend > 0;

-- Manually mark a reservation as completed for testing
UPDATE table_reservations 
SET status = 'completed', actual_spend = 5000 
WHERE id = 'some-reservation-id';
```

---

### Issue: "RLS preventing data access"

**Cause:** Row Level Security policies

**Fix:**
```sql
-- Temporarily disable RLS for testing (NOT for production!)
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE table_reservations DISABLE ROW LEVEL SECURITY;

-- Re-enable after testing
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;
```

---

## 📈 Next Steps

### Phase 1: Basic Operations (Week 1)
- [ ] Deploy migration
- [ ] Test basic functionality
- [ ] Train staff on dashboard
- [ ] Set initial base prices

### Phase 2: Optimization (Week 2-3)
- [ ] Analyze first revenue data
- [ ] Adjust pricing multipliers based on results
- [ ] Add event-based pricing for special nights
- [ ] Integrate with email notifications

### Phase 3: Advanced Features (Month 2)
- [ ] AI-powered demand forecasting
- [ ] Seasonal pricing adjustments
- [ ] VIP customer priority booking
- [ ] Automated marketing campaigns

---

## 🎯 Success Metrics

Track these KPIs to measure success:

1. **Average Revenue Per Table**
   ```sql
   SELECT AVG(total_revenue) 
   FROM get_table_revenue_stats(...);
   ```

2. **Occupancy Rate Trend**
   ```sql
   SELECT reservation_date, occupancy_rate 
   FROM table_pricing_history 
   ORDER BY created_at DESC;
   ```

3. **Price Adjustments Impact**
   ```sql
   SELECT 
     pricing_tier,
     AVG(actual_spend) as avg_spend
   FROM table_reservations r
   JOIN tables t ON r.table_id = t.id
   WHERE r.status = 'completed'
   GROUP BY pricing_tier;
   ```

4. **Conversion Rate**
   - Track how many customers book at higher prices
   - Compare before/after smart pricing implementation

---

## 💡 Pro Tips

**Tip 1: Set Conservative Base Prices**
- Start with lower base prices
- Let smart pricing increase them during demand
- Easier to increase than decrease

**Tip 2: Weekend vs Weekday Pricing**
- Adjust `base_min_spend` differently for weekend tables
- Use `expected_capacity` in events table

**Tip 3: Monitor Pricing History**
```sql
-- See how pricing changed over time
SELECT 
  reservation_date,
  AVG(occupancy_rate) as avg_occupancy,
  AVG(adjustment_percentage) as avg_adjustment
FROM table_pricing_history
GROUP BY reservation_date
ORDER BY reservation_date DESC
LIMIT 30;
```

**Tip 4: Customer Communication**
- Display current pricing tier on booking page
- Show "High demand - limited availability!" for peak tier
- Create urgency to book early

---

## 📞 Support

If you encounter issues:

1. **Check Supabase Logs**
   - Go to Supabase Dashboard → Logs
   - Filter by "Database" and "Functions"

2. **Enable Debug Mode**
   ```javascript
   // In VIPTablesDashboard.jsx
   console.log('Pricing Data:', pricingData);
   console.log('Revenue Stats:', revenueStats);
   ```

3. **Test Functions Directly**
   ```sql
   -- Test in SQL Editor
   SELECT * FROM calculate_dynamic_minimum_spend(
     'tenant-id',
     NULL,
     CURRENT_DATE
   );
   ```

---

## ✅ Deployment Checklist

Final checklist before going live:

### Database
- [ ] Migration applied successfully
- [ ] All 3 functions exist
- [ ] Trigger is active
- [ ] table_pricing_history table created
- [ ] RLS policies enabled
- [ ] Base prices set for all tables

### Frontend
- [ ] VIPTablesDashboard component renders
- [ ] Route `/owner/vip-tables` works
- [ ] Navigation link visible (owner/admin only)
- [ ] Grid view displays tables
- [ ] Heatmap view shows revenue data
- [ ] Modals open and close properly

### Functionality
- [ ] Can create reservations
- [ ] Pricing updates automatically
- [ ] Real-time updates work
- [ ] Occupancy stats accurate
- [ ] Revenue heatmap loads

### Security
- [ ] RLS policies tested
- [ ] Only owners/admins can access
- [ ] Tenant isolation verified

### Testing
- [ ] Low occupancy pricing (< 60%)
- [ ] Medium occupancy pricing (60-80%)
- [ ] High occupancy pricing (> 80%)
- [ ] Reservation trigger updates pricing
- [ ] History tracking works

---

## 🚀 You're Ready!

Your VIP Table Revenue Maximizer is ready to deploy. This system will:
- **Increase revenue** by 20-50% during high demand
- **Automate pricing** decisions based on real-time occupancy
- **Provide insights** through revenue analytics
- **Improve efficiency** with streamlined table management

**Go ahead and deploy! 🎉**

```powershell
# Start deployment
cd "D:\MULTI-TENANT BAR SAAS APP\my-bar-app"
npx supabase db push
npm run dev
```

Then navigate to: **http://localhost:5173/owner/vip-tables**

---

**Need help?** Review this document or check the code comments in:
- `supabase/migrations/20260314000004_smart_pricing_engine.sql`
- `src/components/VIPTablesDashboard.jsx`
