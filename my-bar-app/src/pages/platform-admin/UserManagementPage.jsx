import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import RoleEditor from '../../components/RoleEditor';
import '../Dashboard.css';

/**
 * User Management Page
 * Platform Admin page to view and manage all user roles
 */

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, platform_admin, owner, etc.

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          role,
          tenant_id,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Fetch tenant names for users
      const usersWithTenants = await Promise.all(
        (data || []).map(async (user) => {
          if (!user.tenant_id) {
            return { ...user, tenantName: 'N/A (Platform Admin)' };
          }

          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', user.tenant_id)
            .single();

          return {
            ...user,
            tenantName: tenant?.name || 'Unknown',
          };
        }),
      );

      setUsers(usersWithTenants);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (filter === 'all') {
      return true;
    }
    if (filter === 'no_tenant') {
      return !user.tenant_id;
    }
    return user.role === filter;
  });

  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      platform_admin: 'role-platform-admin',
      owner: 'role-owner',
      manager: 'role-manager',
      staff: 'role-staff',
      promoter: 'role-promoter',
      vip_host: 'role-vip-host',
      customer: 'role-customer',
    };
    return roleClasses[role] || 'role-default';
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>👥 User Management</h1>
          <p>Manage all users and their roles across the platform</p>
        </div>

        {/* Filter Section */}
        <div className="filter-section" style={{ marginBottom: '20px' }}>
          <label htmlFor="role-filter" style={{ marginRight: '10px' }}>
            <strong>Filter by Role:</strong>
          </label>
          <select
            id="role-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">All Users ({users.length})</option>
            <option value="platform_admin">Platform Admins ({users.filter(u => u.role === 'platform_admin').length})</option>
            <option value="owner">Owners ({users.filter(u => u.role === 'owner').length})</option>
            <option value="manager">Managers ({users.filter(u => u.role === 'manager').length})</option>
            <option value="staff">Staff ({users.filter(u => u.role === 'staff').length})</option>
            <option value="promoter">Promoters ({users.filter(u => u.role === 'promoter').length})</option>
            <option value="vip_host">VIP Hosts ({users.filter(u => u.role === 'vip_host').length})</option>
            <option value="customer">Customers ({users.filter(u => u.role === 'customer').length})</option>
            <option value="no_tenant">No Tenant ({users.filter(u => !u.tenant_id).length})</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="info-box">
            <strong>ℹ️ No Users Found</strong>
            <p>No users match the selected filter.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Tenant/Venue</th>
                  <th>Created</th>
                  <th>Update Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.tenantName}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <RoleEditor
                        userId={user.id}
                        currentRole={user.role}
                        userEmail={user.email}
                        onRoleUpdated={fetchUsers}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .role-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-platform-admin {
          background: #dc3545;
          color: white;
        }

        .role-owner {
          background: #007bff;
          color: white;
        }

        .role-manager {
          background: #17a2b8;
          color: white;
        }

        .role-staff {
          background: #28a745;
          color: white;
        }

        .role-promoter {
          background: #ffc107;
          color: #333;
        }

        .role-vip-host {
          background: #6f42c1;
          color: white;
        }

        .role-customer {
          background: #6c757d;
          color: white;
        }

        .role-default {
          background: #e9ecef;
          color: #333;
        }

        .filter-section {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }
      `}</style>
    </DashboardLayout>
  );
}
