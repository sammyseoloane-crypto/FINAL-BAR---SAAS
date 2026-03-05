# Row Level Security (RLS) Policies Reference

## Overview
All tables have RLS enabled with tenant-aware policies based on user roles and data ownership.

## Role Hierarchy
- **Owner**: Full access to all tenant data
- **Admin**: Full access to all tenant data (similar to owner)
- **Staff**: Limited access based on assignments and location
- **Customer**: Only access to their own data

---

## Table-by-Table Policy Breakdown

### 1. TENANTS
**Principle**: Only owners and admins can view their tenant

| Action | Who | Access |
|--------|-----|--------|
| SELECT | Owner/Admin | Their own tenant only |
| UPDATE | Owner/Admin | Their own tenant only |
| INSERT | - | Not allowed via RLS |
| DELETE | - | Not allowed via RLS |

---

### 2. LOCATIONS
**Principle**: Tenant-scoped with admin management

| Action | Who | Access |
|--------|-----|--------|
| SELECT | All authenticated | Locations in their tenant |
| INSERT/UPDATE/DELETE | Owner/Admin | All tenant locations |

---

### 3. USERS
**Principle**: Owner/Admin sees all tenant users, Staff sees limited info, users see themselves

| Action | Who | Access |
|--------|-----|--------|
| SELECT | Owner/Admin | All users in their tenant |
| SELECT | Staff | All users in their tenant (limited) |
| SELECT | Any user | Their own profile |
| UPDATE | Any user | Their own profile only |
| UPDATE | Owner/Admin | All tenant users |
| INSERT | Owner/Admin | Create new tenant users |
| DELETE | Owner/Admin | Delete tenant users |

---

### 4. PRODUCTS
**Principle**: Owner/Admin can manage, Staff/Customers can view by location & tenant

| Action | Who | Access |
|--------|-----|--------|
| SELECT | Authenticated users | Products in their tenant |
| SELECT | Anonymous | All products (for customer apps) |
| ALL (INSERT/UPDATE/DELETE) | Owner/Admin | All tenant products |
| ALL (INSERT/UPDATE/DELETE) | Staff | Products in their tenant |

---

### 5. EVENTS
**Principle**: Owner/Admin can manage, Staff/Customers can view active events

| Action | Who | Access |
|--------|-----|--------|
| SELECT | Owner/Admin/Staff | All tenant events (including inactive) |
| SELECT | Customers/Anonymous | Active events only |
| INSERT/UPDATE/DELETE | Owner/Admin | All tenant events |

---

### 6. TASKS
**Principle**: Staff can view only assigned tasks, Owner/Admin sees all tenant tasks

| Action | Who | Access |
|--------|-----|--------|
| SELECT | Staff | Only tasks assigned to them |
| SELECT | Owner/Admin | All tasks in their tenant |
| UPDATE | Staff | Only their assigned tasks |
| ALL (INSERT/UPDATE/DELETE) | Owner/Admin | All tenant tasks |

**Key Features**:
- ✅ Staff isolation: Staff members only see tasks assigned to them
- ✅ Admin oversight: Owners/Admins have full visibility
- ✅ Status tracking: Task updates limited to assignees and admins

---

### 7. TRANSACTIONS
**Principle**: Customers see only their own, Staff can view and confirm at location, Owner/Admin sees all

| Action | Who | Access |
|--------|-----|--------|
| SELECT | Customer | Only their own transactions |
| SELECT | Staff | All transactions in their tenant |
| SELECT | Owner/Admin | All tenant transactions |
| INSERT | Customer | Create their own transactions |
| UPDATE | Staff | Confirm pending transactions only |
| ALL (INSERT/UPDATE/DELETE) | Owner/Admin | All tenant transactions |

**Key Features**:
- ✅ Customer privacy: Customers only see their purchases
- ✅ Staff confirmation: Staff can confirm pending transactions
- ✅ Location-aware: Staff operations scoped to their tenant
- ✅ Full admin control: Owners/Admins can manage all transactions

---

### 8. QR_CODES
**Principle**: Customers see only their QR, Staff/Owner/Admin can scan/validate at location

| Action | Who | Access |
|--------|-----|--------|
| SELECT | Customer | Only their own QR codes |
| SELECT | Staff/Owner/Admin | QR codes for tenant transactions |
| INSERT | Customer | Create their own QR codes |
| UPDATE | Staff/Owner/Admin | Scan and update QR codes for tenant transactions |
| ALL | Owner/Admin | All tenant QR codes |

**Key Features**:
- ✅ Customer privacy: Customers can't see others' QR codes
- ✅ Staff scanning: Staff can scan QR codes at their location
- ✅ Validation tracking: Updates track who scanned and when
- ✅ Tenant isolation: Staff can only scan QR codes for their tenant

---

## Multi-Tenancy Enforcement

All policies enforce tenant isolation through:

```sql
-- Example: Checking if user belongs to tenant
tenant_id IN (
  SELECT tenant_id FROM users 
  WHERE id = auth.uid() AND role = 'staff'
)
```

## Security Features

1. **Tenant Isolation**: Users can only access data from their tenant
2. **Role-Based Access**: Different permissions based on user role
3. **Resource Ownership**: Users can always access their own data
4. **Location Awareness**: Staff operations can be scoped to specific locations
5. **Status-Based Access**: E.g., staff can only update pending transactions

## Testing Policies

To test RLS policies, you can use Supabase's built-in testing or:

```sql
-- Set the current user context
SET request.jwt.claims.sub = 'user-uuid-here';

-- Now queries will respect RLS for that user
SELECT * FROM transactions;  -- Will only return rows user can access
```

## Best Practices

1. **Always use auth.uid()**: Reference the authenticated user's ID
2. **Explicit role checks**: Always verify role before granting access
3. **Use WITH CHECK**: For INSERT/UPDATE operations, use WITH CHECK clause
4. **Test thoroughly**: Test each role's access patterns
5. **Audit regularly**: Review policies as requirements change

## Common Patterns

### Pattern 1: User's Own Data
```sql
CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  USING (user_id = auth.uid());
```

### Pattern 2: Tenant-Scoped Access
```sql
CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
```

### Pattern 3: Role-Based Access
```sql
CREATE POLICY "policy_name" ON table_name
  FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM users 
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  ));
```

### Pattern 4: Assignment-Based Access
```sql
CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  USING (
    assigned_to = auth.uid() 
    AND tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
```

---

## Troubleshooting

### Issue: "Row level security policy violation"
- Check if user is authenticated (`auth.uid()` returns a value)
- Verify user has correct role for the operation
- Confirm user belongs to correct tenant

### Issue: "Permission denied for table"
- Ensure RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Check if policies exist: `SELECT * FROM pg_policies WHERE tablename = 'your_table';`

### Issue: Anonymous access not working
- Add `OR auth.uid() IS NULL` for public access
- Ensure anon key has correct permissions in Supabase dashboard
