# Multi-Tenant Architecture Documentation

## Overview
This application implements a **strict multi-tenant architecture** where each tenant (bar business) has complete data isolation from other tenants.

---

## Tenant Isolation Strategy

### 1. Database Level (Primary Defense)
**Row Level Security (RLS) Policies** on all tables ensure:
- Users can only access data belonging to their `tenant_id`
- Even if application code has bugs, database enforces isolation
- Automatic filtering based on authenticated user's tenant

### 2. Application Level (Secondary Defense)
All queries explicitly filter by `tenant_id`:
```javascript
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', userProfile.tenant_id) // ✅ Explicit filter
```

### 3. Context Level (User State)
`AuthContext` provides:
- `user` - Supabase auth user
- `userProfile` - Contains `tenant_id`, `role`, etc.

---

## Tenant Creation Flow

### Owner Registration
```
1. Owner registers with business name
   └─→ New tenant created in `tenants` table
       └─→ User created with tenant_id reference
           └─→ Owner assigned to their new tenant
```

**Code:** See `AuthContext.signUp()` - lines 60-80

### Staff/Customer Registration  
```
1. Staff/Customer selects existing bar from dropdown
   └─→ User created with selected tenant_id
       └─→ User associated with existing tenant
```

**Code:** See `Register.jsx` - tenant selection dropdown

---

## Data Relationships

### Tenant → Locations → Products
```
tenant (Bar Biz)
  ├─ location_1 (Downtown Branch)
  │   ├─ product_1 (Beer)
  │   └─ product_2 (Wine)
  └─ location_2 (Uptown Branch)
      └─ product_3 (Cocktail)
```

### Tenant → Users by Role
```
tenant (Bar Biz)
  ├─ owner (full access)
  ├─ admin (full access)
  ├─ staff_1 (assigned tasks only)
  ├─ staff_2 (assigned tasks only)
  ├─ customer_1 (own transactions only)
  └─ customer_2 (own transactions only)
```

---

## RLS Policy Patterns

### Pattern 1: User's Own Data
```sql
CREATE POLICY "Users see their own transactions"
  ON transactions FOR SELECT
  USING (user_id = auth.uid());
```

### Pattern 2: Tenant-Wide Data (Owner/Admin)
```sql
CREATE POLICY "Owners see all tenant products"
  ON products FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM users 
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  ));
```

### Pattern 3: Assigned Data (Staff)
```sql
CREATE POLICY "Staff see assigned tasks"
  ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() AND role = 'staff'
    )
  );
```

---

## Query Guidelines

### ✅ CORRECT: Always filter by tenant_id
```javascript
// Owner viewing all products
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', userProfile.tenant_id) // ✅

// Customer viewing their transactions
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', user.id)
  .eq('tenant_id', userProfile.tenant_id) // ✅ Extra safety
```

### ✅ CORRECT: Insert with tenant_id
```javascript
const { error } = await supabase
  .from('products')
  .insert([{
    name: 'Beer',
    price: 30,
    tenant_id: userProfile.tenant_id // ✅ Required
  }])
```

### ✅ CORRECT: Update with tenant_id verification
```javascript
const { error } = await supabase
  .from('products')
  .update({ price: 35 })
  .eq('id', productId)
  .eq('tenant_id', userProfile.tenant_id) // ✅ Prevents cross-tenant updates
```

### ❌ WRONG: No tenant_id filter
```javascript
// ❌ BAD - might expose cross-tenant data if RLS disabled
const { data } = await supabase
  .from('products')
  .select('*')
  // Missing .eq('tenant_id', ...)
```

---

## Utility Functions

Use `src/utils/tenantUtils.js` for safer queries:

### tenantInsert
```javascript
import { tenantInsert } from '../utils/tenantUtils'

await tenantInsert('products', {
  name: 'Beer',
  price: 30
}, userProfile.tenant_id)
// Automatically adds tenant_id
```

### tenantUpdate
```javascript
import { tenantUpdate } from '../utils/tenantUtils'

await tenantUpdate('products', 
  { price: 35 },
  productId,
  userProfile.tenant_id
)
// Verifies tenant_id before updating
```

### tenantQuery
```javascript
import { tenantQuery } from '../utils/tenantUtils'

const query = tenantQuery('products', userProfile.tenant_id)
const { data } = await query.eq('available', true)
// Automatically filters by tenant_id
```

---

## Security Checklist

Before deploying to production:

- [ ] All RLS policies enabled on all tables
- [ ] All queries include `.eq('tenant_id', userProfile.tenant_id)`
- [ ] Insert operations include `tenant_id` in data
- [ ] Update operations verify `tenant_id` matches
- [ ] Delete operations verify `tenant_id` matches
- [ ] No raw SQL bypassing RLS
- [ ] No admin backdoors that skip tenant checking
- [ ] Test with multiple tenants to verify isolation

---

## Testing Multi-Tenancy

### Test Scenario 1: Cross-Tenant Isolation
```
1. Register Owner A → Creates Tenant A
2. Register Owner B → Creates Tenant B
3. Owner A creates Product X
4. Owner B creates Product Y
5. Verify:
   - Owner A sees only Product X
   - Owner B sees only Product Y
   - Products are NOT visible across tenants
```

### Test Scenario 2: Staff Isolation
```
1. Owner creates Task 1 assigned to Staff A
2. Owner creates Task 2 assigned to Staff B
3. Verify:
   - Staff A sees only Task 1
   - Staff B sees only Task 2
   - Staff cannot see each other's tasks
```

### Test Scenario 3: Customer Isolation
```
1. Customer A creates Transaction 1
2. Customer B creates Transaction 2
3. Verify:
   - Customer A sees only Transaction 1
   - Customer B sees only Transaction 2
   - Customers cannot see each other's transactions
```

---

## Common Pitfalls

### ❌ Pitfall 1: Forgetting tenant_id in INSERT
```javascript
// ❌ Will fail - tenant_id is required
await supabase.from('products').insert([{ name: 'Beer' }])

// ✅ Correct
await supabase.from('products').insert([{ 
  name: 'Beer', 
  tenant_id: userProfile.tenant_id 
}])
```

### ❌ Pitfall 2: Using wrong tenant_id from props/params
```javascript
// ❌ NEVER trust tenant_id from URL or props!
const tenantId = props.tenantId // ❌ Can be manipulated

// ✅ Always use from authenticated user profile
const tenantId = userProfile.tenant_id // ✅ From auth context
```

### ❌ Pitfall 3: Admin routes without tenant scope
```javascript
// ❌ BAD - admin seeing ALL tenants
SELECT * FROM products WHERE role = 'admin'

// ✅ GOOD - admin seeing only their tenant
SELECT * FROM products 
WHERE tenant_id = auth.tenant_id() 
AND role IN ('owner', 'admin')
```

---

## Architecture Benefits

1. **Data Security**: Complete isolation between tenants
2. **Scalability**: Single database serves multiple tenants
3. **Simplicity**: No complex sharding or routing
4. **Cost Effective**: Shared infrastructure
5. **Compliance**: Tenant data never mixes
6. **Performance**: RLS policies use indices efficiently

---

## File References

- **Database Schema**: `/supabase/migrations/20260217000000_initial_schema.sql`
- **Tenant Utils**: `/src/utils/tenantUtils.js`
- **Auth Context**: `/src/contexts/AuthContext.jsx`
- **Registration**: `/src/pages/Register.jsx`

---

## Support

For questions about multi-tenancy implementation:
1. Check RLS policies in Supabase dashboard
2. Use Supabase logs to debug access issues
3. Test with multiple tenant accounts
4. Review this documentation

**Remember**: When in doubt, ALWAYS filter by `tenant_id`! 🔒
