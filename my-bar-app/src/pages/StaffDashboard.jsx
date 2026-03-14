import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function StaffDashboard() {
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
          <span className="role-badge role-staff">Staff</span>
          <PlanBadge />
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Staff Dashboard</h2>
          <p>Welcome, {userProfile?.email}!</p>
          {userProfile?.tenant_name && <p className="company-name">🏢 {userProfile.tenant_name}</p>}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📝</div>
            <h3>My Tasks</h3>
            <p>View and update your assigned tasks</p>
            <button className="btn-card" onClick={() => navigate('/staff/tasks')}>
              View Tasks
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📱</div>
            <h3>Scan QR Codes</h3>
            <p>Scan customer QR codes for entry validation</p>
            <button className="btn-card" onClick={() => navigate('/staff/scanner')}>
              Start Scanning
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>Confirm Payments</h3>
            <p>Review and confirm pending transactions</p>
            <button className="btn-card" onClick={() => navigate('/staff/payments')}>
              View Payments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
