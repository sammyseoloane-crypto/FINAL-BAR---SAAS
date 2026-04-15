# 🔧 Fix QR Code Error - Migration Required

## ❌ Current Error

```
QR Code Error
Invalid QR code. Table not found or inactive.
```

## 🎯 Root Cause

The **permanent QR code system migration has not been run** in your Supabase database yet. The migration adds:
- `qr_token` column to `tables` table
- `get_table_by_qr_token()` function
- Auto-generation trigger for QR tokens
- QR code management views

## ✅ Solution - Run Migration in Supabase

### **Option 1: Supabase Dashboard (Recommended - Easiest)**

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy & Paste Migration**
   - Open file: `supabase/migrations/20260314100000_permanent_table_qr_codes.sql`
   - Copy the ENTIRE contents (all 180 lines)
   - Paste into SQL Editor

4. **Execute Migration**
   - Click "Run" or press `Ctrl+Enter`
   - Wait for success message

5. **Verify Migration**
   Run this query to verify:
   ```sql
   -- Check if qr_token column exists
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'tables' AND column_name = 'qr_token';
   
   -- Check if function exists
   SELECT proname FROM pg_proc WHERE proname = 'get_table_by_qr_token';
   
   -- Check if tables have QR tokens
   SELECT id, name, qr_token FROM tables LIMIT 5;
   ```

### **Option 2: Supabase CLI (For Developers)**

```bash
# Navigate to project directory
cd "d:\MULTI-TENANT BAR SAAS APP\my-bar-app"

# Login to Supabase (if not already)
npx supabase login

# Link to your project (if not already)
npx supabase link --project-ref YOUR_PROJECT_REF

# Run the specific migration
npx supabase db push

# OR run migration directly
npx supabase db execute -f supabase/migrations/20260314100000_permanent_table_qr_codes.sql
```

### **Option 3: Direct SQL Execution (Quick Fix)**

If you just want to fix it NOW without reading files:

1. **Go to Supabase SQL Editor**

2. **Run this complete script:**

```sql
-- ============================================================
-- PERMANENT QR CODE SYSTEM FOR BAR TABS
-- Migration: 20260314100000_permanent_table_qr_codes.sql
-- ============================================================

-- Step 1: Add qr_token column to tables
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(20) UNIQUE;

-- Step 2: Create QR token generation function
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS VARCHAR AS $$
DECLARE
  chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- No ambiguous chars (I, O, 0, 1)
  token VARCHAR := '';
  i INTEGER;
  attempts INTEGER := 0;
BEGIN
  LOOP
    token := '';
    FOR i IN 1..8 LOOP
      token := token || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    
    -- Check if token already exists
    IF NOT EXISTS (SELECT 1 FROM tables WHERE qr_token = token) THEN
      RETURN token;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique QR token after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Step 3: Create function to get table by QR token
CREATE OR REPLACE FUNCTION get_table_by_qr_token(p_token VARCHAR)
RETURNS TABLE (
  table_id UUID,
  table_name VARCHAR,
  table_zone VARCHAR,
  table_capacity INTEGER,
  table_status VARCHAR,
  tenant_id UUID,
  tenant_name VARCHAR,
  minimum_spend DECIMAL,
  qr_token VARCHAR,
  qr_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS table_id,
    t.name AS table_name,
    t.zone AS table_zone,
    t.capacity AS table_capacity,
    t.status AS table_status,
    t.tenant_id,
    tn.name AS tenant_name,
    t.minimum_spend,
    t.qr_token,
    'https://your-app.netlify.app/tab/start/' || t.qr_token AS qr_url
  FROM tables t
  JOIN tenants tn ON t.tenant_id = tn.id
  WHERE t.qr_token = p_token
    AND t.status != 'maintenance'
    AND tn.is_active = true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Step 4: Create trigger to auto-generate QR tokens
CREATE OR REPLACE FUNCTION auto_generate_table_qr_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := generate_qr_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_qr_token ON tables;

CREATE TRIGGER trigger_auto_generate_qr_token
  BEFORE INSERT ON tables
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_table_qr_token();

-- Step 5: Generate QR tokens for existing tables
UPDATE tables 
SET qr_token = generate_qr_token()
WHERE qr_token IS NULL;

-- Step 6: Verify
SELECT 
  COUNT(*) as total_tables,
  COUNT(qr_token) as tables_with_qr_tokens,
  COUNT(*) - COUNT(qr_token) as missing_qr_tokens
FROM tables;
```

3. **Check Results**
   You should see output like:
   ```
   total_tables | tables_with_qr_tokens | missing_qr_tokens
   -------------+-----------------------+------------------
             12 |                    12 |                 0
   ```

## 🧪 Test QR Code System

After running the migration, test with this query:

```sql
-- Get all tables with their QR codes
SELECT 
  id,
  name,
  qr_token,
  'https://your-app.netlify.app/tab/start/' || qr_token AS scan_url
FROM tables
ORDER BY name;
```

Copy one of the `qr_token` values (e.g., `X7KD82`) and test:

```sql
SELECT * FROM get_table_by_qr_token('X7KD82');
```

This should return the table information.

## 📱 Test in Browser

After migration is complete:

1. **Get a QR token from database:**
   ```sql
   SELECT qr_token FROM tables LIMIT 1;
   ```

2. **Visit the URL manually:**
   ```
   https://your-app.netlify.app/tab/start/[TOKEN_HERE]
   ```
   Replace `[TOKEN_HERE]` with actual token from step 1.

3. **You should see:**
   - Venue name
   - Table name
   - Form to open tab
   - NO ERROR

## 🎯 What This Migration Does

### **Database Changes:**
1. ✅ Adds `qr_token VARCHAR(20) UNIQUE` column to `tables`
2. ✅ Creates `generate_qr_token()` function (8-char alphanumeric)
3. ✅ Creates `get_table_by_qr_token(token)` function (lookup)
4. ✅ Creates auto-generation trigger for new tables
5. ✅ Generates tokens for all existing tables

### **QR Token Format:**
- **Length:** 8 characters
- **Characters:** A-Z, 2-9 (no I, O, 0, 1 to avoid confusion)
- **Example:** `X7KD82FR`, `AB3K8M2P`
- **Unique:** Database constraint ensures no duplicates

### **Security:**
- Tokens are random and unpredictable
- Each table has a permanent, unique token
- Tokens never expire (permanent QR codes)
- Can be regenerated if compromised

## 🔄 After Migration

### **Generate QR Codes for Tables**

1. **Go to Staff QR Codes Page:**
   - Login as Owner/Manager
   - Navigate to: `/staff/qr-codes`

2. **Download QR Codes:**
   - Click "Download QR" for each table
   - Saves as PNG file (300x300px)

3. **Print QR Codes:**
   - Click "Print All QR Codes"
   - Prints formatted page with all QR codes

4. **Place on Tables:**
   - Print on paper/stickers
   - Laminate for durability
   - Place on each physical table

## 📊 Migration Status

**Before Migration:**
- ❌ `qr_token` column: Does NOT exist
- ❌ `get_table_by_qr_token()`: Does NOT exist
- ❌ QR codes: NONE generated
- ❌ Scanning QR: **FAILS** with error

**After Migration:**
- ✅ `qr_token` column: EXISTS
- ✅ `get_table_by_qr_token()`: EXISTS
- ✅ QR codes: GENERATED for all tables
- ✅ Scanning QR: **WORKS** successfully

## 🚨 Troubleshooting

### **Issue: Migration fails with "column already exists"**
**Solution:** The migration was partially run. Complete it manually:

```sql
-- Check what exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tables' AND column_name = 'qr_token';

SELECT proname FROM pg_proc WHERE proname = 'get_table_by_qr_token';

-- If column exists but no tokens generated:
UPDATE tables SET qr_token = generate_qr_token() WHERE qr_token IS NULL;
```

### **Issue: "function generate_qr_token does not exist"**
**Solution:** Run the function creation part of the migration:

```sql
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS VARCHAR AS $$
DECLARE
  chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  token VARCHAR := '';
  i INTEGER;
  attempts INTEGER := 0;
BEGIN
  LOOP
    token := '';
    FOR i IN 1..8 LOOP
      token := token || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    
    IF NOT EXISTS (SELECT 1 FROM tables WHERE qr_token = token) THEN
      RETURN token;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique QR token after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;
```

### **Issue: Still getting error after migration**
**Solution:** Clear cache and verify:

1. **Hard refresh browser:** `Ctrl+F5`
2. **Check Netlify deployment:** Ensure latest code is deployed
3. **Verify migration:** Run verification queries above
4. **Check Supabase logs:** SQL Editor > Logs

## 📞 Need Help?

If migration fails or you're stuck:

1. **Check Supabase project settings** - Ensure you're running in correct project
2. **Check permissions** - Ensure you have database admin access
3. **Check migration file** - Located at: `supabase/migrations/20260314100000_permanent_table_qr_codes.sql`
4. **Check error logs** - Supabase Dashboard > Database > Logs

## ✅ Success Criteria

After successful migration, you should be able to:

- [x] Customer scans QR code → Loads tab start page (NO ERROR)
- [x] Customer sees venue name and table name
- [x] Customer fills form → Opens tab successfully
- [x] Staff can view QR codes at `/staff/qr-codes`
- [x] Staff can download/print QR codes
- [x] Database query `SELECT * FROM get_table_by_qr_token('SOMETOKEN')` returns data

---

**TL;DR:** Go to Supabase SQL Editor, paste the migration SQL from `supabase/migrations/20260314100000_permanent_table_qr_codes.sql`, and click Run. QR codes will work immediately after that.

**Estimated Time:** 2-5 minutes

**Priority:** 🔴 HIGH - Blocks customer QR code scanning feature
