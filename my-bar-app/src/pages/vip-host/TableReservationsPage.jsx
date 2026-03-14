import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function VIPTableReservationsPage() {
  const { userProfile } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchReservations = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('table_reservations')
        .select('*, tables!table_id(name, capacity, table_type), profiles!user_id(email, full_name)')
        .eq('tenant_id', userProfile.tenant_id)
        .order('reservation_datetime', { ascending: true });

      if (error) {
        throw error;
      }
      setReservations(data || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkInReservation = async (reservationId) => {
    try {
      const { error } = await supabase
        .from('table_reservations')
        .update({
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', reservationId);

      if (error) {
        throw error;
      }
      fetchReservations();
      alert('Guest checked in successfully');
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Failed to check in guest');
    }
  };

  const confirmReservation = async (reservationId) => {
    try {
      const { error } = await supabase
        .from('table_reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservationId);

      if (error) {
        throw error;
      }
      fetchReservations();
      alert('Reservation confirmed');
    } catch (error) {
      console.error('Error confirming:', error);
      alert('Failed to confirm reservation');
    }
  };

  const completeReservation = async (reservationId) => {
    try {
      const { error } = await supabase
        .from('table_reservations')
        .update({ status: 'completed' })
        .eq('id', reservationId);

      if (error) {
        throw error;
      }
      fetchReservations();
      alert('Reservation completed');
    } catch (error) {
      console.error('Error completing:', error);
      alert('Failed to complete reservation');
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>🪑 Table Reservations</h1>
          <p>Manage VIP table bookings</p>
        </div>

        {loading ? (
          <div className="loading">Loading reservations...</div>
        ) : reservations.length === 0 ? (
          <div className="info-box">
            <p>No table reservations found.</p>
          </div>
        ) : (
          <>
            <div className="stats-grid" style={{ marginBottom: '20px' }}>
              <div className="stat-card">
                <div className="stat-value">
                  {reservations.filter(r => r.status === 'pending').length}
                </div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {reservations.filter(r => r.status === 'confirmed').length}
                </div>
                <div className="stat-label">Confirmed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {reservations.filter(r => r.status === 'checked_in').length}
                </div>
                <div className="stat-label">Checked In</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {reservations.filter(r => r.status === 'completed').length}
                </div>
                <div className="stat-label">Completed</div>
              </div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Guest</th>
                    <th>Date</th>
                    <th>Party Size</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        {reservation.tables?.name || 'N/A'}
                        <br />
                        <small>{reservation.tables?.table_type || 'Standard'}</small>
                      </td>
                      <td>
                        {reservation.profiles?.full_name || reservation.profiles?.email || 'N/A'}
                      </td>
                      <td>
                        {new Date(reservation.reservation_datetime).toLocaleDateString()}
                        <br />
                        <small>{new Date(reservation.reservation_datetime).toLocaleTimeString()}</small>
                      </td>
                      <td>{reservation.guest_count || 'N/A'}</td>
                      <td>
                        <span className={`status-badge status-${reservation.status}`}>
                          {reservation.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {reservation.status === 'pending' && (
                            <button
                              onClick={() => confirmReservation(reservation.id)}
                              className="btn-primary"
                              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                            >
                              Confirm
                            </button>
                          )}
                          {reservation.status === 'confirmed' && (
                            <button
                              onClick={() => checkInReservation(reservation.id)}
                              className="btn-success"
                              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                            >
                              Check In
                            </button>
                          )}
                          {reservation.status === 'checked_in' && (
                            <button
                              onClick={() => completeReservation(reservation.id)}
                              className="btn-primary"
                              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                            >
                              Complete
                            </button>
                          )}
                          {['completed', 'cancelled', 'no_show'].includes(reservation.status) && (
                            <span style={{ color: '#888', fontSize: '0.85rem' }}>No actions</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
