import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function TenantManagementPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, subscription_status, subscription_tier, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Fetch user counts for each tenant
      const tenantsWithCounts = await Promise.all(
        (data || []).map(async (tenant) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          return {
            ...tenant,
            userCount: count || 0,
          };
        }),
      );

      setTenants(tenantsWithCounts);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const suspendTenant = async (tenantId) => {
    if (!confirm('Are you sure you want to suspend this tenant?')) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({ subscription_status: 'inactive' })
        .eq('id', tenantId)
        .select();

      if (error) {
        console.error('Suspend error details:', error);
        throw error;
      }

      // eslint-disable-next-line no-console
      console.log('Tenant suspended successfully:', data);

      // Refresh the list to show updated status
      await fetchTenants();
      alert('Tenant suspended successfully');
    } catch (error) {
      console.error('Error suspending tenant:', error);
      alert(`Failed to suspend tenant: ${error.message || 'Unknown error'}`);
    }
  };

  const activateTenant = async (tenantId) => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({ subscription_status: 'active' })
        .eq('id', tenantId)
        .select();

      if (error) {
        console.error('Activate error details:', error);
        throw error;
      }

      // eslint-disable-next-line no-console
      console.log('Tenant activated successfully:', data);

      // Refresh the list to show updated status
      await fetchTenants();
      alert('Tenant activated successfully');
    } catch (error) {
      console.error('Error activating tenant:', error);
      alert(`Failed to activate tenant: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>🏢 Tenant Management</h1>
          <p>Manage all venues on the platform</p>
        </div>

        {loading ? (
          <div className="loading">Loading tenants...</div>
        ) : tenants.length === 0 ? (
          <div className="info-box">
            <strong>ℹ️ No Venues Found</strong>
            <p>No tenant venues have been created yet. Create your first venue to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Venue Name</th>
                  <th>Subscription</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>{tenant.name}</td>
                    <td>
                      <span className="tier-badge">
                        {tenant.subscription_tier || 'N/A'}
                      </span>
                    </td>
                    <td>{new Date(tenant.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge status-${tenant.subscription_status || 'inactive'}`}>
                        {tenant.subscription_status || 'inactive'}
                      </span>
                    </td>
                    <td>{tenant.userCount}</td>
                    <td>
                      {tenant.subscription_status === 'inactive' ||
                        tenant.subscription_status === 'cancelled' ? (
                          <button
                            onClick={() => activateTenant(tenant.id)}
                            className="btn-success"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            onClick={() => suspendTenant(tenant.id)}
                            className="btn-danger"
                          >
                            Suspend
                          </button>
                        )}
                    </td>
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
