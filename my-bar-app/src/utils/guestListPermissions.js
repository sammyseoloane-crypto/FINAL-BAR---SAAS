/**
 * Guest List Permission System
 * Defines who can do what with guest lists based on their role
 */

export const GUEST_LIST_PERMISSIONS = {
  owner: {
    canAddGuests: true,
    canEditAllGuests: true,
    canEditOwnGuests: true,
    canRemoveGuests: true,
    canCreateLists: true,
    canDeleteLists: true,
    canVerifyGuests: true,
  },
  manager: {
    canAddGuests: true,
    canEditAllGuests: true,
    canEditOwnGuests: true,
    canRemoveGuests: true,
    canCreateLists: true,
    canDeleteLists: true,
    canVerifyGuests: true,
  },
  vip_host: {
    canAddGuests: true,
    canEditAllGuests: true,
    canEditOwnGuests: true,
    canRemoveGuests: false,
    canCreateLists: false,
    canDeleteLists: false,
    canVerifyGuests: true,
  },
  promoter: {
    canAddGuests: true,
    canEditAllGuests: false,
    canEditOwnGuests: true,
    canRemoveGuests: false,
    canCreateLists: true,
    canDeleteLists: true,
    canVerifyGuests: true,
  },
  staff: {
    canAddGuests: false,
    canEditAllGuests: false,
    canEditOwnGuests: false,
    canRemoveGuests: false,
    canCreateLists: false,
    canDeleteLists: false,
    canVerifyGuests: true,
  },
};

/**
 * Get permissions for a specific user role
 * @param {string} role - User role (owner, manager, vip_host, promoter, staff)
 * @returns {object} Permission object
 */
export const getGuestListPermissions = (role) => {
  return GUEST_LIST_PERMISSIONS[role] || GUEST_LIST_PERMISSIONS.staff;
};

/**
 * Check if user can add guests
 */
export const canAddGuests = (role) => {
  const permissions = getGuestListPermissions(role);
  return permissions.canAddGuests;
};

/**
 * Check if user can edit a specific guest
 * @param {string} role - User role
 * @param {string} userId - Current user ID
 * @param {string} guestCreatedBy - ID of user who created the guest entry
 */
export const canEditGuest = (role, userId, guestCreatedBy) => {
  const permissions = getGuestListPermissions(role);

  if (permissions.canEditAllGuests) {
    return true;
  }

  if (permissions.canEditOwnGuests && userId === guestCreatedBy) {
    return true;
  }

  return false;
};

/**
 * Check if user can remove guests
 */
export const canRemoveGuests = (role) => {
  const permissions = getGuestListPermissions(role);
  return permissions.canRemoveGuests;
};

/**
 * Check if user can verify guests (check-in)
 */
export const canVerifyGuests = (role) => {
  const permissions = getGuestListPermissions(role);
  return permissions.canVerifyGuests;
};

/**
 * Check if user can create new guest lists
 */
export const canCreateLists = (role) => {
  const permissions = getGuestListPermissions(role);
  return permissions.canCreateLists;
};

/**
 * Check if user can delete guest lists
 */
export const canDeleteLists = (role) => {
  const permissions = getGuestListPermissions(role);
  return permissions.canDeleteLists;
};

/**
 * Get a user-friendly message about what actions are available
 */
export const getPermissionSummary = (role) => {
  const permissions = getGuestListPermissions(role);
  const actions = [];

  if (permissions.canAddGuests) {
    actions.push('Add guests');
  }
  if (permissions.canEditAllGuests) {
    actions.push('Edit all guests');
  } else if (permissions.canEditOwnGuests) {
    actions.push('Edit own guests');
  }
  if (permissions.canRemoveGuests) {
    actions.push('Remove guests');
  }
  if (permissions.canVerifyGuests) {
    actions.push('Verify/check-in guests');
  }
  if (permissions.canCreateLists) {
    actions.push('Create lists');
  }
  if (permissions.canDeleteLists) {
    actions.push('Delete lists');
  }

  return actions;
};
