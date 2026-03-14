# 🔐 Role Configuration Verification Report

## ❌ **CRITICAL ISSUES FOUND**

Your app **does NOT match** the required role structure. Multiple roles are missing from both the database schema and application routes.

---

## 📊 Current vs Required Roles

| Required Role | Database Status | App Routes Status | Dashboard Status |
|--------------|----------------|------------------|------------------|
| `platform_admin` | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** |
| `owner` | ✅ EXISTS | ✅ EXISTS | ✅ EXISTS |
| `manager` | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** |
| `staff` | ✅ EXISTS | ✅ EXISTS | ✅ EXISTS |
| `promoter` | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** |
| `vip_host` | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** |
| `customer` | ✅ EXISTS | ✅ EXISTS | ✅ EXISTS |

### Current Database Schema
```sql
-- From: supabase/migrations/20260303000000_add_profiles_table.sql
role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'customer'))
```
**Problem:** Only 4 roles defined instead of 7.

---

## 🚨 Missing Implementations

### 1. **Platform Admin Role** ❌
**Status:** Uses `admin` instead of `platform_admin`
- **Required Pages:**
  - ✅ Admin Dashboard (exists but using wrong role name)
  - ❌ Tenant Management (missing)
  - ❌ Billing Overview (missing)
  - ❌ Platform Analytics (missing)

**Current Routes:** Using `'owner', 'admin'` together (incorrect hierarchy)

---

### 2. **Manager Role** ❌
**Status:** Completely missing
- **Required Pages:**
  - ❌ Manager Dashboard (missing)
  - ❌ Staff Management (limited access)
  - ❌ Analytics (limited view)
  - ❌ Reservations Management
  - ❌ Guest Lists
  - ❌ POS Monitoring

**Permissions Required:**
- View reports
- Approve reservations
- Manage guest lists
- Monitor POS
- Track staff performance
- **CANNOT:** Change billing, delete venue, modify subscription

---

### 3. **Promoter Role** ❌
**Status:** Completely missing
- **Required Pages:**
  - ❌ Promoter Dashboard (missing)
  - ❌ Guest List Management (missing)
  - ❌ Event Invitations (missing)
  - ❌ Commission Tracking (missing)
  - ❌ Guest Attendance Reports (missing)

**Note:** Some guest list functionality exists but not accessible by promoter role.

---

### 4. **VIP Host Role** ❌
**Status:** Completely missing
- **Required Pages:**
  - ❌ VIP Host Dashboard (missing)
  - ❌ Table Reservations Management (missing)
  - ❌ Bottle Service Orders (missing)
  - ❌ VIP Guest Management (missing)
  - ❌ Table Spend Monitoring (missing)

**Note:** VIP Tables dashboard exists (`/owner/vip-tables`) but only accessible by owner/admin.

---

## 📄 Current Route Configuration Issues

### App.jsx Route Problems:

```jsx
// ❌ WRONG: Using 'admin' instead of 'platform_admin'
<ProtectedRoute allowedRoles={['owner', 'admin']}>

// ❌ WRONG: 'bartender' role mentioned but not in database
<ProtectedRoute allowedRoles={['staff', 'bartender', 'admin']}>

// ❌ MISSING: No routes for manager, promoter, vip_host
```

### Dashboard.jsx Switch Statement Issues:

```jsx
switch (userProfile.role.toLowerCase()) {
  case 'owner':
  case 'admin':          // ❌ Should be 'platform_admin'
    return <OwnerDashboard />;
  case 'staff':
    return <StaffDashboard />;
  case 'customer':
    return <CustomerDashboard />;
  // ❌ MISSING: manager, promoter, vip_host cases
}
```

---

## 🔍 Permission Matrix Verification

| Action | Platform Admin | Owner | Manager | Staff | Promoter | VIP Host | Customer |
|--------|---------------|-------|---------|-------|----------|----------|----------|
| Manage venues | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage staff | ❌ | ✅ | ⚠️ Limited | ❌ | ❌ | ❌ | ❌ |
| POS sales | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create guest list | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Manage VIP tables | ❌ | ✅ | ⚠️ View | ❌ | ❌ | ✅ | ❌ |
| Reserve table | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View analytics | ✅ | ✅ | ⚠️ Limited | ❌ | ⚠️ Commission | ❌ | ❌ |

**Legend:**
- ✅ Implemented correctly
- ⚠️ Needs implementation
- ❌ Not applicable

---

## 🛠️ Required Fixes

### 1. **Database Migration** (CRITICAL)
Update the role CHECK constraint:

```sql
-- NEW MIGRATION NEEDED
ALTER TABLE profiles 
DROP CONSTRAINT profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('platform_admin', 'owner', 'manager', 'staff', 'promoter', 'vip_host', 'customer'));

-- Update existing 'admin' records to 'platform_admin'
UPDATE profiles 
SET role = 'platform_admin' 
WHERE role = 'admin';
```

---

### 2. **Create Missing Dashboard Pages**
- `src/pages/ManagerDashboard.jsx`
- `src/pages/PromoterDashboard.jsx`
- `src/pages/VIPHostDashboard.jsx`
- `src/pages/PlatformAdminDashboard.jsx`

---

### 3. **Create Missing Role-Specific Pages**

#### Manager Pages:
- `src/pages/manager/StaffManagementPage.jsx`
- `src/pages/manager/ReservationsPage.jsx`
- `src/pages/manager/GuestListsPage.jsx`
- `src/pages/manager/POSMonitoringPage.jsx`

#### Promoter Pages:
- `src/pages/promoter/GuestListPage.jsx`
- `src/pages/promoter/CommissionTrackingPage.jsx`
- `src/pages/promoter/EventInvitationsPage.jsx`

#### VIP Host Pages:
- `src/pages/vip-host/TableReservationsPage.jsx`
- `src/pages/vip-host/BottleServicePage.jsx`
- `src/pages/vip-host/VIPGuestsPage.jsx`

#### Platform Admin Pages:
- `src/pages/platform-admin/TenantManagementPage.jsx`
- `src/pages/platform-admin/BillingOverviewPage.jsx`
- `src/pages/platform-admin/PlatformAnalyticsPage.jsx`

---

### 4. **Update App.jsx Routes**

```jsx
// Platform Admin routes
<Route path="/platform-admin/tenants" element={
  <ProtectedRoute allowedRoles={['platform_admin']}>
    <TenantManagementPage />
  </ProtectedRoute>
} />

// Manager routes
<Route path="/manager/staff" element={
  <ProtectedRoute allowedRoles={['manager']}>
    <StaffManagementPage />
  </ProtectedRoute>
} />

// Promoter routes
<Route path="/promoter/guest-lists" element={
  <ProtectedRoute allowedRoles={['promoter']}>
    <GuestListPage />
  </ProtectedRoute>
} />

// VIP Host routes
<Route path="/vip-host/tables" element={
  <ProtectedRoute allowedRoles={['vip_host']}>
    <TableReservationsPage />
  </ProtectedRoute>
} />
```

---

### 5. **Update Dashboard.jsx Routing**

```jsx
switch (userProfile.role.toLowerCase()) {
  case 'platform_admin':
    return <PlatformAdminDashboard />;
  case 'owner':
    return <OwnerDashboard />;
  case 'manager':
    return <ManagerDashboard />;
  case 'staff':
    return <StaffDashboard />;
  case 'promoter':
    return <PromoterDashboard />;
  case 'vip_host':
    return <VIPHostDashboard />;
  case 'customer':
    return <CustomerDashboard />;
  default:
    // Error handling
}
```

---

### 6. **Update DashboardLayout.jsx Navigation**

Add role-specific navigation links for each new role.

---

## 📋 Implementation Checklist

- [ ] Create database migration to add missing roles
- [ ] Update all references from `admin` to `platform_admin`
- [ ] Create Manager dashboard and pages
- [ ] Create Promoter dashboard and pages
- [ ] Create VIP Host dashboard and pages
- [ ] Create Platform Admin pages for tenant management
- [ ] Update App.jsx with all role routes
- [ ] Update Dashboard.jsx with all role cases
- [ ] Update DashboardLayout.jsx navigation
- [ ] Update AuthContext to handle new roles
- [ ] Update ProtectedRoute component
- [ ] Remove hardcoded `'bartender'` role references
- [ ] Test role-based access control for all 7 roles
- [ ] Update RLS policies for new roles
- [ ] Document role hierarchy in code

---

## 🎯 Priority Order

### **Phase 1: Critical (Database & Core Routing)**
1. Database migration for role constraint
2. Update Dashboard.jsx routing
3. Update App.jsx route structure

### **Phase 2: Manager Role (High Priority)**
4. Create ManagerDashboard
5. Implement manager pages
6. Add manager routes

### **Phase 3: VIP Host & Promoter (Medium Priority)**
7. Create VIPHostDashboard
8. Create PromoterDashboard
9. Implement respective pages

### **Phase 4: Platform Admin (Optional if you're the only admin)**
10. Rename admin to platform_admin
11. Create platform admin pages

---

## ⚠️ Current Security Risks

1. **Role Confusion:** Using `admin` and `owner` interchangeably creates permission leaks
2. **Missing Role Enforcement:** New roles can't be created in database
3. **Incomplete Access Control:** VIP tables accessible by wrong roles
4. **No Manager Oversight:** Can't delegate without manager role

---

## 📞 Next Steps

Would you like me to:
1. **Create the database migration** to add missing roles?
2. **Generate the missing dashboard pages** for each role?
3. **Update the routing configuration** in App.jsx and Dashboard.jsx?
4. **Implement role-specific navigation** in DashboardLayout?

Let me know which phase you'd like to start with!
