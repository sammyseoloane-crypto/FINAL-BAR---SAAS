# Multi-Tenant Testing Guide

## Quick Test Suite
Follow these steps to verify tenant isolation is working correctly.

---

## 🧪 Test 1: Owner Tenant Creation

### Steps:
1. **Open app**: http://localhost:5174
2. **Click "Create Account"**
3. **Fill registration form**:
   - Email: `owner-bar-a@test.com`
   - Role: `Bar Owner`
   - Business Name: `Bar A`
   - Password: `test123`
   - Confirm Password: `test123`
4. **Click "Create Account"**
5. **Login with above credentials**

### Expected Result:
✅ New tenant "Bar A" is created
✅ Owner is assigned to "Bar A"
✅ Dashboard loads successfully
✅ TenantDebugPanel shows "Bar A" tenant info

---

## 🧪 Test 2: Second Tenant Creation

### Steps:
1. **Sign out from Bar A**
2. **Register new owner**:
   - Email: `owner-bar-b@test.com`
   - Role: `Bar Owner`
   - Business Name: `Bar B`
   - Password: `test123`
3. **Login with Bar B credentials**

### Expected Result:
✅ New tenant "Bar B" is created (separate from Bar A)
✅ Owner is assigned to "Bar B"
✅ TenantDebugPanel shows "Bar B" tenant info
✅ **Different Tenant ID** from Bar A

---

## 🧪 Test 3: Data Isolation - Products

### Setup:
- **Bar A Owner** logged in

### Steps:
1. **Navigate to "Products"**
2. **Add product**:
   - Name: `Bar A Special Beer`
   - Price: `50`
   - Type: `Drink`
   - Click "Add Product"
3. **Sign out**
4. **Login as Bar B Owner**
5. **Navigate to "Products"**
6. **Add product**:
   - Name: `Bar B Premium Wine`
   - Price: `120`
   - Type: `Drink`
7. **Check products list**

### Expected Result:
✅ Bar A Owner sees **ONLY** "Bar A Special Beer"
✅ Bar B Owner sees **ONLY** "Bar B Premium Wine"
✅ Products are **NOT** visible across tenants
❌ **FAIL if**: Bar B sees Bar A's products

---

## 🧪 Test 4: Data Isolation - Events

### Setup:
- Two owners logged in (use different browsers)

### Steps:
1. **Bar A Owner**: Create event "Bar A Summer Party" with R50 entry
2. **Bar B Owner**: Create event "Bar B Jazz Night" with R100 entry
3. **Verify each owner's event list**

### Expected Result:
✅ Bar A sees only "Bar A Summer Party"
✅ Bar B sees only "Bar B Jazz Night"
✅ Events are isolated per tenant

---

## 🧪 Test 5: Staff Tenant Assignment

### Setup:
- Bar A Owner logged in

### Steps:
1. **Sign out**
2. **Register as Staff**:
   - Email: `staff-bar-a@test.com`
   - Role: `Staff`
   - **Select Bar**: `Bar A` (from dropdown)
   - Password: `test123`
3. **Login as staff**
4. **Check TenantDebugPanel**

### Expected Result:
✅ Staff is assigned to "Bar A" tenant
✅ Staff sees Bar A's tenant_id in debug panel
✅ Staff can only see Bar A's data

---

## 🧪 Test 6: Customer Tenant Assignment

### Steps:
1. **Register as Customer**:
   - Email: `customer-bar-a@test.com`
   - Role: `Customer`
   - **Select Bar**: `Bar A`
   - Password: `test123`
2. **Login**
3. **Navigate to Events**

### Expected Result:
✅ Customer sees events from Bar A only
✅ Customer assigned to Bar A tenant
✅ Cannot see Bar B's events

---

## 🧪 Test 7: Task Assignment Isolation

### Setup:
- Bar A Owner creates 2 staff members (use different emails)
- Create tasks for each staff

### Steps:
1. **Bar A Owner**: 
   - Create Task 1 → Assign to Staff 1
   - Create Task 2 → Assign to Staff 2
2. **Login as Staff 1**
3. **Navigate to "My Tasks"**
4. **Logout and login as Staff 2**
5. **Navigate to "My Tasks"**

### Expected Result:
✅ Staff 1 sees **ONLY** Task 1
✅ Staff 2 sees **ONLY** Task 2
✅ Staff cannot see each other's tasks

---

## 🧪 Test 8: Transaction Isolation

### Steps:
1. **Login as Customer A (Bar A)**
2. **Purchase event ticket** (creates transaction)
3. **Logout**
4. **Login as Bar A Staff**
5. **Navigate to Payments**
6. **Verify transaction appears**
7. **Logout**
8. **Login as Bar B Staff**
9. **Navigate to Payments**

### Expected Result:
✅ Bar A Staff sees Customer A's transaction
✅ Bar B Staff sees **NO** transactions from Bar A
✅ Transactions are tenant-isolated

---

## 🧪 Test 9: Database RLS Verification

### Steps:
1. **Open Supabase Dashboard**
2. **Navigate to Table Editor**
3. **Open "products" table**
4. **Check RLS Policies tab**

### Expected Result:
✅ RLS is **ENABLED** on products table
✅ Policies exist for tenant isolation
✅ Policy names include "tenant" references

### Verify for these tables:
- [ ] tenants
- [ ] locations
- [ ] users
- [ ] products
- [ ] events
- [ ] tasks
- [ ] transactions
- [ ] qr_codes

---

## 🧪 Test 10: Console Debugging

### Steps:
1. **Login to any account**
2. **Open TenantDebugPanel** (bottom right)
3. **Click "Log to Console"**
4. **Open Browser DevTools** (F12)
5. **Check Console tab**

### Expected Result:
✅ See tenant information logged:
```
=== TENANT DEBUG INFO ===
Tenant ID: abc-123-xyz
Tenant Name: Bar A
User Role: owner
User Email: owner-bar-a@test.com
========================
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Please select a bar location"
**Cause**: No active tenants exist for staff/customer registration
**Solution**: Register at least one owner first to create a tenant

### Issue 2: TenantDebugPanel not showing
**Cause**: Running in production mode
**Solution**: Make sure you're running `npm run dev` (not build)

### Issue 3: Cross-tenant data visible
**Cause**: RLS policies not applied or queries missing tenant_id filter
**Solution**: 
1. Re-run database migration
2. Verify RLS is enabled
3. Check queries include `.eq('tenant_id', ...)`

### Issue 4: "tenant_id violates foreign key constraint"
**Cause**: Using invalid tenant_id or tenant doesn't exist
**Solution**: Ensure tenant exists before assigning users to it

---

## ✅ Success Criteria

Your multi-tenant implementation is correct if:

- [ ] Each owner creates a separate tenant
- [ ] Products are isolated per tenant
- [ ] Events are isolated per tenant  
- [ ] Staff see only their assigned tasks
- [ ] Customers see only their transactions
- [ ] TenantDebugPanel shows correct tenant info
- [ ] Console logs show proper tenant_id
- [ ] RLS policies are enabled on all tables
- [ ] No cross-tenant data leakage

---

## 📊 Test Data Matrix

| User Type | Tenant | Can See | Cannot See |
|-----------|--------|---------|------------|
| Owner A | Bar A | Bar A data | Bar B data |
| Owner B | Bar B | Bar B data | Bar A data |
| Staff A | Bar A | Bar A tasks (assigned) | Bar B tasks |
| Customer A | Bar A | Bar A events/menus | Bar B events |

---

## 🔧 Debug Commands

### Check tenant in database:
```sql
-- In Supabase SQL Editor
SELECT * FROM tenants;
```

### Check user-tenant assignments:
```sql
SELECT id, email, role, tenant_id 
FROM users 
ORDER BY created_at DESC;
```

### Verify product isolation:
```sql
SELECT p.name, t.name as tenant_name
FROM products p
JOIN tenants t ON p.tenant_id = t.id
ORDER BY t.name;
```

---

## 📝 Test Checklist

Print this and check off as you test:

```
TENANT CREATION
[ ] Owner registration creates new tenant
[ ] Staff can select existing tenant
[ ] Customer can select existing tenant

DATA ISOLATION
[ ] Products isolated per tenant
[ ] Events isolated per tenant
[ ] Locations isolated per tenant
[ ] Tasks assigned per tenant
[ ] Transactions isolated per tenant
[ ] QR codes isolated per tenant

ROLE-BASED ACCESS
[ ] Owner sees all tenant data
[ ] Admin sees all tenant data
[ ] Staff sees only assigned tasks
[ ] Customer sees only own transactions

DATABASE SECURITY
[ ] RLS enabled on all tables
[ ] Policies enforce tenant_id filtering
[ ] Cannot access other tenant's data via API

UI/UX
[ ] TenantDebugPanel shows correct info
[ ] Navigation appropriate per role
[ ] Sign out clears tenant context
```

---

## 🎓 Advanced Testing

### SQL Injection Test (Should FAIL):
```javascript
// Try malicious input in product name
const maliciousName = "'; DROP TABLE products; --"
// Should be safely escaped by Supabase
```

### Direct API Test (Should be BLOCKED by RLS):
```javascript
// Try accessing other tenant's data
const { data } = await supabase
  .from('products')
  .select('*')
  // Even without tenant_id filter, RLS should block
```

---

**🎉 If all tests pass, your multi-tenant system is secure!**
