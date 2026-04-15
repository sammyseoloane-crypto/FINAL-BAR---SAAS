# 🚀 Run All Missing Migrations - Complete Setup

## 📋 Overview

You have **2 critical migrations** that need to be run in your Supabase database to fix current errors:

1. ✅ **Permanent QR Codes** - Fixes QR code scanning error
2. ✅ **Club Dashboard Functions** - Fixes 400 error on Club Dashboard

Both can be run together in one SQL script.

---

## 🎯 One-Click Solution - Run Both Migrations

### **Go to Supabase SQL Editor**

https://supabase.com/dashboard → Your Project → **SQL Editor** → **New Query**

### **Paste This COMPLETE Script:**

```sql
-- ============================================================
-- COMPLETE MIGRATION BUNDLE
-- Includes: QR Codes + Club Dashboard
-- Run this entire script to fix all current errors
-- ============================================================

-- ============================================================
-- PART 1: PERMANENT QR CODES FOR BAR TABS
-- ============================================================

-- Add QR token column to tables
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(20) UNIQUE;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_tables_qr_token ON tables(qr_token) WHERE qr_token IS NOT NULL;

-- Function to generate unique QR token
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS VARCHAR(20) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar chars (I,1,O,0)
  result TEXT := '';
  i INTEGER;
  token_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    
    -- Generate 8-character token
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM tables WHERE qr_token = result) INTO token_exists;
    
    -- If unique, return it
    IF NOT token_exists THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate QR token for new tables
CREATE OR REPLACE FUNCTION auto_generate_table_qr_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate QR token if not provided
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := generate_qr_token();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate QR tokens
DROP TRIGGER IF EXISTS trigger_auto_generate_table_qr_token ON tables;
CREATE TRIGGER trigger_auto_generate_table_qr_token
  BEFORE INSERT ON tables
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_table_qr_token();

-- Function to get table by QR token
CREATE OR REPLACE FUNCTION get_table_by_qr_token(p_token VARCHAR)
RETURNS TABLE (
  table_id UUID,
  table_name VARCHAR,
  tenant_id UUID,
  tenant_name VARCHAR,
  location_id UUID,
  capacity INTEGER,
  table_type VARCHAR,
  minimum_spend DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as table_id,
    t.name as table_name,
    t.tenant_id,
    tn.name as tenant_name,
    t.location_id,
    t.capacity,
    t.table_type,
    t.minimum_spend
  FROM tables t
  LEFT JOIN tenants tn ON t.tenant_id = tn.id
  WHERE t.qr_token = p_token
    AND t.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to regenerate QR token for a table
CREATE OR REPLACE FUNCTION regenerate_table_qr_token(p_table_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  new_token VARCHAR(20);
BEGIN
  new_token := generate_qr_token();
  
  UPDATE tables
  SET qr_token = new_token,
      updated_at = TIMEZONE('utc', NOW())
  WHERE id = p_table_id;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Generate QR tokens for existing tables that don't have one
UPDATE tables
SET qr_token = generate_qr_token()
WHERE qr_token IS NULL;

-- ============================================================
-- PART 2: CLUB DASHBOARD FUNCTIONS
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_qr_token() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_by_qr_token(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_table_qr_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tonight_revenue_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_revenue(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_selling_drinks(UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_vip_tables(UUID) TO authenticated;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check QR code setup
SELECT 
  COUNT(*) as total_tables,
  COUNT(qr_token) as tables_with_qr_codes,
  COUNT(*) - COUNT(qr_token) as tables_missing_qr_codes
FROM tables;

-- Check functions created
SELECT 
  routine_name,
  routine_type,
  'CREATED' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'generate_qr_token',
    'get_table_by_qr_token',
    'regenerate_table_qr_token',
    'get_tonight_revenue_stats',
    'get_hourly_revenue',
    'get_top_selling_drinks',
    'get_active_vip_tables'
  )
ORDER BY routine_name;

-- Sample QR codes
SELECT 
  id,
  name,
  qr_token,
  'https://your-app.netlify.app/tab/start/' || qr_token as qr_url
FROM tables
WHERE qr_token IS NOT NULL
LIMIT 5;
```

### **Click "Run" or Press Ctrl+Enter**

---

## ✅ Expected Results

After running, you should see 3 result sets:

### **1. QR Code Setup:**
```
total_tables | tables_with_qr_codes | tables_missing_qr_codes
------------+----------------------+------------------------
          12 |                   12 |                       0
```

### **2. Functions Created:**
```
routine_name                | routine_type | status
---------------------------+-------------+--------
generate_qr_token          | FUNCTION     | CREATED
get_active_vip_tables      | FUNCTION     | CREATED
get_hourly_revenue         | FUNCTION     | CREATED
get_table_by_qr_token      | FUNCTION     | CREATED
get_tonight_revenue_stats  | FUNCTION     | CREATED
get_top_selling_drinks     | FUNCTION     | CREATED
regenerate_table_qr_token  | FUNCTION     | CREATED
```

### **3. Sample QR Codes:**
```
id        | name      | qr_token  | qr_url
----------+-----------+-----------+----------------------------------
abc-123   | Table 1   | X7KD82FR  | https://your-app.../tab/start/X7KD82FR
def-456   | Table 2   | M3NK8P2Y  | https://your-app.../tab/start/M3NK8P2Y
...
```

---

## 🎯 What Gets Fixed

### **✅ QR Code Scanning**
- Customer scans QR code → NO ERROR
- Tab opening page loads correctly
- QR code management page works
- Download/print QR codes functional

### **✅ Club Dashboard**
- `/owner/club-dashboard` loads → NO 400 error
- Tonight's revenue displays
- Drinks sold count works
- VIP tables count displays
- Real-time updates work

---

## 🧪 Test After Migration

### **Test QR Codes:**

1. **Get a QR token:**
   ```sql
   SELECT qr_token FROM tables LIMIT 1;
   ```

2. **Test lookup:**
   ```sql
   SELECT * FROM get_table_by_qr_token('TOKEN_FROM_STEP_1');
   ```

3. **Test in browser:**
   ```
   https://your-app.netlify.app/tab/start/TOKEN_FROM_STEP_1
   ```

### **Test Club Dashboard:**

1. **Get your tenant ID:**
   ```sql
   SELECT id FROM tenants WHERE name = 'Your Venue Name';
   ```

2. **Test revenue function:**
   ```sql
   SELECT * FROM get_tonight_revenue_stats('your-tenant-id');
   ```

3. **Visit dashboard:**
   ```
   https://your-app.netlify.app/owner/club-dashboard
   ```

---

## 🚨 Troubleshooting

### **Error: "column already exists"**
This means migration was partially run. Check what exists:

```sql
-- Check if qr_token exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'tables' AND column_name = 'qr_token';

-- If it exists but has no values:
UPDATE tables SET qr_token = generate_qr_token() WHERE qr_token IS NULL;
```

### **Error: "permission denied"**
Grant permissions:

```sql
GRANT ALL ON tables TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
```

### **Browser still shows errors:**
1. **Hard refresh:** `Ctrl+Shift+R`
2. **Clear cache:** Browser settings → Clear browsing data
3. **Check Netlify deployment:** Ensure latest code is deployed
4. **Check console:** Look for different errors

---

## 📊 Migration Status Checklist

After running complete script:

- [ ] QR token column added to tables
- [ ] All tables have QR tokens generated
- [ ] `get_table_by_qr_token()` function created
- [ ] `get_tonight_revenue_stats()` function created
- [ ] `get_hourly_revenue()` function created
- [ ] `get_top_selling_drinks()` function created
- [ ] `get_active_vip_tables()` function created
- [ ] Permissions granted to authenticated users
- [ ] QR code scanning works (no error)
- [ ] Club dashboard loads (no 400 error)
- [ ] Stripe warnings still show (this is normal in dev)

---

## 📝 About Stripe Warnings

The warnings you see:
```
You may test your Stripe.js integration over HTTP. 
However, live Stripe.js integrations must use HTTPS.
```

These are **informational only**, not errors:

- ✅ **Safe to ignore** in development (localhost)
- ✅ **Will disappear** when deployed to Netlify (HTTPS)
- ✅ **Don't affect functionality** - payments work fine
- ✅ **Normal behavior** for Stripe.js on HTTP

---

## ✅ Success Criteria

You'll know everything is working when:

1. **QR Code Scanning:**
   - Visit `/tab/start/ANYTOKEN` → Shows form (not error)
   - Customer can open tab successfully

2. **Club Dashboard:**
   - Visit `/owner/club-dashboard` → Loads dashboard
   - Revenue stats display (even if $0.00)
   - No 400 errors in console

3. **Console Errors:**
   - ONLY Stripe HTTP warning (normal)
   - NO 400 errors
   - NO "function not found" errors

---

**Total Estimated Time:** 5 minutes  
**Difficulty:** Easy (copy/paste SQL)  
**Impact:** Fixes all current blocking errors

---

**Pro Tip:** Save this SQL script for future reference. If you ever reset your Supabase database or create a new project, run this same script to set everything up instantly.
