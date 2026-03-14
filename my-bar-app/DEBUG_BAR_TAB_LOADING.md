# Debug Bar Tab Loading Issue

## What was changed:
1. ✅ Fixed `CustomerTabView.jsx` to get `tenant_id` from `userProfile.tenant_id` first (before URL or localStorage)
2. ✅ Added phone number to localStorage when found, so it persists
3. ✅ Improved error messages to show what's missing
4. ✅ Added warning when user has no phone in profile

## How to test if it's working now:

### Step 1: Check your browser console (F12)
When you click "My Bar Tab", you should see:
- Loading state appears
- Then either:
  - Phone input form (if no phone in profile)
  - "No Open Tab Found" message
  - Your tab with items

### Step 2: Check your profile has required data
Run this SQL in Supabase:
```sql
SELECT 
  id,
  email,
  phone,
  tenant_id,
  role
FROM profiles
WHERE id = auth.uid();
```

**Required:**
- `tenant_id` must NOT be NULL
- `phone` should have your phone number (optional but helpful)

### Step 3: Check if you have an open tab
Run this SQL:
```sql
SELECT 
  t.*,
  p.phone as profile_phone,
  p.tenant_id as profile_tenant_id
FROM tabs t
CROSS JOIN (SELECT phone, tenant_id FROM profiles WHERE id = auth.uid()) p
WHERE t.customer_phone = p.phone
  AND t.tenant_id = p.tenant_id
  AND t.status = 'open';
```

**Expected:**
- If you have an open tab, it should return rows
- If empty, you need to open a tab first (scan QR code at table)

### Step 4: Test the database function directly
```sql
SELECT * FROM get_customer_tab_by_phone(
  (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
  (SELECT phone FROM profiles WHERE id = auth.uid())
);
```

**Expected:**
- If you have an open tab, returns your tab
- If empty, no open tab exists

## Common Issues & Fixes

### Issue 1: "Venue information not found"
**Cause:** Your `profiles.tenant_id` is NULL

**Fix:**
```sql
UPDATE profiles
SET tenant_id = (SELECT id FROM tenants WHERE subscription_tier = 'enterprise' LIMIT 1)
WHERE id = auth.uid();
```

### Issue 2: Page just loads forever
**Cause:** `userProfile` context not loading, or async issue

**Fix:**
- Check browser console for errors
- Hard refresh (Ctrl+Shift+R)
- Try manually entering your phone in the form

### Issue 3: "No Open Tab Found"
**Cause:** You don't actually have an open tab

**This is EXPECTED if:**
- You haven't scanned a table QR code
- Your bartender hasn't opened a tab for you
- Your phone number in profile doesn't match the tab's phone

**To create a test tab:**
1. Go to `/staff/tabs` (as bartender/manager)
2. Click "Open New Tab"
3. Enter your name and phone (same as in your profile)
4. Add some drinks
5. Now go to Customer Dashboard → My Bar Tab

### Issue 4: Phone number doesn't match
**Cause:** Tab was opened with different phone than your profile

**Check:**
```sql
-- Your profile phone
SELECT phone FROM profiles WHERE id = auth.uid();

-- Open tabs
SELECT customer_name, customer_phone, status FROM tabs WHERE status = 'open';
```

If they don't match, either:
- Update your profile phone to match the tab
- Or open a new tab with your correct phone

## Testing Checklist

- [ ] Your `profiles.tenant_id` is set (not NULL)
- [ ] Your `profiles.phone` is set (optional but helpful)
- [ ] You have an open tab in the database
- [ ] Tab's `customer_phone` matches your `profiles.phone`
- [ ] Tab's `tenant_id` matches your `profiles.tenant_id`
- [ ] Tab's `status` is 'open' (not 'closed')

## Success Criteria

When everything works, clicking "My Bar Tab" should:
1. Show loading spinner briefly
2. Automatically load your tab (if phone in profile)
3. Display your drinks list
4. Show correct totals
5. Allow you to add tip and pay

## If still not working

Open browser DevTools Console (F12) and share any error messages you see. The component now has better error handling that will show specific issues.
