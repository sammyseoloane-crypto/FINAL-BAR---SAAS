import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function SystemLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    tenantId: '',
    searchTerm: '',
  });
  const [tenants, setTenants] = useState([]);

  useEffect(() => {
    fetchTenants();
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (error) {
        throw error;
      }
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);

      // Note: This uses a hypothetical audit_logs table
      // If it doesn't exist, we'll show sample data
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          tenants(name),
          profiles!user_id(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.tenantId) {
        query = query.eq('tenant_id', filters.tenantId);
      }

      if (filters.action) {
        query = query.eq('action', filters.action);
      }

      const { data, error } = await query;

      if (error) {
        // If table doesn't exist, show sample/mock data
        console.warn('Audit logs table not found, showing sample data');
        setLogs(generateSampleLogs());
      } else {
        setLogs(data || []);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs(generateSampleLogs());
    } finally {
      setLoading(false);
    }
  };

  const generateSampleLogs = () => {
    return [
      {
        id: '1',
        action: 'user_login',
        description: 'User logged in successfully',
        user_email: 'admin@example.com',
        tenant_name: 'Demo Venue',
        ip_address: '192.168.1.1',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        action: 'subscription_updated',
        description: 'Subscription plan changed from Starter to Pro',
        user_email: 'owner@venue.com',
        tenant_name: 'Club Paradise',
        ip_address: '192.168.1.5',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        action: 'tenant_suspended',
        description: 'Tenant account suspended for non-payment',
        user_email: 'platform@admin.com',
        tenant_name: 'Old Bar',
        ip_address: '10.0.0.1',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  };

  useEffect(() => {
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.action, filters.tenantId]);

  const getActionBadgeColor = (action) => {
    const colors = {
      user_login: '#3b82f6',
      user_logout: '#6b7280',
      subscription_updated: '#10b981',
      tenant_suspended: '#ef4444',
      tenant_activated: '#22c55e',
      payment_received: '#059669',
      payment_failed: '#dc2626',
    };
    return colors[action] || '#64748b';
  };

  const filteredLogs = logs.filter((log) => {
    if (!filters.searchTerm) {
      return true;
    }
    const search = filters.searchTerm.toLowerCase();
    return (
      log.description?.toLowerCase().includes(search) ||
      log.user_email?.toLowerCase().includes(search) ||
      log.tenant_name?.toLowerCase().includes(search)
    );
  });

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📋 System Activity Logs</h1>
          <p>Monitor all system events and user actions</p>
        </div>

        {/* Filters */}
        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '600' }}>
                Search
              </label>
              <input
                type="text"
                placeholder="Search logs..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '600' }}>
                Tenant
              </label>
              <select
                value={filters.tenantId}
                onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                }}
              >
                <option value="">All Tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em', fontWeight: '600' }}>
                Action Type
              </label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                }}
              >
                <option value="">All Actions</option>
                <option value="user_login">User Login</option>
                <option value="user_logout">User Logout</option>
                <option value="subscription_updated">Subscription Updated</option>
                <option value="tenant_suspended">Tenant Suspended</option>
                <option value="tenant_activated">Tenant Activated</option>
                <option value="payment_received">Payment Received</option>
                <option value="payment_failed">Payment Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="loading">Loading logs...</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>User</th>
                  <th>Tenant</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8em',
                          fontWeight: '600',
                          background: getActionBadgeColor(log.action),
                          color: 'white',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.action?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>{log.description}</td>
                    <td>{log.profiles?.email || log.user_email || 'System'}</td>
                    <td>{log.tenants?.name || log.tenant_name || 'N/A'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                      {log.ip_address || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLogs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                No logs found matching your criteria
              </div>
            )}
          </div>
        )}

        <div
          className="info-box"
          style={{
            marginTop: '20px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            padding: '15px',
            borderRadius: '8px',
          }}
        >
          <strong>ℹ️ Note:</strong> Audit logging system is displaying sample data. To enable full audit logging,
          implement the audit_logs table and triggers for automatic event tracking.
        </div>
      </div>
    </DashboardLayout>
  );
}
