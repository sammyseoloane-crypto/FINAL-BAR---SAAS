# 🔧 Fix Club Dashboard 400 Error

## ❌ Current Error

```
pgzlpwnumdoulxqssxsb.supabase.co/rest/v1/rpc/get_tonight_revenue_stats:1  
Failed to load resource: the server responded with a status of 400 ()
```

## 🎯 Root Cause

The **Club Dashboard migration has not been run** in your Supabase database. The migration creates the RPC functions needed for the live performance dashboard:

- `get_tonight_revenue_stats()` - Tonight's revenue
- `get_hourly_revenue()` - Hourly breakdown
- `get_top_selling_drinks()` - Best sellers
- `get_active_vip_tables()` - Active VIP sections
- Plus performance tracking tables

## ✅ Quick Fix - Run Migration in Supabase

### **1. Open Supabase SQL Editor**

Go to: https://supabase.com/dashboard → Your Project → **SQL Editor**

### **2. Run This Complete Script**

```sql
-- ============================================================
-- CLUB PERFORMANCE DASHBOARD FUNCTIONS
-- Migration: 20260314000005_club_performance_tables.sql
-- ============================================================

-- Function: Get tonight's revenue stats
DROP FUNCTION IF EXISTS get_tonight_revenue_stats(UUID);

CREATE OR REPLACE FUNCTION get_tonight_revenue_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_revenue DECIMAL,
  transaction_count INTEGER,
  avg_transaction DECIMAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.amount), 0) as total_revenue,
    COUNT(*)::INTEGER as transaction_count,
    COALESCE(AVG(t.amount), 0) as avg_transaction
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'confirmed'
    AND DATE(t.created_at) = CURRENT_DATE;
END;
$$;

-- Function: Get hourly revenue
DROP FUNCTION IF EXISTS get_hourly_revenue(UUID, DATE);

CREATE OR REPLACE FUNCTION get_hourly_revenue(
  p_tenant_id UUID, 
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  hour INTEGER,
  revenue DECIMAL,
  transaction_count INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM t.created_at)::INTEGER as hour,
    COALESCE(SUM(t.amount), 0) as revenue,
    COUNT(*)::INTEGER as transaction_count
  FROM transactions t
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'confirmed'
    AND DATE(t.created_at) = p_date
  GROUP BY EXTRACT(HOUR FROM t.created_at)
  ORDER BY hour;
END;
$$;

-- Function: Get top selling drinks
DROP FUNCTION IF EXISTS get_top_selling_drinks(UUID, DATE, INTEGER);

CREATE OR REPLACE FUNCTION get_top_selling_drinks(
  p_tenant_id UUID,
  p_date DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  drink_name VARCHAR,
  total_quantity INTEGER,
  total_revenue DECIMAL,
  avg_price DECIMAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name::VARCHAR as drink_name,
    SUM(ti.quantity)::INTEGER as total_quantity,
    SUM(ti.price * ti.quantity) as total_revenue,
    AVG(ti.price) as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  JOIN products p ON ti.product_id = p.id
  WHERE t.tenant_id = p_tenant_id
    AND t.status = 'confirmed'
    AND DATE(t.created_at) = p_date
    AND p.category = 'drinks'
  GROUP BY p.name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$;

-- Function: Get active VIP tables
DROP FUNCTION IF EXISTS get_active_vip_tables(UUID);

CREATE OR REPLACE FUNCTION get_active_vip_tables(p_tenant_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO active_count
  FROM tables
  WHERE tenant_id = p_tenant_id
    AND table_type = 'vip'
    AND status = 'occupied'
    AND is_active = true;
    
  RETURN COALESCE(active_count, 0);
END;
$$;

-- Verify functions created
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_tonight_revenue_stats',
    'get_hourly_revenue', 
    'get_top_selling_drinks',
    'get_active_vip_tables'
  )
ORDER BY routine_name;
```

### **3. Click "Run"**

You should see output showing 4 functions created:

```
routine_name                | routine_type
---------------------------+-------------
get_active_vip_tables      | FUNCTION
get_hourly_revenue         | FUNCTION
get_tonight_revenue_stats  | FUNCTION
get_top_selling_drinks     | FUNCTION
```

## 🧪 Test Functions Work

After running migration, test with:

```sql
-- Get your tenant_id
SELECT id, name FROM tenants LIMIT 1;

-- Test revenue stats (replace with your tenant_id)
SELECT * FROM get_tonight_revenue_stats('YOUR-TENANT-ID-HERE');

-- Should return:
-- total_revenue | transaction_count | avg_transaction
-- -------------+-------------------+----------------
--          0.00 |                 0 |            0.00
```

## 🎯 What This Fixes

After migration, the Club Dashboard will load:

✅ **Tonight's Revenue** - Real-time total  
✅ **Drinks Sold** - Today's drink count  
✅ **VIP Tables Active** - Occupied VIP sections  
✅ **Guest List** - Checked-in guests  
✅ **Hourly Revenue Chart** - Visual breakdown  
✅ **Top Drinks** - Best sellers today  

## 🚨 If You Still See Errors

### **Check if functions exist:**
```sql
SELECT proname FROM pg_proc 
WHERE proname LIKE '%tonight%' OR proname LIKE '%hourly%';
```

### **Check for permission issues:**
```sql
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_tonight_revenue_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_revenue(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_selling_drinks(UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_vip_tables(UUID) TO authenticated;
```

### **Hard refresh browser:**
- Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache
- Reload page

## 📋 Stripe Warnings (Not Errors)

The Stripe warnings you see:
```
You may test your Stripe.js integration over HTTP. 
However, live Stripe.js integrations must use HTTPS.
```

These are **just informational warnings**, not errors. They appear because you're running on `localhost:5173` (HTTP) in development. They will disappear when deployed to Netlify (HTTPS).

**Safe to ignore during local development.** ✅

## ✅ Success Criteria

After migration, you should:

- [x] Visit `/owner/club-dashboard` → NO 400 error
- [x] See revenue stats loading (even if $0)
- [x] See all dashboard cards populated
- [x] No console errors except Stripe HTTP warning (which is normal)

---

**TL;DR:** 
1. Go to Supabase SQL Editor
2. Paste the SQL above
3. Click Run
4. Refresh your Club Dashboard page
5. ✅ Fixed!

**Estimated Time:** 2 minutes
