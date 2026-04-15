# Guest List Role-Based Permissions Implementation

## Overview
Implemented comprehensive role-based permissions system for guest list operations, ensuring that users can only perform actions authorized for their role.

## Permission Matrix

| Role | Add Guests | Edit All Guests | Edit Own Guests | Remove Guests | Create Lists | Delete Lists | Verify/Check-in |
|------|-----------|----------------|----------------|---------------|--------------|--------------|----------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **VIP Host** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Promoter** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Staff** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Files Created/Modified

### 1. Permission Utility (`src/utils/guestListPermissions.js`)
**Purpose**: Centralized permission logic for guest list operations

**Key Functions**:
- `getGuestListPermissions(role)` - Returns permissions object for a role
- `canAddGuests(role)` - Check if user can add guests
- `canEditGuest(role, userId, guestCreatedBy)` - Check if user can edit specific guest
- `canRemoveGuests(role)` - Check if user can remove guests
- `canVerifyGuests(role)` - Check if user can check-in guests
- `canCreateLists(role)` - Check if user can create guest lists
- `canDeleteLists(role)` - Check if user can delete guest lists
- `getPermissionSummary(role)` - Returns array of allowed actions for display

**Usage Example**:
```javascript
import { canAddGuests, canEditGuest } from '../../utils/guestListPermissions';

// Check if user can add guests
if (canAddGuests(userProfile.role)) {
  // Show add guest button
}

// Check if user can edit a specific guest
if (canEditGuest(userProfile.role, userProfile.id, guest.added_by)) {
  // Allow editing
}
```

### 2. Manager Guest Lists Page (`src/pages/manager/GuestListsPage.jsx`)
**Updates**:
- Added Add/Edit/Remove guest functionality
- Permission checks on all actions (Add, Edit, Remove, Check-in)
- Edit button only shows if user can edit that specific guest
- Remove button only shows for owners/managers
- Permission summary displayed at bottom
- Form validation and error handling

**New Features**:
- ➕ Add Guest form with name, email, phone, plus ones
- ✏️ Edit Guest form (yellow background for visibility)
- 🗑️ Remove Guest with confirmation dialog
- ✅ Check-in guests (updates checked_in status)
- 📊 Real-time guest count updates

### 3. Promoter Guest Lists Page (`src/pages/promoter/GuestListsPage.jsx`)
**Updates**:
- Added guest management UI similar to manager page
- "Manage Guests" button to view/edit guests on each list
- Add/Edit guests with role-based restrictions
- Promoters can only edit guests they added
- Promoters cannot remove guests
- Guest status set to "pending" for promoter-added guests (requires manager approval)
- Permission summary displayed

**New Features**:
- 📋 View guests on each list
- ➕ Add guests to their own lists
- ✏️ Edit only guests they added
- ✅ Check-in guests at events
- 🔒 Cannot remove guests (enforced in UI and database)

### 4. Database Migration (`supabase/migrations/20260316000000_guest_list_role_based_permissions.sql`)
**Purpose**: Enforce permissions at the database level with RLS policies

**RLS Policies Created**:

#### Guest List Entries Policies:

#### Guest List Entries Policies:
1. **guest_entries_select_policy**
   - All authenticated users in tenant can view guest entries
   
2. **guest_entries_insert_policy**
   - Owner, Manager, VIP Host, Promoter can add guests
   - Staff cannot add guests
   - Must set `added_by` to their own user ID
   
3. **guest_entries_update_policy**
   - Owner, Manager, VIP Host: Can edit all guests
   - Promoter: Can only edit guests they added (`added_by = auth.uid()`)
   - Staff: Cannot edit
   
4. **guest_entries_delete_policy**
   - Only Owner and Manager can remove guests
   - VIP Host, Promoter, Staff cannot remove

#### Guest Lists Policies:
1. **guest_lists_select_policy**
   - All authenticated users in tenant can view lists
   
2. **guest_lists_insert_policy**
   - Owner, Manager, Promoter can create lists
   
3. **guest_lists_update_policy**
   - Owner, Manager: Can update any list
   - Promoter: Can only update their own lists
   
4. **guest_lists_delete_policy**
   - Owner, Manager: Can delete any list
   - Promoter: Can only delete their own lists

## Routing and Navigation

### Routes Added (`src/App.jsx`):
- `/manager/guest-lists` - Manager guest list management (existing)
- `/promoter/guest-lists` - Promoter guest list management (existing, enhanced)
- `/vip-host/guest-lists` - VIP Host guest list management (NEW - uses ManagerGuestListsPage)
- `/staff/guest-lists` - Staff guest check-in page (NEW - uses ManagerGuestListsPage)

### Navigation Links (`src/components/DashboardLayout.jsx`):
All roles now have access to guest list functionality through their sidebar:

- **Owner/Manager**: "Guest Lists" 📋
- **VIP Host**: "Guest Lists" 📋 (added between Bottle Service and VIP Guests)
- **Promoter**: "Guest Lists" 📋
- **Staff**: "Guest Check-In" 📋 (read-only for verification)

**Design Decision**: VIP Host and Staff use the same `ManagerGuestListsPage` component, which dynamically shows/hides features based on role permissions. This ensures:
- Single source of truth for guest list UI
- Consistent behavior across roles
- Automatic permission enforcement
- Easier maintenance

## Security Features

### Frontend Validation
- Permission checks before showing buttons
- Permission checks before API calls
- User-friendly error messages
- Conditional rendering based on role

### Backend Enforcement (RLS)
- Database-level permission enforcement
- Cannot bypass with API calls
- Tenant isolation maintained
- Role-based access control

### Audit Trail
- `added_by` field tracks who created each guest entry
- `checked_in_by` field tracks who checked in guests
- Timestamps for all actions

## User Experience

### Owner/Manager Experience
✅ Full control over all guest lists and entries
✅ Can add, edit, remove any guest
✅ Can create and delete any guest list
✅ Can check-in guests at events

### VIP Host Experience
✅ Can add guests to lists
✅ Can edit all guest entries
❌ Cannot remove guests (prevents abuse)
❌ Cannot create or delete guest lists
✅ Can check-in guests

### Promoter Experience
✅ Can create their own guest lists
✅ Can add guests to their lists (pending approval)
✅ Can edit only guests they added
❌ Cannot edit guests added by others
❌ Cannot remove guests
✅ Can check-in guests
✅ Can delete their own lists

### Staff Experience
❌ Cannot add guests
❌ Cannot edit guests
❌ Cannot remove guests
❌ Cannot create/delete lists
✅ Can ONLY check-in guests (verify at door)

## Testing Checklist

### As Owner/Manager:
- [ ] Create a guest list
- [ ] Add guests to any list
- [ ] Edit any guest entry
- [ ] Remove guests
- [ ] Check-in guests
- [ ] Delete guest lists

### As VIP Host:
- [ ] Add guests to lists
- [ ] Edit any guest entry
- [ ] Verify cannot remove guests (button hidden)
- [ ] Verify cannot create lists (button hidden)
- [ ] Check-in guests

### As Promoter:
- [ ] Create own guest list
- [ ] Add guest (verify status = "pending")
- [ ] Edit own guest
- [ ] Verify cannot edit other users' guests
- [ ] Verify cannot remove guests (button hidden)
- [ ] Check-in guests
- [ ] Delete own list

### As Staff:
- [ ] Verify cannot add guests (button hidden)
- [ ] Verify cannot edit guests (button hidden)
- [ ] Verify cannot remove guests (button hidden)
- [ ] Can check-in guests only
- [ ] Verify cannot create lists (button hidden)

## Migration Instructions

1. **Apply Database Migration**:
```bash
# Push migration to Supabase
supabase db push
```

2. **Verify RLS Policies**:
```sql
-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('guest_lists', 'guest_list_entries')
ORDER BY tablename, policyname;
```

3. **Test Permissions**:
- Create test users for each role
- Verify each role can only perform allowed actions
- Check database rejects unauthorized operations

## Troubleshooting

### Issue: "Permission Denied" Error
**Cause**: RLS policy blocking action
**Solution**: Check user role and permission matrix

### Issue: Can't Edit Guest Added by Someone Else (as Promoter)
**Expected Behavior**: This is correct - promoters can only edit their own guests

### Issue: Guest Status Stuck on "Pending"
**Cause**: Promoter-Added guests need manager approval
**Solution**: Owner/Manager must approve the guest

### Issue: Remove Button Not Showing
**Possible Causes**:
1. User is VIP Host, Promoter, or Staff (expected)
2. User is Manager/Owner but RLS policy failed
**Solution**: Verify user role and RLS policies

## Performance Considerations

- Permission checks use in-memory role data (no extra DB queries)
- RLS policies use indexed columns (`tenant_id`, `added_by`, `promoter_id`)
- Guest list counts updated via database triggers
- Minimal re-renders with React state management

## Future Enhancements

- [ ] Bulk add guests from CSV
- [ ] Guest approval workflow notifications
- [ ] Permission override system for special cases
- [ ] Audit log viewer for managers
- [ ] Guest self-check-in with QR codes
- [ ] Commission calculation for promoters based on checked-in guests

## Related Documentation

- `MANAGER_PERMISSIONS_VERIFICATION.md` - Manager role verification
- `CUSTOMER_ROLE_VERIFICATION.md` - Customer role setup
- Database schema documentation for guest_lists and guest_list_entries tables

## Summary

✅ Role-based permissions implemented and enforced
✅ Frontend validation with user-friendly UI
✅ Database-level security with RLS policies
✅ Manager and Promoter pages updated
✅ Permission summary displayed to users
✅ All ESLint errors resolved
✅ Ready for testing and deployment
