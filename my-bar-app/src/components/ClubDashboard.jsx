import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import './ClubDashboard.css';

// Animated counter component
function AnimatedCounter({ value, duration = 1000, prefix = '', suffix = '' }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const currentCount = Math.floor(progress * value);

      setCount(currentCount);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return (
    <span className="animated-counter">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

AnimatedCounter.propTypes = {
  value: PropTypes.number.isRequired,
  duration: PropTypes.number,
  prefix: PropTypes.string,
  suffix: PropTypes.string,
};

export default function ClubDashboard() {
  const [tenantId, setTenantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasData, setHasData] = useState(false);

  // KPI Metrics
  const [revenueTonight, setRevenueTonight] = useState(0);
  const [drinksSold, setDrinksSold] = useState(0);
  const [vipTablesActive, setVipTablesActive] = useState(0);
  const [guestListEntries, setGuestListEntries] = useState(0);
  const [crowdSize, setCrowdSize] = useState({ current: 0, max: 500, rate: 0 });
  const [topDrinks, setTopDrinks] = useState([]);
  const [topStaff, setTopStaff] = useState([]);

  // Chart Data
  const [hourlyRevenue, setHourlyRevenue] = useState([]);
  const [hourlyDrinks, setHourlyDrinks] = useState([]);
  const [hourlyGuests, setHourlyGuests] = useState([]);

  // Real-time update timestamp
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Get tenant ID
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();

        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
        }
      } catch (error) {
        console.error('Error loading tenant:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, []);

  // Load all metrics
  const loadMetrics = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    try {
      // Load revenue stats
      const { data: revenueData, error: revenueError } = await supabase
        .rpc('get_tonight_revenue_stats', { p_tenant_id: tenantId });

      if (revenueError) {
        console.error('Error loading revenue stats:', revenueError);
      } else if (revenueData && revenueData.length > 0) {
        setRevenueTonight(parseFloat(revenueData[0].total_revenue) || 0);
      }

      // Load drinks sold today
      const { data: drinksData, error: drinksError } = await supabase
        .from('drinks_sold')
        .select('quantity')
        .eq('tenant_id', tenantId)
        .eq('shift_date', new Date().toISOString().split('T')[0]);

      if (drinksError) {
        console.error('Error loading drinks:', drinksError);
      } else {
        const totalDrinks = drinksData?.reduce((sum, d) => sum + d.quantity, 0) || 0;
        setDrinksSold(totalDrinks);
      }

      // Load active VIP tables
      const { data: vipCount, error: vipError } = await supabase
        .rpc('get_active_vip_tables', { p_tenant_id: tenantId });

      if (vipError) {
        console.error('Error loading VIP tables:', vipError);
      } else {
        setVipTablesActive(vipCount || 0);
      }

      // Load guest list entries (checked in)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: guestData } = await supabase
        .from('guest_list_entries')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('checked_in', true)
        .gte('checked_in_at', todayStart.toISOString());

      setGuestListEntries(guestData?.length || 0);

      // Load crowd size
      const { data: crowdData } = await supabase
        .rpc('get_current_crowd_size', { p_tenant_id: tenantId });

      if (crowdData && crowdData.length > 0) {
        setCrowdSize({
          current: crowdData[0].current_capacity || 0,
          max: crowdData[0].max_capacity || 500,
          rate: parseFloat(crowdData[0].occupancy_rate) || 0,
        });
      }

      // Load top drinks
      const { data: topDrinksData } = await supabase
        .rpc('get_top_selling_drinks', {
          p_tenant_id: tenantId,
          p_date: new Date().toISOString().split('T')[0],
          p_limit: 5,
        });

      setTopDrinks(topDrinksData || []);

      // Load top staff
      const { data: topStaffData } = await supabase
        .rpc('get_top_staff_performers', {
          p_tenant_id: tenantId,
          p_date: new Date().toISOString().split('T')[0],
          p_limit: 5,
        });

      setTopStaff(topStaffData || []);

      // Load hourly revenue
      const { data: hourlyRevData } = await supabase
        .rpc('get_hourly_revenue', {
          p_tenant_id: tenantId,
          p_date: new Date().toISOString().split('T')[0],
        });

      setHourlyRevenue(hourlyRevData || []);

      // Load hourly drinks
      const { data: hourlyDrinksData } = await supabase
        .rpc('get_hourly_drinks_sold', {
          p_tenant_id: tenantId,
          p_date: new Date().toISOString().split('T')[0],
        });

      setHourlyDrinks(hourlyDrinksData || []);

      // Load hourly guest entries
      const { data: hourlyGuestData } = await supabase
        .rpc('get_hourly_guest_entries', {
          p_tenant_id: tenantId,
          p_date: new Date().toISOString().split('T')[0],
        });

      setHourlyGuests(hourlyGuestData || []);

      // Check if we have any data
      const dataExists =
        (revenueData && revenueData.length > 0 && revenueData[0].total_revenue > 0) ||
        (drinksData && drinksData.length > 0) ||
        (vipCount && vipCount > 0) ||
        (guestData && guestData.length > 0) ||
        (topDrinksData && topDrinksData.length > 0) ||
        (hourlyRevData && hourlyRevData.length > 0);

      setHasData(dataExists);
      setLastUpdate(new Date());
      setError(null);
    } catch (error) {
      console.error('Error loading metrics:', error);
      setError(error.message);
    }
  }, [tenantId]);

  // Initial load
  useEffect(() => {
    if (tenantId) {
      loadMetrics();
    }
  }, [tenantId, loadMetrics]);

  // Real-time subscriptions
  useEffect(() => {
    if (!tenantId) {
      return;
    }

    // Subscribe to transactions
    const transactionsChannel = supabase
      .channel('club-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadMetrics();
        },
      )
      .subscribe();

    // Subscribe to drinks_sold
    const drinksChannel = supabase
      .channel('club-drinks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drinks_sold',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadMetrics();
        },
      )
      .subscribe();

    // Subscribe to guest_list_entries
    const guestsChannel = supabase
      .channel('club-guests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guest_list_entries',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadMetrics();
        },
      )
      .subscribe();

    // Subscribe to tables
    const tablesChannel = supabase
      .channel('club-tables')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tables',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadMetrics();
        },
      )
      .subscribe();

    // Subscribe to staff_sales
    const staffChannel = supabase
      .channel('club-staff')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_sales',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadMetrics();
        },
      )
      .subscribe();

    // Subscribe to crowd_tracking
    const crowdChannel = supabase
      .channel('club-crowd')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crowd_tracking',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          loadMetrics();
        },
      )
      .subscribe();

    return () => {
      transactionsChannel.unsubscribe();
      drinksChannel.unsubscribe();
      guestsChannel.unsubscribe();
      tablesChannel.unsubscribe();
      staffChannel.unsubscribe();
      crowdChannel.unsubscribe();
    };
  }, [tenantId, loadMetrics]);

  // Chart colors
  const COLORS = ['#d4af37', '#daa520', '#f59e0b', '#10b981', '#c9a227'];

  if (loading) {
    return (
      <div className="club-dashboard-loading">
        <div className="spinner"></div>
        <p>Loading Club Dashboard...</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="club-dashboard-error">
        <h2>⚠️ No Tenant Found</h2>
        <p>Unable to load dashboard. Please ensure you&apos;re logged in with a valid account.</p>
      </div>
    );
  }

  return (
    <div className="club-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🎵 Live Club Performance</h1>
          <div className="last-update">
            <span className="update-dot"></span>
            <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {/* No Data Warning */}
      {!hasData && !error && (
        <div className="info-banner">
          <h3>📊 No Data Yet</h3>
          <p>Your dashboard is ready, but there&apos;s no data to display yet.</p>
          <p><strong>To populate sample data:</strong></p>
          <ol>
            <li>Go to your Supabase Dashboard</li>
            <li>Open SQL Editor</li>
            <li>Run the <code>POPULATE_SAMPLE_DASHBOARD_DATA.sql</code> script</li>
            <li>Refresh this page</li>
          </ol>
          <p>Or wait for real transactions and activity to start flowing in!</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card revenue">
          <div className="kpi-icon">💰</div>
          <div className="kpi-content">
            <h3>Revenue Tonight</h3>
            <div className="kpi-value">
              <AnimatedCounter value={revenueTonight} prefix="R" />
            </div>
            <p className="kpi-label">Total transactions</p>
          </div>
        </div>

        <div className="kpi-card drinks">
          <div className="kpi-icon">🍹</div>
          <div className="kpi-content">
            <h3>Drinks Sold</h3>
            <div className="kpi-value">
              <AnimatedCounter value={drinksSold} />
            </div>
            <p className="kpi-label">Total tonight</p>
          </div>
        </div>

        <div className="kpi-card vip">
          <div className="kpi-icon">🥂</div>
          <div className="kpi-content">
            <h3>VIP Tables Active</h3>
            <div className="kpi-value">
              <AnimatedCounter value={vipTablesActive} />
            </div>
            <p className="kpi-label">Reserved or occupied</p>
          </div>
        </div>

        <div className="kpi-card guests">
          <div className="kpi-icon">✅</div>
          <div className="kpi-content">
            <h3>Guest List Entries</h3>
            <div className="kpi-value">
              <AnimatedCounter value={guestListEntries} />
            </div>
            <p className="kpi-label">Checked in</p>
          </div>
        </div>

        <div className="kpi-card crowd">
          <div className="kpi-icon">👥</div>
          <div className="kpi-content">
            <h3>Crowd Size</h3>
            <div className="kpi-value">
              <AnimatedCounter value={crowdSize.current} />
              <span className="kpi-secondary"> / {crowdSize.max}</span>
            </div>
            <div className="capacity-bar">
              <div
                className="capacity-fill"
                style={{ width: `${Math.min(crowdSize.rate, 100)}%` }}
              ></div>
            </div>
            <p className="kpi-label">{crowdSize.rate.toFixed(1)}% capacity</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Revenue per Hour */}
        <div className="chart-card">
          <h3>📈 Revenue Per Hour</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="hour"
                stroke="#9ca3af"
                label={{ value: 'Hour', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                stroke="#9ca3af"
                label={{ value: 'Revenue (R)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#d4af37"
                strokeWidth={2}
                dot={{ fill: '#d4af37', r: 5 }}
                activeDot={{ r: 8 }}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Drinks per Hour */}
        <div className="chart-card">
          <h3>🍸 Drinks Sold Per Hour</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyDrinks}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="hour"
                stroke="#9ca3af"
                label={{ value: 'Hour', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                stroke="#9ca3af"
                label={{ value: 'Drinks', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend />
              <Bar dataKey="drinks_count" fill="#daa520" name="Drinks Sold" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Guest Entry Rate */}
        <div className="chart-card">
          <h3>🚪 Guest Entry Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyGuests}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="hour"
                stroke="#9ca3af"
                label={{ value: 'Hour', position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                stroke="#9ca3af"
                label={{ value: 'Guests', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f9fafb' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="checked_in_count"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                name="Checked In"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Selling Drinks */}
        <div className="chart-card">
          <h3>🏆 Top Selling Drinks</h3>
          {topDrinks.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topDrinks}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.drink_name}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="total_quantity"
                >
                  {topDrinks.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">
              <p>No drinks sold yet tonight</p>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboards */}
      <div className="leaderboards-grid">
        {/* Top Staff */}
        <div className="leaderboard-card">
          <h3>⭐ Top Staff Tonight</h3>
          {topStaff.length > 0 ? (
            <div className="leaderboard-list">
              {topStaff.map((staff, index) => (
                <div key={staff.staff_id} className="leaderboard-item">
                  <div className="rank">{index + 1}</div>
                  <div className="staff-info">
                    <div className="staff-name">{staff.staff_name}</div>
                    <div className="staff-stats">
                      {staff.drinks_sold} drinks • {staff.tables_served} tables
                    </div>
                  </div>
                  <div className="staff-sales">R{parseFloat(staff.total_sales).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <p>No staff sales yet tonight</p>
            </div>
          )}
        </div>

        {/* Top Drinks Detail */}
        <div className="leaderboard-card">
          <h3>🥤 Best Sellers</h3>
          {topDrinks.length > 0 ? (
            <div className="leaderboard-list">
              {topDrinks.map((drink, index) => (
                <div key={index} className="leaderboard-item">
                  <div className="rank">{index + 1}</div>
                  <div className="drink-info">
                    <div className="drink-name">{drink.drink_name}</div>
                    <div className="drink-stats">
                      {drink.total_quantity} sold
                    </div>
                  </div>
                  <div className="drink-revenue">R{parseFloat(drink.total_revenue).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <p>No drinks sold yet tonight</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
