import { useState } from 'react';
import { supabase } from '../supabaseClient';
import PropTypes from 'prop-types';
import './RoleEditor.css';

/**
 * Simple Role Editor Component
 * Allows platform admins to update user roles
 *
 * Usage:
 * import RoleEditor from '../components/RoleEditor';
 * <RoleEditor userId={userId} currentRole={role} onRoleUpdated={callback} />
 */

const AVAILABLE_ROLES = [
  { value: 'platform_admin', label: 'Platform Admin', description: 'Full access to all tenants' },
  { value: 'owner', label: 'Owner', description: 'Full access to their tenant' },
  { value: 'manager', label: 'Manager', description: 'Manage tenant operations' },
  { value: 'staff', label: 'Staff', description: 'Basic staff access' },
  { value: 'promoter', label: 'Promoter', description: 'Promoter features' },
  { value: 'vip_host', label: 'VIP Host', description: 'VIP host features' },
  { value: 'customer', label: 'Customer', description: 'Customer access only' },
];

export default function RoleEditor({ userId, currentRole, userEmail, onRoleUpdated }) {
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [updating, setUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRoleChange = (newRole) => {
    setSelectedRole(newRole);
    setShowConfirm(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedRole || selectedRole === currentRole) {
      setShowConfirm(false);
      return;
    }

    setUpdating(true);

    try {
      // Update user role
      const updates = { role: selectedRole };

      // If changing to platform_admin, remove tenant association
      if (selectedRole === 'platform_admin') {
        updates.tenant_id = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        throw error;
      }

      alert(`✅ Role updated successfully!\n\n${userEmail} is now: ${selectedRole}`);

      if (onRoleUpdated) {
        onRoleUpdated(selectedRole);
      }

      setShowConfirm(false);
    } catch (error) {
      console.error('Error updating role:', error);
      alert(`Failed to update role: ${error.message}`);
      setSelectedRole(currentRole); // Revert on error
    } finally {
      setUpdating(false);
    }
  };

  const cancelRoleChange = () => {
    setSelectedRole(currentRole);
    setShowConfirm(false);
  };

  return (
    <div className="role-editor">
      <div className="role-selector">
        <label htmlFor={`role-${userId}`}>
          <strong>Role:</strong>
        </label>
        <select
          id={`role-${userId}`}
          value={selectedRole}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={updating}
          className="role-select"
        >
          {AVAILABLE_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {showConfirm && selectedRole !== currentRole && (
        <div className="role-confirm">
          <p className="warning-text">
            ⚠️ Change role from <strong>{currentRole}</strong> to <strong>{selectedRole}</strong>?
          </p>
          <div className="confirm-buttons">
            <button
              onClick={confirmRoleChange}
              disabled={updating}
              className="btn btn-primary btn-sm"
            >
              {updating ? 'Updating...' : 'Confirm'}
            </button>
            <button
              onClick={cancelRoleChange}
              disabled={updating}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="role-description">
        <small>
          {AVAILABLE_ROLES.find((r) => r.value === selectedRole)?.description}
        </small>
      </div>
    </div>
  );
}

RoleEditor.propTypes = {
  userId: PropTypes.string.isRequired,
  currentRole: PropTypes.string.isRequired,
  userEmail: PropTypes.string,
  onRoleUpdated: PropTypes.func,
};

RoleEditor.defaultProps = {
  userEmail: 'User',
  onRoleUpdated: null,
};
