/**
 * Products Page - Customer View
 * Browse and purchase products, specials, and admission
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../supabaseClient';
import DashboardLayout from '../../components/DashboardLayout';
import FloatingCartButton from '../../components/FloatingCartButton';
import Toast from '../../components/Toast';

const ProductsPage = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { addToCart } = useCart(); // Cart context for adding items
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, drinks, food, specials
  const [toast, setToast] = useState(null);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchProducts();
  }, [userProfile]);

  const fetchProducts = async () => {
    if (!userProfile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('available', true)
        .order('is_special', { ascending: false })
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setToast({ type: 'error', message: 'Failed to load products' });
    } finally {
      setLoading(false);
    }
  };

  // Get quantity for a product (default 1)
  const getQuantity = (productId) => quantities[productId] || 1;

  // Update quantity for a product
  const updateQuantity = (productId, change) => {
    const currentQty = getQuantity(productId);
    const newQty = Math.max(1, Math.min(99, currentQty + change));
    setQuantities({ ...quantities, [productId]: newQty });
  };

  const addItemToCart = (product) => {
    const quantity = getQuantity(product.id);
    
    // Add item to cart with specified quantity
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      type: 'product',
      productType: product.type
    }, quantity);
    
    // Show success toast
    setToast({ 
      type: 'success', 
      message: `${quantity}x ${product.name} added to cart!` 
    });
    
    // Reset quantity to 1
    setQuantities({ ...quantities, [product.id]: 1 });
  };

  // Render quantity selector component
  const renderQuantitySelector = (product) => {
    const quantity = getQuantity(product.id);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>
          ${parseFloat(product.price).toFixed(2)}
        </span>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          background: '#f7fafc',
          padding: '8px',
          borderRadius: '8px'
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateQuantity(product.id, -1);
            }}
            disabled={quantity <= 1}
            style={{
              width: '28px',
              height: '28px',
              fontSize: '16px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              cursor: quantity > 1 ? 'pointer' : 'not-allowed',
              background: '#fff',
              color: '#667eea',
              opacity: quantity <= 1 ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            −
          </button>
          
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            minWidth: '50px',
            textAlign: 'center',
            color: '#4a5568'
          }}>
            Qty {quantity}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateQuantity(product.id, 1);
            }}
            disabled={quantity >= 99}
            style={{
              width: '28px',
              height: '28px',
              fontSize: '16px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '6px',
              cursor: quantity < 99 ? 'pointer' : 'not-allowed',
              background: '#fff',
              color: '#667eea',
              opacity: quantity >= 99 ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            +
          </button>
          
          <button
            onClick={() => addItemToCart(product)}
            style={{
              padding: '6px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
              background: '#667eea',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: 1
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    );
  };

  const filteredProducts = products.filter(product => {
    if (filter === 'all') return true;
    if (filter === 'specials') return product.is_special;
    if (filter === 'drinks') return product.type === 'drink';
    if (filter === 'food') return product.type === 'food';
    return true;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading products...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '10px' }}>Products & Specials</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Browse and purchase admission, drinks, and food items
        </p>

      {/* Filter buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap' 
      }}>
        {['all', 'specials', 'drinks', 'food'].map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              background: filter === filterType ? '#667eea' : '#f7fafc',
              color: filter === filterType ? '#fff' : '#4a5568',
              transition: 'all 0.2s'
            }}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      {/* Products grid */}
      {filteredProducts.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: '#f7fafc',
          borderRadius: '12px'
        }}>
          <p style={{ fontSize: '18px', color: '#666' }}>
            No products available at the moment
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px'
          }}
        >
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
              }}
            >
              {/* Special badge */}
              {product.is_special && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: '#f6ad55',
                    color: '#fff',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    zIndex: 1
                  }}
                >
                  Special
                </div>
              )}

              {/* Product image */}
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={{
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '200px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '48px'
                  }}
                >
                  {product.type === 'drink' ? '🍹' : '🍔'}
                </div>
              )}

              {/* Product details */}
              <div style={{ padding: '16px' }}>
                <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>
                  {product.name}
                </h3>

                <div
                  style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    borderRadius: '6px',
                    background: product.type === 'drink' ? '#bee3f8' : '#fbd38d',
                    color: product.type === 'drink' ? '#2c5282' : '#7c2d12',
                    marginBottom: '12px'
                  }}
                >
                  {product.type}
                </div>

                {product.description && (
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#666',
                      marginBottom: '16px',
                      lineHeight: '1.5'
                    }}
                  >
                    {product.description}
                  </p>
                )}

                <div style={{ marginTop: '16px' }}>
                  {renderQuantitySelector(product)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div
        style={{
          marginTop: '40px',
          padding: '20px',
          background: '#edf2f7',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#4a5568'
        }}
      >
        <p style={{ margin: 0 }}>
          💡 <strong>How it works:</strong> Click "Add to Cart" to add items to your cart. 
          Review your cart and click "Checkout" to create pending transactions.
          Once staff confirms your payment, you'll receive a QR code for entry. 
          View your purchases and QR codes in "My Purchases" page.
        </p>
      </div>
      </div>
      <FloatingCartButton onClick={() => navigate('/customer/orders')} />
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
};

export default ProductsPage;
