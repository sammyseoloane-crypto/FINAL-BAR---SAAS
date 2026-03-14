import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function ManagerDashboard() {
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
          <span className="role-badge role-manager">Manager</span>
          <PlanBadge />
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Manager Dashboard</h2>
          <p>Welcome back, {userProfile?.email}!</p>
          {userProfile?.tenant_name && <p className="company-name">🏢 {userProfile.tenant_name}</p>}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">👥</div>
            <h3>Staff Management</h3>
            <p>View staff and performance</p>
            <button className="btn-card" onClick={() => navigate('/manager/staff')}>
              View Staff
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📅</div>
            <h3>Staff Shifts</h3>
            <p>Schedule and manage shifts</p>
            <button className="btn-card" onClick={() => navigate('/manager/shifts')}>
              Manage Shifts
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎟️</div>
            <h3>Reservations</h3>
            <p>Approve and manage reservations</p>
            <button className="btn-card" onClick={() => navigate('/manager/reservations')}>
              View Reservations
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <h3>Guest Lists</h3>
            <p>Manage event guest lists</p>
            <button className="btn-card" onClick={() => navigate('/manager/guest-lists')}>
              View Guest Lists
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>POS Monitoring</h3>
            <p>Monitor point-of-sale activity</p>
            <button className="btn-card" onClick={() => navigate('/manager/pos-monitor')}>
              Monitor POS
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Reports</h3>
            <p>View performance reports</p>
            <button className="btn-card" onClick={() => navigate('/manager/reports')}>
              View Reports
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎉</div>
            <h3>Events</h3>
            <p>View and manage events</p>
            <button className="btn-card" onClick={() => navigate('/manager/events')}>
              Manage Events
            </button>
          </div>
        </div>

        <div className="info-box" style={{ marginTop: '30px' }}>
          <strong>ℹ️ Manager Capabilities:</strong>
          <ul>
            <li>✅ View and manage staff</li>
            <li>✅ Schedule staff shifts</li>
            <li>✅ Approve reservations</li>
            <li>✅ Manage guest lists (approve, check-in)</li>
            <li>✅ Monitor POS activity</li>
            <li>✅ View reports and analytics</li>
            <li>❌ Cannot change billing or subscription</li>
            <li>❌ Cannot delete venue</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
