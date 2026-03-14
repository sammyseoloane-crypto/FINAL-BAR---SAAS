import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function PromoterDashboard() {
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
          <span className="role-badge role-promoter">Promoter</span>
          <PlanBadge />
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Promoter Dashboard</h2>
          <p>Welcome back, {userProfile?.email}!</p>
          <p>Bring customers to events and track your performance</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <h3>My Guest Lists</h3>
            <p>Create and manage guest lists</p>
            <button className="btn-card" onClick={() => navigate('/promoter/guest-lists')}>
              Manage Lists
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💰</div>
            <h3>Commission</h3>
            <p>Track revenue and earnings</p>
            <button className="btn-card" onClick={() => navigate('/promoter/commission')}>
              View Commission
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎉</div>
            <h3>Events</h3>
            <p>View upcoming events</p>
            <button className="btn-card" onClick={() => navigate('/promoter/events')}>
              View Events
            </button>
          </div>
        </div>

        <div className="info-box" style={{ marginTop: '30px' }}>
          <strong>ℹ️ Promoter Capabilities:</strong>
          <ul>
            <li>✅ Create guest lists</li>
            <li>✅ Invite guests to events</li>
            <li>✅ Track guest attendance</li>
            <li>✅ View commission earnings</li>
            <li>✅ Track revenue generated</li>
            <li>❌ Cannot access POS</li>
            <li>❌ Cannot view financial reports</li>
            <li>❌ Cannot manage inventory</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
