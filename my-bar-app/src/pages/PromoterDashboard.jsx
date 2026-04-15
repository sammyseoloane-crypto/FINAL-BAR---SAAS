import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function PromoterDashboard() {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalGuestLists: 0,
    activeGuestLists: 0,
    totalGuests: 0,
    totalCommission: 0,
    pendingCommission: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.id) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchStats = async () => {
    try {
      // Get guest lists stats
      const { data: guestLists, error: listsError } = await supabase
        .from('guest_lists')
        .select('id, status, current_guest_count')
        .eq('promoter_id', userProfile.id);

      if (listsError) {
        throw listsError;
      }

      const totalLists = guestLists?.length || 0;
      const activeLists = guestLists?.filter(list => list.status === 'active').length || 0;
      const totalGuests = guestLists?.reduce((sum, list) => sum + (list.current_guest_count || 0), 0) || 0;

      // Get commission stats (if commission tracking exists)
      const { data: commissions } = await supabase
        .from('promoter_commissions')
        .select('amount, status')
        .eq('promoter_id', userProfile.id);

      const totalComm = commissions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const pendingComm = commissions?.filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      setStats({
        totalGuestLists: totalLists,
        activeGuestLists: activeLists,
        totalGuests: totalGuests,
        totalCommission: totalComm,
        pendingCommission: pendingComm,
      });
    } catch (error) {
      console.error('Error fetching promoter stats:', error);
    } finally {
      setLoading(false);
    }
  };

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

        {loading ? (
          <div className="loading">Loading dashboard...</div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="stats-grid" style={{ marginBottom: '30px' }}>
              <div className="stat-card">
                <div className="stat-icon">📋</div>
                <div className="stat-value">{stats.activeGuestLists}</div>
                <div className="stat-label">Active Guest Lists</div>
                <small style={{ color: '#666' }}>Total: {stats.totalGuestLists}</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-value">{stats.totalGuests}</div>
                <div className="stat-label">Total Guests</div>
                <small style={{ color: '#666' }}>Across all lists</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-value">R{stats.totalCommission.toFixed(2)}</div>
                <div className="stat-label">Total Commission</div>
                <small style={{ color: '#666' }}>All time earnings</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-value">R{stats.pendingCommission.toFixed(2)}</div>
                <div className="stat-label">Pending Commission</div>
                <small style={{ color: '#666' }}>Awaiting payment</small>
              </div>
            </div>

            {/* Action Cards */}
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
          </>
        )}
      </div>
    </div>
  );
}
