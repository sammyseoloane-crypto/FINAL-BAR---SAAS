import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import './Pages.css';

export default function StaffPage() {
  const { userProfile } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'staff',
  });

  const fetchStaff = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .in('role', ['staff', 'admin', 'manager', 'promoter', 'vip_host'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile.tenant_id]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Note: In production, staff creation should be handled server-side
      // with proper email invitations
      alert(`Staff invitation feature would be implemented here.\nEmail: ${formData.email}`);
      setFormData({ email: '', password: '', role: 'staff' });
      setShowForm(false);
    } catch (error) {
      alert(`Error inviting staff: ${error.message}`);
    }
  };

  const handleEdit = (member) => {
    setEditingId(member.id);
    setFormData({
      email: member.email,
      role: member.role,
      password: '', // Don't pre-fill password
    });
    setShowForm(false); // Close new staff form if open
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        role: formData.role,
        email: formData.email,
      };

      const { error } = await supabase.from('profiles').update(updateData).eq('id', editingId);

      if (error) {
        throw error;
      }

      alert('Staff member updated successfully!');
      setEditingId(null);
      setFormData({ email: '', password: '', role: 'staff' });
      fetchStaff();
    } catch (error) {
      alert(`Error updating staff: ${error.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ email: '', password: '', role: 'staff' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this staff member?')) {
      return;
    }

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);

      if (error) {
        throw error;
      }
      fetchStaff();
    } catch (error) {
      alert(`Error removing staff: ${error.message}`);
    }
  };

  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      manager: 'status-active',
      staff: 'status-pending',
      promoter: 'status-warning',
      vip_host: 'status-success',
      admin: 'status-active',
      owner: 'status-active',
    };
    return roleClasses[role] || 'status-pending';
  };

  const formatRoleName = (role) => {
    const roleNames = {
      manager: 'Manager',
      staff: 'Staff',
      promoter: 'Promoter',
      vip_host: 'VIP Host',
      admin: 'Admin',
      owner: 'Owner',
    };
    return roleNames[role] || role;
  };

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>Staff Management</h2>
          <p>Manage your team members</p>
        </div>

        <div className="action-bar">
          <div className="search-bar">
            <input type="text" placeholder="Search staff..." />
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            + Invite Staff
          </button>
        </div>

        {showForm && (
          <div className="card">
            <div className="card-header">
              <h3>Invite New Staff Member</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="staff@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="promoter">Promoter</option>
                    <option value="vip_host">VIP Host</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">
                    Send Invitation
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingId && (
          <div className="card">
            <div className="card-header">
              <h3>Edit Staff Member</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleUpdate}>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="staff@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="promoter">Promoter</option>
                    <option value="vip_host">VIP Host</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">
                    Update Staff
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : staff.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>No staff members yet</h3>
            <p>Invite your first team member to get started</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>{member.email}</td>
                      <td>
                        <span className={`status-badge ${getRoleBadgeClass(member.role)}`}>
                          {formatRoleName(member.role)}
                        </span>
                      </td>
                      <td>{new Date(member.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(member)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(member.id)}
                          >
                            🗑️ Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
