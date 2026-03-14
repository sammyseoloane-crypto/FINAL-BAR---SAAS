/**
 * Analytics Dashboard Component
 * Provides comprehensive business analytics and insights
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import './AnalyticsDashboard.css';

function AnalyticsDashboard({ tenantId }) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [analytics, setAnalytics] = useState({
    revenue: {
      total: 0,
      trend: [],
      growth: 0,
    },
    transactions: {
      count: 0,
      average: 0,
    },
    topProducts: [],
    topCustomers: [],
    hourlyDistribution: [],
    paymentMethods: [],
  });

  useEffect(() => {
    if (tenantId) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, dateRange]);

  const getDateRangeParams = () => {
    const end = new Date();
    const start = new Date();

    switch (dateRange) {
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRangeParams();

      await Promise.all([
        fetchRevenueTrends(start, end),
        fetchTopProducts(start, end),
        fetchTopCustomers(start, end),
        fetchHourlyDistribution(start, end),
        fetchPaymentMethods(start, end),
      ]);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueTrends = async (start, end) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, created_at, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const total = data.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const count = data.length;
      const average = count > 0 ? total / count : 0;

      // Group by day for trend
      const trendMap = new Map();
      data.forEach((t) => {
        const date = new Date(t.created_at).toLocaleDateString();
        if (!trendMap.has(date)) {
          trendMap.set(date, 0);
        }
        trendMap.set(date, trendMap.get(date) + parseFloat(t.amount));
      });

      const trend = Array.from(trendMap.entries()).map(([date, amount]) => ({
        date,
        amount,
      }));

      // Calculate growth (compare first half to second half)
      const midpoint = Math.floor(data.length / 2);
      const firstHalf = data.slice(0, midpoint).reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const secondHalf = data.slice(midpoint).reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

      setAnalytics((prev) => ({
        ...prev,
        revenue: { total, trend, growth },
        transactions: { count, average },
      }));
    } catch (error) {
      console.error('Error fetching revenue trends:', error);
    }
  };

  const fetchTopProducts = async (start, end) => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(
          `
          product:products(id, name),
          quantity,
          price,
          order:orders!inner(
            created_at,
            tenant_id
          )
        `,
        )
        .eq('order.tenant_id', tenantId)
        .gte('order.created_at', start)
        .lte('order.created_at', end);

      if (error) {
        throw error;
      }

      // Aggregate by product
      const productMap = new Map();
      data.forEach((item) => {
        if (!item.product) {
          return;
        }

        const key = item.product.id;
        if (!productMap.has(key)) {
          productMap.set(key, {
            id: item.product.id,
            name: item.product.name,
            quantity: 0,
            revenue: 0,
          });
        }

        const product = productMap.get(key);
        product.quantity += item.quantity;
        product.revenue += parseFloat(item.price) * item.quantity;
      });

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setAnalytics((prev) => ({ ...prev, topProducts }));
    } catch (error) {
      console.error('Error fetching top products:', error);
    }
  };

  const fetchTopCustomers = async (start, end) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          amount,
          user_id,
          profiles(full_name, email)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) {
        throw error;
      }

      // Aggregate by customer
      const customerMap = new Map();
      data.forEach((t) => {
        const key = t.user_id;
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            user_id: t.user_id,
            name: t.profiles?.full_name || 'Unknown',
            email: t.profiles?.email || '',
            total_spent: 0,
            transaction_count: 0,
          });
        }

        const customer = customerMap.get(key);
        customer.total_spent += parseFloat(t.amount);
        customer.transaction_count += 1;
      });

      const topCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10);

      setAnalytics((prev) => ({ ...prev, topCustomers }));
    } catch (error) {
      console.error('Error fetching top customers:', error);
    }
  };

  const fetchHourlyDistribution = async (start, end) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('created_at, amount')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) {
        throw error;
      }

      // Group by hour
      const hourMap = new Map();
      for (let i = 0; i < 24; i++) {
        hourMap.set(i, { hour: i, count: 0, revenue: 0 });
      }

      data.forEach((t) => {
        const hour = new Date(t.created_at).getHours();
        const hourData = hourMap.get(hour);
        hourData.count += 1;
        hourData.revenue += parseFloat(t.amount);
      });

      const hourlyDistribution = Array.from(hourMap.values());

      setAnalytics((prev) => ({ ...prev, hourlyDistribution }));
    } catch (error) {
      console.error('Error fetching hourly distribution:', error);
    }
  };

  const fetchPaymentMethods = async (start, end) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('payment_method, amount')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) {
        throw error;
      }

      // Aggregate by payment method
      const methodMap = new Map();
      data.forEach((t) => {
        const method = t.payment_method || 'unknown';
        if (!methodMap.has(method)) {
          methodMap.set(method, { method, count: 0, total: 0 });
        }
        const methodData = methodMap.get(method);
        methodData.count += 1;
        methodData.total += parseFloat(t.amount);
      });

      const paymentMethods = Array.from(methodMap.values());

      setAnalytics((prev) => ({ ...prev, paymentMethods }));
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  if (loading) {
    return <div className="analytics-dashboard loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h2>Analytics Dashboard</h2>
        <div className="date-range-selector">
          <button
            onClick={() => setDateRange('24h')}
            className={dateRange === '24h' ? 'active' : ''}
          >
            24 Hours
          </button>
          <button onClick={() => setDateRange('7d')} className={dateRange === '7d' ? 'active' : ''}>
            7 Days
          </button>
          <button
            onClick={() => setDateRange('30d')}
            className={dateRange === '30d' ? 'active' : ''}
          >
            30 Days
          </button>
          <button
            onClick={() => setDateRange('90d')}
            className={dateRange === '90d' ? 'active' : ''}
          >
            90 Days
          </button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card revenue">
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">{formatCurrency(analytics.revenue.total)}</div>
          <div
            className={`metric-trend ${analytics.revenue.growth >= 0 ? 'positive' : 'negative'}`}
          >
            {analytics.revenue.growth >= 0 ? '↑' : '↓'}{' '}
            {Math.abs(analytics.revenue.growth).toFixed(1)}%
          </div>
        </div>

        <div className="metric-card transactions">
          <div className="metric-label">Total Transactions</div>
          <div className="metric-value">{analytics.transactions.count}</div>
          <div className="metric-detail">Avg: {formatCurrency(analytics.transactions.average)}</div>
        </div>

        <div className="metric-card customers">
          <div className="metric-label">Active Customers</div>
          <div className="metric-value">{analytics.topCustomers.length}</div>
        </div>

        <div className="metric-card payment-split">
          <div className="metric-label">Payment Methods</div>
          <div className="metric-value">{analytics.paymentMethods.length}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card revenue-trend">
          <h3>Revenue Trend</h3>
          <div className="simple-chart">
            {analytics.revenue.trend.map((point, index) => (
              <div key={index} className="chart-bar">
                <div
                  className="bar"
                  style={{
                    height: `${(point.amount / Math.max(...analytics.revenue.trend.map((p) => p.amount))) * 100}%`,
                  }}
                  title={`${point.date}: ${formatCurrency(point.amount)}`}
                ></div>
                <div className="bar-label">{point.date.split('/')[1]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card hourly-dist">
          <h3>Sales by Hour</h3>
          <div className="simple-chart horizontal">
            {analytics.hourlyDistribution
              .filter((h) => h.count > 0)
              .slice(0, 12)
              .map((hour) => (
                <div key={hour.hour} className="chart-row">
                  <div className="row-label">{hour.hour}:00</div>
                  <div className="row-bar-container">
                    <div
                      className="row-bar"
                      style={{
                        width: `${(hour.revenue / Math.max(...analytics.hourlyDistribution.map((h) => h.revenue))) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <div className="row-value">{formatCurrency(hour.revenue)}</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="tables-grid">
        <div className="table-card">
          <h3>Top Products</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topProducts.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty">
                    No data available
                  </td>
                </tr>
              ) : (
                analytics.topProducts.map((product, index) => (
                  <tr key={product.id}>
                    <td>
                      <span className="rank">#{index + 1}</span> {product.name}
                    </td>
                    <td>{product.quantity}</td>
                    <td className="revenue-cell">{formatCurrency(product.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <h3>Top Customers</h3>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Orders</th>
                <th>Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topCustomers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty">
                    No data available
                  </td>
                </tr>
              ) : (
                analytics.topCustomers.map((customer, index) => (
                  <tr key={customer.user_id}>
                    <td>
                      <span className="rank">#{index + 1}</span>
                      <div className="customer-info">
                        <div className="customer-name">{customer.name}</div>
                        <div className="customer-email">{customer.email}</div>
                      </div>
                    </td>
                    <td>{customer.transaction_count}</td>
                    <td className="revenue-cell">{formatCurrency(customer.total_spent)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <h3>Payment Methods</h3>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Transactions</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {analytics.paymentMethods.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty">
                    No data available
                  </td>
                </tr>
              ) : (
                analytics.paymentMethods.map((method) => (
                  <tr key={method.method}>
                    <td className="payment-method">{method.method.toUpperCase()}</td>
                    <td>{method.count}</td>
                    <td className="revenue-cell">{formatCurrency(method.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

AnalyticsDashboard.propTypes = {
  tenantId: PropTypes.string.isRequired,
};

export default AnalyticsDashboard;
