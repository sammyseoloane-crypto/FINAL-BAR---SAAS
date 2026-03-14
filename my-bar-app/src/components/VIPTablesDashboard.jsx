import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import FeatureGate from './FeatureGate';
import { FEATURES } from '../utils/subscriptionUtils';
import './VIPTablesDashboard.css';

export default function VIPTablesDashboard() {
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [revenueStats, setRevenueStats] = useState([]);
  const [pricingData, setPricingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [view, setView] = useState('grid'); // 'grid' or 'heatmap'

  // Reservation form state
  const [reservationForm, setReservationForm] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    party_size: 2,
    reservation_date: new Date().toISOString().split('T')[0],
    reservation_time: '20:00',
    special_requests: '',
    deposit_amount: 0,
  });

  // Pricing form state
  const [pricingForm, setPricingForm] = useState({
    base_min_spend: 0,
    custom_min_spend: 0,
  });

  // Get current user and tenant
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantId, setTenantId] = useState(null);

  useEffect(() => {
    loadUserAndData();

    // Subscribe to real-time updates
    const tablesSubscription = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        loadTables();
      })
      .subscribe();

    const reservationsSubscription = supabase
      .channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_reservations' }, () => {
        loadReservations();
      })
      .subscribe();

    return () => {
      tablesSubscription.unsubscribe();
      reservationsSubscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserAndData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      setCurrentUser(user);

      // Get user's profile to find tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
        await Promise.all([
          loadTables(profile.tenant_id),
          loadReservations(profile.tenant_id),
          loadPricingData(profile.tenant_id),
          loadRevenueStats(profile.tenant_id),
        ]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async (tid = tenantId) => {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('tenant_id', tid)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading tables:', error);
    } else {
      setTables(data || []);
    }
  };

  const loadReservations = async (tid = tenantId) => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('table_reservations')
      .select(`
        *,
        tables (name, capacity)
      `)
      .eq('tenant_id', tid)
      .gte('reservation_date', today)
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .order('reservation_datetime');

    if (error) {
      console.error('Error loading reservations:', error);
    } else {
      setReservations(data || []);
    }
  };

  const loadPricingData = async (tid = tenantId) => {
    const { data, error } = await supabase
      .rpc('calculate_dynamic_minimum_spend', {
        p_tenant_id: tid,
        p_reservation_date: new Date().toISOString().split('T')[0],
      });

    if (error) {
      console.error('Error loading pricing data:', error);
    } else if (data && data.length > 0) {
      setPricingData(data[0]); // Get first row for global stats
    }
  };

  const loadRevenueStats = async (tid = tenantId) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .rpc('get_table_revenue_stats', {
        p_tenant_id: tid,
        p_start_date: thirtyDaysAgo.toISOString().split('T')[0],
        p_end_date: new Date().toISOString().split('T')[0],
      });

    if (error) {
      console.error('Error loading revenue stats:', error);
    } else {
      setRevenueStats(data || []);
    }
  };

  const getTableStatus = (table) => {
    const today = new Date().toISOString().split('T')[0];
    const hasReservationToday = reservations.some(
      r => r.table_id === table.id &&
           r.reservation_date === today &&
           r.status !== 'cancelled',
    );

    if (table.status === 'occupied') {
      return 'occupied';
    }
    if (hasReservationToday || table.status === 'reserved') {
      return 'reserved';
    }
    return 'available';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'green';
      case 'reserved': return 'yellow';
      case 'occupied': return 'red';
      default: return 'gray';
    }
  };

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setShowReservationModal(true);
    setReservationForm({
      ...reservationForm,
      deposit_amount: table.deposit_amount || table.base_min_spend * 0.2 || 0,
    });
  };

  const handlePricingClick = (table) => {
    setSelectedTable(table);
    setPricingForm({
      base_min_spend: table.base_min_spend || table.minimum_spend || 0,
      custom_min_spend: table.current_min_spend || 0,
    });
    setShowPricingModal(true);
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();

    if (!currentUser || !selectedTable) {
      return;
    }

    const reservationDatetime = new Date(`${reservationForm.reservation_date}T${reservationForm.reservation_time}`);

    const { error } = await supabase
      .from('table_reservations')
      .insert({
        tenant_id: tenantId,
        table_id: selectedTable.id,
        user_id: currentUser.id,
        guest_count: parseInt(reservationForm.party_size),
        contact_phone: reservationForm.guest_phone,
        contact_email: reservationForm.guest_email,
        reservation_date: reservationForm.reservation_date,
        reservation_time: reservationForm.reservation_time,
        reservation_datetime: reservationDatetime.toISOString(),
        minimum_spend: selectedTable.current_min_spend || selectedTable.base_min_spend || 0,
        deposit_amount: parseFloat(reservationForm.deposit_amount),
        special_requests: reservationForm.special_requests,
        status: 'confirmed',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reservation:', error);
      alert(`Failed to create reservation: ${error.message}`);
    } else {
      alert('Reservation created successfully!');
      setShowReservationModal(false);
      setSelectedTable(null);
      loadReservations();
      loadTables();
      loadPricingData();
    }
  };

  const handleUpdatePricing = async (e) => {
    e.preventDefault();

    if (!selectedTable) {
      return;
    }

    const { error } = await supabase
      .from('tables')
      .update({
        base_min_spend: parseFloat(pricingForm.base_min_spend),
        minimum_spend: parseFloat(pricingForm.base_min_spend),
        current_min_spend: parseFloat(pricingForm.custom_min_spend || pricingForm.base_min_spend),
      })
      .eq('id', selectedTable.id);

    if (error) {
      console.error('Error updating pricing:', error);
      alert(`Failed to update pricing: ${error.message}`);
    } else {
      alert('Pricing updated successfully!');
      setShowPricingModal(false);
      setSelectedTable(null);
      loadTables();
      loadPricingData();
    }
  };

  const getRevenueColor = (stats) => {
    const maxRevenue = Math.max(...revenueStats.map(s => s.total_revenue || 0));
    if (maxRevenue === 0) {
      return '#e0e0e0';
    }

    const intensity = (stats.total_revenue / maxRevenue) * 100;
    if (intensity >= 75) {
      return '#d32f2f'; // Dark red (highest revenue)
    }
    if (intensity >= 50) {
      return '#f57c00'; // Orange
    }
    if (intensity >= 25) {
      return '#ffa726'; // Light orange
    }
    return '#ffcc80'; // Pale orange (lowest revenue)
  };

  if (loading) {
    return (
      <div className="vip-dashboard-loading">
        <div className="spinner"></div>
        <p>Loading VIP Tables Dashboard...</p>
      </div>
    );
  }

  return (
    <FeatureGate feature={FEATURES.VIP_TABLES}>
      <div className="vip-tables-dashboard">
        <header className="dashboard-header">
          <h1>🥂 VIP Tables Dashboard</h1>

          {/* View Toggle */}
          <div className="view-toggle">
            <button
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
            >
              Grid View
            </button>
            <button
              className={view === 'heatmap' ? 'active' : ''}
              onClick={() => setView('heatmap')}
            >
              Revenue Heatmap
            </button>
          </div>

          {/* Pricing Stats */}
          {pricingData && (
            <div className="pricing-stats">
              <div className="stat-card">
                <span className="stat-label">Occupancy Rate</span>
                <span className="stat-value">{pricingData.occupancy_rate}%</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Reserved Tables</span>
                <span className="stat-value">{pricingData.reserved_count} / {pricingData.total_count}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Pricing Tier</span>
                <span className={`stat-value tier-${pricingData.pricing_tier}`}>
                  {pricingData.pricing_tier.toUpperCase()}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Price Adjustment</span>
                <span className="stat-value">+{pricingData.adjustment_percentage}%</span>
              </div>
            </div>
          )}
        </header>

        {/* Tables Grid View */}
        {view === 'grid' && (
          <div className="tables-grid">
            {tables.map(table => {
              const status = getTableStatus(table);
              const statusColor = getStatusColor(status);

              return (
                <div
                  key={table.id}
                  className={`table-card status-${statusColor}`}
                >
                  <div className="table-header">
                    <h3>{table.name}</h3>
                    <span className={`status-badge ${statusColor}`}>
                      {status.toUpperCase()}
                    </span>
                  </div>

                  <div className="table-details">
                    <p><strong>Capacity:</strong> {table.capacity} guests</p>
                    <p><strong>Type:</strong> {table.table_type}</p>
                    {table.zone && <p><strong>Zone:</strong> {table.zone}</p>}

                    <div className="pricing-info">
                      <p>
                        <strong>Base Min Spend:</strong>
                        <span className="price">R{(table.base_min_spend || 0).toLocaleString()}</span>
                      </p>
                      <p>
                        <strong>Current Min Spend:</strong>
                        <span className="price current">R{(table.current_min_spend || table.base_min_spend || 0).toLocaleString()}</span>
                      </p>
                      {table.pricing_tier && table.pricing_tier !== 'standard' && (
                        <span className={`tier-badge ${table.pricing_tier}`}>
                          {table.pricing_tier.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="table-actions">
                    <button
                      className="btn-reserve"
                      onClick={() => handleTableClick(table)}
                      disabled={status === 'occupied'}
                    >
                      Reserve Table
                    </button>
                    <button
                      className="btn-pricing"
                      onClick={() => handlePricingClick(table)}
                    >
                      Update Pricing
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Revenue Heatmap View */}
        {view === 'heatmap' && (
          <div className="revenue-heatmap">
            <h2>30-Day Revenue Heatmap</h2>
            <div className="heatmap-legend">
              <span>Low Revenue</span>
              <div className="legend-gradient"></div>
              <span>High Revenue</span>
            </div>

            <div className="heatmap-grid">
              {tables.map(table => {
                const stats = revenueStats.find(s => s.table_id === table.id);
                const bgColor = stats ? getRevenueColor(stats) : '#e0e0e0';

                return (
                  <div
                    key={table.id}
                    className="heatmap-cell"
                    style={{ backgroundColor: bgColor }}
                    title={`${table.name}: R${(stats?.total_revenue || 0).toLocaleString()}`}
                  >
                    <h4>{table.name}</h4>
                    <div className="revenue-details">
                      <p className="revenue-amount">R{(stats?.total_revenue || 0).toLocaleString()}</p>
                      <p className="revenue-meta">{stats?.reservation_count || 0} reservations</p>
                      <p className="revenue-meta">Avg: R{(stats?.avg_spend || 0).toLocaleString()}</p>
                      {stats?.revenue_rank && (
                        <span className="revenue-rank">#{stats.revenue_rank}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Reservations */}
        <section className="upcoming-reservations">
          <h2>Upcoming Reservations</h2>
          <div className="reservations-list">
            {reservations.length === 0 ? (
              <p className="no-reservations">No upcoming reservations</p>
            ) : (
              <table className="reservations-table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Date & Time</th>
                    <th>Guests</th>
                    <th>Min Spend</th>
                    <th>Deposit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(res => (
                    <tr key={res.id}>
                      <td>{res.tables?.name}</td>
                      <td>{new Date(res.reservation_datetime).toLocaleString()}</td>
                      <td>{res.guest_count}</td>
                      <td>R{(res.minimum_spend || 0).toLocaleString()}</td>
                      <td>R{(res.deposit_amount || 0).toLocaleString()}</td>
                      <td>
                        <span className={`status-badge ${res.status}`}>
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Reservation Modal */}
        {showReservationModal && selectedTable && (
          <div className="modal-overlay" onClick={() => setShowReservationModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Reserve {selectedTable.name}</h2>
              <form onSubmit={handleCreateReservation}>
                <div className="form-group">
                  <label>Guest Name *</label>
                  <input
                    type="text"
                    required
                    value={reservationForm.guest_name}
                    onChange={e => setReservationForm({ ...reservationForm, guest_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    required
                    value={reservationForm.guest_phone}
                    onChange={e => setReservationForm({ ...reservationForm, guest_phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={reservationForm.guest_email}
                    onChange={e => setReservationForm({ ...reservationForm, guest_email: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      required
                      value={reservationForm.reservation_date}
                      onChange={e => setReservationForm({ ...reservationForm, reservation_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Time *</label>
                    <input
                      type="time"
                      required
                      value={reservationForm.reservation_time}
                      onChange={e => setReservationForm({ ...reservationForm, reservation_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Party Size *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedTable.capacity}
                    required
                    value={reservationForm.party_size}
                    onChange={e => setReservationForm({ ...reservationForm, party_size: e.target.value })}
                  />
                  <small>Max capacity: {selectedTable.capacity}</small>
                </div>

                <div className="form-group">
                  <label>Deposit Amount (R)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reservationForm.deposit_amount}
                    onChange={e => setReservationForm({ ...reservationForm, deposit_amount: e.target.value })}
                  />
                  <small>Minimum spend: R{(selectedTable.current_min_spend || 0).toLocaleString()}</small>
                </div>

                <div className="form-group">
                  <label>Special Requests</label>
                  <textarea
                    rows="3"
                    value={reservationForm.special_requests}
                    onChange={e => setReservationForm({ ...reservationForm, special_requests: e.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowReservationModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Confirm Reservation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pricing Modal */}
        {showPricingModal && selectedTable && (
          <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Update Pricing - {selectedTable.name}</h2>
              <form onSubmit={handleUpdatePricing}>
                <div className="form-group">
                  <label>Base Minimum Spend (R) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={pricingForm.base_min_spend}
                    onChange={e => setPricingForm({ ...pricingForm, base_min_spend: e.target.value })}
                  />
                  <small>This is the standard price before dynamic adjustments</small>
                </div>

                <div className="form-group">
                  <label>Custom Minimum Spend (R)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingForm.custom_min_spend}
                    onChange={e => setPricingForm({ ...pricingForm, custom_min_spend: e.target.value })}
                    placeholder="Leave empty for automatic pricing"
                  />
                  <small>Override automatic pricing (optional)</small>
                </div>

                <div className="pricing-preview">
                  <h4>Pricing Preview</h4>
                  <p>Base: R{parseFloat(pricingForm.base_min_spend || 0).toLocaleString()}</p>
                  {pricingData && (
                    <>
                      <p>With {pricingData.adjustment_percentage}% adjustment:
                        R{(parseFloat(pricingForm.base_min_spend || 0) * (1 + pricingData.adjustment_percentage / 100)).toLocaleString()}
                      </p>
                    </>
                  )}
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowPricingModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update Pricing
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}