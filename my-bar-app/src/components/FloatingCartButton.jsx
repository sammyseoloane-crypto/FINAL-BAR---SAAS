import { useCart } from '../contexts/CartContext'
import './FloatingCartButton.css'

export default function FloatingCartButton({ onClick }) {
  const { getCartCount } = useCart()
  const count = getCartCount()

  return (
    <button className="floating-cart-button" onClick={onClick}>
      <span className="cart-icon">🛒</span>
      {count > 0 && <span className="cart-badge">{count}</span>}
    </button>
  )
}
