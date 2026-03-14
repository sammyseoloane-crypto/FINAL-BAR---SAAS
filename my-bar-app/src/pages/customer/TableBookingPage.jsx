/* eslint-disable indent */
/* eslint-disable react/jsx-indent */
/* eslint-disable react/jsx-indent-props */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import './TableBookingPage.css';

export default function TableBookingPage() {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('20:00');
  const [guestCount, setGuestCount] = useState(4);
  const [specialRequests, setSpecialRequests] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [myReservations, setMyReservations] = useState([]);
  const [view, setView] = useState('tables'); // 'tables', 'book', 'my-reservations'
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user && userProfile) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load available tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .order('table_type', { ascending: true })
        .order('capacity', { ascending: true });

      if (tablesError) {
        throw tablesError;
      }

      setTables(tablesData || []);

      // Load upcoming events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(10);

      if (eventsError) {
        throw eventsError;
      }

      setEvents(eventsData || []);

      // Load user's reservations
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('table_reservations')
        .select(`
          *,
          tables!table_id (
            name,
            table_type,
            capacity
          )
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .eq('user_id', user.id)
        .order('reservation_datetime', { ascending: false })
        .limit(10);

      if (reservationsError) {
        throw reservationsError;
      }

      setMyReservations(reservationsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setErrorMessage('Failed to load table booking data');
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setView('book');
  };

  const handleBookTable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!selectedTable) {
        throw new Error('Please select a table');
      }

      if (!reservationDate || !reservationTime) {
        throw new Error('Please select date and time');
      }

      // Combine date and time
      const reservationDatetime = new Date(`${reservationDate}T${reservationTime}`);

      // Check if table is available
      const { data: existingReservations, error: checkError } = await supabase
        .from('table_reservations')
        .select('id')
        .eq('table_id', selectedTable.id)
        .eq('reservation_date', reservationDate)
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .gte('end_datetime', reservationDatetime.toISOString())
        .lte('reservation_datetime', new Date(reservationDatetime.getTime() + 2 * 60 * 60 * 1000).toISOString());

      if (checkError) {
        throw checkError;
      }

      if (existingReservations && existingReservations.length > 0) {
        throw new Error('This table is already reserved for the selected time. Please choose another time or table.');
      }

      // Create reservation
      const endDatetime = new Date(reservationDatetime.getTime() + 2 * 60 * 60 * 1000); // 2 hour default

      const reservationData = {
        tenant_id: userProfile.tenant_id,
        table_id: selectedTable.id,
        user_id: user.id,
        event_id: selectedEvent || null,
        location_id: userProfile.location_id || null,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        reservation_datetime: reservationDatetime.toISOString(),
        duration_hours: 2.0,
        end_datetime: endDatetime.toISOString(),
        guest_count: guestCount,
        contact_phone: contactPhone || userProfile.phone || '',
        contact_email: user.email,
        deposit_amount: selectedTable.deposit_amount || 0,
        minimum_spend: selectedTable.minimum_spend || 0,
        special_requests: specialRequests,
        status: 'pending',
      };

      const { error: insertError } = await supabase
        .from('table_reservations')
        .insert([reservationData])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      setSuccessMessage(`Table ${selectedTable.name} reserved successfully! Your reservation is pending confirmation.`);

      // Reset form
      setSelectedTable(null);
      setSelectedEvent(null);
      setReservationDate('');
      setReservationTime('20:00');
      setGuestCount(4);
      setSpecialRequests('');

      // Reload reservations
      await loadData();

      // Switch to my reservations view
      setTimeout(() => {
        setView('my-reservations');
        setSuccessMessage('');
      }, 2000);

    } catch (error) {
      console.error('Error creating reservation:', error);
      setErrorMessage(error.message || 'Failed to create reservation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('table_reservations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Cancelled by customer',
        })
        .eq('id', reservationId);

      if (error) {
        throw error;
      }

      setSuccessMessage('Reservation cancelled successfully');
      await loadData();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      setErrorMessage('Failed to cancel reservation');
    }
  };

  const getTableTypeColor = (type) => {
    const colors = {
      vip: '#FFD700',
      booth: '#9370DB',
      standard: '#4CAF50',
      bar: '#FF6B6B',
    };
    return colors[type] || '#808080';
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      checked_in: 'status-checked-in',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      no_show: 'status-no-show',
    };
    return classes[status] || 'status-default';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div>Loading table booking...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ padding: '20px' }}>
        <div className="page-header">
          <h1>VIP Table Booking</h1>
          <p>Reserve your exclusive table for an unforgettable night</p>
        </div>

      <div className="view-tabs">
        <button
          className={view === 'tables' ? 'tab-active' : ''}
          onClick={() => setView('tables')}
        >
          Available Tables
        </button>
        <button
          className={view === 'my-reservations' ? 'tab-active' : ''}
          onClick={() => setView('my-reservations')}
        >
          My Reservations ({myReservations.length})
        </button>
      </div>

      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}

      {errorMessage && (
        <div className="alert alert-error">{errorMessage}</div>
      )}

      {view === 'tables' && (
        <div className="tables-view">
          <div className="tables-grid">
            {tables.map((table) => (
              <div
                key={table.id}
                className="table-card"
                style={{ borderColor: getTableTypeColor(table.table_type) }}
              >
                <div
                  className="table-type-badge"
                  style={{ backgroundColor: getTableTypeColor(table.table_type) }}
                >
                  {table.table_type.toUpperCase()}
                </div>
                <h3>{table.name}</h3>
                {table.zone && <p className="table-zone">{table.zone}</p>}
                <div className="table-details">
                  <div className="detail-item">
                    <span className="detail-label">Capacity:</span>
                    <span className="detail-value">{table.capacity} guests</span>
                  </div>
                  {table.minimum_spend > 0 && (
                    <div className="detail-item">
                      <span className="detail-label">Min Spend:</span>
                      <span className="detail-value">R{table.minimum_spend.toFixed(2)}</span>
                    </div>
                  )}
                  {table.deposit_amount > 0 && (
                    <div className="detail-item">
                      <span className="detail-label">Deposit:</span>
                      <span className="detail-value">R{table.deposit_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {table.amenities && table.amenities.length > 0 && (
                  <div className="table-amenities">
                    {table.amenities.map((amenity, index) => (
                      <span key={index} className="amenity-tag">{amenity}</span>
                    ))}
                  </div>
                )}

                <div className="table-features">
                  {table.has_bottle_service && <span className="feature-icon" title="Bottle Service">🍾</span>}
                  {table.has_waiter_service && <span className="feature-icon" title="Waiter Service">👨‍💼</span>}
                  {table.is_outdoor && <span className="feature-icon" title="Outdoor">🌙</span>}
                </div>

                {table.description && (
                  <p className="table-description">{table.description}</p>
                )}

                <button
                  className="btn btn-primary"
                  onClick={() => handleTableSelect(table)}
                  disabled={table.status !== 'available'}
                >
                  {table.status === 'available' ? 'Reserve This Table' : 'Not Available'}
                </button>
              </div>
            ))}
          </div>

          {tables.length === 0 && (
            <div className="empty-state">
              <p>No tables available at this time</p>
            </div>
          )}
        </div>
      )}

      {view === 'book' && selectedTable && (
        <div className="booking-view">
          <button
            className="btn-back"
            onClick={() => {
              setView('tables');
              setSelectedTable(null);
            }}
          >
            ← Back to Tables
          </button>

          <div className="booking-container">
            <div className="selected-table-info">
              <h2>Selected Table: {selectedTable.name}</h2>
              <p className="table-type" style={{ color: getTableTypeColor(selectedTable.table_type) }}>
                {selectedTable.table_type.toUpperCase()}
              </p>
              <div className="table-summary">
                <p>Capacity: {selectedTable.capacity} guests</p>
                {selectedTable.minimum_spend > 0 && (
                  <p>Minimum Spend: R{selectedTable.minimum_spend.toFixed(2)}</p>
                )}
                {selectedTable.deposit_amount > 0 && (
                  <p><strong>Deposit Required: R{selectedTable.deposit_amount.toFixed(2)}</strong></p>
                )}
              </div>
            </div>

            <form onSubmit={handleBookTable} className="booking-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Reservation Date *</label>
                  <input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Reservation Time *</label>
                  <input
                    type="time"
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Number of Guests *</label>
                  <input
                    type="number"
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value, 10))}
                    min="1"
                    max={selectedTable.capacity}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+27 XX XXX XXXX"
                  />
                </div>
              </div>

              {events.length > 0 && (
                <div className="form-group">
                  <label>Event (Optional)</label>
                  <select
                    value={selectedEvent || ''}
                    onChange={(e) => setSelectedEvent(e.target.value || null)}
                  >
                    <option value="">General Visit</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name} - {new Date(event.date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Special Requests</label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Birthday celebration, dietary restrictions, etc."
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Processing...' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'my-reservations' && (
        <div className="reservations-view">
          {myReservations.length > 0 ? (
            <div className="reservations-list">
              {myReservations.map((reservation) => (
                <div key={reservation.id} className="reservation-card">
                  <div className="reservation-header">
                    <h3>
                      {reservation.tables?.name || 'Table'}
                      <span className={`status-badge ${getStatusBadgeClass(reservation.status)}`}>
                        {reservation.status.replace('_', ' ')}
                      </span>
                    </h3>
                  </div>

                  <div className="reservation-details">
                    <div className="detail-row">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">
                        {new Date(reservation.reservation_datetime).toLocaleDateString('en-ZA', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Time:</span>
                      <span className="detail-value">
                        {new Date(reservation.reservation_datetime).toLocaleTimeString('en-ZA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Guests:</span>
                      <span className="detail-value">{reservation.guest_count}</span>
                    </div>

                    {reservation.minimum_spend > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Minimum Spend:</span>
                        <span className="detail-value">R{reservation.minimum_spend.toFixed(2)}</span>
                      </div>
                    )}

                    {reservation.deposit_amount > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Deposit:</span>
                        <span className="detail-value">
                          R{reservation.deposit_amount.toFixed(2)}
                          {reservation.deposit_paid ? ' ✓ Paid' : ' (Pending)'}
                        </span>
                      </div>
                    )}

                    {reservation.events && (
                      <div className="detail-row">
                        <span className="detail-label">Event:</span>
                        <span className="detail-value">{reservation.events.name}</span>
                      </div>
                    )}

                    {reservation.special_requests && (
                      <div className="detail-row">
                        <span className="detail-label">Special Requests:</span>
                        <span className="detail-value">{reservation.special_requests}</span>
                      </div>
                    )}
                  </div>

                  {reservation.status === 'pending' && (
                    <div className="reservation-actions">
                      <button
                        className="btn btn-danger"
                        onClick={() => handleCancelReservation(reservation.id)}
                      >
                        Cancel Reservation
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>You don&apos;t have any reservations yet</p>
              <button className="btn btn-primary" onClick={() => setView('tables')}>
                Reserve a Table
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
