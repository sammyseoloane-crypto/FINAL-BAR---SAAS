import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { useEffect } from 'react';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function OwnerDashboard() {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const notification = useNotification();

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      notification.success('🎉 Subscription activated successfully! Your payment is being processed.');
      // Clear the URL parameter
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
    } else if (canceled === 'true') {
      notification.warning('⚠️ Subscription upgrade was canceled. You can try again anytime.');
      // Clear the URL parameter
      searchParams.delete('canceled');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, notification]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>🍺 Bar SaaS</h1>
          <span className="role-badge role-owner">Owner</span>
          <PlanBadge />
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Owner Dashboard</h2>
          <p>Welcome back, {userProfile?.email}!</p>
          {userProfile?.tenant_name && <p className="company-name">🏢 {userProfile.tenant_name}</p>}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Analytics</h3>
            <p>View sales reports and business insights</p>
            <button className="btn-card" onClick={() => navigate('/owner/reports')}>
              View Reports
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📍</div>
            <h3>Locations</h3>
            <p>Manage your bar locations</p>
            <button className="btn-card" onClick={() => navigate('/owner/locations')}>
              Manage Locations
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">👥</div>
            <h3>Staff Management</h3>
            <p>Add and manage staff members</p>
            <button className="btn-card" onClick={() => navigate('/owner/staff')}>
              Manage Staff
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🍺</div>
            <h3>Products</h3>
            <p>Manage drinks and food menu</p>
            <button className="btn-card" onClick={() => navigate('/owner/products')}>
              Manage Products
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎉</div>
            <h3>Events</h3>
            <p>Create and manage bar events</p>
            <button className="btn-card" onClick={() => navigate('/owner/events')}>
              Manage Events
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📝</div>
            <h3>Tasks</h3>
            <p>Assign and track staff tasks</p>
            <button className="btn-card" onClick={() => navigate('/owner/tasks')}>
              Manage Tasks
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>Transactions</h3>
            <p>View all customer transactions</p>
            <button className="btn-card" onClick={() => navigate('/owner/transactions')}>
              View Transactions
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📬</div>
            <h3>Email Logs</h3>
            <p>View email delivery logs</p>
            <button className="btn-card" onClick={() => navigate('/owner/email-logs')}>
              View Email Logs
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🥂</div>
            <h3>VIP Tables</h3>
            <p>Manage VIP table reservations and pricing</p>
            <button className="btn-card" onClick={() => navigate('/owner/vip-tables')}>
              Manage VIP Tables
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎵</div>
            <h3>Live Performance</h3>
            <p>Real-time club metrics and analytics</p>
            <button className="btn-card" onClick={() => navigate('/owner/club-dashboard')}>
              View Live Data
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⚙️</div>
            <h3>Settings</h3>
            <p>Configure business settings</p>
            <button className="btn-card" onClick={() => navigate('/owner/subscription')}>
              Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
