import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import './Pages.css';

export default function EnhancedAnalyticsPage() {
  const { userProfile } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState('7days'); // '7days', '30days', '90days'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, dateRange]);

  async function loadAnalytics() {
    try {
      setLoading(true);

      const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Load analytics snapshots
      const { data: snapshots, error: snapshotError } = await supabase
        .from('analytics_snapshots')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('snapshot_date', startDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: false });

      if (snapshotError) {
        throw snapshotError;
      }

      // Calculate totals
      const totalRevenue = snapshots?.reduce((sum, s) => sum + parseFloat(s.revenue || 0), 0) || 0;
      const totalTransactions = snapshots?.reduce((sum, s) => sum + (s.transaction_count || 0), 0) || 0;
      const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Load hourly metrics for today
      const today = new Date().toISOString().split('T')[0];
      const { data: hourlyData, error: hourlyError } = await supabase
        .from('hourly_metrics')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('hour_timestamp', today)
        .order('hour_timestamp', { ascending: true });

      if (hourlyError) {
        throw hourlyError;
      }

      // Load top products
      const { data: productAnalytics, error: productError } = await supabase
        .from('product_analytics')
        .select(`
          *,
          products (name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('revenue', { ascending: false })
        .limit(10);

      if (productError) {
        throw productError;
      }

      // Aggregate product data
      const productMap = new Map();
      productAnalytics?.forEach((p) => {
        const name = p.products?.name || 'Unknown';
        if (!productMap.has(name)) {
          productMap.set(name, {
            name,
            revenue: 0,
            units_sold: 0,
          });
        }
        const product = productMap.get(name);
        product.revenue += parseFloat(p.revenue || 0);
        product.units_sold += p.units_sold || 0;
      });

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setAnalytics({
        snapshots: snapshots || [],
        hourlyData: hourlyData || [],
        topProducts,
        totalRevenue,
        totalTransactions,
        avgTransactionValue,
      });

    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="owner">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="owner">
      <div className="page-container">
        <div className="page-header">
          <h1>📊 Advanced Analytics</h1>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="date-range-selector"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
        </div>

        {/* Key Metrics */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <h3>R{analytics.totalRevenue.toFixed(2)}</h3>
              <p>Total Revenue</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <h3>{analytics.totalTransactions}</h3>
              <p>Total Transactions</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💳</div>
            <div className="stat-content">
              <h3>R{analytics.avgTransactionValue.toFixed(2)}</h3>
              <p>Avg Transaction Value</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{analytics.snapshots.length}</h3>
              <p>Data Points</p>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="chart-card">
          <h2>Revenue Trend</h2>
          <div className="simple-chart">
            {analytics.snapshots.map((snapshot) => {
              const maxRevenue = Math.max(...analytics.snapshots.map(s => parseFloat(s.revenue || 0)));
              const height = maxRevenue > 0 ? (parseFloat(snapshot.revenue || 0) / maxRevenue) * 100 : 0;

              return (
                <div key={snapshot.id} className="chart-bar-container">
                  <div
                    className="chart-bar"
                    style={{ height: `${height}%` }}
                    title={`R${parseFloat(snapshot.revenue || 0).toFixed(2)}`}
                  ></div>
                  <div className="chart-label">
                    {new Date(snapshot.snapshot_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products */}
        <div className="chart-card">
          <h2>Top Selling Products</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Units Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topProducts.map((product, index) => (
                <tr key={index}>
                  <td>
                    <span className="rank-badge">{index + 1}</span>
                    {product.name}
                  </td>
                  <td>{product.units_sold}</td>
                  <td>R{product.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Hourly Activity Today */}
        {analytics.hourlyData.length > 0 && (
          <div className="chart-card">
            <h2>Today&apos;s Hourly Activity</h2>
            <div className="simple-chart">
              {analytics.hourlyData.map((hour) => {
                const maxRevenue = Math.max(...analytics.hourlyData.map(h => parseFloat(h.revenue || 0)));
                const height = maxRevenue > 0 ? (parseFloat(hour.revenue || 0) / maxRevenue) * 100 : 0;

                return (
                  <div key={hour.id} className="chart-bar-container">
                    <div
                      className="chart-bar"
                      style={{ height: `${height}%`, background: 'linear-gradient(135deg, #50c878 0%, #3da95f 100%)' }}
                      title={`R${parseFloat(hour.revenue || 0).toFixed(2)}`}
                    ></div>
                    <div className="chart-label">
                      {new Date(hour.hour_timestamp).toLocaleTimeString('en-ZA', { hour: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
