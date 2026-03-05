import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import DashboardLayout from '../../components/DashboardLayout'
import '../owner/Pages.css'

export default function OrdersPage() {
  const { user, userProfile } = useAuth()
  const { cartItems, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartCount } = useCart()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [deleting, setDeleting] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [filter])

  // Handle Stripe redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const canceled = urlParams.get('canceled')
    
    if (success === 'true') {
      clearCart()
      alert('🎉 Payment successful! Your order has been confirmed.')
      // Clean URL
      window.history.replaceState({}, '', '/customer/orders')
      fetchTransactions()
    } else if (canceled === 'true') {
      alert('Payment was cancelled. Your cart is still available.')
      // Clean URL
      window.history.replaceState({}, '', '/customer/orders')
    }
  }, [])

  const fetchTransactions = async () => {
    try {
      let query = supabase
        .from('transactions')
        .select('*, products(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (filter === 'all') {
        // Exclude cancelled orders from 'all' view
        query = query.in('status', ['pending', 'confirmed'])
      } else if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'confirmed': return '✓'
      case 'cancelled': return '✗'
      default: return '📋'
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'event_entry': return '🎉 Event Entry'
      case 'product_purchase': return '🍹 Product Purchase'
      default: return type
    }
  }

  const deleteOrder = async (orderId, currentStatus) => {
    if (currentStatus !== 'pending') {
      alert('Only pending orders can be cancelled')
      return
    }

    if (!confirm('Are you sure you want to cancel this order?')) {
      return
    }

    setDeleting(true)
    try {
      // Soft delete: Mark as cancelled instead of deleting
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('user_id', user.id) // Security: only cancel own orders
        .eq('status', 'pending') // Only cancel if still pending

      if (error) throw error

      // Refresh the list
      await fetchTransactions()
      alert('Order cancelled successfully')
    } catch (error) {
      console.error('Error cancelling order:', error)
      alert('Failed to cancel order: ' + error.message)
    } finally {
      setDeleting(false)
    }
  }

  const clearAllOrders = async () => {
    const pendingOrders = transactions.filter(t => t.status === 'pending')
    
    if (pendingOrders.length === 0) {
      alert('No pending orders to cancel')
      return
    }

    if (!confirm(`Are you sure you want to cancel ${pendingOrders.length} pending order(s)? This cannot be undone!`)) {
      return
    }

    setDeleting(true)
    try {
      // Soft delete: Mark all pending orders as cancelled
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id) // Cancel orders for this user
        .eq('status', 'pending') // Only cancel pending orders

      if (error) throw error

      // Refresh the list
      await fetchTransactions()
      alert(`${pendingOrders.length} pending order(s) cancelled successfully`)
    } catch (error) {
      console.error('Error cancelling orders:', error)
      alert('Failed to cancel orders: ' + error.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      alert('Your cart is empty!')
      return
    }

    setProcessing(true)

    try {
      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('You must be logged in to checkout')
      }

      console.log('🔐 Session token present:', !!session.access_token)
      console.log('🔐 Token preview:', session.access_token ? `${session.access_token.substring(0, 20)}...` : 'NONE')
      console.log('🔐 User ID:', user.id)
      console.log('🔐 Tenant ID:', userProfile.tenant_id)

      // Call Supabase Edge Function to create Stripe Checkout Session
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'create-checkout-session',
        {
          body: {
            cartItems,
            totalAmount: getCartTotal(),
            userId: user.id,
            tenantId: userProfile.tenant_id,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      console.log('📦 Function response:', { functionData, functionError })

      if (functionError) {
        console.error('❌ Function error details:', functionError)
        console.error('❌ Function error message:', functionError.message)
        console.error('❌ Function error context:', functionError.context)
        console.error('❌ Function data (error details):', functionData)
        
        // Extract detailed error message
        const errorMsg = functionData?.error || functionData?.message || functionData?.hint || functionError.message || 'Failed to create checkout session'
        const errorHint = functionData?.hint ? `\n${functionData.hint}` : ''
        
        throw new Error(errorMsg + errorHint)
      }

      if (!functionData?.sessionId) {
        console.error('No sessionId in response:', functionData)
        throw new Error('No session ID returned from server')
      }

      // Redirect to Stripe Checkout using the session URL (modern approach)
      if (functionData.url) {
        window.location.href = functionData.url
      } else {
        throw new Error('No checkout URL returned from server')
      }
      
      // Note: Cart will be cleared by webhook after successful payment
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Error starting checkout: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  const totalSpent = transactions
    .filter(t => t.status === 'confirmed')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  const pendingAmount = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header" style={{ marginBottom: '30px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '2em' }}>📦 My Orders</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '1.05em' }}>Track and manage your order history</p>
          </div>
        </div>

        {/* Cart Section */}
        {cartItems.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '30px',
            color: 'white',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.5em' }}>🛒 Your Cart</h3>
              <button
                onClick={clearCart}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#667eea',
                  background: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🗑️ Clear Cart
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              {cartItems.map((item, index) => (
                <div
                  key={`${item.id}-${item.type}-${index}`}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                        {item.type === 'event' ? '🎉' : item.productType === 'drink' ? '🍸' : '🍕'} {item.name}
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.9 }}>
                        R{item.price.toFixed(2)} each
                      </div>
                      {item.type === 'event' && item.date && (
                        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                          📅 {new Date(item.date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id, item.type)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      🗑️
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => updateQuantity(item.id, item.type, item.quantity - 1)}
                        style={{
                          width: '32px',
                          height: '32px',
                          border: 'none',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          fontSize: '18px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: '16px', fontWeight: '600', minWidth: '30px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.type, item.quantity + 1)}
                        style={{
                          width: '32px',
                          height: '32px',
                          border: 'none',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          fontSize: '18px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '700' }}>
                      R{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '20px',
              borderTop: '2px solid rgba(255, 255, 255, 0.3)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>
                Total ({getCartCount()} items):
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>
                R{getCartTotal().toFixed(2)}
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={processing}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                fontWeight: '700',
                color: '#667eea',
                background: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: processing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: processing ? 0.6 : 1
              }}
            >
              {processing ? '⏳ Processing...' : `💳 Pay with Stripe - R${getCartTotal().toFixed(2)}`}
            </button>
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '14px', opacity: 0.9 }}>
              🔒 Secure payment powered by Stripe
            </div>
          </div>
        )}

        {/* Order History Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.5em', margin: '0 0 8px 0' }}>📋 Order History</h3>
          <p style={{ color: '#666', margin: 0 }}>View your past and pending orders</p>
        </div>

        <div className="stats-grid" style={{ marginBottom: '30px' }}>
          <div className="stat-card" style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '12px',
            padding: '25px'
          }}>
            <div className="stat-value" style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '8px' }}>
              R {totalSpent.toFixed(2)}
            </div>
            <div className="stat-label" style={{ fontSize: '0.95em', opacity: 0.9 }}>💰 Total Spent</div>
          </div>
          <div className="stat-card" style={{ 
            background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
            color: 'white',
            borderRadius: '12px',
            padding: '25px'
          }}>
            <div className="stat-value" style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '8px' }}>
              {transactions.filter(t => t.status === 'confirmed').length}
            </div>
            <div className="stat-label" style={{ fontSize: '0.95em', opacity: 0.9 }}>✓ Completed Orders</div>
          </div>
          <div className="stat-card" style={{ 
            background: 'linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)',
            color: 'white',
            borderRadius: '12px',
            padding: '25px'
          }}>
            <div className="stat-value" style={{ fontSize: '2em', fontWeight: 'bold', marginBottom: '8px' }}>
              R {pendingAmount.toFixed(2)}
            </div>
            <div className="stat-label" style={{ fontSize: '0.95em', opacity: 0.9 }}>⏳ Pending Payments</div>
          </div>
        </div>

        <div className="action-bar" style={{ 
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          marginBottom: '25px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('all')}
                style={{
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                📋 All Orders
              </button>
              <button
                className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('pending')}
                style={{
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                ⏳ Pending
              </button>
              <button
                className={`btn ${filter === 'confirmed' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('confirmed')}
                style={{
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                ✓ Confirmed
              </button>
              <button
                className={`btn ${filter === 'cancelled' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter('cancelled')}
                style={{
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                ✗ Cancelled
              </button>
            </div>
            {transactions.filter(t => t.status === 'pending').length > 0 && (
              <button
                className="btn btn-danger"
                onClick={clearAllOrders}
                disabled={deleting}
                style={{ 
                  background: '#e53e3e', 
                  color: 'white',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '500',
                  border: 'none',
                  boxShadow: '0 2px 6px rgba(229,62,62,0.3)'
                }}
              >
                🗑️ Cancel All Pending
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '3em', marginBottom: '15px' }}>⏳</div>
            <p style={{ color: '#666', fontSize: '1.1em' }}>Loading your orders...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state" style={{
            textAlign: 'center',
            padding: '80px 20px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div className="empty-state-icon" style={{ fontSize: '5em', marginBottom: '20px' }}>🛒</div>
            <h3 style={{ fontSize: '1.5em', marginBottom: '10px', color: '#333' }}>No Orders Yet</h3>
            <p style={{ color: '#666', fontSize: '1.05em' }}>Start ordering from the menu or buy event tickets!</p>
          </div>
        ) : (
          <div className="card" style={{
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: 'none'
          }}>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr style={{ background: '#f7fafc' }}>
                      <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>Type</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>Item</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>Qty</th>
                      <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>Amount</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#4a5568', borderBottom: '2px solid #e2e8f0' }}>Action</th>
                    </tr>
                  </thead>
                <tbody>
                  {transactions.map((trans) => (
                    <tr key={trans.id} style={{
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background 0.2s',
                      cursor: 'default'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '16px' }}>{getTypeLabel(trans.type)}</td>
                      <td style={{ padding: '16px', fontWeight: '500', color: '#2d3748' }}>
                        {trans.products?.name || trans.metadata?.event_name || trans.metadata?.product_name || 'N/A'}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <strong style={{ 
                          background: '#edf2f7',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontSize: '0.95em'
                        }}>
                          {trans.metadata?.quantity || 1}
                        </strong>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.05em', color: '#2d3748' }}>R {trans.amount}</strong>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span className={`status-badge status-${trans.status}`} style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '0.85em',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {getStatusIcon(trans.status)} {trans.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px', color: '#718096' }}>
                        {new Date(trans.created_at).toLocaleDateString('en-ZA', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <button
                          className="btn btn-danger"
                          onClick={() => deleteOrder(trans.id, trans.status)}
                          disabled={deleting || trans.status !== 'pending'}
                          style={{ 
                            padding: '8px 16px', 
                            fontSize: '0.9em',
                            background: trans.status !== 'pending' ? '#edf2f7' : '#fee5e5',
                            color: trans.status !== 'pending' ? '#a0aec0' : '#e53e3e',
                            border: '1px solid ' + (trans.status !== 'pending' ? '#e2e8f0' : '#fc8181'),
                            cursor: trans.status !== 'pending' ? 'not-allowed' : 'pointer',
                            borderRadius: '6px',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                        >
                          {trans.status === 'cancelled' ? '✓ Cancelled' : trans.status === 'confirmed' ? '✓ Confirmed' : '✗ Cancel'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {transactions.filter(t => t.status === 'pending').length > 0 && (
          <div className="card" style={{ 
            borderLeft: '4px solid #f6ad55',
            borderRadius: '12px',
            marginTop: '25px',
            background: 'linear-gradient(to right, #fefcf5, white)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div className="card-header" style={{ 
              padding: '20px',
              borderBottom: '1px solid #feebc8'
            }}>
              <h3 style={{ margin: 0, color: '#c05621', fontSize: '1.2em' }}>
                ⚠️ Pending Payments
              </h3>
            </div>
            <div className="card-body" style={{ padding: '20px' }}>
              <p style={{ 
                margin: '0 0 12px 0', 
                fontSize: '1.05em',
                color: '#4a5568'
              }}>
                You have <strong style={{ color: '#c05621' }}>{transactions.filter(t => t.status === 'pending').length}</strong> pending payment(s) 
                totaling <strong style={{ color: '#c05621' }}>R {pendingAmount.toFixed(2)}</strong>.
              </p>
              <p style={{ 
                margin: 0,
                color: '#718096',
                fontSize: '0.95em'
              }}>
                💡 Please visit the counter to complete your payment and receive your QR code(s).
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
