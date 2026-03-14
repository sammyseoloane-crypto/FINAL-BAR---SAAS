import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function VIPHostDashboard() {
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
          <span className="role-badge role-vip-host">VIP Host</span>
          <PlanBadge />
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>VIP Host Dashboard</h2>
          <p>Welcome back, {userProfile?.email}!</p>
          <p>Manage VIP tables and high-value customers</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">🪑</div>
            <h3>Table Reservations</h3>
            <p>Manage VIP table bookings</p>
            <button className="btn-card" onClick={() => navigate('/vip-host/tables')}>
              Manage Tables
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">✅</div>
            <h3>Table Check-Ins</h3>
            <p>Confirm guest arrivals</p>
            <button className="btn-card" onClick={() => navigate('/vip-host/tables')}>
              Check In Guests
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🍾</div>
            <h3>Bottle Service</h3>
            <p>Manage bottle orders</p>
            <button className="btn-card" onClick={() => navigate('/vip-host/bottle-service')}>
              View Orders
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⭐</div>
            <h3>VIP Guests</h3>
            <p>Track high-value customers</p>
            <button className="btn-card" onClick={() => navigate('/vip-host/guests')}>
              View Guests
            </button>
          </div>
        </div>

        <div className="info-box" style={{ marginTop: '30px' }}>
          <strong>ℹ️ VIP Host Capabilities:</strong>
          <ul>
            <li>✅ Manage table reservations</li>
            <li>✅ Check in guests</li>
            <li>✅ Handle bottle service</li>
            <li>✅ Track VIP customers</li>
            <li>✅ Monitor table spending</li>
            <li>❌ Cannot access POS</li>
            <li>❌ Cannot view financial reports</li>
            <li>❌ Cannot manage inventory</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
