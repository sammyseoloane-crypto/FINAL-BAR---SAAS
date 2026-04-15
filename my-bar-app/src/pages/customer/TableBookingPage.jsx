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
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  useEffect(() => {
    console.log('🔵 TableBookingPage useEffect triggered');
    console.log('🔵 User:', user ? 'Logged in' : 'Not logged in');
    console.log('🔵 UserProfile:', userProfile ? 'Loaded' : 'Not loaded');

    if (user && userProfile) {
      loadData();

      // Check if returning from successful payment
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const sessionId = urlParams.get('session_id');

      console.log('🔵 URL params:', { success, sessionId });

      if (success === 'true' && sessionId) {
        console.log('🎯 PAYMENT SUCCESS DETECTED - Calling handlePaymentSuccess');
        handlePaymentSuccess(sessionId);
      } else {
        console.log('ℹ️ Not a payment return page (normal page load)');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile]);

  const handlePaymentSuccess = async (sessionId) => {
    console.log('🔄 handlePaymentSuccess called with sessionId:', sessionId);

    try {
      // Try to get pending reservation from sessionStorage (persists across Stripe redirect)
      let pendingReservationData = sessionStorage.getItem('pending_reservation');
      console.log('📦 sessionStorage data:', pendingReservationData ? 'Found' : 'NOT FOUND');

      // If sessionStorage is empty (cleared by redirect), retrieve from Stripe session
      if (!pendingReservationData) {
        console.log('🔄 sessionStorage empty, retrieving from Stripe session...');

        try {
          // Call Edge Function to retrieve Stripe session data
          const { data: sessionData, error: sessionError } = await supabase.functions.invoke('get-checkout-session', {
            body: { sessionId },
          });

          if (sessionError) {
            throw sessionError;
          }

          if (sessionData && sessionData.metadata && sessionData.metadata.checkoutType === 'table_deposit') {
            console.log('✅ Retrieved reservation data from Stripe session');

            // Reconstruct pending reservation from Stripe metadata and sessionStorage backup
            const storedData = sessionStorage.getItem(`reservation_backup_${sessionId}`);
            if (storedData) {
              pendingReservationData = storedData;
              console.log('✅ Found backup reservation data');
            } else {
              // Fallback: use what we can from Stripe metadata
              console.warn('⚠️ No backup data found, using minimal Stripe metadata');
              pendingReservationData = JSON.stringify({
                table_id: sessionData.metadata.tableId,
                table_name: sessionData.metadata.tableName,
                deposit_amount: parseFloat(sessionData.metadata.depositAmount),
                stripe_session_id: sessionId,
                guest_count: 4, // Default
                reservation_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
              });
            }
          }
        } catch (err) {
          console.error('❌  Error retrieving Stripe session:', err);
        }
      }

      if (!pendingReservationData) {
        const errorMsg = 'Payment succeeded but reservation details were lost. Please contact support with session ID: ' + sessionId;
        console.error('❌ No pending reservation data found');
        setErrorMessage(errorMsg);
        return;
      }

      const reservationData = JSON.parse(pendingReservationData);
      console.log('📋 Reservation data:', {
        table_name: reservationData.table_name,
        stripe_session_id: reservationData.stripe_session_id,
        deposit_amount: reservationData.deposit_amount      });

      // Verify session ID matches
      if (reservationData.stripe_session_id !== sessionId) {
        const errorMsg = `❌ Session ID mismatch! Expected: ${reservationData.stripe_session_id}, Got: ${sessionId}`;
        console.error(errorMsg);
        setErrorMessage('Payment verification failed. Please contact support.');
        return;
      }

      console.log('✅ Session ID verified');

      // Get table data
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('id', reservationData.table_id)
        .single();

      if (tableError || !table) {
        console.error('❌ Table fetch error:', tableError);
        throw new Error('Table not found: ' + (tableError?.message || 'Unknown error'));
      }

      console.log('✅ Table found:', table.name);

      // Create reservation with deposit marked as paid
      const endDatetime = new Date(new Date(reservationData.reservation_datetime).getTime() + 2 * 60 * 60 * 1000);

      const newReservation = {
        tenant_id: userProfile.tenant_id,
        table_id: reservationData.table_id,
        user_id: user.id,
        event_id: reservationData.event_id || null,
        location_id: userProfile.location_id || null,
        reservation_date: reservationData.reservation_date,
        reservation_time: reservationData.reservation_time,
        reservation_datetime: reservationData.reservation_datetime,
        duration_hours: 2.0,
        end_datetime: endDatetime.toISOString(),
        guest_count: reservationData.guest_count,
        contact_phone: reservationData.contact_phone,
        contact_email: user.email,
        deposit_amount: reservationData.deposit_amount,
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        minimum_spend: reservationData.minimum_spend,
        special_requests: reservationData.special_requests,
        status: 'confirmed', // Confirmed immediately since deposit is paid
        metadata: {
          stripe_session_id: sessionId,
          payment_completed_at: new Date().toISOString(),
        },
      };

      const { error: insertError } = await supabase
        .from('table_reservations')
        .insert([newReservation]);

      if (insertError) {
        console.error('❌ Reservation creation failed:', insertError);
        throw insertError;
      }

      // Wait a moment for the trigger to update table status
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for trigger to update table status
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clean up
      sessionStorage.removeItem('pending_reservation');

      await loadData();

      setSuccessMessage(`✅ Payment successful! Table ${reservationData.table_name} is now reserved for you.`);
      setView('my-reservations');

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);

    } catch (error) {
      console.error('❌ Reservation creation error:', error.message);
      setErrorMessage(`Payment received but reservation creation failed. Please contact support with session ID: ${sessionId}`);
      setView('my-reservations');
    }
  };

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

      // Check and mark any no-shows (expired reservations past grace period)
      try {
        await supabase.rpc('check_and_mark_no_shows');
      } catch (noShowError) {
        console.warn('Could not check no-shows:', noShowError);
        // Non-critical, continue loading data
      }

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

      // Check if table is available using the database function
      const { data: isAvailable, error: availError } = await supabase
        .rpc('is_table_available', {
          p_table_id: selectedTable.id,
          p_reservation_datetime: reservationDatetime.toISOString(),
          p_duration_hours: 2.0,
        });

      if (availError) {
        throw availError;
      }

      if (!isAvailable) {
        throw new Error('This table is already reserved for the selected time. Please choose another time or table.');
      }

      const depositAmount = selectedTable.deposit_amount || 0;

      // If deposit required, process payment first
      if (depositAmount > 0) {
        setPaymentProcessing(true);
        setLoading(false); // Remove general loading while payment processes

        try {
          // Create Stripe checkout session via Edge Function using cart format
          const { data: session, error: sessionError } = await supabase.functions.invoke('create-checkout-session', {
            body: {
              cartItems: [{
                id: selectedTable.id,
                name: `Table Deposit - ${selectedTable.name}`,
                type: 'table_deposit',
                price: depositAmount,
                quantity: 1,
                tenant_id: userProfile.tenant_id,
                productType: 'Table Reservation Deposit',
                date: reservationDate,
              }],
              totalAmount: depositAmount,
              userId: user.id,
              tenantId: userProfile.tenant_id,
            },
          });

          if (sessionError) {
            throw new Error(`Failed to create payment session: ${sessionError.message}`);
          }

          if (!session || !session.url) {
            throw new Error('No payment URL received');
          }

          // Store reservation details in sessionStorage to complete after payment
          // sessionStorage persists across Stripe redirect (unlike localStorage in some browsers)
          const pendingReservation = {
            table_id: selectedTable.id,
            table_name: selectedTable.name,
            reservation_date: reservationDate,
            reservation_time: reservationTime,
            reservation_datetime: reservationDatetime.toISOString(),
            guest_count: guestCount,
            contact_phone: contactPhone || userProfile.phone || '',
            special_requests: specialRequests,
            event_id: selectedEvent || null,
            deposit_amount: depositAmount,
            minimum_spend: selectedTable.minimum_spend || 0,
            stripe_session_id: session.sessionId,
          };

          console.log('💾 SAVING to sessionStorage:', pendingReservation);
          sessionStorage.setItem('pending_reservation', JSON.stringify(pendingReservation));

          // Verify it was saved
          const verification = sessionStorage.getItem('pending_reservation');
          console.log('✅ VERIFIED sessionStorage saved:', verification ? 'YES' : 'NO');
          console.log('✅ Data length:', verification ? verification.length : 0);

          // Redirect to Stripe Checkout
          console.log('🔀 Redirecting to Stripe:', session.url);
          window.location.href = session.url;
          return; // Don't continue, user will be redirected
        } catch (paymentError) {
          setPaymentProcessing(false);
          setLoading(false);
          throw paymentError;
        }
      }

      // No deposit required, create reservation directly
      await createReservation(selectedTable, reservationDatetime, depositAmount, true);


    } catch (error) {
      console.error('Error creating reservation:', error);
      setErrorMessage(error.message || 'Failed to create reservation');
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
    }
  };

  const createReservation = async (table, reservationDatetime, depositAmount, depositPaid = false) => {
    const endDatetime = new Date(reservationDatetime.getTime() + 2 * 60 * 60 * 1000); // 2 hour default

    const reservationData = {
      tenant_id: userProfile.tenant_id,
      table_id: table.id,
      user_id: user.id,
      event_id: selectedEvent || null,
      location_id: userProfile.location_id || null,
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      reservation_datetime: reservationDatetime,
      duration_hours: 2.0,
      end_datetime: endDatetime.toISOString(),
      guest_count: guestCount,
      contact_phone: contactPhone || userProfile.phone || '',
      contact_email: user.email,
      deposit_amount: depositAmount,
      deposit_paid: depositPaid,
      deposit_paid_at: depositPaid ? new Date().toISOString() : null,
      minimum_spend: table.minimum_spend || 0,
      special_requests: specialRequests,
      status: 'confirmed', // Confirmed immediately if deposit paid
    };

    const { data: newReservation, error: insertError } = await supabase
      .from('table_reservations')
      .insert([reservationData])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Wait for trigger to update table status
    await new Promise(resolve => setTimeout(resolve, 500));

    setSuccessMessage(`Table ${table.name} reserved successfully! ${depositPaid ? 'Deposit paid.' : ''}`);

    // Reset form
    setSelectedTable(null);
    setSelectedEvent(null);
    setReservationDate('');
    setReservationTime('20:00');
    setGuestCount(4);
    setSpecialRequests('');


    // Switch to my reservations view
    setTimeout(() => {
      setView('my-reservations');
      setSuccessMessage('');
    }, 2000);
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
          onClick={() => {
            setView('tables');
            setSuccessMessage(''); // Clear any success messages
            setErrorMessage(''); // Clear any error messages
            loadData(); // Refresh data when switching to tables view
          }}
        >
          Available Tables
        </button>
        <button
          className={view === 'my-reservations' ? 'tab-active' : ''}
          onClick={() => {
            setView('my-reservations');
            setSuccessMessage(''); // Clear any success messages
            setErrorMessage(''); // Clear any error messages
            loadData(); // Refresh data when switching to reservations view
          }}
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
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {tables.filter(t => t.status === 'available').length} of {tables.length} tables available
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showOnlyAvailable}
                onChange={(e) => setShowOnlyAvailable(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Show only available tables</span>
            </label>
          </div>
          <div className="tables-grid">
            {tables
              .filter(table => !showOnlyAvailable || table.status === 'available')
              .map((table) => (
              <div
                key={table.id}
                className="table-card"
                style={{
                  borderColor: getTableTypeColor(table.table_type),
                  opacity: table.status === 'reserved' ? 0.7 : 1,
                  position: 'relative',
                }}
              >
                <div
                  className="table-type-badge"
                  style={{ backgroundColor: getTableTypeColor(table.table_type) }}
                >
                  {table.table_type.toUpperCase()}
                </div>
                {table.status === 'reserved' && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    zIndex: 10,
                  }}>
                    RESERVED
                  </div>
                )}
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

                {table.status !== 'available' && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#ffebee',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    textAlign: 'center',
                    color: '#c62828',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                  }}>
                    ⚠️ This table is currently reserved
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={() => handleTableSelect(table)}
                  disabled={table.status !== 'available'}
                  style={{
                    opacity: table.status !== 'available' ? 0.5 : 1,
                    cursor: table.status !== 'available' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {table.status === 'available' ? 'Reserve This Table' : 'Not Available'}
                </button>
              </div>
            ))}
          </div>

          {tables.filter(t => !showOnlyAvailable || t.status === 'available').length === 0 && (
            <div className="empty-state">
              <p>{showOnlyAvailable ? 'No available tables at this time' : 'No tables found'}</p>
              {showOnlyAvailable && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowOnlyAvailable(false)}
                  style={{ marginTop: '10px' }}
                >
                  Show All Tables
                </button>
              )}
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
                {selectedTable.deposit_amount > 0 && (
                  <div className="payment-notice" style={{
                    marginBottom: '15px',
                    padding: '12px',
                    backgroundColor: '#FFF3CD',
                    border: '1px solid #FFE69C',
                    borderRadius: '6px',
                    color: '#856404',
                  }}>
                    <strong>💳 Payment Required</strong>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
                      You will be redirected to secure payment to pay the R{selectedTable.deposit_amount.toFixed(2)} deposit.
                    </p>
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || paymentProcessing}
                  style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 'bold' }}
                >
                  {paymentProcessing ? '🔄 Redirecting to Payment...' :
                   loading ? 'Processing...' :
                   selectedTable.deposit_amount > 0 ?
                     `Pay Deposit & Reserve (R${selectedTable.deposit_amount.toFixed(2)})` :
                     'Confirm Reservation'}
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
