import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import { supabase } from '../../supabaseClient';
import {
  generateSalesPrediction,
  getPredictions,
  getCriticalInventoryAlerts,
  batchGeneratePredictions } from '../../services/aiPredictions';
import { getPricingRules } from '../../services/dynamicPricing';
import './SuperDashboard.css';

const SuperDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real-time metrics
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [activeCustomers, setActiveCustomers] = useState(0);
  const [liveTransactions, setLiveTransactions] = useState([]);

  // AI Predictions
  const [predictions, setPredictions] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState([]);

  // Analytics
  const [topProducts, setTopProducts] = useState([]);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);

  // Pricing rules
  const [activePricingRules, setActivePricingRules] = useState([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
      setupRealtimeSubscriptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTodayMetrics(),
        loadPredictions(),
        loadInventoryAlerts(),
        loadTopProducts(),
        loadStaffPerformance(),
        loadRevenueChart(),
        loadPricingRules(),
        loadVenueActivity(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayMetrics = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      // Today's revenue
      const { data: transactions } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'completed')
        .gte('created_at', today.toISOString());

      const revenue = transactions?.reduce((sum, t) => sum + parseFloat(t.total_amount), 0) || 0;
      setTodayRevenue(revenue);
      setTodayOrders(transactions?.length || 0);

      // Active customers (last 4 hours)
      const fourHoursAgo = new Date();
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('customer_id')
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', fourHoursAgo.toISOString());

      const uniqueCustomers = new Set(recentTransactions?.map(t => t.customer_id).filter(Boolean));
      setActiveCustomers(uniqueCustomers.size);

      // Load recent transactions
      const { data: recent } = await supabase
        .from('transactions')
        .select(`
          id,
          total_amount,
          created_at,
          payment_method,
          profiles:customer_id (
            full_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(5);

      setLiveTransactions(recent || []);

    } catch (error) {
      console.error('Error loading today metrics:', error);
    }
  };

  const loadPredictions = async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const data = await getPredictions(today, tomorrow);
      setPredictions(data);

      // If no predictions exist, generate them
      if (data.length === 0) {
        await generateSalesPrediction(tomorrow);
        const newData = await getPredictions(today, tomorrow);
        setPredictions(newData);
      }
    } catch (error) {
      console.error('Error loading predictions:', error);
    }
  };

  const loadInventoryAlerts = async () => {
    try {
      const alerts = await getCriticalInventoryAlerts();
      setInventoryAlerts(alerts);
    } catch (error) {
      console.error('Error loading inventory alerts:', error);
    }
  };

  const loadTopProducts = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      // Get top products by revenue (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          product_id,
          quantity,
          subtotal,
          products (
            name,
            price
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Aggregate by product
      const productMap = {};
      orders?.forEach(order => {
        if (!productMap[order.product_id]) {
          productMap[order.product_id] = {
            productId: order.product_id,
            name: order.products?.name || 'Unknown',
            totalQuantity: 0,
            totalRevenue: 0,
            orderCount: 0,
          };
        }
        productMap[order.product_id].totalQuantity += order.quantity;
        productMap[order.product_id].totalRevenue += parseFloat(order.subtotal);
        productMap[order.product_id].orderCount++;
      });

      const topProductsList = Object.values(productMap)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);

      setTopProducts(topProductsList);

    } catch (error) {
      console.error('Error loading top products:', error);
    }
  };

  const loadStaffPerformance = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const { data: performance } = await supabase
        .from('staff_performance')
        .select(`
          *,
          profiles:staff_id (
            full_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('period_start', startOfMonth.toISOString().split('T')[0])
        .order('revenue_generated', { ascending: false })
        .limit(5);

      setStaffPerformance(performance || []);

    } catch (error) {
      console.error('Error loading staff performance:', error);
    }
  };

  const loadRevenueChart = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      // Get last 7 days revenue
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        // eslint-disable-next-line no-await-in-loop
        const { data: transactions } = await supabase
          .from('transactions')
          .select('total_amount')
          .eq('tenant_id', profile.tenant_id)
          .eq('status', 'completed')
          .gte('created_at', date.toISOString())
          .lt('created_at', nextDay.toISOString());

        const revenue = transactions?.reduce((sum, t) => sum + parseFloat(t.total_amount), 0) || 0;

        days.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue,
        });
      }

      setRevenueChart(days);

    } catch (error) {
      console.error('Error loading revenue chart:', error);
    }
  };

  const loadPricingRules = async () => {
    try {
      const rules = await getPricingRules();
      const activeRules = rules.filter(r => r.is_active);
      setActivePricingRules(activeRules);
    } catch (error) {
      console.error('Error loading pricing rules:', error);
    }
  };

  const loadVenueActivity = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const currentHour = new Date();
      currentHour.setMinutes(0, 0, 0);

      await supabase
        .from('venue_activity')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .gte('timestamp_hour', currentHour.toISOString())
        .single();

    } catch (error) {
      console.error('Error loading venue activity:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to transactions
    const transactionSubscription = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          loadTodayMetrics();
        },
      )
      .subscribe();

    return () => {
      transactionSubscription.unsubscribe();
    };
  };

  const handleRefreshPredictions = async () => {
    setRefreshing(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await batchGeneratePredictions(tomorrow);
      await loadPredictions();
    } catch (error) {
      console.error('Error refreshing predictions:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshAll = async () => {
    await loadDashboardData();
  };

  if (loading) {
    return (
      <DashboardLayout role="owner">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading Super Dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  const dailyPrediction = predictions.find(p => p.prediction_type === 'daily');
  const maxRevenue = Math.max(...revenueChart.map(d => d.revenue), 1);

  return (
    <DashboardLayout role="owner">
      <div className="super-dashboard">
        <div className="dashboard-header">
          <h1>🎯 Owner Super Dashboard</h1>
          <button onClick={handleRefreshAll} className="refresh-btn">
            🔄 Refresh All
          </button>
        </div>

        {/* Real-Time Metrics */}
        <div className="metrics-grid">
          <div className="metric-card revenue">
            <div className="metric-icon">💰</div>
            <div className="metric-content">
              <h3>Today&apos;s Revenue</h3>
              <p className="metric-value">${todayRevenue.toFixed(2)}</p>
              <span className="metric-label">{todayOrders} orders</span>
            </div>
          </div>

          <div className="metric-card customers">
            <div className="metric-icon">👥</div>
            <div className="metric-content">
              <h3>Active Customers</h3>
              <p className="metric-value">{activeCustomers}</p>
              <span className="metric-label">Last 4 hours</span>
            </div>
          </div>

          <div className="metric-card prediction">
            <div className="metric-icon">🔮</div>
            <div className="metric-content">
              <h3>Tomorrow&apos;s Forecast</h3>
              <p className="metric-value">
                {dailyPrediction ? `$${dailyPrediction.predicted_revenue.toFixed(0)}` : 'N/A'}
              </p>
              <span className="metric-label">
                {dailyPrediction ? `${(dailyPrediction.confidence_score * 100).toFixed(0)}% confidence` : 'Generate prediction'}
              </span>
            </div>
          </div>

          <div className="metric-card alerts">
            <div className="metric-icon">⚠️</div>
            <div className="metric-content">
              <h3>Inventory Alerts</h3>
              <p className="metric-value">{inventoryAlerts.length}</p>
              <span className="metric-label">Critical items</span>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="dashboard-section">
          <h2>📊 7-Day Revenue Trend</h2>
          <div className="revenue-chart">
            {revenueChart.map((day, index) => (
              <div key={index} className="chart-bar-container">
                <div
                  className="chart-bar"
                  style={{ height: `${(day.revenue / maxRevenue) * 100}%` }}
                  title={`$${day.revenue.toFixed(2)}`}
                >
                  <span className="bar-value">${day.revenue.toFixed(0)}</span>
                </div>
                <span className="chart-label">{day.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-row">
          {/* Live Transactions */}
          <div className="dashboard-section half">
            <h2>🔴 Live Transactions</h2>
            <div className="transactions-list">
              {liveTransactions.length === 0 ? (
                <p className="empty-state">No recent transactions</p>
              ) : (
                liveTransactions.map(transaction => (
                  <div key={transaction.id} className="transaction-item">
                    <div className="transaction-info">
                      <strong>{transaction.profiles?.full_name || 'Guest'}</strong>
                      <span className="transaction-method">{transaction.payment_method}</span>
                    </div>
                    <div className="transaction-amount">
                      ${parseFloat(transaction.total_amount).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="dashboard-section half">
            <h2>🏆 Top Products (30 Days)</h2>
            <div className="top-products-list">
              {topProducts.length === 0 ? (
                <p className="empty-state">No product data</p>
              ) : (
                topProducts.map((product, index) => (
                  <div key={product.productId} className="product-item">
                    <span className="product-rank">#{index + 1}</span>
                    <div className="product-info">
                      <strong>{product.name}</strong>
                      <span>{product.totalQuantity} sold</span>
                    </div>
                    <div className="product-revenue">
                      ${product.totalRevenue.toFixed(0)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI Predictions */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>🤖 AI Sales Predictions</h2>
            <button
              onClick={handleRefreshPredictions}
              className="secondary-btn"
              disabled={refreshing}
            >
              {refreshing ? 'Generating...' : '🔄 Regenerate'}
            </button>
          </div>
          {predictions.length === 0 ? (
            <div className="empty-state">
              <p>No predictions available yet</p>
              <button onClick={handleRefreshPredictions} className="primary-btn">
                Generate Predictions
              </button>
            </div>
          ) : (
            <div className="predictions-grid">
              {predictions.slice(0, 6).map((pred, index) => (
                <div key={index} className="prediction-card">
                  <h4>{pred.prediction_type.toUpperCase()}</h4>
                  <p className="prediction-value">${pred.predicted_revenue?.toFixed(0) || 'N/A'}</p>
                  <p className="prediction-volume">{pred.predicted_sales_volume || 0} sales</p>
                  {pred.hour_of_day !== null && (
                    <span className="prediction-time">{pred.hour_of_day}:00</span>
                  )}
                  <div className="prediction-confidence">
                    <div
                      className="confidence-bar"
                      style={{ width: `${(pred.confidence_score || 0) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Alerts */}
        {inventoryAlerts.length > 0 && (
          <div className="dashboard-section alert-section">
            <h2>🚨 Critical Inventory Alerts</h2>
            <div className="alerts-list">
              {inventoryAlerts.map(alert => (
                <div key={alert.id} className={`alert-item ${alert.low_stock_risk}`}>
                  <div className="alert-icon">
                    {alert.low_stock_risk === 'critical' ? '🔴' : '🟠'}
                  </div>
                  <div className="alert-content">
                    <strong>{alert.products?.name}</strong>
                    <p>Current: {alert.current_stock} | Need: {alert.suggested_reorder_quantity}</p>
                    <span className="alert-time">
                      Reorder by: {new Date(alert.suggested_reorder_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="alert-risk">
                    {alert.low_stock_risk.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Pricing Rules */}
        <div className="dashboard-section">
          <h2>💸 Active Dynamic Pricing Rules</h2>
          {activePricingRules.length === 0 ? (
            <p className="empty-state">No active pricing rules</p>
          ) : (
            <div className="pricing-rules-list">
              {activePricingRules.map(rule => (
                <div key={rule.id} className="pricing-rule-item">
                  <div className="rule-header">
                    <strong>{rule.rule_name}</strong>
                    <span className={`rule-type ${rule.rule_type}`}>
                      {rule.rule_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="rule-multipliers">
                    {rule.peak_multiplier !== 1 && (
                      <span>Peak: ×{rule.peak_multiplier}</span>
                    )}
                    {rule.time_multiplier !== 1 && (
                      <span>Time: ×{rule.time_multiplier}</span>
                    )}
                    {rule.demand_multiplier !== 1 && (
                      <span>Demand: ×{rule.demand_multiplier}</span>
                    )}
                    {rule.event_multiplier !== 1 && (
                      <span>Event: ×{rule.event_multiplier}</span>
                    )}
                  </div>
                  {rule.valid_time_start && (
                    <p className="rule-schedule">
                      {rule.valid_time_start} - {rule.valid_time_end}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff Performance */}
        {staffPerformance.length > 0 && (
          <div className="dashboard-section">
            <h2>⭐ Staff Performance (This Month)</h2>
            <div className="staff-performance-list">
              {staffPerformance.map((staff, index) => (
                <div key={staff.id} className="staff-item">
                  <span className="staff-rank">#{index + 1}</span>
                  <div className="staff-info">
                    <strong>{staff.profiles?.full_name || 'Unknown'}</strong>
                    <span>{staff.transactions_handled} transactions</span>
                  </div>
                  <div className="staff-revenue">
                    ${parseFloat(staff.revenue_generated || 0).toFixed(0)}
                  </div>
                  {staff.efficiency_score && (
                    <div className="staff-score">
                      {staff.efficiency_score.toFixed(0)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SuperDashboard;
