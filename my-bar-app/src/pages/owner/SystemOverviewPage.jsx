import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import { runSystemHealthCheck } from '../../utils/healthCheck';
import './Pages.css';

export default function SystemOverviewPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalEvents: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    activeLocations: 0,
    pendingTasks: 0,
    recentActivity: [],
  });
  const [healthCheck, setHealthCheck] = useState(null);
  const [showHealthCheck, setShowHealthCheck] = useState(false);

  const fetchUserStats = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('tenant_id', userProfile.tenant_id);

    if (!error) {
      setSystemStats((prev) => ({ ...prev, totalUsers: data.length }));
    }
  };

  const fetchProductStats = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', userProfile.tenant_id);

    if (!error) {
      setSystemStats((prev) => ({ ...prev, totalProducts: data.length }));
    }
  };

  const fetchEventStats = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('active', true);

    if (!error) {
      setSystemStats((prev) => ({ ...prev, totalEvents: data.length }));
    }
  };

  const fetchTransactionStats = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('amount, status')
      .eq('tenant_id', userProfile.tenant_id);

    if (!error) {
      const totalRevenue = data
        .filter((t) => t.status === 'confirmed')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      setSystemStats((prev) => ({
        ...prev,
        totalTransactions: data.length,
        totalRevenue,
      }));
    }
  };

  const fetchLocationStats = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id')
      .eq('tenant_id', userProfile.tenant_id);

    if (!error) {
      setSystemStats((prev) => ({ ...prev, activeLocations: data.length }));
    }
  };

  const fetchTaskStats = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('status', 'pending');

    if (!error) {
      setSystemStats((prev) => ({ ...prev, pendingTasks: data.length }));
    }
  };

  const fetchRecentActivity = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, status, created_at, products!product_id(name)')
      .eq('tenant_id', userProfile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) {
      setSystemStats((prev) => ({ ...prev, recentActivity: data }));
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchUserStats(),
      fetchProductStats(),
      fetchEventStats(),
      fetchTransactionStats(),
      fetchLocationStats(),
      fetchTaskStats(),
      fetchRecentActivity(),
    ])
      .catch((error) => console.error('Error fetching system stats:', error))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunHealthCheck = async () => {
    setShowHealthCheck(true);
    const results = await runSystemHealthCheck(userProfile.tenant_id);
    setHealthCheck(results);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const getHealthColor = (status) => {
    const colors = {
      healthy: '#28a745',
      degraded: '#ffc107',
      unhealthy: '#dc3545',
    };
    return colors[status] || '#666';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="page-content">
          <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em', color: '#666' }}>
            Loading system overview...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>🏢 System Overview</h2>
          <p>Comprehensive view of your bar management system</p>
        </div>

        {/* Tenant Information */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>Tenant Information</h3>
          </div>
          <div className="card-body">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px',
              }}
            >
              <div>
                <strong>Business Name:</strong>
                <div style={{ fontSize: '1.1em', color: '#d4af37', marginTop: '5px' }}>
                  {userProfile.tenant_name || 'N/A'}
                </div>
              </div>
              <div>
                <strong>Your Role:</strong>
                <div style={{ fontSize: '1.1em', color: '#d4af37', marginTop: '5px' }}>
                  {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
                </div>
              </div>
              <div>
                <strong>Email:</strong>
                <div style={{ fontSize: '1.1em', color: '#d4af37', marginTop: '5px' }}>
                  {userProfile.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginBottom: '30px',
          }}
        >
          <StatCard icon="👥" label="Total Users" value={systemStats.totalUsers} color="#d4af37" />
          <StatCard icon="🍺" label="Products" value={systemStats.totalProducts} color="#48bb78" />
          <StatCard
            icon="🎉"
            label="Active Events"
            value={systemStats.totalEvents}
            color="#ed8936"
          />
          <StatCard
            icon="📍"
            label="Locations"
            value={systemStats.activeLocations}
            color="#daa520"
          />
          <StatCard
            icon="💰"
            label="Total Revenue"
            value={formatCurrency(systemStats.totalRevenue)}
            color="#38b2ac"
          />
          <StatCard
            icon="📝"
            label="Pending Tasks"
            value={systemStats.pendingTasks}
            color="#f56565"
          />
          <StatCard
            icon="💳"
            label="Transactions"
            value={systemStats.totalTransactions}
            color="#4299e1"
          />
        </div>

        {/* System Health Check */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div
            className="card-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h3>🏥 System Health</h3>
            <button className="btn btn-secondary" onClick={handleRunHealthCheck} disabled={loading}>
              Run Health Check
            </button>
          </div>
          <div className="card-body">
            {!showHealthCheck && (
              <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                Click &quot;Run Health Check&quot; to verify system configuration and connectivity
              </p>
            )}
            {healthCheck && (
              <div>
                <div
                  style={{
                    padding: '15px',
                    borderRadius: '8px',
                    background: `${getHealthColor(healthCheck.overall)}20`,
                    border: `2px solid ${getHealthColor(healthCheck.overall)}`,
                    marginBottom: '15px',
                  }}
                >
                  <strong style={{ fontSize: '1.2em', color: getHealthColor(healthCheck.overall) }}>
                    Overall Status: {healthCheck.overall.toUpperCase()}
                  </strong>
                  <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                    Last checked: {new Date(healthCheck.timestamp).toLocaleString()}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  {Object.entries(healthCheck.checks).map(([name, check]) => (
                    <HealthCheckItem key={name} name={name} check={check} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3>📊 Recent Transaction Activity</h3>
          </div>
          <div className="card-body">
            {systemStats.recentActivity.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                No recent transactions
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Product</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemStats.recentActivity.map((activity) => (
                      <tr key={activity.id}>
                        <td>{new Date(activity.created_at).toLocaleString()}</td>
                        <td>{activity.products?.name || 'N/A'}</td>
                        <td>{formatCurrency(activity.amount)}</td>
                        <td>
                          <span className={`status-badge status-${activity.status}`}>
                            {activity.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div
      className="stat-card"
      style={{
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <div className="stat-icon" style={{ fontSize: '2.5em', marginBottom: '10px' }}>
        {icon}
      </div>
      <div
        className="stat-value"
        style={{
          fontSize: '2em',
          fontWeight: 'bold',
          color: color,
          margin: '10px 0',
        }}
      >
        {value}
      </div>
      <div
        className="stat-label"
        style={{
          fontSize: '0.95em',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string.isRequired,
};

function HealthCheckItem({ name, check }) {
  const isHealthy =
    check.isValid ||
    check.isConnected ||
    check.isAuthenticated ||
    check.rlsEnabled ||
    check.isActive;
  const icon = isHealthy ? '✓' : '✗';
  const color = isHealthy ? '#28a745' : '#dc3545';

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '20px', color, fontWeight: 'bold', minWidth: '24px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <strong style={{ textTransform: 'capitalize' }}>{name}</strong>
        <div style={{ fontSize: '0.9em', color: '#666', marginTop: '4px' }}>
          {check.message || 'No details available'}
        </div>
      </div>
    </div>
  );
}

HealthCheckItem.propTypes = {
  name: PropTypes.string.isRequired,
  check: PropTypes.shape({
    isValid: PropTypes.bool,
    isConnected: PropTypes.bool,
    isAuthenticated: PropTypes.bool,
    rlsEnabled: PropTypes.bool,
    isActive: PropTypes.bool,
    message: PropTypes.string,
  }).isRequired,
};
