import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import '../owner/Pages.css';
import './POSPage.css';

export default function POSPage() {
  const { user, userProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [customerNote, setCustomerNote] = useState('');

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw error;
      }

      setProducts(data || []);

      // Extract unique categories
      const uniqueCategories = [...new Set(data.map((p) => p.type || 'other'))];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Error loading products:', err);
      alert(`Failed to load products: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product) {
    const existingItem = cart.find((item) => item.id === product.id);

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  }

  function updateQuantity(productId, newQuantity) {
    if (newQuantity === 0) {
      setCart(cart.filter((item) => item.id !== productId));
    } else {
      setCart(cart.map((item) => (item.id === productId ? { ...item, quantity: newQuantity } : item)));
    }
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
    setCustomerNote('');
  }

  function calculateTotal() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountAmount = subtotal * (discount / 100);
    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  }

  async function processOrder() {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }

    setProcessing(true);

    try {
      const { subtotal, discountAmount, total } = calculateTotal();

      // Create transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          tenant_id: userProfile.tenant_id,
          amount: total,
          status: paymentMethod === 'bar_tab' ? 'pending' : 'confirmed',
          payment_method: paymentMethod,
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
          metadata: {
            cart_items: cart,
            subtotal,
            discount_percentage: discount,
            discount_amount: discountAmount,
            payment_method: paymentMethod,
            customer_note: customerNote,
            pos_transaction: true,
          },
        })
        .select()
        .single();

      if (txError) {
        throw txError;
      }

      // Create order records for each item
      const orderPromises = cart.map((item) =>
        supabase.from('orders').insert({
          user_id: user.id,
          tenant_id: userProfile.tenant_id,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
          amount: item.price * item.quantity,
          status: 'completed',
          metadata: {
            transaction_id: transaction.id,
            payment_method: paymentMethod,
          },
        }),
      );

      await Promise.all(orderPromises);

      // Create stock movements
      const stockPromises = cart.map(async (item) => {
        // Get current inventory
        const { data: inventory } = await supabase
          .from('inventory')
          .select('id, current_stock')
          .eq('product_id', item.id)
          .eq('tenant_id', userProfile.tenant_id)
          .single();

        if (inventory) {
          // Update inventory
          const newStock = Math.max(0, inventory.current_stock - item.quantity);
          await supabase
            .from('inventory')
            .update({ current_stock: newStock })
            .eq('id', inventory.id);

          // Log stock movement
          await supabase.from('stock_movements').insert({
            tenant_id: userProfile.tenant_id,
            inventory_id: inventory.id,
            product_id: item.id,
            movement_type: 'sale',
            quantity: -item.quantity,
            previous_stock: inventory.current_stock,
            new_stock: newStock,
            reference_type: 'transaction',
            reference_id: transaction.id,
            performed_by: user.id,
            reason: `POS sale - Transaction #${transaction.id}`,
          });
        }
      });

      await Promise.all(stockPromises);

      alert(`✅ Order completed! Total: R${total.toFixed(2)}`);
      clearCart();
    } catch (error) {
      console.error('Error processing order:', error);
      alert(`Failed to process order: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.type === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const { subtotal, discountAmount, total } = calculateTotal();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="pos-loading">
          <p>Loading POS...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="pos-container">
        {/* Left Panel: Products */}
        <div className="pos-products-panel">
          {/* Search Bar */}
          <div className="pos-search">
            <input
              type="text"
              placeholder="🔍 Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pos-search-input"
            />
          </div>

          {/* Category Filter */}
          <div className="pos-categories">
            <button
              className={`pos-category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={`pos-category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="pos-product-grid">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={addToCart} />
            ))}
            {filteredProducts.length === 0 && (
              <div className="pos-empty-products">
                <p>No products found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Cart & Checkout */}
        <div className="pos-cart-panel">
          <h3 className="pos-cart-title">Current Order</h3>

          {/* Cart Items */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="pos-empty-cart">
                <p>🛒 Cart is empty</p>
                <p className="pos-empty-hint">Tap products to add</p>
              </div>
            ) : (
              cart.map((item) => (
                <CartItem key={item.id} item={item} onUpdateQuantity={updateQuantity} />
              ))
            )}
          </div>

          {/* Customer Note */}
          {cart.length > 0 && (
            <div className="pos-note-section">
              <input
                type="text"
                placeholder="Customer note (optional)"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="pos-note-input"
              />
            </div>
          )}

          {/* Discount */}
          {cart.length > 0 && (
            <div className="pos-discount-section">
              <label>Discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="pos-discount-input"
              />
            </div>
          )}

          {/* Totals */}
          {cart.length > 0 && (
            <div className="pos-totals">
              <div className="pos-total-row">
                <span>Subtotal:</span>
                <span>R{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="pos-total-row pos-discount-row">
                  <span>Discount ({discount}%):</span>
                  <span>-R{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="pos-total-row pos-grand-total">
                <span>TOTAL:</span>
                <span>R{total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Method */}
          {cart.length > 0 && (
            <div className="pos-payment-section">
              <label>Payment Method:</label>
              <div className="pos-payment-grid">
                <button
                  className={`pos-payment-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  💵 Cash
                </button>
                <button
                  className={`pos-payment-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  💳 Card
                </button>
                <button
                  className={`pos-payment-btn ${paymentMethod === 'stripe' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('stripe')}
                >
                  🌐 Stripe
                </button>
                <button
                  className={`pos-payment-btn ${paymentMethod === 'bar_tab' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('bar_tab')}
                >
                  📋 Bar Tab
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pos-actions">
            <button className="pos-btn pos-btn-clear" onClick={clearCart} disabled={cart.length === 0}>
              🗑️ Clear
            </button>
            <button
              className="pos-btn pos-btn-checkout"
              onClick={processOrder}
              disabled={cart.length === 0 || processing}
            >
              {processing ? '⏳ Processing...' : '✅ Complete Order'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <div className="pos-product-card" onClick={() => onAdd(product)}>
      {product.image_url && <img src={product.image_url} alt={product.name} className="pos-product-image" />}
      <div className="pos-product-info">
        <h4 className="pos-product-name">{product.name}</h4>
        <p className="pos-product-price">R{parseFloat(product.price).toFixed(2)}</p>
      </div>
    </div>
  );
}

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    image_url: PropTypes.string,
  }).isRequired,
  onAdd: PropTypes.func.isRequired,
};

function CartItem({ item, onUpdateQuantity }) {
  return (
    <div className="pos-cart-item">
      <div className="pos-cart-item-info">
        <h5>{item.name}</h5>
        <p className="pos-cart-item-price">R{parseFloat(item.price).toFixed(2)}</p>
      </div>
      <div className="pos-cart-item-controls">
        <button
          className="pos-qty-btn"
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
        >
          −
        </button>
        <span className="pos-qty">{item.quantity}</span>
        <button
          className="pos-qty-btn"
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
        >
          +
        </button>
      </div>
      <div className="pos-cart-item-total">R{(item.price * item.quantity).toFixed(2)}</div>
    </div>
  );
}

CartItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    quantity: PropTypes.number.isRequired,
  }).isRequired,
  onUpdateQuantity: PropTypes.func.isRequired,
};
