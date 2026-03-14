import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function ReservationsPage() {
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
        .select('*, tables!table_id(table_number, name), profiles!user_id(email)')
        .eq('tenant_id', userProfile.tenant_id)
        .order('reservation_date', { ascending: true });

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

  const approveReservation = async (reservationId) => {
    try {
      const { error } = await supabase
        .from('table_reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservationId);

      if (error) {
        throw error;
      }
      fetchReservations();
      alert('Reservation approved');
    } catch (error) {
      console.error('Error approving reservation:', error);
      alert('Failed to approve reservation');
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>📅 Reservations</h1>
          <p>Approve and manage table reservations</p>
        </div>

        {loading ? (
          <div className="loading">Loading reservations...</div>
        ) : reservations.length === 0 ? (
          <div className="info-box">
            <p>No reservations found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Guest</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Guest Count</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.tables?.name || reservation.tables?.table_number || 'N/A'}</td>
                    <td>{reservation.profiles?.email || 'N/A'}</td>
                    <td>{new Date(reservation.reservation_date).toLocaleDateString()}</td>
                    <td>{reservation.reservation_time || 'N/A'}</td>
                    <td>{reservation.guest_count || 'N/A'}</td>
                    <td>
                      <span className={`status-badge status-${reservation.status}`}>
                        {reservation.status}
                      </span>
                    </td>
                    <td>
                      {reservation.status === 'pending' && (
                        <button
                          onClick={() => approveReservation(reservation.id)}
                          className="btn-success"
                        >
                          Approve
                        </button>
                      )}
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
