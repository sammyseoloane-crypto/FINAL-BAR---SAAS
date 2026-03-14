import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import './NightclubDashboard.css';

export default function NightclubDashboard() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    liveRevenue: 0,
    activeTables: 0,
    activeBarTabs: 0,
    bottleOrders: 0,
    guestListCheckins: 0,
    currentOccupancy: 0,
    revenueToday: 0,
    vipCustomers: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [tableReservations, setTableReservations] = useState([]);
  const [bottleServiceOrders, setBottleServiceOrders] = useState([]);
  const [guestListStats, setGuestListStats] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [activePromoters, setActivePromoters] = useState([]);

  useEffect(() => {
    if (user && profile && profile.role === 'owner') {
      loadDashboardData();

      // Real-time subscription for live updates
      const channel = supabase
        .channel('nightclub-dashboard')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `tenant_id=eq.${profile.tenant_id}`,
          },
          () => {
            loadDashboardData();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      // Live Revenue (today)
      const { data: todayTransactions } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', `${today}T00:00:00`)
        .eq('status', 'completed');

      const todayRevenue = todayTransactions?.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0) || 0;

      // Active Tables (reserved or occupied)
      const { data: activeTables } = await supabase
        .from('table_reservations')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['confirmed', 'checked_in'])
        .gte('reservation_datetime', now.toISOString())
        .lte('reservation_datetime', new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString());

      // Active Bar Tabs
      const { data: activeTabs } = await supabase
        .from('bar_tabs')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'open');

      // Pending Bottle Orders
      const { data: pendingBottles } = await supabase
        .from('bottle_orders')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['pending', 'confirmed', 'preparing']);

      // Guest List Check-ins (today)
      const { data: guestCheckins } = await supabase
        .from('guest_list_entries')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('checked_in', true)
        .gte('checked_in_at', `${today}T00:00:00`);

      // VIP Customers (active)
      const { data: vipCustomers } = await supabase
        .from('customer_vip_status')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'active');

      setMetrics({
        revenueToday: todayRevenue,
        activeTables: activeTables?.length || 0,
        activeBarTabs: activeTabs?.length || 0,
        bottleOrders: pendingBottles?.length || 0,
        guestListCheckins: guestCheckins?.length || 0,
        vipCustomers: vipCustomers?.length || 0,
      });

      // Recent Transactions (last 10)
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentTransactions(transactions || []);

      // Table Reservations (today and upcoming)
      const { data: reservations } = await supabase
        .from('table_reservations')
        .select(`
          *,
          tables:table_id (
            name,
            capacity
          ),
          profiles:user_id (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('reservation_date', today)
        .order('reservation_datetime', { ascending: true })
        .limit(10);

      setTableReservations(reservations || []);

      // Bottle Service Orders (pending/active)
      const { data: bottles } = await supabase
        .from('bottle_orders')
        .select(`
          *,
          tables:table_id (
            name
          ),
          bottle_packages:package_id (
            name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['pending', 'confirmed', 'preparing', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(10);

      setBottleServiceOrders(bottles || []);

      // Guest List Stats (today's events)
      const { data: guestLists } = await supabase
        .from('guest_lists')
        .select(`
          *,
          events:event_id (
            name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('event_date', today)
        .order('created_at', { ascending: false });

      setGuestListStats(guestLists || []);

      // Top Performers (staff by revenue today)
      const { data: staffPerformance } = await supabase
        .from('transactions')
        .select(`
          processed_by,
          total_amount,
          profiles:processed_by (
            first_name,
            last_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', `${today}T00:00:00`)
        .eq('status', 'completed')
        .not('processed_by', 'is', null);

      const staffMap = {};
      staffPerformance?.forEach((t) => {
        if (t.processed_by) {
          if (!staffMap[t.processed_by]) {
            staffMap[t.processed_by] = {
              id: t.processed_by,
              name: `${t.profiles?.first_name || ''} ${t.profiles?.last_name || ''}`.trim(),
              revenue: 0,
              count: 0,
            };
          }
          staffMap[t.processed_by].revenue += parseFloat(t.total_amount || 0);
          staffMap[t.processed_by].count += 1;
        }
      });

      const sortedStaff = Object.values(staffMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopPerformers(sortedStaff);

      // Active Promoters (by today's check-ins)
      const { data: promoterStats } = await supabase
        .from('promoters')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'active')
        .order('total_guests', { ascending: false })
        .limit(5);

      setActivePromoters(promoterStats || []);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `R${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#FFC107',
      confirmed: '#4CAF50',
      checked_in: '#2196F3',
      completed: '#9C27B0',
      cancelled: '#f44336',
      open: '#4CAF50',
      closed: '#9E9E9E',
      preparing: '#FF9800',
      delivered: '#00BCD4',
    };
    return colors[status] || '#808080';
  };

  if (loading) {
    return (
      <div className="nightclub-dashboard">
        <div className="loading-spinner">Loading nightclub dashboard...</div>
      </div>
    );
  }

  return (
    <div className="nightclub-dashboard">
      <div className="dashboard-header">
        <h1>🎉 Nightclub Operations</h1>
        <p className="dashboard-subtitle">Real-time venue management & analytics</p>
      </div>

      {/* Live Metrics */}
      <div className="metrics-grid">
        <div className="metric-card revenue">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>{formatCurrency(metrics.revenueToday)}</h3>
            <p>Today&apos;s Revenue</p>
          </div>
        </div>

        <div className="metric-card tables">
          <div className="metric-icon">🪑</div>
          <div className="metric-content">
            <h3>{metrics.activeTables}</h3>
            <p>Active Tables</p>
          </div>
        </div>

        <div className="metric-card tabs">
          <div className="metric-icon">📋</div>
          <div className="metric-content">
            <h3>{metrics.activeBarTabs}</h3>
            <p>Open Bar Tabs</p>
          </div>
        </div>

        <div className="metric-card bottles">
          <div className="metric-icon">🍾</div>
          <div className="metric-content">
            <h3>{metrics.bottleOrders}</h3>
            <p>Bottle Orders</p>
          </div>
        </div>

        <div className="metric-card guests">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <h3>{metrics.guestListCheckins}</h3>
            <p>Guest List Check-ins</p>
          </div>
        </div>

        <div className="metric-card vip">
          <div className="metric-icon">⭐</div>
          <div className="metric-content">
            <h3>{metrics.vipCustomers}</h3>
            <p>VIP Customers</p>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Table Reservations */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>🪑 Table Reservations</h2>
            <span className="count-badge">{tableReservations.length}</span>
          </div>
          <div className="card-content">
            {tableReservations.length > 0 ? (
              <div className="reservations-list">
                {tableReservations.map((res) => (
                  <div key={res.id} className="reservation-item">
                    <div className="reservation-info">
                      <strong>{res.tables?.name || 'Table'}</strong>
                      <span className="guest-name">
                        {res.profiles?.first_name} {res.profiles?.last_name}
                      </span>
                      <span className="guest-count">{res.guest_count} guests</span>
                    </div>
                    <div className="reservation-meta">
                      <span className="time">{formatTime(res.reservation_datetime)}</span>
                      <span
                        className="status-dot"
                        style={{ backgroundColor: getStatusColor(res.status) }}
                        title={res.status}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No reservations today</div>
            )}
          </div>
        </div>

        {/* Bottle Service Orders */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>🍾 Bottle Service</h2>
            <span className="count-badge">{bottleServiceOrders.length}</span>
          </div>
          <div className="card-content">
            {bottleServiceOrders.length > 0 ? (
              <div className="bottle-orders-list">
                {bottleServiceOrders.map((order) => (
                  <div key={order.id} className="bottle-order-item">
                    <div className="order-info">
                      <strong>{order.bottle_packages?.name || 'Custom Order'}</strong>
                      <span className="table-name">{order.tables?.name || 'No table'}</span>
                      <span className="order-amount">{formatCurrency(order.total_amount)}</span>
                    </div>
                    <div className="order-meta">
                      <span className="order-time">{formatTime(order.created_at)}</span>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(order.status) }}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No pending bottle orders</div>
            )}
          </div>
        </div>

        {/* Guest Lists */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>📋 Guest Lists</h2>
            <span className="count-badge">{guestListStats.length}</span>
          </div>
          <div className="card-content">
            {guestListStats.length > 0 ? (
              <div className="guest-lists">
                {guestListStats.map((list) => (
                  <div key={list.id} className="guest-list-item">
                    <div className="list-info">
                      <strong>{list.list_name}</strong>
                      {list.events && <span className="event-name">{list.events.name}</span>}
                    </div>
                    <div className="list-stats">
                      <span className="stat">
                        <span className="stat-value">{list.checked_in_count}</span>
                        <span className="stat-label">/ {list.current_guest_count} checked in</span>
                      </span>
                      <span
                        className="status-dot"
                        style={{ backgroundColor: getStatusColor(list.status) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No guest lists today</div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>💳 Live Transactions</h2>
            <span className="count-badge">{recentTransactions.length}</span>
          </div>
          <div className="card-content">
            {recentTransactions.length > 0 ? (
              <div className="transactions-list">
                {recentTransactions.map((txn) => (
                  <div key={txn.id} className="transaction-item">
                    <div className="transaction-info">
                      <span className="transaction-amount">{formatCurrency(txn.total_amount)}</span>
                      <span className="transaction-method">{txn.payment_method}</span>
                    </div>
                    <div className="transaction-meta">
                      <span className="transaction-time">{formatTime(txn.created_at)}</span>
                      {txn.profiles && (
                        <span className="transaction-customer">
                          {txn.profiles.first_name} {txn.profiles.last_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No recent transactions</div>
            )}
          </div>
        </div>

        {/* Top Performers (Staff) */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>🏆 Top Performers</h2>
          </div>
          <div className="card-content">
            {topPerformers.length > 0 ? (
              <div className="performers-list">
                {topPerformers.map((staff, index) => (
                  <div key={staff.id} className="performer-item">
                    <div className="performer-rank">#{index + 1}</div>
                    <div className="performer-info">
                      <strong>{staff.name || 'Unknown'}</strong>
                      <span className="performer-count">{staff.count} transactions</span>
                    </div>
                    <div className="performer-revenue">{formatCurrency(staff.revenue)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No performance data</div>
            )}
          </div>
        </div>

        {/* Active Promoters */}
        <div className="dashboard-card">
          <div className="card-header">
            <h2>🎤 Active Promoters</h2>
          </div>
          <div className="card-content">
            {activePromoters.length > 0 ? (
              <div className="promoters-list">
                {activePromoters.map((promoter) => (
                  <div key={promoter.id} className="promoter-item">
                    <div className="promoter-info">
                      <strong>
                        {promoter.profiles?.first_name} {promoter.profiles?.last_name}
                      </strong>
                      <span className="promoter-code">{promoter.promoter_code}</span>
                    </div>
                    <div className="promoter-stats">
                      <span className="stat-item">
                        <span className="stat-value">{promoter.total_guests}</span>
                        <span className="stat-label">guests</span>
                      </span>
                      <span className="stat-item">
                        <span className="stat-value">{formatCurrency(promoter.total_revenue)}</span>
                        <span className="stat-label">revenue</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No active promoters</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
