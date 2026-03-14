import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import DashboardLayout from '../../components/DashboardLayout';
import FloatingCartButton from '../../components/FloatingCartButton';
import Toast from '../../components/Toast';
import '../owner/Pages.css';

export default function MenuPage() {
  const { userProfile } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('available', true)
        .order('name');

      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuantity = (productId) => quantities[productId] || 1;

  const updateQuantity = (productId, change) => {
    setQuantities((prev) => {
      const current = prev[productId] || 1;
      const newQty = Math.max(1, Math.min(99, current + change));
      return { ...prev, [productId]: newQty };
    });
  };

  const renderQuantitySelector = (product) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '1.4em', color: '#d4af37', fontWeight: 'bold' }}>
        R {product.price}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: '#f7fafc',
            borderRadius: '6px',
            padding: '2px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => updateQuantity(product.id, -1)}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              fontSize: '1em',
              fontWeight: 'bold',
              color: '#d4af37',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            −
          </button>
          <span
            style={{
              minWidth: '35px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '0.8em',
              color: '#4a5568',
              flexShrink: 0,
            }}
          >
            Qty {getQuantity(product.id)}
          </span>
          <button
            onClick={() => updateQuantity(product.id, 1)}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              fontSize: '1em',
              fontWeight: 'bold',
              color: '#d4af37',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => addItemToCart(product)}
          style={{
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          + ADD
        </button>
      </div>
    </div>
  );

  const addItemToCart = (product) => {
    const qty = getQuantity(product.id);
    // Add item to cart with specified quantity
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        type: 'product',
        productType: product.type,
      },
      qty,
    );

    // Reset quantity and show success toast
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
    setToast({
      type: 'success',
      message: `${qty}x ${product.name} added to cart!`,
    });
  };

  const drinks = products.filter((p) => p.type === 'drink');
  const food = products.filter((p) => p.type === 'food');

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>🍹 Bar Menu</h2>
          <p>Browse our drinks and food selection</p>
        </div>

        <div className="action-bar">
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
              style={{ padding: '10px 16px', fontSize: '0.9em' }}
            >
              📋 ALL ITEMS
            </button>
            <button
              className={`btn ${filter === 'drink' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('drink')}
              style={{ padding: '10px 16px', fontSize: '0.9em' }}
            >
              🍸 DRINKS
            </button>
            <button
              className={`btn ${filter === 'food' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('food')}
              style={{ padding: '10px 16px', fontSize: '0.9em' }}
            >
              🍕 FOOD
            </button>
          </div>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🍽️</div>
            <h3>No Items Available</h3>
            <p>Check back soon for menu updates</p>
          </div>
        ) : filter === 'all' ? (
          <>
            {drinks.length > 0 && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#d4af37' }}>
                  🍸 Drinks
                </h3>
                <div className="grid-3">
                  {drinks.map((product) => (
                    <div key={product.id} className="card hover-card">
                      <div className="card-body">
                        <h4 style={{ margin: '0 0 10px 0' }}>{product.name}</h4>
                        {product.description && (
                          <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '15px' }}>
                            {product.description}
                          </p>
                        )}
                        {renderQuantitySelector(product)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {food.length > 0 && (
              <>
                <h3 style={{ marginTop: '30px', marginBottom: '15px', color: '#d4af37' }}>
                  🍕 Food
                </h3>
                <div className="grid-3">
                  {food.map((product) => (
                    <div key={product.id} className="card hover-card">
                      <div className="card-body">
                        <h4 style={{ margin: '0 0 10px 0' }}>{product.name}</h4>
                        {product.description && (
                          <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '15px' }}>
                            {product.description}
                          </p>
                        )}
                        {renderQuantitySelector(product)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="grid-3">
            {products.map((product) => (
              <div key={product.id} className="card hover-card">
                <div className="card-body">
                  <h4 style={{ margin: '0 0 10px 0' }}>{product.name}</h4>
                  {product.description && (
                    <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '15px' }}>
                      {product.description}
                    </p>
                  )}
                  {renderQuantitySelector(product)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: '30px' }}>
          <div className="card-header">
            <h3>💡 How to Order</h3>
          </div>
          <div className="card-body">
            <ol style={{ lineHeight: '1.8' }}>
              <li>Browse the menu and click &quot;Add to Cart&quot; on items you want</li>
              <li>Review your cart and click &quot;Checkout&quot;</li>
              <li>Go to the counter with your order details</li>
              <li>Make payment to staff</li>
              <li>Staff will confirm your order and prepare it</li>
              <li>View your order history in &quot;My Orders&quot;</li>
            </ol>
          </div>
        </div>
      </div>
      <FloatingCartButton onClick={() => navigate('/customer/orders')} />
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
