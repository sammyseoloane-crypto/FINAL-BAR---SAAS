import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function PlatformAdminDashboard() {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>🍺 Bar SaaS</h1>
          <span className="role-badge role-platform-admin">Platform Admin</span>
          <PlanBadge />
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Platform Admin Dashboard</h2>
          <p>Welcome back, {userProfile?.email}!</p>
          <p>Manage the entire SaaS platform across all venues</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">🏢</div>
            <h3>Tenant Management</h3>
            <p>Manage all venues using the platform</p>
            <button className="btn-card" onClick={() => navigate('/platform-admin/tenants')}>
              Manage Tenants
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">�</div>
            <h3>User Management</h3>
            <p>Manage all users and their roles</p>
            <button className="btn-card" onClick={() => navigate('/platform-admin/users')}>
              Manage Users
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">�📊</div>
            <h3>Platform Analytics</h3>
            <p>View system-wide performance metrics</p>
            <button className="btn-card" onClick={() => navigate('/platform-admin/analytics')}>
              View Analytics
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💰</div>
            <h3>Billing Overview</h3>
            <p>Monitor subscriptions and revenue</p>
            <button className="btn-card" onClick={() => navigate('/platform-admin/billing')}>
              View Billing
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>Subscription Plans</h3>
            <p>Manage pricing tiers and features</p>
            <button className="btn-card" onClick={() => navigate('/platform-admin/plans')}>
              Manage Plans
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <h3>System Logs</h3>
            <p>Access all system activity logs</p>
            <button className="btn-card" onClick={() => navigate('/platform-admin/logs')}>
              View Logs
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎫</div>
            <h3>Support Tickets</h3>
            <p>Manage customer support requests</p>
            <button className="btn-card" onClick={() => navigate('/platform-admin/support')}>
              View Tickets
            </button>
          </div>
        </div>

        <div className="info-box" style={{ marginTop: '30px' }}>
          <strong>ℹ️ Platform Admin Capabilities:</strong>
          <ul>
            <li>✅ Manage all tenant venues</li>
            <li>✅ Manage all users and roles</li>
            <li>✅ View platform-wide analytics</li>
            <li>✅ Handle billing and subscriptions</li>
            <li>✅ Suspend or activate venues</li>
            <li>✅ Access all system logs</li>
            <li>✅ Manage support tickets</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
