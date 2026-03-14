import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import '../Dashboard.css';

export default function POSMonitoringPage() {
  const { userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const fetchTransactions = async () => {
    if (!userProfile?.tenant_id) {
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('transactions')
        .select('*, user:profiles!user_id(email, full_name), confirmed_by_profile:profiles!confirmed_by(email, full_name)')
        .eq('tenant_id', userProfile.tenant_id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      const total = data.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      setStats({ total, count: data.length });
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-container">
        <div className="page-header">
          <h1>💳 POS Monitoring</h1>
          <p>Monitor point-of-sale activity in real-time</p>
        </div>

        <div className="dashboard-stats" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-value">${stats.total.toFixed(2)}</div>
              <div className="stat-label">Today&apos;s Sales</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🧾</div>
            <div className="stat-content">
              <div className="stat-value">{stats.count}</div>
              <div className="stat-label">Transactions</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="info-box">
            <p>No transactions recorded today. Activity will appear here as sales are made.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Confirmed By</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.created_at).toLocaleTimeString()}</td>
                    <td>{transaction.user?.full_name || transaction.user?.email || 'N/A'}</td>
                    <td>${parseFloat(transaction.amount || 0).toFixed(2)}</td>
                    <td>
                      <span className={`status-badge status-${transaction.status}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td>{transaction.confirmed_by_profile?.full_name || transaction.confirmed_by_profile?.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="info-box" style={{ marginTop: '20px' }}>
          <strong>ℹ️ POS Monitoring:</strong>
          <ul>
            <li>✅ Real-time transaction monitoring</li>
            <li>✅ View today&apos;s sales and transaction count</li>
            <li>✅ See customer and staff details</li>
            <li>✅ Track transaction status (pending, confirmed, cancelled)</li>
            <li>📊 Last 50 transactions shown</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
