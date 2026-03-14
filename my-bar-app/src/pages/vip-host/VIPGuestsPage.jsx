import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function VIPGuestsPage() {
  const { userProfile } = useAuth();
  const [vipGuests, setVipGuests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVIPGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchVIPGuests = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('table_reservations')
        .select(`
          user_id,
          profiles!user_id(id, email, full_name),
          tables!table_id(table_type)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .eq('status', 'checked_in')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Group by user to get unique VIP guests
      const uniqueGuests = {};
      data.forEach((reservation) => {
        const userId = reservation.user_id;
        if (!uniqueGuests[userId]) {
          uniqueGuests[userId] = {
            ...reservation.profiles,
            totalReservations: 0,
            highestTier: reservation.tables?.table_type,
          };
        }
        uniqueGuests[userId].totalReservations++;
      });

      setVipGuests(Object.values(uniqueGuests));
    } catch (error) {
      console.error('Error fetching VIP guests:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>⭐ VIP Guests</h1>
          <p>Track and manage high-value customers</p>
        </div>

        {loading ? (
          <div className="loading">Loading VIP guests...</div>
        ) : vipGuests.length === 0 ? (
          <div className="info-box">
            <p>No VIP guests found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Email</th>
                  <th>Total Visits</th>
                  <th>Tier</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vipGuests.map((guest) => (
                  <tr key={guest.id}>
                    <td>{guest.full_name || 'N/A'}</td>
                    <td>{guest.email}</td>
                    <td>{guest.totalReservations}</td>
                    <td>
                      <span className="badge badge-gold">
                        {guest.highestTier || 'Standard'}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge status-active">VIP</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
