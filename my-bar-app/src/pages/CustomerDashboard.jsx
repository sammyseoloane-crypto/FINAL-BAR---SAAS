import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import PlanBadge from '../components/PlanBadge';
import './Dashboard.css';

export default function CustomerDashboard() {
  const { userProfile, signOut } = useAuth();
  const { getCartCount } = useCart();
  const navigate = useNavigate();
  const cartCount = getCartCount();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>🍺 Bar SaaS</h1>
          <span className="role-badge role-customer">Customer</span>
          <PlanBadge />
        </div>
        <button onClick={handleSignOut} className="btn-signout">
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Welcome Back!</h2>
          <p>Hello, {userProfile?.email}! Ready to order?</p>
          {userProfile?.tenant_name && <p className="company-name">📍 {userProfile.tenant_name}</p>}
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">🍺</div>
            <h3>Browse Menu</h3>
            <p>View available drinks and food</p>
            <button className="btn-card" onClick={() => navigate('/customer/products')}>
              View Menu
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon" style={{ position: 'relative' }}>
              🛒
              {cartCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: '#f56565',
                    color: 'white',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  {cartCount}
                </span>
              )}
            </div>
            <h3>My Cart</h3>
            <p>View and checkout your cart{cartCount > 0 ? ` (${cartCount} items)` : ''}</p>
            <button
              className="btn-card"
              onClick={() => navigate('/customer/orders')}
              style={{
                background: cartCount > 0 ? '#d4af37' : undefined,
                color: cartCount > 0 ? 'white' : undefined,
              }}
            >
              {cartCount > 0 ? 'Checkout Now' : 'View Cart'}
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎉</div>
            <h3>Events</h3>
            <p>Check out upcoming bar events</p>
            <button className="btn-card" onClick={() => navigate('/customer/events')}>
              View Events
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🪑</div>
            <h3>Table Reservations</h3>
            <p>Book VIP tables for events</p>
            <button className="btn-card" onClick={() => navigate('/customer/tables')}>
              Reserve Table
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <h3>Guest Lists</h3>
            <p>Join event guest lists</p>
            <button className="btn-card" onClick={() => navigate('/customer/guest-lists')}>
              View Lists
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>My Purchases</h3>
            <p>View your transaction history</p>
            <button className="btn-card" onClick={() => navigate('/customer/purchases')}>
              View Purchases
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🍸</div>
            <h3>My Bar Tab</h3>
            <p>Open or view your current bar tab</p>
            <button className="btn-card" onClick={() => navigate('/tab/view')}>
              View Tab
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📱</div>
            <h3>QR Codes</h3>
            <p>View your payment QR codes</p>
            <button className="btn-card" onClick={() => navigate('/customer/qrcodes')}>
              View QR Codes
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⭐</div>
            <h3>Loyalty Rewards</h3>
            <p>Track points and redeem rewards</p>
            <button className="btn-card" onClick={() => navigate('/customer/loyalty')}>
              View Rewards
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">👤</div>
            <h3>My Profile</h3>
            <p>Update your profile information</p>
            <button className="btn-card" onClick={() => navigate('/customer/profile')}>
              View Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
