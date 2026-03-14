import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function ManagerStaffPage() {
  const { userProfile } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchStaff = async () => {
    if (!userProfile?.tenant_id) {
      setError('No venue assigned to your account. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .in('role', ['staff', 'manager', 'promoter', 'vip_host'])
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setError(error.message || 'Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>👥 Staff Management</h1>
          <p>View and manage staff performance</p>
        </div>

        <div className="info-box" style={{ marginBottom: '20px' }}>
          <strong>ℹ️ Manager View:</strong> You can view staff but cannot add/remove staff. Contact the owner for staff changes.
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: '20px', padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', color: '#c33' }}>
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading staff...</div>
        ) : staff.length === 0 ? (
          <div className="info-box">
            <strong>📋 No Staff Found</strong>
            <p>There are no staff members assigned to your venue yet.</p>
            <p>Tenant ID: {userProfile?.tenant_id || 'Not set'}</p>
            <p>Your Role: {userProfile?.role || 'Unknown'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td>{member.full_name || 'N/A'}</td>
                    <td>{member.email}</td>
                    <td>
                      <span className={`role-badge role-${member.role}`}>{formatRoleName(member.role)}</span>
                    </td>
                    <td>
                      <span className="status-badge status-active">Active</span>
                    </td>
                    <td>{new Date(member.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
