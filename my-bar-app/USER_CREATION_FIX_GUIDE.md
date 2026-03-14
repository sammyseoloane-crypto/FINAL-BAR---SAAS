# User Creation Error - Complete Fix Guide

## 🔴 Problem
**Error:** `Failed to create user: Database error creating new user`

**Root Cause:** The `audit_profiles` trigger tries to log profile creation to `audit_logs` table, but fails because:
- New users have `tenant_id = NULL` (especially platform_admin users)
- Old `audit_logs` table requires `tenant_id NOT NULL`
- Trigger fails → User creation fails

---

## ✅ Solution Options

### Option 1: QUICK FIX (Recommended for Testing) ⚡

**File:** `QUICK_FIX_USER_CREATION.sql`

**What it does:** Temporarily disables the audit trigger on profiles

**Pros:**
- ✅ Takes 5 seconds
- ✅ Guaranteed to work
- ✅ No risk of breaking anything

**Cons:**
- ⚠️ Profile changes won't be logged until you re-enable auditing

**How to use:**
1. Open Supabase Dashboard → SQL Editor
2. Copy & paste this single line:
   ```sql
   DROP TRIGGER IF EXISTS audit_profiles ON profiles;
   ```
3. Click "Run"
4. Go create users - it will work! ✅

---

### Option 2: COMPLETE FIX (Recommended for Production) 🔧

**File:** `FIX_USER_CREATION_FOR_TESTING.sql`

**What it does:** Fixes the audit_logs table and trigger to allow NULL tenant_id

**Pros:**
- ✅ Permanent fix
- ✅ Audit logging still works
- ✅ Supports platform_admin users properly

**Cons:**
- ⚠️ Drops and recreates audit_logs table (existing audit data will be lost)
- ⚠️ Longer script to run

**How to use:**
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `FIX_USER_CREATION_FOR_TESTING.sql`
3. Paste and click "Run"
4. Wait for completion
5. Go create users - it will work! ✅

---

## 📝 How to Create Platform Admin Users

### Step 1: Run ONE of the fixes above

### Step 2: Create user in Supabase Auth UI
1. Go to **Authentication → Users**
2. Click **"Add User"**
3. Enter email (e.g., `admin@test.com`) and password
4. Click **"Create User"** ✅

### Step 3: Upgrade to platform_admin role
Run this in SQL Editor:
```sql
UPDATE profiles 
SET role = 'platform_admin',
    tenant_id = NULL
WHERE email = 'admin@test.com';  -- Replace with your email
```

### Step 4: Verify
```sql
SELECT id, email, role, tenant_id 
FROM profiles 
WHERE role = 'platform_admin';
```

You should see your user with `role = 'platform_admin'` and `tenant_id = NULL` ✅

---

## 🎯 Quick Reference

| Task | SQL File | Time | Best For |
|------|----------|------|----------|
| Just want to create users NOW | `QUICK_FIX_USER_CREATION.sql` | 10 seconds | Testing/Development |
| Full fix with audit logging | `FIX_USER_CREATION_FOR_TESTING.sql` | 1 minute | Production |
| Upgrade user to platform_admin | `CREATE_PLATFORM_ADMIN_USER.sql` | 5 seconds | After user creation |

---

## 🧪 Testing Checklist

After applying a fix:

- [ ] Can create user in Supabase Auth UI without errors
- [ ] Profile is created in `profiles` table
- [ ] Can upgrade user to `platform_admin` role
- [ ] Can login with test user
- [ ] User can access platform admin pages in your app

---

## 🔄 Re-enabling Audit Logging (if you used Quick Fix)

After you've fixed the `audit_logs` table, re-enable the trigger:

```sql
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
```

---

## ❓ Troubleshooting

**Q: Still getting "Database error creating new user"?**
- Make sure you ran the SQL fix in Supabase
- Check SQL Editor for any error messages
- Try the Quick Fix option first (it's guaranteed to work)

**Q: Users are created but they can't login?**
- Check if email confirmation is required in Supabase settings
- Verify the user exists: `SELECT * FROM auth.users WHERE email = 'test@test.com'`

**Q: Want to delete test users?**
```sql
-- This deletes from auth and cascades to profiles
DELETE FROM auth.users WHERE email = 'test@test.com';
```

---

## 📚 Related Files

- `QUICK_FIX_USER_CREATION.sql` - Fastest fix (disable audit trigger)
- `FIX_USER_CREATION_FOR_TESTING.sql` - Complete fix (recreate audit_logs)
- `CREATE_PLATFORM_ADMIN_USER.sql` - Upgrade user to platform_admin
- `FIX_USER_CREATION_ERROR.sql` - Original diagnosis (replaced by above files)

---

**Last Updated:** 2026-03-14
