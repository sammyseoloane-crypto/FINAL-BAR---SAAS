import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import './Pages.css'

export default function ReportsPage() {
  const { userProfile } = useAuth()
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    pendingTransactions: 0,
    totalProducts: 0,
    activeEvents: 0
  })
  const [recentTransactions, setRecentTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchRecentTransactions()
  }, [])

  const fetchStats = async () => {
    try {
      // Total transactions
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('amount, status')
        .eq('tenant_id', userProfile.tenant_id)

      if (transError) throw transError

      const totalRevenue = transactions
        .filter(t => t.status === 'confirmed')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)

      const pendingCount = transactions.filter(t => t.status === 'pending').length

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
        activeEvents: eventsCount || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, users(email), products(name)')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>Reports & Analytics</h2>
          <p>View your business insights</p>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-value">R {stats.totalRevenue}</div>
                <div className="stat-label">Total Revenue</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">💳</div>
                <div className="stat-value">{stats.totalTransactions}</div>
                <div className="stat-label">Total Transactions</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{stats.pendingTransactions}</div>
                <div className="stat-label">Pending Payments</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🍺</div>
                <div className="stat-value">{stats.totalProducts}</div>
                <div className="stat-label">Products</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🎉</div>
                <div className="stat-value">{stats.activeEvents}</div>
                <div className="stat-label">Active Events</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Recent Transactions</h3>
              </div>
              <div className="card-body">
                {recentTransactions.length === 0 ? (
                  <div className="empty-state">
                    <p>No transactions yet</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((trans) => (
                        <tr key={trans.id}>
                          <td>{trans.users?.email || 'Unknown'}</td>
                          <td>{trans.products?.name || 'N/A'}</td>
                          <td>R {trans.amount}</td>
                          <td>
                            <span className={`status-badge status-${trans.status}`}>
                              {trans.status}
                            </span>
                          </td>
                          <td>{new Date(trans.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
