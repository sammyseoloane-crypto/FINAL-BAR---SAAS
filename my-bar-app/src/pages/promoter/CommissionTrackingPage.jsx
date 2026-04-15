import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function CommissionTrackingPage() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({
    totalGuests: 0,
    checkedIn: 0,
    revenueGenerated: 0,
    commission: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommissionStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchCommissionStats = async () => {
    if (!userProfile?.id) {
      return;
    }

    try {
      // Fetch guest lists for this promoter
      const { data: guestLists, error } = await supabase
        .from('guest_lists')
        .select('*')
        .eq('promoter_id', userProfile.id);

      if (error) {
        throw error;
      }

      const totalGuests = guestLists.reduce((sum, list) => sum + (list.current_guest_count || 0), 0);
      const checkedIn = guestLists.reduce((sum, list) => sum + (list.checked_in_count || 0), 0);

      // Calculate estimated revenue (example: $20 per checked-in guest)
      const revenueGenerated = checkedIn * 20;
      // Calculate commission (example: 10% of revenue)
      const commission = revenueGenerated * 0.1;

      setStats({
        totalGuests,
        checkedIn,
        revenueGenerated,
        commission,
      });
    } catch (error) {
      console.error('Error fetching commission stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>💰 Commission Tracking</h1>
          <p>Track your earnings and performance</p>
        </div>

        {loading ? (
          <div className="loading">Loading commission data...</div>
        ) : (
          <>
            <div className="dashboard-stats">
              <div className="stat-card">
                <div className="stat-icon">🎟️</div>
                <div className="stat-content">
                  <div className="stat-value">{stats.totalGuests}</div>
                  <div className="stat-label">Total Guests Invited</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <div className="stat-value">{stats.checkedIn}</div>
                  <div className="stat-label">Guests Checked In</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <div className="stat-value">${stats.revenueGenerated.toFixed(2)}</div>
                  <div className="stat-label">Revenue Generated</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💵</div>
                <div className="stat-content">
                  <div className="stat-value">${stats.commission.toFixed(2)}</div>
                  <div className="stat-label">Commission Earned</div>
                </div>
              </div>
            </div>

            <div className="info-box" style={{ marginTop: '20px' }}>
              <strong>📊 Commission Structure:</strong>
              <p>You earn 10% commission on revenue generated from your guests.</p>
              <p>Keep bringing more guests to increase your earnings!</p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
