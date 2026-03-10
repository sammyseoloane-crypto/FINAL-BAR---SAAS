import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { confirmTransaction } from '../../utils/paymentUtils'
import DashboardLayout from '../../components/DashboardLayout'
import '../owner/Pages.css'

export default function PaymentsPage() {
  const { user, userProfile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    fetchTransactions()
  }, [filter])

  const fetchTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select('*, products(name)')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      
      // Fetch user profiles separately (no custom 'users' table, using profiles)
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))]
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, email')
            .in('user_id', userIds)
          
          // Create a map for quick lookup
          const profileMap = {}
          profiles?.forEach(p => {
            profileMap[p.user_id] = p
          })
          
          // Merge profile data into transactions
          data.forEach(trans => {
            trans.users = profileMap[trans.user_id] || null
          })
        }
      }
      
      setTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const confirmPayment = async (transactionId) => {
    try {
      console.log('[Payments Page] Confirming payment for transaction:', transactionId);
      
      // Use the proper utility function which creates QR code automatically
      const result = await confirmTransaction(transactionId, user.id);
      
      if (result.error) {
        throw result.error;
      }
      
      console.log('[Payments Page] ✅ Payment confirmed, QR code created:', result.qrCode);
      alert('Payment confirmed successfully! QR code generated.');
      fetchTransactions();
    } catch (error) {
      console.error('[Payments Page] ❌ Error confirming payment:', error);
      alert('Error confirming payment: ' + error.message);
    }
  }

  const cancelTransaction = async (transactionId) => {
    if (!confirm('Are you sure you want to cancel this transaction?')) return

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', transactionId)

      if (error) throw error
      fetchTransactions()
    } catch (error) {
      alert('Error cancelling transaction: ' + error.message)
    }
  }

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>Payment Confirmation</h2>
          <p>View and confirm customer payments</p>
        </div>

        <div className="action-bar">
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('pending')}
            >
              ⏳ Pending
            </button>
            <button
              className={`btn ${filter === 'confirmed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('confirmed')}
            >
              ✓ Confirmed
            </button>
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              📋 All
            </button>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <h3>No transactions found</h3>
            <p>No {filter !== 'all' ? filter : ''} transactions at the moment</p>
          </div>
        ) : filter === 'pending' ? (
          <div className="grid-2">
            {transactions.map((trans) => (
              <div key={trans.id} className="card" style={{ borderLeft: '4px solid #ffc107' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span className="status-badge status-pending">Pending</span>
                    <span style={{ fontSize: '0.85em', color: '#666' }}>
                      {new Date(trans.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <p style={{ margin: '5px 0' }}><strong>Customer:</strong> {trans.users?.email || 'Unknown'}</p>
                    <p style={{ margin: '5px 0' }}><strong>Product:</strong> {trans.products?.name || 'N/A'}</p>
                    <p style={{ margin: '5px 0', fontSize: '1.3em', color: '#667eea' }}>
                      <strong>Amount: R {trans.amount}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-success"
                      style={{ flex: 1 }}
                      onClick={() => confirmPayment(trans.id)}
                    >
                      ✓ Confirm Payment
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => cancelTransaction(trans.id)}
                    >
                      ✗ Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Confirmed By</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((trans) => (
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
                      <td>
                        {trans.confirmed_at 
                          ? new Date(trans.confirmed_at).toLocaleDateString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3>💡 How It Works</h3>
          </div>
          <div className="card-body">
            <ol style={{ lineHeight: '1.8' }}>
              <li>Customer creates a transaction from their app</li>
              <li>Transaction appears here with "Pending" status</li>
              <li>Verify the customer's payment (cash, card, etc.)</li>
              <li>Click "Confirm Payment" to approve</li>
              <li>System automatically generates a QR code for the customer</li>
              <li>Customer can use the QR code for entry/service</li>
            </ol>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
