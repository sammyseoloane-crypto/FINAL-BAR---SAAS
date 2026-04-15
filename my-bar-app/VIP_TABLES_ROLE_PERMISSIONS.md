# VIP Tables - Role-Based Access Control

## ✅ Implementation Complete

Role-based permissions have been implemented for VIP Tables management with different access levels for Owners and Managers.

---

## 👑 Owner Permissions (Full Control)

Owners have **complete administrative control** over VIP tables:

### ✅ Can Do:
- ✓ **Create** new VIP tables
- ✓ **Edit** all table properties (name, capacity, type, zone, pricing)
- ✓ **Disable** tables (soft delete - hides table but keeps data)
- ✓ **Permanently Delete** tables (hard delete - removes all data)
- ✓ **Update Pricing** (minimum spend, deposits)
- ✓ **Assign Locations** (zones, areas)
- ✓ **Set Capacity** (maximum guests)
- ✓ **Make Reservations**

### UI Features:
- 🟢 **"Create New Table"** button visible
- 🔵 **"Edit Table"** button on all tables
- 🟡 **"Update Pricing"** button on all tables
- 🟠 **"Disable"** button on all tables
- 🔴 **"Delete"** button on all tables (Owner only)

### Safety:
- Permanent deletes require **double confirmation**
- Warning dialog explains consequences
- Soft delete option available as safer alternative

---

## 🧑‍💼 Manager Permissions (Operational Control)

Managers can **manage day-to-day operations** but cannot permanently delete:

### ✅ Can Do:
- ✓ **Create** new VIP tables
- ✓ **Edit** table properties
- ✓ **Disable** tables (soft delete)
- ✓ **Update Pricing** (minimum spend, deposits)  
- ✓ **Assign Sections** (zones, areas)
- ✓ **Set Capacity**
- ✓ **Make Reservations**

### ❌ Cannot Do:
- ✗ **Permanently Delete** tables (Owner only)

### UI Features:
- 🟢 **"Create New Table"** button visible
- 🔵 **"Edit Table"** button on all tables
- 🟡 **"Update Pricing"** button on all tables
- 🟠 **"Disable"** button on all tables
- ⚫ **"Delete"** button **hidden** (not available)

### Rationale:
- Prevents accidental data loss
- Requires owner approval for permanent changes
- Managers can disable tables for operational needs
- Owners can review and permanently delete if needed

---

## 🔒 Permission Functions

### Permission Checkers:
```javascript
canCreateTables()   // Owner OR Manager
canEditTables()     // Owner OR Manager  
canDisableTables()  // Owner OR Manager
canDeleteTables()   // Owner ONLY
```

### Action Handlers:
- `handleCreateTable()` - Creates new table
- `handleUpdateTable()` - Updates existing table
- `handleDisableTable()` - Soft delete (is_active = false)
- `handleDeleteTable()` - Hard delete (permanent removal)

---

## 🎨 Visual Design

### Button Colors:
- **Create** (Green) - `linear-gradient(135deg, #10b981 0%, #059669 100%)`
- **Edit** (Blue) - `rgba(59, 130, 246, 0.2)` with blue text
- **Pricing** (White/Gray) - `rgba(255, 255, 255, 0.1)`
- **Disable** (Orange) - `rgba(251, 146, 60, 0.2)` with orange text
- **Delete** (Red) - `rgba(239, 68, 68, 0.2)` with red text

### Responsive Grid:
- Buttons use `grid-template-columns: repeat(auto-fit, minmax(100px, 1fr))`
- Automatically adjusts based on available buttons
- Managers see 4 buttons, Owners see 5 buttons

---

## 🛡️ Database Security

### Row Level Security (RLS):
Tables are protected by RLS policies in Supabase:

```sql
CREATE POLICY tables_tenant_isolation ON tables
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
```

Users can only access tables in their own tenant, regardless of role.

### Soft Delete vs Hard Delete:

**Soft Delete (Disable):**
- Sets `is_active = false`
- Table hidden from view
- Data preserved
- Can be re-enabled
- ✅ Available to: Manager, Owner

**Hard Delete (Permanent):**
- Removes row from database
- All data permanently lost
- Cannot be undone
- ⚠️ Available to: Owner ONLY

---

## 📱 User Experience

### Manager View:
1. Opens `/owner/vip-tables`
2. Sees **"Create New Table"** button
3. Can edit, disable, and update pricing on all tables
4. **No delete button** to prevent accidental permanent deletion

### Owner View:
1. Opens `/owner/vip-tables`
2. Sees **"Create New Table"** button
3. Can edit, disable, update pricing, **and delete** tables
4. Delete requires **double confirmation** for safety

### Confirmation Dialogs:

**Disable:**
```
Are you sure you want to disable "VIP Table 1"? 
This will hide the table but keep all data.
```

**Delete (First Confirmation):**
```
⚠️ PERMANENT DELETE: Are you sure you want to permanently delete "VIP Table 1"? 
This action cannot be undone and will remove all associated data.
```

**Delete (Second Confirmation):**
```
Final confirmation: Type YES to permanently delete "VIP Table 1"
```

---

## 🔍 Role Detection

The system automatically detects user roles from the `profiles` table:

```javascript
const { data: profile } = await supabase
  .from('profiles')
  .select('tenant_id, role')
  .eq('id', user.id)
  .single();

setUserRole(profile.role); // 'owner' or 'manager'
```

### Valid Roles:
- `owner` - Full administrative access
- `manager` - Operational access (no permanent delete)
- Other roles (staff, customer) - No VIP table management access

---

## 🎯 Implementation Files

### Modified Files:
1. **VIPTablesDashboard.jsx**
   - Added role state and permission functions
   - Added disable and delete handlers
   - Conditional rendering of buttons
   - Double confirmation for deletes

2. **VIPTablesDashboard.css**
   - Added `.btn-disable` styles (orange)
   - Added `.btn-delete` styles (red)
   - Updated grid for flexible button layout

### Key Features:
- ✅ Role-based UI rendering
- ✅ Permission validation before actions
- ✅ Soft delete for managers
- ✅ Hard delete for owners only
- ✅ Double confirmation for permanent actions
- ✅ Clear visual distinction between actions

---

## 🚀 Testing

### As Owner:
1. Login as user with `role = 'owner'`
2. Navigate to `/owner/vip-tables`
3. Verify you see all 5 buttons: Reserve, Edit, Pricing, Disable, Delete
4. Test creating a table
5. Test deleting a table (should require double confirmation)

### As Manager:
1. Login as user with `role = 'manager'`
2. Navigate to `/owner/vip-tables`
3. Verify you see 4 buttons: Reserve, Edit, Pricing, Disable (NO Delete)
4. Test creating a table
5. Test disabling a table
6. Verify delete button is not visible

---

## 📝 Summary

✅ **Owners** have full control including permanent deletion  
✅ **Managers** can manage operations but not permanently delete  
✅ **Permission checks** prevent unauthorized actions  
✅ **UI adapts** based on user role  
✅ **Safety confirmations** for critical actions  
✅ **Soft delete** available as safer alternative  

The VIP Tables system now has proper role-based access control that balances operational flexibility with data protection! 🎉
