import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import DashboardLayout from '../../components/DashboardLayout';
import FloatingCartButton from '../../components/FloatingCartButton';
import Toast from '../../components/Toast';
import '../owner/Pages.css';

export default function EventsListPage() {
  const { userProfile } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, locations!location_id(name)')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('active', true)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuantity = (eventId) => quantities[eventId] || 1;

  const updateQuantity = (eventId, change) => {
    setQuantities((prev) => {
      const current = prev[eventId] || 1;
      const newQty = Math.max(1, Math.min(99, current + change));
      return { ...prev, [eventId]: newQty };
    });
  };

  const addEventToCart = (event) => {
    const qty = getQuantity(event.id);
    // Add item to cart with specified quantity
    addToCart(
      {
        id: event.id,
        name: event.name,
        price: event.entry_fee,
        type: 'event',
        date: event.date,
      },
      qty,
    );

    // Reset quantity and show success toast
    setQuantities((prev) => ({ ...prev, [event.id]: 1 }));
    setToast({
      type: 'success',
      message: `${qty}x ${event.name} entry added to cart!`,
    });
  };

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>🎉 Upcoming Events</h2>
          <p>Browse and purchase entry to upcoming events</p>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎪</div>
            <h3>No Upcoming Events</h3>
            <p>Check back soon for exciting events!</p>
          </div>
        ) : (
          <div className="grid-2">
            {events.map((event) => (
              <div key={event.id} className="card hover-card">
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', height: '320px' }}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '15px',
                      }}
                    >
                      <h3 style={{ margin: 0, color: '#d4af37' }}>{event.name}</h3>
                      <span className="status-badge status-completed">Active</span>
                    </div>

                    {event.description && (
                      <p style={{ color: '#666', marginBottom: '15px' }}>{event.description}</p>
                    )}

                    <div style={{ marginBottom: '15px' }}>
                      <p
                        style={{
                          margin: '8px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span>📅</span>
                        <strong>
                          {new Date(event.date).toLocaleDateString('en-ZA', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </strong>
                      </p>
                      <p
                        style={{
                          margin: '8px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span>📍</span>
                        <span>{event.locations?.name || 'Location TBA'}</span>
                      </p>
                      <p
                        style={{
                          margin: '8px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span>💰</span>
                        <span style={{ fontSize: '1.3em', color: '#d4af37' }}>
                          <strong>R {event.entry_fee}</strong>
                        </span>
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#f7fafc',
                        borderRadius: '6px',
                        padding: '4px',
                      }}
                    >
                      <button
                        onClick={() => updateQuantity(event.id, -1)}
                        style={{
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          width: '28px',
                          height: '28px',
                          cursor: 'pointer',
                          fontSize: '1.1em',
                          fontWeight: 'bold',
                          color: '#d4af37',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          minWidth: '40px',
                          textAlign: 'center',
                          fontWeight: '600',
                          fontSize: '0.9em',
                          color: '#4a5568',
                        }}
                      >
                        Qty {getQuantity(event.id)}
                      </span>
                      <button
                        onClick={() => updateQuantity(event.id, 1)}
                        style={{
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          width: '28px',
                          height: '28px',
                          cursor: 'pointer',
                          fontSize: '1.1em',
                          fontWeight: 'bold',
                          color: '#d4af37',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => addEventToCart(event)}
                    >
                      🛒 Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3>ℹ️ How to Attend</h3>
          </div>
          <div className="card-body">
            <ol style={{ lineHeight: '1.8' }}>
              <li>Click "Add to Cart" on your desired event</li>
              <li>Review your cart and click "Checkout"</li>
              <li>Go to the counter and pay the entry fee</li>
              <li>Staff will confirm your payment</li>
              <li>You'll receive a QR code in "My QR Codes"</li>
              <li>Show your QR code at the entrance</li>
            </ol>
          </div>
        </div>
      </div>
      <FloatingCartButton onClick={() => navigate('/customer/orders')} />
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
