import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line, Bar, Pie } from 'react-chartjs-2'
import './Pages.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

// Add custom styles for animations
const styles = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.2);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes highlightUpdate {
    0% {
      background-color: #fff9e6;
      box-shadow: 0 0 20px rgba(255, 193, 7, 0.5);
    }
    100% {
      background-color: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    transition: all 0.3s ease;
  }

  .stat-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }

  .stat-card.updating {
    animation: highlightUpdate 1s ease-out;
  }

  .stat-icon {
    font-size: 2.5em;
    margin-bottom: 10px;
  }

  .stat-value {
    font-size: 2em;
    font-weight: bold;
    color: #333;
    margin: 10px 0;
  }

  .stat-label {
    font-size: 0.95em;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Mobile Responsive Styles */
  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat-card {
      padding: 15px 10px;
    }

    .stat-icon {
      font-size: 2em;
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 1.5em;
      margin: 5px 0;
    }

    .stat-label {
      font-size: 0.8em;
    }

    .chart-container {
      height: 250px !important;
      margin-bottom: 15px;
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .data-table {
      min-width: 600px;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .stat-card {
      padding: 12px;
    }

    .stat-value {
      font-size: 1.3em;
    }
  }
`

export default function ReportsPage() {
  const { userProfile } = useAuth()
  const [dateRange, setDateRange] = useState('30') // days
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    pendingTransactions: 0,
    totalProducts: 0,
    activeEvents: 0,
    revenueGrowth: 0
  })
  const [productAnalytics, setProductAnalytics] = useState([])
  const [eventAnalytics, setEventAnalytics] = useState([])
  const [salesTrend, setSalesTrend] = useState({ labels: [], data: [] })
  const [recentTransactions, setRecentTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [updateAnimation, setUpdateAnimation] = useState(false)

  // Initial load and date range changes
  useEffect(() => {
    fetchAllAnalytics()
  }, [dateRange])

  // Real-time subscription for transactions
  useEffect(() => {
    if (!userProfile?.tenant_id || !isLive) return

    console.log('🔴 Setting up real-time analytics subscription...')
    
    // Subscribe to all transaction changes for this tenant
    const channel = supabase
      .channel('analytics-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'transactions',
          filter: `tenant_id=eq.${userProfile.tenant_id}`
        },
        (payload) => {
          console.log('🔴 Real-time update received:', payload)
          setUpdateAnimation(true)
          setLastUpdate(new Date())
          
          // Refresh analytics after a short delay to allow DB to settle
          setTimeout(() => {
            fetchAllAnalytics()
            setTimeout(() => setUpdateAnimation(false), 1000)
          }, 500)
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status)
      })

    return () => {
      console.log('🔴 Cleaning up real-time subscription')
      supabase.removeChannel(channel)
    }
  }, [userProfile?.tenant_id, isLive])

  // Auto-refresh every 30 seconds as backup
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh triggered')
      fetchAllAnalytics()
      setLastUpdate(new Date())
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [isLive, dateRange])

  const fetchAllAnalytics = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchStats(),
        fetchProductAnalytics(),
        fetchEventAnalytics(),
        fetchSalesTrend(),
        fetchRecentTransactions()
      ])
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateFilter = () => {
    const date = new Date()
    date.setDate(date.getDate() - parseInt(dateRange))
    return date.toISOString()
  }

  const fetchStats = async () => {
    try {
      const dateFilter = getDateFilter()
      
      // Transactions for selected period
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('amount, status, created_at')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('created_at', dateFilter)

      if (transError) throw transError

      const confirmedTrans = transactions.filter(t => t.status === 'confirmed')
      const totalRevenue = confirmedTrans.reduce((sum, t) => sum + parseFloat(t.amount), 0)
      const pendingCount = transactions.filter(t => t.status === 'pending').length

      // Previous period for growth calculation
      const prevDate = new Date(dateFilter)
      prevDate.setDate(prevDate.getDate() - parseInt(dateRange))
      
      const { data: prevTransactions } = await supabase
        .from('transactions')
        .select('amount, status')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('created_at', prevDate.toISOString())
        .lt('created_at', dateFilter)

      const prevRevenue = prevTransactions
        ?.filter(t => t.status === 'confirmed')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0

      const revenueGrowth = prevRevenue > 0 
        ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1)
        : 0

      // Total products
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userProfile.tenant_id)

      // Active events
      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userProfile.tenant_id)
        .eq('active', true)

      setStats({
        totalRevenue: totalRevenue.toFixed(2),
        totalTransactions: transactions.length,
        pendingTransactions: pendingCount,
        totalProducts: productsCount || 0,
        activeEvents: eventsCount || 0,
        revenueGrowth
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchProductAnalytics = async () => {
    try {
      const dateFilter = getDateFilter()
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('product_id, amount, metadata, status')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('status', 'confirmed')
        .gte('created_at', dateFilter)

      if (error) throw error

      // Get product details
      const productIds = [...new Set(transactions.map(t => t.product_id).filter(Boolean))]
      const { data: products } = await supabase
        .from('products')
        .select('id, name, type')
        .in('id', productIds)

      const productMap = products?.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) || {}

      // Aggregate sales by product
      const productSales = {}
      transactions.forEach(t => {
        const productName = productMap[t.product_id]?.name || t.metadata?.product_name || 'Unknown'
        const productType = productMap[t.product_id]?.type || t.metadata?.product_type || 'other'
        const quantity = parseInt(t.metadata?.quantity || 1)
        
        if (!productSales[productName]) {
          productSales[productName] = {
            name: productName,
            type: productType,
            quantity: 0,
            revenue: 0
          }
        }
        productSales[productName].quantity += quantity
        productSales[productName].revenue += parseFloat(t.amount)
      })

      const analytics = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .map((item, index, arr) => {
          const totalRevenue = arr.reduce((sum, p) => sum + p.revenue, 0)
          const totalQuantity = arr.reduce((sum, p) => sum + p.quantity, 0)
          return {
            ...item,
            revenuePercentage: ((item.revenue / totalRevenue) * 100).toFixed(1),
            quantityPercentage: ((item.quantity / totalQuantity) * 100).toFixed(1)
          }
        })

      setProductAnalytics(analytics)
    } catch (error) {
      console.error('Error fetching product analytics:', error)
    }
  }

  const fetchEventAnalytics = async () => {
    try {
      const dateFilter = getDateFilter()
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('event_id, amount, metadata, status')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('status', 'confirmed')
        .not('event_id', 'is', null)
        .gte('created_at', dateFilter)

      if (error) throw error

      // Get event details
      const eventIds = [...new Set(transactions.map(t => t.event_id).filter(Boolean))]
      const { data: events } = await supabase
        .from('events')
        .select('id, name')
        .in('id', eventIds)

      const eventMap = events?.reduce((acc, e) => ({ ...acc, [e.id]: e }), {}) || {}

      // Aggregate by event
      const eventSales = {}
      transactions.forEach(t => {
        const eventName = eventMap[t.event_id]?.name || t.metadata?.event_name || 'Unknown Event'
        if (!eventSales[eventName]) {
          eventSales[eventName] = {
            name: eventName,
            transactions: 0,
            revenue: 0
          }
        }
        eventSales[eventName].transactions += 1
        eventSales[eventName].revenue += parseFloat(t.amount)
      })

      setEventAnalytics(Object.values(eventSales).sort((a, b) => b.revenue - a.revenue))
    } catch (error) {
      console.error('Error fetching event analytics:', error)
    }
  }

  const fetchSalesTrend = async () => {
    try {
      const dateFilter = getDateFilter()
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, created_at, status')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('status', 'confirmed')
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group by date
      const salesByDate = {}
      transactions.forEach(t => {
        const date = new Date(t.created_at).toLocaleDateString()
        if (!salesByDate[date]) {
          salesByDate[date] = 0
        }
        salesByDate[date] += parseFloat(t.amount)
      })

      const labels = Object.keys(salesByDate)
      const data = Object.values(salesByDate)

      setSalesTrend({ labels, data })
    } catch (error) {
      console.error('Error fetching sales trend:', error)
    }
  }

  const fetchRecentTransactions = async () => {
    try {
      const dateFilter = getDateFilter()
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*, products(name)')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      // Fetch user emails separately from profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds)

        const profileMap = profiles?.reduce((acc, p) => ({ ...acc, [p.user_id]: p }), {}) || {}
        const transactionsWithUsers = data.map(t => ({
          ...t,
          users: profileMap[t.user_id] || null
        }))
        setRecentTransactions(transactionsWithUsers)
      } else {
        setRecentTransactions(data || [])
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  // Chart configurations
  const salesTrendChartData = {
    labels: salesTrend.labels,
    datasets: [
      {
        label: 'Daily Revenue (R)',
        data: salesTrend.data,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.3
      }
    ]
  }

  const productChartData = {
    labels: productAnalytics.slice(0, 5).map(p => p.name),
    datasets: [
      {
        label: 'Revenue (R)',
        data: productAnalytics.slice(0, 5).map(p => p.revenue),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }
    ]
  }

  const productTypeData = () => {
    const typeRevenue = {}
    productAnalytics.forEach(p => {
      if (!typeRevenue[p.type]) typeRevenue[p.type] = 0
      typeRevenue[p.type] += p.revenue
    })
    
    return {
      labels: Object.keys(typeRevenue).map(t => t.replace('_', ' ').toUpperCase()),
      datasets: [{
        data: Object.values(typeRevenue),
        backgroundColor: [
          'rgba(255, 159, 64, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 99, 132, 0.8)'
        ]
      }]
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 10,
          font: {
            size: window.innerWidth < 768 ? 10 : 12
          }
        }
      },
      tooltip: {
        titleFont: {
          size: window.innerWidth < 768 ? 11 : 12
        },
        bodyFont: {
          size: window.innerWidth < 768 ? 10 : 12
        }
      }
    },
    scales: {
      x: {
        ticks: {
          font: {
            size: window.innerWidth < 768 ? 9 : 11
          },
          maxRotation: window.innerWidth < 768 ? 45 : 0,
          minRotation: window.innerWidth < 768 ? 45 : 0
        }
      },
      y: {
        ticks: {
          font: {
            size: window.innerWidth < 768 ? 9 : 11
          }
        }
      }
    }
  }

  return (
    <DashboardLayout>
      <style>{styles}</style>
      <div className="page-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2>📊 Business Analytics & Reports</h2>
            <p>Real-time insights into your bar's performance</p>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.9em', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  background: isLive ? '#28a745' : '#6c757d',
                  animation: isLive ? 'pulse 2s infinite' : 'none'
                }} />
                <span style={{ color: '#666' }}>
                  {isLive ? 'Live Updates' : 'Paused'}
                </span>
              </div>
              <div style={{ color: '#999', fontSize: '0.85em' }}>
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                fetchAllAnalytics()
                setLastUpdate(new Date())
              }}
              style={{ 
                padding: '8px 16px', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                background: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Refresh now"
            >
              🔄 Refresh
            </button>
            
            <button 
              onClick={() => setIsLive(!isLive)}
              style={{ 
                padding: '8px 16px', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                background: isLive ? '#d4edda' : '#f8f9fa',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              title={isLive ? 'Pause live updates' : 'Resume live updates'}
            >
              {isLive ? '⏸️ Pause' : '▶️ Resume'}
            </button>

            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd' }}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading analytics...</div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="stats-grid">
              <div className={`stat-card ${updateAnimation ? 'updating' : ''}`}>
                <div className="stat-icon">💰</div>
                <div className="stat-value">R {stats.totalRevenue}</div>
                <div className="stat-label">Total Revenue</div>
                {stats.revenueGrowth !== 0 && (
                  <div style={{ fontSize: '12px', color: stats.revenueGrowth > 0 ? '#28a745' : '#dc3545', marginTop: '5px' }}>
                    {stats.revenueGrowth > 0 ? '↑' : '↓'} {Math.abs(stats.revenueGrowth)}% vs previous period
                  </div>
                )}
              </div>

              <div className={`stat-card ${updateAnimation ? 'updating' : ''}`}>
                <div className="stat-icon">💳</div>
                <div className="stat-value">{stats.totalTransactions}</div>
                <div className="stat-label">Total Transactions</div>
              </div>

              <div className={`stat-card ${updateAnimation ? 'updating' : ''}`}>
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{stats.pendingTransactions}</div>
                <div className="stat-label">Pending Payments</div>
              </div>

              <div className={`stat-card ${updateAnimation ? 'updating' : ''}`}>
                <div className="stat-icon">🍺</div>
                <div className="stat-value">{stats.totalProducts}</div>
                <div className="stat-label">Products</div>
              </div>

              <div className={`stat-card ${updateAnimation ? 'updating' : ''}`}>
                <div className="stat-icon">🎉</div>
                <div className="stat-value">{stats.activeEvents}</div>
                <div className="stat-label">Active Events</div>
              </div>
            </div>

            {/* Sales Trend Chart */}
            {salesTrend.labels.length > 0 && (
              <div className="card" style={{ marginTop: '20px' }}>
                <div className="card-header">
                  <h3>📈 Revenue Trend</h3>
                </div>
                <div className="card-body" style={{ height: '300px', padding: '20px' }}>
                  <Line data={salesTrendChartData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              {/* Top Products */}
              {productAnalytics.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3>🏆 Top Products by Revenue</h3>
                  </div>
                  <div className="card-body" style={{ height: '300px', padding: '20px' }}>
                    <Bar data={productChartData} options={chartOptions} />
                  </div>
                </div>
              )}

              {/* Sales by Product Type */}
              {productAnalytics.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3>🎯 Revenue by Category</h3>
                  </div>
                  <div className="card-body" style={{ height: '300px', padding: '20px' }}>
                    <Pie data={productTypeData()} options={chartOptions} />
                  </div>
                </div>
              )}
            </div>

            {/* Product Analytics Table */}
            {productAnalytics.length > 0 && (
              <div className="card" style={{ marginTop: '20px' }}>
                <div className="card-header">
                  <h3>📦 Product Performance</h3>
                </div>
                <div className="card-body">
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Type</th>
                          <th>Quantity Sold</th>
                          <th>Revenue</th>
                          <th>Revenue %</th>
                          <th>Quantity %</th>
                        </tr>
                      </thead>
                    <tbody>
                      {productAnalytics.map((product, index) => (
                        <tr key={index}>
                          <td><strong>{product.name}</strong></td>
                          <td>
                            <span style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              background: '#f0f0f0',
                              fontSize: '12px'
                            }}>
                              {product.type === 'drink' ? '🍹 Drink' : 
                               product.type === 'food' ? '🍔 Food' : 
                               product.type === 'entrance_fee' ? '🎫 Entrance' : '📦 Other'}
                            </span>
                          </td>
                          <td>{product.quantity}</td>
                          <td>R {product.revenue.toFixed(2)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ 
                                width: '100px', 
                                height: '8px', 
                                background: '#e0e0e0', 
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{ 
                                  width: `${product.revenuePercentage}%`, 
                                  height: '100%', 
                                  background: '#28a745'
                                }} />
                              </div>
                              {product.revenuePercentage}%
                            </div>
                          </td>
                          <td>{product.quantityPercentage}%</td>
                        </tr>
                      ))}  
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )}

            {/* Event Analytics */}
            {eventAnalytics.length > 0 && (
              <div className="card" style={{ marginTop: '20px' }}>
                <div className="card-header">
                  <h3>🎉 Event Performance</h3>
                </div>
                <div className="card-body">
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="data-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Transactions</th>
                        <th>Revenue</th>
                        <th>Avg Transaction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventAnalytics.map((event, index) => (
                        <tr key={index}>
                          <td><strong>{event.name}</strong></td>
                          <td>{event.transactions}</td>
                          <td>R {event.revenue.toFixed(2)}</td>
                          <td>R {(event.revenue / event.transactions).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="card" style={{ marginTop: '20px' }}>
              <div className="card-header">
                <h3>🕐 Recent Transactions</h3>
              </div>
              <div className="card-body">
                {recentTransactions.length === 0 ? (
                  <div className="empty-state">
                    <p>No transactions in selected period</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((trans) => (
                        <tr key={trans.id}>
                          <td>{new Date(trans.created_at).toLocaleString()}</td>
                          <td>{trans.users?.email || 'Unknown'}</td>
                          <td>{trans.products?.name || trans.metadata?.product_name || 'N/A'}</td>
                          <td>R {trans.amount}</td>
                          <td>
                            <span className={`status-badge status-${trans.status}`}>
                              {trans.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
