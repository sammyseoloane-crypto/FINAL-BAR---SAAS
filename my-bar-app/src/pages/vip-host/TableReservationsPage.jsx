import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function VIPTableReservationsPage() {
  const { userProfile } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [gracePeriodReservations, setGracePeriodReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
    fetchGracePeriodReservations();

    // Auto-refresh grace period every minute
    const interval = setInterval(() => {
      fetchGracePeriodReservations();
    }, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchGracePeriodReservations = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_reservations_in_grace_period', {
          p_tenant_id: userProfile.tenant_id,
        });

      if (error) {
        console.error('Grace period error:', error);
        return;
      }
      setGracePeriodReservations(data || []);
    } catch (error) {
      console.error('Error fetching grace period reservations:', error);
    }
  };

  const fetchReservations = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      // First, check and mark any no-shows
      try {
        await supabase.rpc('check_and_mark_no_shows');
      } catch (noShowError) {
        console.warn('Could not check no-shows:', noShowError);
        // Non-critical, continue loading
      }

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
      fetchGracePeriodReservations();
      alert('Guest checked in successfully');
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Failed to check in guest');
    }
  };

  const markDepositPaid = async (reservationId) => {
    try {
      const { error } = await supabase.rpc('mark_deposit_paid', {
        p_reservation_id: reservationId,
        p_marked_by: userProfile.id,
      });

      if (error) {
        throw error;
      }
      fetchReservations();
      alert('Deposit marked as paid');
    } catch (error) {
      console.error('Error marking deposit:', error);
      alert(`Failed to mark deposit as paid: ${error.message}`);
    }
  };

  const confirmReservation = async (reservationId) => {
    try {
      // Use the new function that checks deposit
      const { data, error } = await supabase.rpc('confirm_reservation_with_deposit', {
        p_reservation_id: reservationId,
        p_confirmed_by: userProfile.id,
        p_mark_deposit_paid: false,
      });

      if (error) {
        throw error;
      }

      // Check the result
      if (data && !data.success) {
        if (data.deposit_required) {
          alert(`Cannot confirm: Deposit of R${data.deposit_amount} must be paid first. Please mark deposit as paid before confirming.`);
        } else {
          alert(`Failed to confirm: ${data.error || 'Unknown error'}`);
        }
        return;
      }

      fetchReservations();
      alert('Reservation confirmed successfully');
    } catch (error) {
      console.error('Error confirming:', error);
      alert(`Failed to confirm reservation: ${error.message}`);
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
        ) : (
          <>
            {/* Grace Period Alert Section */}
            {gracePeriodReservations.length > 0 && (
              <div style={{
                backgroundColor: '#fff3cd',
                border: '2px solid #ffc107',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px',
              }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>
                  ⏰ Guests in Grace Period ({gracePeriodReservations.length})
                </h3>
                <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#856404' }}>
                  These guests are late but still within their grace period. Check them in now or they&apos;ll be marked as no-show.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {gracePeriodReservations.map((res) => (
                    <div
                      key={res.reservation_id}
                      style={{
                        backgroundColor: 'white',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #ffc107',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{res.table_name}</strong> - {res.guest_name || 'Guest'}
                        <br />
                        <small style={{ color: '#666' }}>
                          Reserved: {new Date(res.reservation_time).toLocaleTimeString()} |
                          Grace ends: {new Date(res.grace_ends_at).toLocaleTimeString()}
                        </small>
                        <br />
                        <span style={{
                          color: res.minutes_remaining < 5 ? '#dc3545' : '#ffc107',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                        }}>
                          ⏱️ {Math.floor(res.minutes_remaining)} minutes remaining
                        </span>
                      </div>
                      <button
                        onClick={() => checkInReservation(res.reservation_id)}
                        className="btn-success"
                        style={{ padding: '8px 16px' }}
                      >
                        Check In Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reservations.length === 0 ? (
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
                        <th>Deposit</th>
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
                            {reservation.deposit_amount > 0 ? (
                              <div style={{ fontSize: '0.85rem' }}>
                                <div>R{parseFloat(reservation.deposit_amount).toFixed(2)}</div>
                                {reservation.deposit_paid ? (
                                  <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓ Paid</span>
                                ) : (
                                  <span style={{ color: '#f44336', fontWeight: 'bold' }}>✗ Unpaid</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#888', fontSize: '0.85rem' }}>None</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge status-${reservation.status}`}>
                              {reservation.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {reservation.status === 'pending' && (
                                <>
                                  {reservation.deposit_amount > 0 && !reservation.deposit_paid && (
                                    <button
                                      onClick={() => markDepositPaid(reservation.id)}
                                      className="btn-success"
                                      style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                      title="Mark deposit as paid"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                  <button
                                    onClick={() => confirmReservation(reservation.id)}
                                    className="btn-primary"
                                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                    title={reservation.deposit_amount > 0 && !reservation.deposit_paid ?
                                      'Deposit must be paid first' : 'Confirm reservation'}
                                  >
                                    Confirm
                                  </button>
                                </>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
