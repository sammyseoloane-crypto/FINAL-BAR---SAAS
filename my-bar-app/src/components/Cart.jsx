import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import './Cart.css'

export default function Cart({ isOpen, onClose }) {
  const { user, userProfile } = useAuth()
  const { cartItems, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartCount } = useCart()
  const [processing, setProcessing] = useState(false)
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      alert('Your cart is empty!')
      return
    }

    setProcessing(true)

    try {
      // Create transactions for all cart items
      const transactions = cartItems.map(item => {
        const baseTransaction = {
          user_id: user.id,
          tenant_id: userProfile.tenant_id,
          amount: item.price * item.quantity,
          status: 'pending'
        }

        if (item.type === 'event') {
          return {
            ...baseTransaction,
            type: 'event_entry',
            metadata: {
              event_id: item.id,
              event_name: item.name,
              event_date: item.date,
              quantity: item.quantity
            }
          }
        } else {
          return {
            ...baseTransaction,
            product_id: item.id,
            type: 'product_purchase',
            metadata: {
              product_name: item.name,
              product_type: item.productType,
              quantity: item.quantity
            }
          }
        }
      })

      const { error } = await supabase
        .from('transactions')
        .insert(transactions)

      if (error) throw error

      const total = getCartTotal()
      alert(`Order placed for R${total.toFixed(2)}! Please pay at the counter to complete your order.`)
      
      clearCart()
      onClose()
      navigate('/customer/orders')
    } catch (error) {
      alert('Error processing checkout: ' + error.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <div className="cart-overlay" onClick={onClose}></div>
      <div className="cart-sidebar">
        <div className="cart-header">
          <h2>🛒 Your Cart</h2>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        <div className="cart-body">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">🛍️</div>
              <p>Your cart is empty</p>
              <small>Add items from the menu or events</small>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cartItems.map((item, index) => (
                  <div key={`${item.id}-${item.type}-${index}`} className="cart-item">
                    <div className="cart-item-header">
                      <div className="cart-item-name">
                        {item.type === 'event' ? '🎉' : item.productType === 'drink' ? '🍸' : '🍕'} {item.name}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id, item.type)}
                        className="remove-btn"
                        title="Remove from cart"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="cart-item-price">R{item.price.toFixed(2)} each</div>
                    {item.type === 'event' && item.date && (
                      <div className="cart-item-date">
                        📅 {new Date(item.date).toLocaleDateString()}
                      </div>
                    )}
                    <div className="cart-item-footer">
                      <div className="quantity-controls">
                        <button
                          onClick={() => updateQuantity(item.id, item.type, item.quantity - 1)}
                          className="qty-btn"
                        >
                          −
                        </button>
                        <span className="quantity">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.type, item.quantity + 1)}
                          className="qty-btn"
                        >
                          +
                        </button>
                      </div>
                      <div className="cart-item-total">
                        R{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-summary">
                <div className="cart-total">
                  <span>Total ({getCartCount()} items):</span>
                  <strong>R{getCartTotal().toFixed(2)}</strong>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="cart-footer">
          {cartItems.length > 0 && (
            <>
              <button
                className="btn btn-secondary"
                onClick={clearCart}
                disabled={processing}
                style={{ marginBottom: '10px', width: '100%' }}
              >
                🗑️ Clear All Items
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCheckout}
                disabled={processing}
              >
                {processing ? 'Processing...' : `Checkout - R${getCartTotal().toFixed(2)}`}
              </button>
              <small style={{ display: 'block', textAlign: 'center', marginTop: '10px', color: '#666' }}>
                Pay at the counter to complete your order
              </small>
            </>
          )}
        </div>
      </div>
    </>
  )
}
